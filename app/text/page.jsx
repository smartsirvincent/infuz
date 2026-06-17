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
    brand_summary:
      '台灣女裝品牌，為亞洲女生身材設計褲款。核心技術：後腰鬆緊、繭形版型、大腿內側剪接線。解決梨形、蘋果型、H 型、OX 腿、小腹困擾。',
    audience: '25-40 歲關注顯瘦/身形困擾的女性，多為通勤族與小資族',
    brand_persona:
      '知性、療癒、有同理心的姊姊。短句、換行多，給人「她懂我」的感覺。把問題歸咎於版型而非妳。',
    purchase_url: 'https://www.infuz.com.tw/',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 180,
    products: [
      {
        name: '方袋錐形彎刀褲',
        features:
          '弧線形外型輪廓、適度寬鬆不顯腫。方形後口袋帶中性感。修飾假胯、X/O 型腿。',
        images: ['https://i.ibb.co/gFJsDh73/28039-1.png'],
        purchase_url: 'https://goingto.tw/4VVv5',
      },
      {
        name: '韓系無彈直筒寬褲',
        features:
          '低調褪色感、立體曲線剪裁修飾腿型。中磅丹寧布料、挺度好、耐穿。',
        images: ['https://i.ibb.co/qYfCRwhF/LINE-ALBUM-24-250122-24.png'],
        purchase_url: 'https://goingto.tw/UzaiA',
      },
      {
        name: '撞色系短版針織毛衣',
        features:
          '輕柔舒適、撞色層次感。領口/袖口/下襬小花形收邊。短版凸顯腰身不腫胖。',
        images: ['https://i.ibb.co/14zmpb7/LINE-ALBUM-2025-251121-3.jpg'],
        purchase_url: 'https://goingto.tw/CZgUT',
      },
    ],
    start_date: '',
  },
  'Infuz 珠寶': {
    brand: 'Infuz Jewelry',
    brand_summary:
      '為日常通勤而生的輕珠寶。極簡幾何線條 + 14K 真金 / 925 純銀。不誇張、耐看、可疊戴。每一件都能融進日常 outfit，不必特別打扮也能戴。',
    audience: '25-45 歲女性，職場通勤族、自我犒賞型消費者、注重質感不愛 logo 感、會買來送自己的人',
    brand_persona:
      '質感、低調、有故事感。文案如同好友自言自語、用畫面而非形容詞。換行多、留白多。視覺強調柔和燈光、單色背景、特寫紋理。',
    purchase_url: 'https://www.infuz.com.tw/jewelry',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 90,
    products: [
      {
        name: '極簡線條項鍊',
        features: '14K 真金、0.8mm 細鏈、可調節 40-45cm。日常戴不嫌、洗澡不用拿下、抗氧化處理。',
        images: [''],
        purchase_url: '',
      },
      {
        name: '幾何疊戴戒指組',
        features: '925 純銀 3 件組，可單戴可疊戴。霧面 + 鏡面對比質感，US 5-9 號齊全。',
        images: [''],
        purchase_url: '',
      },
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
  platforms: ['Threads'],
  monthly_total: 100,
  start_date: '',
  products: [
    { name: '', features: '', images: [''], purchase_url: '' },
  ],
  dry_run: false,
  generate_images: false, // 文字流程不生圖,要圖請走 /images
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  function loadSample(name) {
    const s = SAMPLES[name];
    setInput({
      ...EMPTY_INPUT,
      ...s,
      // 確保 products 陣列存在
      products: s.products?.map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
      })) || EMPTY_INPUT.products,
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
          loadOnly={true}
          showThemeStrategy={true}
          onSubmit={async (themesFromAPI) => {
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
          onDone={(res) => {
            setResult(res);
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <Step4Done input={input} themes={themes} result={result} onReset={reset} />
      )}
    </main>
  );
}
