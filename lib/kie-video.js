// KIE Image-to-Video API wrapper (2026-10 新)
// docs: https://docs.kie.ai/
//
// 同一個 endpoint (/jobs/createTask) 不同 model 跑不同 image-to-video
// 支援 Kling 2.5 Turbo Pro / wan-2-6-flash / Hailuo 02 Pro / Veo 3 Fast/Quality
//
// 流程: POST /jobs/createTask → taskId → poll /jobs/recordInfo → state=success 拿 video URL
// 注意: video URL 是臨時連結, 要立刻下載上傳到 Cloudinary

import { trackKie } from './infuz-usage.js';

const KIE_BASE = 'https://api.kie.ai/api/v1';
const POLL_INTERVAL_MS = 5000;        // video 比 image 慢, 5 秒一輪
const POLL_MAX_ATTEMPTS = 60;         // 60 * 5s = 5 分鐘 (video 普遍 2-3 分鐘)

// ===================================================================
// 支援的 model 清單 (已 KIE API 2026-10-26 實測可用 · wan 系列不在 KIE)
// slug 要跟 KIE 完全一致 (底線不是 dash · 大小寫敏感)
// ===================================================================
export const VIDEO_MODELS = {
  'kling/v2-5-turbo-image-to-video-pro': {
    label: '🥇 Kling 2.5 Turbo Pro',
    hint: '人物動態穩, 衣料不扭曲 (服飾走秀首選)',
    secs: [5, 10],
    costUsdPer5s: 0.35,
    typicalDurationSec: 150,
  },
  'kling/v2-1-master-image-to-video': {
    label: '🥈 Kling 2.1 Master',
    hint: '上一代 flagship · 風格較電影感',
    secs: [5, 10],
    costUsdPer5s: 0.28,
    typicalDurationSec: 150,
  },
  'hailuo/02-image-to-video-pro': {
    label: '🥉 Hailuo 02 Pro',
    hint: '物理真實感佳 · prompt 控制較弱',
    secs: [6, 10],
    costUsdPer5s: 0.48,
    typicalDurationSec: 180,
  },
  'veo3_fast': {
    label: '🚀 Veo 3 Fast',
    hint: '1 分鐘內出 · 1080p + 原生音訊',
    secs: [4, 6, 8],
    costUsdPer5s: 0.40,
    typicalDurationSec: 60,
  },
  'veo3': {
    label: '👑 Veo 3 Quality',
    hint: '最頂畫質 + 原生音訊 · 貴 (開發期不預設)',
    secs: [4, 6, 8],
    costUsdPer5s: 2.00,
    typicalDurationSec: 240,
  },
};

export const DEFAULT_VIDEO_MODELS = [
  'kling/v2-5-turbo-image-to-video-pro',
  'veo3_fast',
];

// ===================================================================
// 影音模板 · 服飾/生活/產品特寫 常用情境
// 用戶在 UI 點 chip 就套用 prompt
// 英文效果較好 (KIE 內部跑 Kling/Hailuo/Veo 都偏英文訓練)
// ===================================================================
// 10 個模板 · 全部「正面不轉身」避免 AI 猜衣服背面出錯
// 以頭部/手部/表情/相機微動為主 · 服裝整件保留
export const VIDEO_PROMPT_TEMPLATES = [
  {
    key: 'smile_nod',
    label: '😊 微笑點頭',
    use: '肖像感 · 任何服裝',
    prompt: 'The same woman from the input image faces the camera, gentle smile, slight head nod, keep her exact face, hair and outfit unchanged, soft natural light, premium portrait aesthetic, static body no turning',
  },
  {
    key: 'hair_touch',
    label: '💇 撥頭髮',
    use: '優雅感 · 任何服裝',
    prompt: 'The same woman from the input image gently touches her hair behind the ear, soft eye contact with camera, keep her exact face and outfit unchanged, warm daylight, cinematic shallow depth of field, no body rotation',
  },
  {
    key: 'camera_pushin',
    label: '🎥 相機緩推',
    use: '服飾細節 · 精品感',
    prompt: 'Slow cinematic camera push-in on the woman from the input image, she stays still facing camera, keep her face and outfit exactly the same, soft bokeh background, warm natural light, premium product film style',
  },
  {
    key: 'camera_dolly',
    label: '📹 相機側移',
    use: '質感展示 · 不動人',
    prompt: 'Camera slowly dolly from left to right in front of the woman from the input image, she stays motionless facing the camera, keep her face and outfit unchanged, soft studio lighting, cinematic parallax, no rotation of subject',
  },
  {
    key: 'breath_still',
    label: '🌸 呼吸靜止',
    use: '氣質感 · 文青風',
    prompt: 'The same woman from the input image stands still facing camera, chest rises and falls with calm breathing, hair sways very subtly, slight eye blink, keep her face and outfit exactly, soft golden hour light, meditative cinematic feel, no turning',
  },
  {
    key: 'collar_adjust',
    label: '👕 整理衣領',
    use: '上衣展示 · 自然互動',
    prompt: 'The same woman from the input image uses one hand to lightly adjust her collar or top edge, looks slightly down then back at camera, keep her exact face and outfit, natural indoor light, OOTD lookbook aesthetic, body stays facing forward',
  },
  {
    key: 'light_sway',
    label: '🌬️ 衣料輕飄',
    use: '裙裝/寬褲 · 氣流感',
    prompt: 'Very gentle breeze lifts the fabric of the woman from the input image, hair moves softly, she stands still facing camera, keep her face and outfit exactly, golden hour side light, cinematic slow motion, no body turn',
  },
  {
    key: 'wave_hi',
    label: '👋 擺手打招呼',
    use: '親和感 · 生活化',
    prompt: 'The same woman from the input image waves hand toward the camera with a friendly smile, body stays facing forward, keep her face and outfit unchanged, natural daylight, casual vlog aesthetic, no body rotation',
  },
  {
    key: 'look_aside',
    label: '👀 側望微笑',
    use: '文藝感 · 靜態片',
    prompt: 'The same woman from the input image slowly looks to her side with a soft smile, then returns gaze to camera, body stays facing forward, keep her exact face and outfit, soft daylight, editorial cinematic quality, no body turning',
  },
  {
    key: 'phone_hold',
    label: '📱 看手機',
    use: '生活日常感',
    prompt: 'The same woman from the input image holds a phone at chest level, looks down briefly then back up at camera with a slight smile, keep her face and outfit unchanged, natural indoor light, lifestyle commercial style, body does not turn',
  },
];

