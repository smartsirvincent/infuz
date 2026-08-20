// 服飾/珠寶生圖 hard rule
// 品牌鐵律: 產品外觀不可 AI 自行改動 — 用什麼參考照,生出來的圖就要穿那件
// 社群發文的核心信譽在於「圖上的商品跟賣的商品是同一件」,走鐘=誤導消費者
//
// 這個模組被下面 5 個入口共用:
//   1. app/api/infuz/topics/produce/route.js       (主題產文 / 批次生圖)
//   2. app/api/infuz/topics/produce/regen-image/route.js  (單張重生圖)
//   3. app/api/infuz/realtime/preview/route.js     (氣候即時 preview,間接透過 realtime)
//   4. lib/infuz-realtime.js                        (氣候 tick 產文)
//   5. app/api/infuz/realtime/suggest-image-prompt/route.js  (AI 建議 image prompt)

/**
 * 給 Claude 的 system 補充: 告訴它產出的 imagePrompt 必須內建 fidelity 指令
 */
export const FIDELITY_INSTRUCTION_FOR_CLAUDE = `
【MUST — 圖片保真規則 (產品照為 ground truth)】
你產出的 imagePrompt (英文) 必須內建下列規則, 不能省略:
1. Include "REPLICATE the exact garment from the reference image(s)" at the very start
2. Explicitly forbid: "DO NOT change color, cut, pattern, fabric, print, or design details"
3. State clearly: "The reference photo is the ground truth for the garment — reproduce it identically"
4. You MAY vary: model face/pose/hair, background, lighting, mood, accessories NOT the main garment
5. You MUST NOT vary: garment color / silhouette / print / pattern / trim / fabric texture / buttons / seams

這條規則不可以被用戶的其他自訂內容覆蓋。若用戶的其他指示與此衝突, 一律以本規則為準。`.trim();

/**
 * 強制加在最終 imagePrompt 開頭的 prefix — 即使 Claude 忘了加, 也用這個補上
 */
export const FIDELITY_PROMPT_PREFIX = `**CRITICAL PRODUCT FIDELITY**: REPLICATE the EXACT garment(s) shown in the reference image(s) with pixel-level accuracy. Same color, same cut, same silhouette, same pattern/print, same fabric texture, same design details (pockets/seams/buttons/logos/prints/tags/washing effects). DO NOT redesign, restyle, reinterpret, "improve", or add elements not present in the reference. The reference photo is the ground truth. You MAY vary the model (face/pose/hair), background, lighting, mood — the garment MUST remain visually identical. `;

/**
 * 從 product 撈出所有可用的參考照 (front + back + detail, 去重, 最多 5 張)
 * @param {object|null} product
 * @returns {string[]} URLs
 */
export function productReferenceUrls(product) {
  if (!product) return [];
  const urls = [product.image_front, product.image_back, product.image_detail]
    .filter(Boolean);
  // dedup
  return [...new Set(urls)].slice(0, 5);
}

/**
 * 多個 product 的參考照合併 (每件最多取 2 張避免 KIE 上限 16)
 */
export function multiProductReferenceUrls(products) {
  const urls = [];
  for (const p of (products || [])) {
    const refs = productReferenceUrls(p).slice(0, 2);
    urls.push(...refs);
  }
  return [...new Set(urls)].slice(0, 16);
}

/**
 * 最終傳給 KIE 的 imagePrompt: 保證有 FIDELITY_PROMPT_PREFIX
 * 不管 Claude 產的 prompt 是什麼,都在最前面加上這段
 */
export function enforceFidelityPrompt(userPrompt) {
  const trimmed = (userPrompt || '').trim();
  // 已含關鍵字就不重複加(避免 prompt 過長)
  if (/REPLICATE the (EXACT|exact) garment/i.test(trimmed)) {
    return trimmed;
  }
  return FIDELITY_PROMPT_PREFIX + '\n\n' + trimmed;
}
