// 即時發文引擎(Infuz 版) — 參考 luftrum/threads-app/lib/scheduler.js + realtime/*
//
// 差異:
// - luftrum 是 Express 常駐(setInterval), Infuz 走 cron-job.org 外部觸發
// - luftrum 帳號在 config.listAccounts(), Infuz 用單一 connections.main
// - luftrum 排程單位是 realtimeJob, Infuz 存進 Cloudinary `realtime_jobs` DB
//
// 一個 job = {
//   id, name, moduleId ('weather'),
//   config: {
//     locations: ['臺北市', ...],  // 複選,任一達標即觸發
//     minPoP, minMaxT, maxMinT,   // 觸發條件 (OR)
//     prompt, imagePrompt,         // 產文/產圖提示詞
//     productPool: 'female' | 'unisex' | 'all', // 從 products DB 過濾
//     aspectRatio: '4:5' | '1:1' | '9:16',
//   },
//   time: 'HH:MM', days: [0-6] (0=週日), platforms: {threads,instagram,facebook},
//   withImage: bool, enabled: bool,
//   lastRunDate: 'YYYY-MM-DD', lastResult: {at, ok, error, reason, text, imageUrl}
// }
import { loadDb, updateItem } from './infuz-db.js';
import { INFUZ_BRAND } from './infuz-brand.js';
import { callJSON } from './llm.js';
import { submitAndPollV2WithRetry } from './kie-image.js';
import { uploadToCloudinary } from './cloudinary.js';
import * as weather from './infuz-weather.js';

const SCHEDULE_GRACE_MS = 6 * 3600 * 1000;

// ------------------------------------------------------
// 模組:天氣
// ------------------------------------------------------
export const WEATHER_MODULE = {
  id: 'weather',
  label: '氣候即時發文',
  description: '到點抓中央氣象署即時預報(可多縣市),依當下氣溫/降雨產出穿搭建議,選配隨機從產品庫挑一件搭配生圖',
  isReady: () => weather.isConfigured(),

  async shouldFire(config) {
    const locs = normalizeLocations(config);
    if (!locs.length) return { fire: false, reason: '未設定縣市' };

    const snapshots = await Promise.all(locs.map((loc) => weather.snapshot({ location: loc }).catch((e) => ({ error: e.message, location: loc }))));
    const ok = snapshots.filter((s) => !s.error);
    if (!ok.length) return { fire: false, reason: `所有縣市抓氣象失敗: ${snapshots.map((s) => s.error).filter(Boolean).join('; ')}` };

    // 任一縣市達標就 fire
    let fireReasons = [];
    let firedByAny = false;
    for (const snap of ok) {
      const check = weather.checkConditions(snap, config);
      if (check.fire) {
        firedByAny = true;
        fireReasons.push(`${snap.location}: ${check.reason}`);
      }
    }
    if (!firedByAny) {
      return { fire: false, reason: '所有縣市都未達觸發條件', snapshots: ok };
    }
    return { fire: true, reason: fireReasons.join(' / '), snapshots: ok };
  },

  async buildContent({ config, snapshot, snapshots, withImage }) {
    const snaps = snapshots || (snapshot ? [snapshot] : await fetchAllSnapshots(config));
    const weatherText = snaps.map((s) => weather.toPromptText(s)).join('\n\n');

    // 隨機挑 1 個產品 (若 withImage 或用戶想在文案裡帶產品名)
    let picked = null;
    if (withImage || config.mentionProductInText) {
      picked = await pickProduct(config);
    }

    const brand = INFUZ_BRAND;
    const userPrompt = (config.prompt || '').trim() || DEFAULT_WEATHER_PROMPT;
    const imagePromptGuide = (config.imagePrompt || '').trim() || DEFAULT_WEATHER_IMAGE_PROMPT;

    const productHint = picked
      ? `\n\n【今天要搭配的單品】
- 名稱: ${picked.name}
- 分類: ${picked.category || '?'} ${picked._gender ? `(${picked._gender})` : ''}
- 顏色: ${Array.isArray(picked.colors) ? picked.colors.join('、') : (picked.colors || '見圖')}
- 特色: ${picked.features || '(無)'}
- 產品照: ${picked.image_front || ''}
文案裡自然帶到這件單品(不要生硬),讓氣候與單品結合。`
      : '';

    const system = `你是 ${brand.brand} 的社群小編。
品牌介紹:${brand.brand_summary}
受眾:${brand.audience}
品牌人格:${brand.brand_persona}

必須遵守:
- 用繁體中文寫作
- 台灣用語(不要用「视频」「网站」「哪儿」等對岸用詞)
- 不要 emoji 開頭
- 換行多、短句、有空氣感
- 融入當下天氣狀況(下方即時數據),讓讀者感覺是「今天/明天」的事`;

    const userMsg = `【即時氣象數據】
${weatherText}
${productHint}

【這篇要寫什麼】
${userPrompt}

${withImage ? `【配圖大方向 (參考)】
${imagePromptGuide}
配圖模特兒:${config.modelGender === 'male' ? '男性' : '女性'} 為主
` : ''}
請回傳 JSON:
{
  "text": "貼文文字內容(繁體中文,含適當換行,100-200 字)",
  ${withImage ? `"imagePrompt": "給 KIE 生圖模型的英文 prompt。內容: 一位${config.modelGender === 'male' ? 'Asian male' : 'Asian female'} 模特兒,穿著上面提到的產品${picked ? ` (${picked.name})` : ''},場景與氛圍要呼應今天的天氣(雨天/悶熱/寒流等)。日系冷光、柔和、有空氣感、film grain aesthetic。品牌 logo 會疊左上角,構圖時左上角留白。不要露臉特寫、不要小孩、不要浮水印。文字/數字絕對不能出現在圖上。",` : ''}
  "hashtags": "3-6 個相關 hashtag(#開頭,空白分隔)"
}`;

    const result = await callJSON({
      system,
      user: userMsg,
      maxTokens: 2000,
      temperature: 0.85,
      endpoint: 'realtime-weather',
    });

    // 若需要圖,呼叫 KIE 生圖 + 上傳 Cloudinary
    let imageUrl = null;
    let kieTaskId = null;
    let imageError = null;
    if (withImage && result.imagePrompt) {
      try {
        const refs = picked?.image_front ? [picked.image_front] : [];
        const kieResult = await submitAndPollV2WithRetry(
          {
            prompt: result.imagePrompt,
            referenceImages: refs,
            aspect_ratio: config.aspectRatio || '4:5',
          },
          { maxRetries: 1 },
        );
        kieTaskId = kieResult.taskId;
        // KIE URL 只活 20 分鐘,立即轉存到 Cloudinary
        const uploaded = await uploadToCloudinary(kieResult.kieUrl, {
          folder: 'infuz/realtime',
        });
        imageUrl = uploaded.url;
      } catch (e) {
        imageError = e.message;
        console.error('[realtime] KIE 生圖失敗:', e.message);
      }
    }

    return {
      text: (result.text || '').trim(),
      imagePrompt: withImage ? (result.imagePrompt || imagePromptGuide) : null,
      hashtags: result.hashtags || '',
      imageUrl,
      kieTaskId,
      imageError,
      pickedProduct: picked ? { id: picked._id, name: picked.name, image: picked.image_front } : null,
      dataNote: weatherText,
      snapshots: snaps,
    };
  },
};

