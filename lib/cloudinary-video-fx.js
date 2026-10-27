// Cloudinary video transformation helpers
// 把 KIE 產出的 video 加 BGM / 文字 overlay / 片頭片尾 fade 等 · 不用 ffmpeg
// 全部在 URL 層做, 立即回新 URL
//
// 參考: https://cloudinary.com/documentation/video_manipulation_and_delivery

function cloudName() {
  const n = process.env.CLOUDINARY_CLOUD_NAME;
  if (!n) throw new Error('CLOUDINARY_CLOUD_NAME not set');
  return n;
}

/**
 * 從完整 Cloudinary URL 抽出 video public_id
 * 例: https://res.cloudinary.com/dn6f4pghi/video/upload/v1234/infuz/videos/abc.mp4
 *     → infuz/videos/abc
 */
export function extractVideoPublicId(url) {
  if (!url) return null;
  // match: /video/upload/.../(infuz/videos/xxx).mp4
  const m = url.match(/\/video\/upload\/(?:[^/]+\/)*?([^/]+\/[^/]+)\.(?:mp4|mov|webm)/i);
  if (m) return m[1];
  // fallback: last 2 segments without extension
  const parts = url.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last.replace(/\.(?:mp4|mov|webm)$/i, '');
}

/**
 * 轉義 Cloudinary text overlay 的特殊字元
 * 空格 → %20, 逗號/斜線/引號都要 encode
 */
function encodeText(text) {
  return encodeURIComponent(String(text || ''))
    .replace(/%2C/gi, '%252C') // 逗號 double-encode (Cloudinary URL 用 , 當 separator)
    .replace(/%2F/gi, '%252F');
}

/**
 * 組出有 BGM + 文字 overlay 的 video URL
 *
 * @param {Object} opts
 * @param {string} opts.videoPublicId - 原始 video 的 Cloudinary public_id (或整段 URL)
 * @param {string} [opts.bgmPublicId] - 背景音樂的 public_id (e.g. 'infuz/bgm/fashion_pop'), 空 = 不加
 * @param {number} [opts.bgmVolume] - 0-100 音量, 預設 60
 * @param {string} [opts.text] - 疊字 (繁中 OK, 建議 1-2 句)
 * @param {string} [opts.textFont] - Google Font 名 or Cloudinary built-in, 預設 'Arial'
 * @param {number} [opts.textSize] - 字體 px, 預設 60
 * @param {string} [opts.textColor] - 'white' / 'black' / '#RRGGBB', 預設 'white'
 * @param {string} [opts.textPos] - 'north' | 'south' | 'center' · 預設 'south'
 * @param {number} [opts.textY] - y offset, 預設 100
 * @param {boolean} [opts.fadeInOut] - 加片頭片尾 fade, 預設 true
 */
export function buildEnhancedVideoUrl(opts) {
  const {
    videoPublicId,
    bgmPublicId,
    bgmVolume = 60,
    text,
    textFont = 'Arial',
    textSize = 60,
    textColor = 'white',
    textPos = 'south',
    textY = 100,
    fadeInOut = true,
  } = opts;

  const vid = videoPublicId.includes('http') ? extractVideoPublicId(videoPublicId) : videoPublicId;
  if (!vid) throw new Error('無法 parse video public_id');

  const transforms = [];

  // 1. 音樂 overlay: 用 l_video + ac_mp3 (若 BGM 是 video resource)
  //    若 BGM 存為 video resource, 用 l_video; 若存為 raw mp3, 用 l_audio
  if (bgmPublicId) {
    // l_video:slug/fl_layer_apply,ac_mp3 (會把音軌蓋上去, 保留原影片)
    const bgmSlug = bgmPublicId.replace(/\//g, ':');
    transforms.push(`l_video:${bgmSlug},e_volume:${bgmVolume}/fl_layer_apply`);
  }

  // 2. 文字 overlay (疊在最上層)
  if (text) {
    const encodedText = encodeText(text);
    // l_text:Font_size_style:encodedText 格式
    const fontSpec = `${textFont.replace(/\s/g, '%20')}_${textSize}_bold_center`;
    const color = textColor.startsWith('#') ? `rgb:${textColor.slice(1)}` : textColor;
    transforms.push(
      `l_text:${fontSpec}:${encodedText},co_${color},b_rgb:000000A0,bo_8px_solid_rgb:00000000`,
      `fl_layer_apply,g_${textPos},y_${textY}`,
    );
  }

  // 3. 片頭片尾 fade (1.5 秒各)
  if (fadeInOut) {
    transforms.push('e_fade:1500', 'e_fade:-1500');
  }

  const path = transforms.length
    ? transforms.join('/') + '/' + vid
    : vid;

  return `https://res.cloudinary.com/${cloudName()}/video/upload/${path}.mp4`;
}

/**
 * 計算這組 transformation 的簡要摘要 (給 UI 顯示 "已套用 2 個效果" 之類)
 */
export function summarizeFx({ bgmPublicId, text, fadeInOut }) {
  const parts = [];
  if (bgmPublicId) parts.push('🎵 BGM');
  if (text) parts.push('🏷️ 文字');
  if (fadeInOut) parts.push('🌙 淡入淡出');
  return parts.join(' · ') || '無';
}
