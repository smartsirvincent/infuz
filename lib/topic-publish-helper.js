// 共用: 組合最終發文文本
// - 加 hashtags
// - 若 post.includePurchaseUrl=true 且 pickedProduct 有 purchase_url, 附上 URL (可加 UTM)
export function buildTextWithLink({ post, productsDb, utmCfg, platformId }) {
  let text = (post.text || '').trim();
  if (post.hashtags) text += `\n\n${post.hashtags}`;

  if (post.includePurchaseUrl && post.pickedProductId) {
    const product = (productsDb?.items || []).find((p) => p.id === post.pickedProductId);
    if (product?.purchase_url) {
      const url = withUtm(product.purchase_url, platformId, utmCfg);
      text += `\n\n👉 ${url}`;
    }
  }

  return text;
}

// 依 platform 帶不同 utm_source, 其他共用
export function withUtm(url, platformId, utmCfg) {
  if (!utmCfg || !url) return url;
  try {
    const u = new URL(url);
    const source = (utmCfg.source || {})[platformId] || platformId || 'social';
    if (source) u.searchParams.set('utm_source', source);
    if (utmCfg.medium) u.searchParams.set('utm_medium', utmCfg.medium);
    if (utmCfg.campaign) u.searchParams.set('utm_campaign', utmCfg.campaign);
    return u.toString();
  } catch {
    return url;
  }
}
