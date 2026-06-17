'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useEntityList, ProductMultiPicker, ModelPicker, ScenarioPicker, ResultPanel,
  CompositionUploader, GenerationOptions,
} from '@/components/MaterialPickers';

export default function MaterialCompositionPage() {
  const products = useEntityList('products');
  const models = useEntityList('models');
  const scenarios = useEntityList('scenarios');

  const [displayMode, setDisplayMode] = useState('display'); // 'display' | 'model'
  const [productIds, setProductIds] = useState([]);
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

  const selectedProducts = productIds
    .map((id) => products.items.find((p) => p.id === id))
    .filter(Boolean);
  const productSummary = selectedProducts.map((p) => p.name).join(' + ').slice(0, 200);
  const selectedScenario = scenarios.items.find((s) => s.id === scenarioId);
  const dispatchContext = selectedProducts.length >= 2 ? {
    mode: 'composition',
    displayMode,
    products: selectedProducts,
    scenario: selectedScenario?.name || '',
    slogan, promoInfo,
  } : null;

  // composition 模式 + display 子模式 → 不需要模特,reference 上限 6
  // composition 模式 + model 子模式 → 需要模特,reference 上限 5 (3 product + 1 model + 1 composition)
  const maxProducts = displayMode === 'display' ? 6 : 5;

  async function handleGenerate() {
    if (productIds.length < 2) {
      setError('至少要選 2 件產品');
      return;
    }
    if (displayMode === 'model' && !modelId) {
      setError('搭配模特模式需要選模特');
      return;
    }
    if (!scenarioId) {
      setError('請選情境');
      return;
    }
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const r = await fetch('/api/infuz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'composition',
          displayMode,
          productIds,
          modelId: displayMode === 'model' ? modelId : '',
          scenarioId,
          textMode, promoInfo, slogan,
          noFace: displayMode === 'model' ? noFace : false, // display mode 本來就沒人
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

  const loading = products.loading || models.loading || scenarios.loading;
  const dataErr = products.error || models.error || scenarios.error;

  return (
    <main className="space-y-5">
      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">🎨 組合素材</h1>
          <Link href="/material" className="text-xs text-stone-500 hover:underline">← 切換模式</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">挑多件產品（2-{maxProducts} 件）→ AI 合成 1:1 系列圖。</p>
      </div>

      {/* 顯示模式選擇 */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">📷 顯示方式</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDisplayMode('display')}
            className={`rounded-lg border p-4 text-left transition ${displayMode === 'display' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-400' : 'border-stone-200 hover:bg-stone-50'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗂</span>
              <span className="text-sm font-semibold text-stone-900">純陳列</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-600">Flat lay / 商品陳列,沒有模特</p>
            <p className="mt-0.5 text-[10px] text-stone-500">適合: 新品系列、月度推薦、配色陳列</p>
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('model')}
            className={`rounded-lg border p-4 text-left transition ${displayMode === 'model' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-400' : 'border-stone-200 hover:bg-stone-50'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">👤</span>
              <span className="text-sm font-semibold text-stone-900">搭配模特</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-600">模特穿/拿/搭配多件單品</p>
            <p className="mt-0.5 text-[10px] text-stone-500">適合: lookbook、季節穿搭、整套介紹</p>
          </button>
        </div>
      </div>

      {loading && <div className="card text-center text-stone-500">載入資料庫中…</div>}
      {dataErr && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {dataErr}</div>}

      {!loading && !dataErr && (
        <>
          <div className="card">
            <ProductMultiPicker
              label={`👕 選產品 (2-${maxProducts} 件)`}
              products={products.items}
              value={productIds}
              onChange={setProductIds}
              maxItems={maxProducts}
            />
          </div>

          {displayMode === 'model' && (
            <div className="card">
              <ModelPicker
                models={models.items}
                value={modelId}
                onChange={setModelId}
                genderFilter={modelGender}
                onGenderChange={setModelGender}
              />
            </div>
          )}

          <div className="card">
            <ScenarioPicker scenarios={scenarios.items} value={scenarioId} onChange={setScenarioId} />
            {displayMode === 'display' && (
              <p className="mt-2 text-[11px] text-stone-500">
                💡 純陳列模式下,情境主要用於背景色調 / 風格基調 (AI 會忽略「穿著」相關描述)
              </p>
            )}
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
            noFace={displayMode === 'model' ? noFace : false}
            setNoFace={setNoFace}
            productSummary={productSummary}
          />
          {displayMode === 'display' && (
            <div className="-mt-3 text-[11px] text-stone-500 px-1">
              ℹ 純陳列模式本來就沒人,「不要人臉」選項已停用
            </div>
          )}

          <div className="card">
            <label className="label text-xs">額外視覺指示（選填）</label>
            <input
              className="input text-sm"
              placeholder="例:加上柔光、極簡留白、品牌色調"
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
              disabled={generating || productIds.length < 2 || (displayMode === 'model' && !modelId) || !scenarioId}
              className="btn-primary disabled:opacity-50"
            >
              {generating ? '生成中…' : `🎨 開始生圖 (${productIds.length} 件, 1:1)`}
            </button>
          </div>

          <ResultPanel
            result={result}
            onReset={() => { setResult(null); setError(''); }}
            generating={generating}
            error={null}
            mode="composition"
            dispatchContext={dispatchContext}
          />
        </>
      )}
    </main>
  );
}
