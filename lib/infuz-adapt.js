// 一稿三發:同一份文案,依平台自動調整
import { PLATFORMS, splitForThreads } from './infuz-platforms.js';

function existingTags(text) {
  return new Set((text.match(/#[^\s#]+/g) || []).map((t) => t.toLowerCase()));
}

/**
 * 依平台把文字調整成合規格式
 * threads → { chunks: [...] } 長文分段
 * instagram → { caption: "..." } 附 hashtag,超字截斷
 * facebook → { message: "..." } 硬上限
 */
export function adapt(text, platformId, opts = {}) {
  const clean = (text || '').trim();

  if (platformId === 'threads') {
    return { chunks: splitForThreads(clean) };
  }

  if (platformId === 'instagram') {
    const have = existingTags(clean);
    const tags = (opts.hashtags || '')
      .split(/[\s,、]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : '#' + t))
      .filter((t) => !have.has(t.toLowerCase()));

    const limit = PLATFORMS.instagram.hardLimit;
    const tagLine = tags.length ? '\n\n' + tags.join(' ') : '';
    const room = limit - tagLine.length;
    const body = clean.length > room ? clean.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : clean;
    return { caption: body + tagLine };
  }

  if (platformId === 'facebook') {
    const limit = PLATFORMS.facebook.hardLimit;
    return { message: clean.length > limit ? clean.slice(0, limit - 1) + '…' : clean };
  }

  throw new Error(`未知的平台:${platformId}`);
}

/**
 * 發文前預檢
 * 回傳不能發的原因,null = 可以發
 */
export function preflight(text, imageUrl, platformId) {
  const spec = PLATFORMS[platformId];
  if (!spec) return `未知的平台:${platformId}`;
  if (spec.requiresImage && !imageUrl) return `${spec.label} 貼文必須附圖片,這篇沒有圖`;
  if (!(text || '').trim() && !imageUrl) return '沒有內容';
  return null;
}