const DEFAULT_WEATHER_PROMPT = `依當下的氣溫與降雨機率,給 25-40 歲的通勤女性一則穿搭建議。
不要一開頭就講產品,先從天氣/場景切入,最後自然帶到我們的褲款(強調顯瘦/舒適/版型),
或直接寫生活觀察,不推銷。長度 100-180 字。`;

const DEFAULT_WEATHER_IMAGE_PROMPT = `Editorial fashion photography, Asian woman walking in a Taipei street,
soft natural light, cool tones, film grain aesthetic, minimal composition,
reserve empty space in top-left corner for logo overlay.`;

// ------------------------------------------------------
// 模組註冊表
// ------------------------------------------------------
export const MODULES = { weather: WEATHER_MODULE };
export function getModule(id) { return MODULES[id] || null; }
export function listModules() {
  return Object.values(MODULES).map((m) => ({
    id: m.id, label: m.label, description: m.description, ready: m.isReady(),
  }));
}

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------
function normalizeLocations(config) {
  if (Array.isArray(config?.locations) && config.locations.length) return config.locations;
  if (config?.location) return [config.location]; // 舊資料相容
  return [];
}

async function fetchAllSnapshots(config) {
  const locs = normalizeLocations(config);
  const results = await Promise.all(locs.map((loc) => weather.snapshot({ location: loc }).catch(() => null)));
  return results.filter(Boolean);
}

/**
 * 從 products DB 隨機挑一筆,依 productPool 過濾
 * - female: gender === '女性' (或 category === '珠寶' 但這裡先排除珠寶,那是另一個線)
 * - unisex: gender 為空
 * - all: 全部
 */
