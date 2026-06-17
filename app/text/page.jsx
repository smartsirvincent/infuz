'use client';

import { useEffect, useState } from 'react';
import Step1Form from '@/components/Step1Form';
import Step2Themes from '@/components/Step2Themes';
import Step3Progress from '@/components/Step3Progress';
import Step4Done from '@/components/Step4Done';
import Stepper from '@/components/Stepper';
import { loadInfuzInput, INFUZ_BRAND } from '@/lib/infuz-brand';

const EMPTY_INPUT = {
  ...INFUZ_BRAND,
  products: [],
  image_theme_strategy: 'shared',
  start_date: '',
  dry_run: false,
  generate_images: false,
};

export default function TextPage() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  // 自動載入 Infuz DB 資料
  useEffect(() => {
    (async () => {
      try {
        const data = await loadInfuzInput();
        setInput(data);
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function reset() {
    setStep(1);
    setThemes([]);
    setResult(null);
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <div className="card text-center text-stone-500">
          ⏳ 載入 Infuz 品牌資料中…
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="card border-emerald-200 bg-emerald-50/40">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">📝 文字貼文（Infuz）</h1>
        <p className="mt-1 text-sm text-stone-600">
          已自動載入 Infuz 品牌資料 + <strong>{input.products?.length || 0}</strong> 個 SKU。直接走「下一步」AI 推薦主題。
        </p>
        {loadError && <p className="mt-2 text-xs text-red-600">⚠ {loadError}</p>}
      </div>

      <Stepper current={step} />

      {step === 1 && (
        <Step1Form
          input={input}
          setInput={setInput}
          hideProfileLoader={true}
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
