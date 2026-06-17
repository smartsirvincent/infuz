'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useEntityList, ProductPicker, ModelPicker, ScenarioPicker, ResultPanel,
  CompositionUploader, GenerationOptions, SwapProductModal,
} from '@/components/MaterialPickers';

export default function MaterialComboPage() {
  const products = useEntityList('products');
  const models = useEntityList('models');
  const scenarios = useEntityList('scenarios');

  const [topId, setTopId] = useState('');
  const [bottomId, setBottomId] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelGender, setModelGender] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  const [compositionRefUrl, setCompositionRefUrl] = useState(null);
  const [compositionPrompt, setCompositionPrompt] = useState('');

  const [textMode, setTextMode] = useState('none');
  const [promoInfo, setPromoInfo] = useState('');
  const [slogan, setSlogan] = useState('');
  const [noFace, setNoFace] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [swapping, setSwapping] = useState(null); // 'top' | 'bottom' | null

  const topProduct = products.items.find((p) => p.id === topId);
  const bottomProduct = products.items.find((p) => p.id === bottomId);
  const selectedScenario = scenarios.items.find((s) => s.id === scenarioId);
  const dispatchContext = (topProduct && bottomProduct) ? {
    mode: 'combo',
    products: [topProduct, bottomProduct],
    scenario: selectedScenario?.name || '',
    slogan, promoInfo,
  } : null;

  async function runGenerate(overrideTop, overrideBottom) {
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const r = await fetch('/api/infuz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'combo',
          topId: overrideTop || topId,
          bottomId: overrideBottom || bottomId,
          modelId, scenarioId,
          textMode, promoInfo, slogan, noFace,
          compositionRefUrl, compositionPrompt,
          extraPrompt,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setResult(d);
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  function handleGenerate() {
    if (!topId || !bottomId || !modelId || !scenarioId) {
      setError('上衣 / 下身 / 模特 / 情境 都必選');
      return;
    }
    if (topId === bottomId) {
      setError('上衣和下身不可選同一件');
      return;
    }
    runGenerate();
  }

  async function handleSwap(newId) {
    if (swapping === 'top') {
      setTopId(newId); setSwapping(null);
      await runGenerate(newId, null);
    } else if (swapping === 'bottom') {
      setBottomId(newId); setSwapping(null);
      await runGenerate(null, newId);
    }
  }

  const loading = products.loading || models.loading || scenarios.loading;
  const dataErr = products.error || models.error || scenarios.error;
  const productSummary = topProduct && bottomProduct
    ? `上衣 ${topProduct.name} + 下身 ${bottomProduct.name}`
    : '';

  return (
    <main className="space-y-5">
      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">👯 搭配素材</h1>
          <Link href="/material" className="text-xs text-stone-500 hover:underline">← 切換模式</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">挑上衣 + 下身 + 1 模特 + 1 情境 → AI 1:1 整套穿搭視覺。</p>
      </div>

      {loading && <div className="card text-center text-stone-500">載入資料庫中…</div>}
      {dataErr && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {dataErr}</div>}

      {!loading && !dataErr && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card border-blue-200 bg-blue-50/30">
              <ProductPicker
                label="👕 選上衣"
                products={products.items}
                value={topId}
                onChange={setTopId}
                lockCategory="上衣"
              />
            </div>
            <div className="card border-amber-200 bg-amber-50/30">
              <ProductPicker
                label="👖 選下身"
                products={products.items}
                value={bottomId}
                onChange={setBottomId}
                lockCategory="下身"
              />
            </div>
          </div>

          <div className="card">
            <ModelPicker
              models={models.items}
              value={modelId}
              onChange={setModelId}
              genderFilter={modelGender}
              onGenderChange={setModelGender}
            />
          </div>

          <div className="card">
            <ScenarioPicker scenarios={scenarios.items} value={scenarioId} onChange={setScenarioId} />
          </div>

          <CompositionUploader
            uploadedUrl={compositionRefUrl}
            setUploadedUrl={setCompositionRefUrl}
            compositionPrompt={compositionPrompt}
            setCompositionPrompt={setCompositionPrompt}
          />

          <GenerationOptions
            textMode={textMode} setTextMode={setTextMode}
            promoInfo={promoInfo} setPromoInfo={setPromoInfo}
            slogan={slogan} setSlogan={setSlogan}
            noFace={noFace} setNoFace={setNoFace}
            productSummary={productSummary}
          />

          <div className="card">
            <label className="label text-xs">額外視覺指示（選填）</label>
            <input
              className="input text-sm"
              placeholder="例:加上柔光、換成黃昏色調"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
            />
          </div>

          {error && !generating && (
            <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !topId || !bottomId || !modelId || !scenarioId}
              className="btn-primary disabled:opacity-50"
            >
              {generating ? '生成中…' : '🎨 開始生圖 (1:1)'}
            </button>
          </div>

          <ResultPanel
            result={result}
            onReset={() => { setResult(null); setError(''); }}
            generating={generating}
            error={null}
            onSwapTop={() => setSwapping('top')}
            onSwapBottom={() => setSwapping('bottom')}
            mode="combo"
            dispatchContext={dispatchContext}
          />

          <SwapProductModal
            open={swapping === 'top'}
            products={products.items}
            currentId={topId}
            lockCategory="上衣"
            onPick={handleSwap}
            onCancel={() => setSwapping(null)}
            title="🔁 換上衣再生"
          />
          <SwapProductModal
            open={swapping === 'bottom'}
            products={products.items}
            currentId={bottomId}
            lockCategory="下身"
            onPick={handleSwap}
            onCancel={() => setSwapping(null)}
            title="🔁 換下身再生"
          />
        </>
      )}
    </main>
  );
}
