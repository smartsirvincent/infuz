// 即時發文引擎(Infuz 版) — 參考 luftrum/threads-app/lib/scheduler.js + realtime/*
//
// 差異:
// - luftrum 是 Express 常駐(setInterval), Infuz 走 Vercel Cron(/api/infuz/cron/tick)
// - luftrum 帳號在 config.listAccounts(), Infuz 用單一 connections.main
// - luftrum 排程單位是 realtimeJob, Infuz 存進 Cloudinary `realtime_jobs` DB
//
// 一個 job = {
//   id, name, moduleId ('weather'|'custom'),
//   config: { location, minPoP, minMaxT, maxMinT, prompt, imagePrompt },
//   time: 'HH:MM', days: [0-6] (0=週日), platforms: {threads,instagram,facebook},
//   withImage: bool, enabled: bool,
//   lastRunDate: 'YYYY-MM-DD' (台北日期), lastResult: {at, ok, error, reason, text}
// }
import { loadDb, updateItem } from './infuz-db.js';
import { INFUZ_BRAND } from './infuz-brand.js';
import { callJSON } from './llm.js';
import * as weather from './infuz-weather.js';

const SCHEDULE_GRACE_MS = 6 * 3600 * 1000; // 錯過 6 小時內還會補發

// ------------------------------------------------------
// 模組:天氣
// ------------------------------------------------------
export const WEATHER_MODULE = {
  id: 'weather',
  label: '氣候即時發文',
  description: '到點抓中央氣象署即時預報,依當下氣溫/降雨產出穿搭建議或生活觀察貼文',
  isReady: () => weather.isConfigured(),

  async shouldFire(config) {
    if (!config?.location) return { fire: false, reason: '未設定縣市' };
    const snap = await weather.snapshot({ location: config.location });
    const check = weather.checkConditions(snap, config);
    return { ...check, snapshot: snap };
  },

  async buildContent({ config, snapshot, withImage }) {
    const snap = snapshot || (await weather.snapshot({ location: config.location }));
    const weatherText = weather.toPromptText(snap);

    const brand = INFUZ_BRAND;
    const userPrompt = (config.prompt || '').trim() || DEFAULT_WEATHER_PROMPT;
    const imagePrompt = (config.imagePrompt || '').trim() || DEFAULT_WEATHER_IMAGE_PROMPT;

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

    const userMsg = `【即時氣象數據 (${snap.location})】
${weatherText}

【這篇要寫什麼】
${userPrompt}

${withImage ? `【配圖方向】
${imagePrompt}

` : ''}請回傳 JSON:
{
  "text": "貼文文字內容(繁體中文,含適當換行)",
  ${withImage ? '"imagePrompt": "給 KIE 生圖模型的英文 prompt,呼應這篇文案+今天的天氣,包含品牌視覺風格(日系冷光/柔和/空氣感)。左上角留白給 logo。若文案提到具體地點/數字,imagePrompt 只能用上面實際數據裡的值,不能自己編。",' : ''}
  "hashtags": "3-6 個相關 hashtag(#開頭,空白分隔)"
}`;

    const result = await callJSON({
      system,
      user: userMsg,
      maxTokens: 2000,
      temperature: 0.85,
      endpoint: 'realtime-weather',
    });

    return {
      text: (result.text || '').trim(),
      imagePrompt: withImage ? (result.imagePrompt || imagePrompt) : null,
      hashtags: result.hashtags || '',
      dataNote: weatherText,
    };
  },
};

const DEFAULT_WEATHER_PROMPT = `依當下的氣溫與降雨機率,給 25-40 歲的通勤女性一則穿搭建議。
不要一開頭就講產品,先從天氣/場景切入,最後自然帶到我們的褲款(強調顯瘦/舒適/版型),
或直接寫生活觀察,不推銷。長度 100-180 字。`;

const DEFAULT_WEATHER_IMAGE_PROMPT = `Editorial fashion photography, Asian woman in casual outfit walking in Taipei street,
soft natural light, cool tones, film grain aesthetic, minimal composition,
reserve empty space in top-left corner for logo overlay.`;

// ------------------------------------------------------
// 模組註冊表 (未來要加就 append)
// ------------------------------------------------------
export const MODULES = { weather: WEATHER_MODULE };
export function getModule(id) { return MODULES[id] || null; }
export function listModules() {
  return Object.values(MODULES).map((m) => ({
    id: m.id, label: m.label, description: m.description, ready: m.isReady(),
  }));
}

// ------------------------------------------------------
// 排程 tick — 由 /api/infuz/cron/tick 每 5 分鐘打
// ------------------------------------------------------
/**
 * 找出「已到點 & 今天還沒發過」的 job,執行(抓資料→產文→發文)
 * @returns {Promise<{tried:number, fired:number, skipped:number, errors:string[]}>}
 */
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

    // 先寫入 lastRunDate 佔位,避免下一輪 cron 重複觸發
    await updateItem('realtime_jobs', job.id, { lastRunDate: slot.dateStr });

    try {
      const check = await mod.shouldFire(job.config || {});
      if (!check.fire) {
        await updateItem('realtime_jobs', job.id, {
          lastResult: { at: new Date().toISOString(), skipped: true, reason: check.reason },
        });
        stats.skipped++;
        console.log(`[realtime] ${job.name}: 跳過 - ${check.reason}`);
        continue;
      }

      const built = await mod.buildContent({
        config: job.config || {},
        snapshot: check.snapshot,
        withImage: Boolean(job.withImage),
      });

      // 交給既有的 publish 端點
      const res = await fetch(`${getBaseUrl()}/api/infuz/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: built.text + (built.hashtags ? `\n\n${built.hashtags}` : ''),
          imageUrl: null, // MVP:先不做 realtime 產圖(要走 KIE async pipeline)
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
          reason: check.reason,
          publishResult: publishResult.results,
          error: publishResult.ok ? null : publishResult.error || 'publish failed',
        },
      });
      if (publishResult.ok) {
        stats.fired++;
        console.log(`[realtime] ${job.name}: 已發佈`);
      } else {
        stats.errors.push(`job ${job.id}: ${publishResult.error || 'publish failed'}`);
      }
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

// 找最近一個「已到點」的時段(今天或昨天,取較近者)
// 錯過超過 6h 就不補,超過 24h 昨天也不補(以免發舊資料)
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
  // Vercel 上 VERCEL_URL 沒 protocol; 本機用 localhost
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return 'http://localhost:3000';
}
