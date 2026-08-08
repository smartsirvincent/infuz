// 三個發文平台的規格差異集中在這裡
export const PLATFORMS = {
  threads: {
    id: 'threads',
    label: 'Threads',
    emoji: '🧵',
    requiresImage: false,
    softLimit: 500,        // 超過會自動切成回覆串
    supportsThread: true,
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    emoji: '📷',
    requiresImage: true,   // IG /media 必填 image_url
    hardLimit: 2200,
    supportsThread: false,
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook 粉專',
    emoji: '👍',
    requiresImage: false,
    hardLimit: 63206,
    supportsThread: false,
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS);

/**
 * 依內容型態決定哪些平台可用
 * kind = 'text' | 'image' | 'long'
 */
export function allowedFor(kind) {
  if (kind === 'text' || kind === 'long') {
    return ['threads', 'facebook']; // 沒圖不能發 IG
  }
  return PLATFORM_IDS;
}

export function blockReason(kind, platformId) {
  const allowed = allowedFor(kind);
  if (allowed.includes(platformId)) return null;
  return `${PLATFORMS[platformId]?.label} 需要圖片,這篇沒圖`;
}

/**
 * 把 checkbox object 正規化,至少保留 1 個平台
 */
export function normalizePlatforms(input, kind) {
  const allowed = allowedFor(kind);
  const out = {};
  for (const p of PLATFORM_IDS) out[p] = Boolean(input?.[p]) && allowed.includes(p);
  if (!PLATFORM_IDS.some((p) => out[p])) out.threads = true;
  return out;
}

/**
 * 簡易 Threads 分段:優先切 \n\n → \n → 依 length
 */
export function splitForThreads(text, softLimit = 500) {
  const s = (text || '').trim();
  if (!s) return [''];
  if (s.length <= softLimit) return [s];

  const chunks = [];
  let rest = s;
  while (rest.length > softLimit) {
    let cut = -1;
    // 從 softLimit 往前找 \n\n
    const pp = rest.lastIndexOf('\n\n', softLimit);
    if (pp > softLimit / 2) cut = pp;
    else {
      const p = rest.lastIndexOf('\n', softLimit);
      if (p > softLimit / 2) cut = p;
    }
    if (cut < 0) cut = softLimit; // 找不到自然斷點就硬切
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