function key() {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error('KIE_API_KEY not set in .env');
  return k;
}

async function postJSON(path, body) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE ${path} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function getJSON(path) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${key()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE ${path} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 送出 image-to-video 任務, 回 taskId
 * @param {Object} opts
 * @param {string} opts.model - 必須在 VIDEO_MODELS keys 內
 * @param {string} opts.imageUrl - 公開可達 URL (JPEG/PNG/WebP, ≤10 MB)
 * @param {string} opts.prompt - 動作指示 (例「fashion walk, model turns 180 degrees」)
 * @param {string} opts.negativePrompt - 選填, 排除元素 (預設系統預設排除扭曲/血腥)
 * @param {5|10|8} opts.duration - 秒數, 預設 5
 * @param {number} opts.cfgScale - 0-1, Kling 等支援, 預設 0.5 (越高越照 prompt)
 */
export async function submitVideo({ model, imageUrl, prompt, negativePrompt, duration = 5, cfgScale = 0.7 }) {
  if (!VIDEO_MODELS[model]) {
    throw new Error(`不支援的 KIE video model: ${model}`);
  }
  if (!imageUrl) throw new Error('submitVideo 缺 imageUrl');

  const spec = VIDEO_MODELS[model];
  const dur = spec.secs.includes(duration) ? duration : spec.secs[0];

  // 每個 model 的 input 欄位略有差異, 這裡用大家都吃的通用版
  const input = {
    prompt: prompt || 'Natural model movement, smooth motion, cinematic lighting',
    image_url: imageUrl,
    duration: String(dur),
  };
  // Identity drift 預防: 預設 negative_prompt 強化排除「換臉/換人」
  if (negativePrompt) input.negative_prompt = negativePrompt;
  else input.negative_prompt = 'blur, distort, extra limbs, logo warp, text, watermark, deformed hands, face swap, different person, facial distortion, identity change, different face, morphing face, warped features, inconsistent appearance';
  // cfg_scale 預設 0.7 (越高越照 input 圖 · 服飾/人物保 identity 更強, 原預設 0.5 太自由)
  if (cfgScale != null) input.cfg_scale = cfgScale;

  const body = { model, input };
  const resp = await postJSON('/jobs/createTask', body);
  if (resp.code !== 200 || !resp.data?.taskId) {
    throw new Error(`KIE video submit failed (${model}): ${resp.msg || JSON.stringify(resp)}`);
  }
  try {
    await trackKie({ model, count: 1, endpoint: 'submitVideo' });
  } catch (e) { console.error('[trackKie-video]', e.message); }
  return resp.data.taskId;
}

/**
 * 輪詢直到完成, 回 video URL
 * video 比 image 慢很多, poll 間隔 5s, max 5 分鐘
 */
export async function pollVideo(taskId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const resp = await getJSON(`/jobs/recordInfo?taskId=${taskId}`);
    const d = resp.data;
    if (!d) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (d.state === 'success') {
      try {
        const r = JSON.parse(d.resultJson || '{}');
        // KIE video 回 result_urls 或 resultUrls, 第一個就是 video URL
        const urls = r.resultUrls || r.result_urls;
        if (urls && urls.length > 0) return urls[0];
        throw new Error(`KIE video done but no URL: ${d.resultJson}`);
      } catch (e) {
        throw new Error(`KIE video parse resultJson: ${e.message}`);
      }
    }
    if (d.state === 'fail') {
      const failMsg = d.failMsg || d.failCode || 'unknown';
      const retryable = /internal\s*error|timeout|temporarily|please try|server|503|502|500|rate.?limit/i.test(failMsg);
      const err = new Error(`KIE video failed: ${failMsg} (taskId=${taskId})`);
      err.kieRetryable = retryable;
      err.kieTaskId = taskId;
      throw err;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const err = new Error(`KIE video poll timeout (taskId=${taskId}, 已等 ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s)`);
  err.kieRetryable = true;
  err.kieTaskId = taskId;
  throw err;
}

/**
 * 一次跑完: submit → poll → 回 { taskId, kieUrl }
 */
export async function generateVideo(opts) {
  const taskId = await submitVideo(opts);
  const url = await pollVideo(taskId);
  return { taskId, kieUrl: url };
}

/**
 * 平行跑多個 model, 回 [{ model, ok, taskId?, kieUrl?, error? }]
 * UI 「2 個 model 同時產」用這個
 */
export async function generateMultiModel({ models, imageUrl, prompt, duration = 5 }) {
  const list = models.filter((m) => VIDEO_MODELS[m]);
  if (list.length === 0) throw new Error('models 空');
  const results = await Promise.all(list.map(async (model) => {
    try {
      const { taskId, kieUrl } = await generateVideo({ model, imageUrl, prompt, duration });
      return { model, ok: true, taskId, kieUrl };
    } catch (e) {
      return { model, ok: false, error: e.message };
    }
  }));
  return results;
}

/**
 * 下載 video bytes (給 Cloudinary 上傳用)
 */
export async function downloadVideo(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Video download HTTP ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
