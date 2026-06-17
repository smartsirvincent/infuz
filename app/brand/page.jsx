'use client';

import { useState } from 'react';
import Step1Form from '@/components/Step1Form';

const EMPTY_INPUT = {
  brand: '',
  brand_summary: '',
  audience: '',
  brand_persona: '',
  purchase_url: '',
  platforms: ['Threads'],
  monthly_total: 100,
  start_date: '',
  products: [
    {
      name: '', features: '', images: [''], purchase_url: '',
      include_in_image_gen: true,
      image_styles: { scene: true, character: true, product: true, ecommerce: false },
      promo_offer: '',
      image_focus: '',
    },
  ],
  image_theme_strategy: 'shared',
  brand_logos: '',
  avoid_terms: '',
  dry_run: false,
  generate_images: false,
};

const SAMPLES = {
  'Infuz 服飾': {
    brand: 'Infuz',
    brand_summary: '台灣女裝品牌，為亞洲女生身材設計褲款。核心技術：後腰鬆緊、繭形版型、大腿內側剪接線。解決梨形 / 蘋果型 / H 型 / OX 腿 / 小腹困擾。',
    audience: '25-40 歲關注顯瘦/身形困擾的女性，多為通勤族與小資族',
    brand_persona: '知性、療癒、有同理心的姊姊。短句、換行多，給人「她懂我」的感覺。把問題歸咎於版型而非妳。視覺要日系冷光、柔和不過曝、有空氣感。',
    purchase_url: 'https://www.infuz.com.tw/',
    monthly_total: 120,
    products: [
      {
        name: '方袋錐形彎刀褲',
        features: '弧線形外型輪廓、適度寬鬆不顯腫。方形後口袋帶中性感。修飾假胯、X/O 型腿。',
        images: ['https://i.ibb.co/gFJsDh73/28039-1.png'],
      },
      {
        name: '韓系無彈直筒寬褲',
        features: '低調褪色感、立體曲線剪裁修飾腿型。中磅丹寧、挺度好、耐穿。',
        images: ['https://i.ibb.co/qYfCRwhF/LINE-ALBUM-24-250122-24.png'],
      },
    ],
  },
  'Infuz 珠寶': {
    brand: 'Infuz Jewelry',
    brand_summary: '為日常通勤而生的輕珠寶。極簡幾何線條 + 14K 真金 / 925 純銀。不誇張、耐看、可疊戴。',
    audience: '25-45 歲女性，職場通勤族、自我犒賞型消費者、注重質感不愛 logo 感',
    brand_persona: '質感、低調、有故事感。文案如同好友自言自語、用畫面而非形容詞。視覺強調柔和燈光、單色背景、特寫紋理。',
    purchase_url: 'https://www.infuz.com.tw/jewelry',
    monthly_total: 90,
    products: [
      {
        name: '極簡線條項鍊',
        features: '14K 真金、0.8mm 細鏈、可調節 40-45cm。日常戴不嫌。',
        images: [''],
      },
      {
        name: '幾何疊戴戒指組',
        features: '925 純銀 3 件組，可單戴可疊戴。霧面 + 鏡面對比質感。',
        images: [''],
      },
    ],
  },
};

export default function BrandPage() {
  const [input, setInput] = useState(EMPTY_INPUT);

  function loadSample(name) {
    const s = SAMPLES[name];
    if (!s) return;
    setInput({ ...EMPTY_INPUT, ...s, products: s.products?.map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [] })) || EMPTY_INPUT.products });
  }

  return (
    <main className="space-y-6">
      <div className="card border-emerald-200 bg-emerald-50/40">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          🏷 品牌資訊輸入
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          這裡專門編輯品牌與 SKU 資料。改完<strong className="text-emerald-700">記得按頂部「☁️ 雲端」→「存雲端」</strong>。
          存好後，去文字貼文 / 圖片貼文 / 素材產生時可直接從雲端載入。
        </p>
        <ul className="mt-3 space-y-1 text-xs text-stone-500">
          <li>• <strong>同名覆蓋</strong>：用相同名稱再存一次會直接更新，不會多一筆</li>
          <li>• <strong>備份</strong>：可同時按「💾 本機」+「📥 匯出 JSON」做多層備份</li>
          <li>• <strong>跨裝置</strong>：雲端設定在任何電腦/瀏覽器都看得到</li>
        </ul>
      </div>

      <Step1Form
        input={input}
        setInput={setInput}
        onLoadSample={loadSample}
        showImageHint={false}
        showImageStyles={true}
        showThemeStrategy={true}
        hideSubmit={true}
        onSubmit={() => {}}
      />
    </main>
  );
}
