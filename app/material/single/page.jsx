'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useEntityList, ProductPicker, ModelPicker, ScenarioPicker, ResultPanel,
  CompositionUploader, GenerationOptions, SwapProductModal,
} from '@/components/MaterialPickers';

export default function MaterialSinglePage() {
  const products = useEntityList('products');
  const models = useEntityList('models');
  const scenarios = useEntityList('scenarios');

  const [productId, setProductId] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelGender, setModelGender] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  // 模仿構圖
  const [compositionRefUrl, setCompositionRefUrl] = useState(null);
  const [compositionPrompt, setCompositionPrompt] = useState('');

  // 生圖選項
  const [textMode, setTextMode] = useState('none');
  const [promoInfo, setPromoInfo] = useState('');
  const [slogan, setSlogan] = useState('');
  const [noFace, setNoFace] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // 換產品 modal
  const [swapping, setSwapping] = useState(false);

  const selectedProduct = products.items.find((p) => p.id === productId);

  async function runGenerate(overrideProductId) {
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const r = await fetch('/api/infuz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          productId: overrideProductId || productId,
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
    if (!productId || !modelId || !scenarioId) {
      setError('產品 / 模特 / 情境 都必選');
      return;
    }
    runGenerate();
  }

  async function handleSwapProduct(newId) {
    setSwapping(false);
    setProductId(newId);
    await runGenerate(newId);
  }

  const loading = products.loading || models.loading || scenarios.loading;
  const dataErr = products.error || models.error || scenarios.error;

  return (
    <main className="space-y-5">
      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">👕 單件素材</h1>
          <Link href="/material" className="text-xs text-stone-500 hover:underline">← 切換模式</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">挑 1 件衣服 + 1 模特 + 1 情境 → AI 1:1 視覺。</p>
      </div>

      {loading && <div className="card text-center text-stone-500">載入資料庫中…</div>}
      {dataErr && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {dataErr}</div>}

      {!loading && !dataErr && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <ProductPicker
                label="👕 選產品"
                products={products.items}
                value={productId}
                onChange={setProductId}
              />
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
            productSummary={selectedProduct ? `${selectedProduct.name} (${selectedProduct.category}, ${selectedProduct.colors})` : ''}
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
              disabled={generating || !productId || !modelId || !scenarioId}
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
            onSwapTop={() => setSwapping(true)}
            mode="single"
          />

          <SwapProductModal
            open={swapping}
            products={products.items}
            currentId={productId}
            onPick={handleSwapProduct}
            onCancel={() => setSwapping(false)}
            title="🔁 換另一件再生 (同模特 / 同情境)"
          />
        </>
      )}
    </main>
  );
}
