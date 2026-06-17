// Infuz 單一品牌設定（hardcode 給 /text /image-plan 用,搭配 DB 預載產品清單）
export const INFUZ_BRAND = {
  brand: 'Infuz',
  brand_summary:
    '台灣女裝品牌，為亞洲女生身材設計褲款。核心技術：後腰鬆緊、繭形版型、大腿內側剪接線。解決梨形、蘋果型、H 型、OX 腿、小腹困擾。延伸產品線:Infuz Jewelry 輕珠寶 (14K 真金 / 925 純銀),極簡幾何線條,可疊戴。',
  audience: '25-40 歲關注顯瘦/身形困擾的女性，多為通勤族與小資族；25-45 歲注重質感不愛 logo 感的女性 (珠寶線)',
  brand_persona:
    '知性、療癒、有同理心的姊姊。短句、換行多，給人「她懂我」的感覺。把問題歸咎於版型而非妳。視覺要日系冷光、柔和不過曝、有空氣感。',
  purchase_url: 'https://www.infuz.com.tw/',
  platforms: ['Threads', 'IG', 'FB'],
  monthly_total: 180,
  brand_logos: '',
  avoid_terms: '',
};

/**
 * 把 infuz DB 的產品轉成 Step1Form 用的 products[] 結構
 */
export function mapInfuzProducts(infuzProducts) {
  return (infuzProducts || []).map((p) => ({
    name: p.name || '',
    features: p.features || '',
    images: [p.image_front, p.image_back, p.image_detail].filter(Boolean),
    purchase_url: p.purchase_url || '',
    include_in_image_gen: true,
    image_styles: { scene: true, character: true, product: true, ecommerce: false },
    promo_offer: '',
    image_focus: '',
    // 額外 metadata (傳給 prompt 用)
    _id: p.id,
    _category: p.category,
    _gender: p.gender,
    _colors: p.colors,
    _price: p.price,
  }));
}

/**
 * 取得完整 Infuz input 物件 (給 /text /image-plan 預填用)
 */
export async function loadInfuzInput(extra = {}) {
  const res = await fetch('/api/infuz/products', { cache: 'no-store' });
  if (!res.ok) throw new Error('無法載入產品 DB');
  const data = await res.json();
  const products = mapInfuzProducts(data.items || []);
  return {
    ...INFUZ_BRAND,
    products,
    image_theme_strategy: 'shared',
    start_date: '',
    dry_run: false,
    generate_images: false,
    ...extra,
  };
}
