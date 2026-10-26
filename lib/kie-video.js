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
// 支援的 model 清單 (secs 預設, cost 參考, label 顯示在 UI)
// 單價以 KIE 2026-10 公開/第三方對照為準 · 實際以 Playground 顯示為準
// ===================================================================
export const VIDEO_MODELS = {
  'kling/v2-5-turbo-image-to-video-pro': {
    label: '🥇 Kling 2.5 Turbo Pro',
    hint: '人物動態穩, 衣料不扭曲 (服飾走秀首選)',
    secs: [5, 10],
    costUsdPer5s: 0.35,
    needsAspectRatioInImage: true, // 用 input 圖的比例決定輸出比例
    typicalDurationSec: 150,
  },
  'wan-2-6-flash': {
    label: '🥉 wan-2-6 Flash',
    hint: 'KIE 最便宜 image→video, 動態保守但可用',
    secs: [5, 10],
    costUsdPer5s: 0.15,
    needsAspectRatioInImage: true,
    typicalDurationSec: 90,
  },
  'hailuo/02-image-to-video-pro': {
    label: '🥈 Hailuo 02 Pro',
    hint: '物理真實感佳 · 第二候補',
    secs: [6, 10],
    costUsdPer5s: 0.48,
    needsAspectRatioInImage: true,
    typicalDurationSec: 180,
  },
  'veo-3-1-fast': {
    label: '🚀 Veo 3 Fast',
    hint: '1080p + 原生音訊 · 衣料紋理偶爾走樣',
    secs: [8],
    costUsdPer5s: 0.35,
    needsAspectRatioInImage: true,
    typicalDurationSec: 60,
  },
  'veo-3-1-quality': {
    label: '👑 Veo 3 Quality',
    hint: '最頂畫質 + 音訊 · 貴 (開發階段先不預設)',
    secs: [8],
    costUsdPer5s: 2.00,
    needsAspectRatioInImage: true,
    typicalDurationSec: 240,
  },
};

export const DEFAULT_VIDEO_MODELS = [
  'kling/v2-5-turbo-image-to-video-pro',
  'wan-2-6-flash',
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
export async function submitVideo({ model, imageUrl, prompt, negativePrompt, duration = 5, cfgScale = 0.5 }) {
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
  if (negativePrompt) input.negative_prompt = negativePrompt;
  else input.negative_prompt = 'blur, distort, extra limbs, logo warp, text, watermark, deformed hands';
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
