'use client';

import { useState } from 'react';
import Step1Form from '@/components/Step1Form';
import Step2Themes from '@/components/Step2Themes';
import Step3Progress from '@/components/Step3Progress';
import Step4Done from '@/components/Step4Done';
import Stepper from '@/components/Stepper';

const SAMPLES = {
  'Infuz 服飾': {
    brand: 'Infuz',
    brand_summary: '台灣女裝品牌,主打為亞洲女生身材設計的褲款。後腰鬆緊、繭形版型、大腿內側剪接線。',
    audience: '25-40 歲關注顯瘦/身形困擾的女性',
    brand_persona: '知性、療癒。視覺要日系冷光、柔和不過曝、有空氣感、模特兒不過度笑。',
    purchase_url: 'https://www.infuz.com.tw/',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 72,
    products: [
      { name: '方袋錐形彎刀褲', features: '弧線形外型、修飾假胯', images: ['https://i.ibb.co/gFJsDh73/28039-1.png'], purchase_url: '' },
      { name: '韓系無彈直筒寬褲', features: '褪色感、立體曲線剪裁', images: ['https://i.ibb.co/qYfCRwhF/LINE-ALBUM-24-250122-24.png'], purchase_url: '' },
      { name: '撞色系短版針織毛衣', features: '輕柔親膚、撞色層次', images: ['https://i.ibb.co/14zmpb7/LINE-ALBUM-2025-251121-3.jpg'], purchase_url: '' },
    ],
    start_date: '',
  },
  'Infuz 珠寶': {
    brand: 'Infuz Jewelry',
    brand_summary: '為日常通勤而生的輕珠寶。14K 真金 / 925 純銀,極簡幾何線條,可疊戴。',
    audience: '25-45 歲女性,職場通勤族、自我犒賞、注重質感不愛 logo 感',
    brand_persona: '質感、低調、有故事感。視覺強調柔和燈光、單色背景、特寫紋理、淺景深。',
    purchase_url: 'https://www.infuz.com.tw/jewelry',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 60,
    products: [
      { name: '極簡線條項鍊', features: '14K 真金,0.8mm 細鏈,可調節 40-45cm,洗澡不用拿下', images: [''], purchase_url: '' },
      { name: '幾何疊戴戒指組', features: '925 純銀 3 件組,可單戴可疊戴,霧面 + 鏡面對比', images: [''], purchase_url: '' },
    ],
    start_date: '',
  },
};

const EMPTY_INPUT = {
  brand: '',
  brand_summary: '',
  audience: '',
  brand_persona: '',
  purchase_url: '',
  platforms: ['Threads', 'IG'],
  monthly_total: 60,
  start_date: '', // 起始日期已從 UI 移除,留空白 → xlsx 發文時間欄空白
  products: [
    {
      name: '', features: '', images: [''], purchase_url: '',
      include_in_image_gen: true,
      image_styles: { scene: true, character: true, product: true },
    },
  ],
  image_theme_strategy: 'shared',
  dry_run: false,
  generate_images: true,
};

export default function ImagePlanPage() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  function loadSample(name) {
    const s = SAMPLES[name];
    setInput({
      ...EMPTY_INPUT,
      ...s,
      products: s.products?.map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [] })) || EMPTY_INPUT.products,
    });
  }

  function reset() {
    setStep(1);
    setInput(EMPTY_INPUT);
    setThemes([]);
    setResult(null);
  }

  return (
    <main className="space-y-6">
      <Stepper current={step} />

      {step === 1 && (
        <Step1Form
          input={input}
          setInput={setInput}
          onLoadSample={loadSample}
          showImageHint={false}
          showImageStyles={true}
          showThemeStrategy={true}
          loadOnly={true}
          recommendEndpoint="/api/recommend-images"
          submitLabel="下一步：AI 推薦圖片主題 →"
          loadingLabel="🎨 AI 推薦圖片主題中…"
          onSubmit={(themesFromAPI) => {
            setThemes(themesFromAPI);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2Themes
          input={input}
          themes={themes}
          setThemes={setThemes}
          onBack={() => setStep(1)}
          onConfirm={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3Progress
          input={input}
          themes={themes}
          onDone={(res) => { setResult(res); setStep(4); }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <Step4Done input={input} themes={themes} result={result} onReset={reset} />
      )}
    </main>
  );
}