async function pickProduct(config) {
  try {
    const db = await loadDb('products');
    const items = db.items || [];
    if (!items.length) return null;

    const pool = config.productPool || 'female';
    // 珠寶不參與穿搭(視覺不合)
    const clothing = items.filter((p) => p.category !== '珠寶' && p.image_front);
    let filtered = clothing;
    if (pool === 'female') {
      filtered = clothing.filter((p) => p._gender === '女性' || p.gender === '女性' || !p.gender);
    } else if (pool === 'male') {
      filtered = clothing.filter((p) => p._gender === '男性' || p.gender === '男性');
    }
    // 特定 productIds
    if (Array.isArray(config.productIds) && config.productIds.length) {
      const setIds = new Set(config.productIds);
      filtered = filtered.filter((p) => setIds.has(p.id));
    }
    if (!filtered.length) filtered = clothing; // fallback: 挑不到就從全部服飾挑

    const picked = filtered[Math.floor(Math.random() * filtered.length)];
    // normalize gender 欄位 (buildContent 會讀 _gender)
    return { ...picked, _id: picked.id, _gender: picked.gender };
  } catch (e) {
    console.error('[realtime] pickProduct 失敗:', e.message);
    return null;
  }
}

// ------------------------------------------------------
// 排程 tick — 由 cron-job.org 每 N 分鐘打 /api/infuz/cron/tick
// ------------------------------------------------------
export async function tick() {
  const stats = { tried: 0, fired: 0, skipped: 0, errors: [] };
  const db = await loadDb('realtime_jobs');
  const jobs = db.items || [];
  const taipeiNowMs = Date.now() + 8 * 3600 * 1000;

  for (const job of jobs) {
    if (!job.enabled || !job.time) continue;

    const slot = findDueSlot(job, taipeiNowMs);
    if (!slot) continue;
    if (job.lastRunDate && job.lastRunDate >= slot.dateStr) continue;

    stats.tried++;
    const mod = getModule(job.moduleId);
    if (!mod) {
      stats.errors.push(`job ${job.id}: unknown module ${job.moduleId}`);
      continue;
    }

    await updateItem('realtime_jobs', job.id, { lastRunDate: slot.dateStr });

    try {
      const check = await mod.shouldFire(job.config || {});
      if (!check.fire) {
        await updateItem('realtime_jobs', job.id, {
          lastResult: { at: new Date().toISOString(), skipped: true, reason: check.reason },
        });
        stats.skipped++;
        continue;
      }

      const built = await mod.buildContent({
        config: job.config || {},
        snapshots: check.snapshots || (check.snapshot ? [check.snapshot] : undefined),
        withImage: Boolean(job.withImage),
      });

      const finalText = built.text + (built.hashtags ? `\n\n${built.hashtags}` : '');
      const res = await fetch(`${getBaseUrl()}/api/infuz/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          imageUrl: built.imageUrl,
          hashtags: '',
          platforms: job.platforms || { threads: true },
        }),
      });
      const publishResult = await res.json();

      await updateItem('realtime_jobs', job.id, {
        lastResult: {
          at: new Date().toISOString(),
          ok: publishResult.ok,
          text: built.text,
          hashtags: built.hashtags,
          imageUrl: built.imageUrl,
          imageError: built.imageError,
          pickedProduct: built.pickedProduct,
          reason: check.reason,
          publishResult: publishResult.results,
          error: publishResult.ok ? null : publishResult.error || 'publish failed',
        },
      });
      if (publishResult.ok) stats.fired++;
      else stats.errors.push(`job ${job.id}: ${publishResult.error || 'publish failed'}`);
    } catch (err) {
      await updateItem('realtime_jobs', job.id, {
        lastResult: { at: new Date().toISOString(), error: err.message },
      });
      stats.errors.push(`job ${job.id}: ${err.message}`);
      console.error(`[realtime] ${job.name} 失敗:`, err.message);
    }
  }

  return stats;
}

function findDueSlot(job, taipeiNowMs) {
  const days = Array.isArray(job.days) && job.days.length ? job.days : [0, 1, 2, 3, 4, 5, 6];
  const [h, m] = job.time.split(':').map(Number);
  for (let back = 0; back <= 1; back++) {
    const d = new Date(taipeiNowMs - back * 86400000);
    const dStr = d.toISOString().slice(0, 10);
    if (!days.includes(d.getUTCDay())) continue;
    const slotMs = Date.parse(dStr + 'T00:00:00Z') + (h * 60 + (m || 0)) * 60000;
    if (slotMs > taipeiNowMs) continue;
    if (taipeiNowMs - slotMs > SCHEDULE_GRACE_MS) return null;
    return { dateStr: dStr, slotMs };
  }
  return null;
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return 'http://localhost:3000';
}
