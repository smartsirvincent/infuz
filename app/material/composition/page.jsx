'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useEntityList, ProductMultiPicker, ModelPicker, ScenarioPicker, ResultPanel,
  CompositionUploader, GenerationOptions,
} from '@/components/MaterialPickers';

const DISPLAY_MODES = [
  { key: 'none', emoji: '🗂', title: '不指定模特兒 (純陳列)', hint: 'Flat lay / 商品陳列', desc: '適合: 新品系列、月度推薦、配色陳列' },
  { key: 'single', emoji: '👤', title: '固定 1 位模特兒', hint: '同 1 位穿/搭多件', desc: '適合: lookbook、整套穿搭、季節介紹' },
  { key: 'dual', emoji: '👥', title: '2 位模特兒 (各穿 1 件)', hint: '需正好選 2 件產品', desc: '適合: 對比款、姊妹裝、雙人 OOTD' },
  { key: 'random', emoji: '🎲', title: '隨機生成模特兒', hint: 'AI 自創,不用參考圖', desc: '適合: 想要新面孔、不想被既有模特綁架' },
];

export default function MaterialCompositionPage() {
  const products = useEntityList('products');
  const models = useEntityList('models');
  const scenarios = useEntityList('scenarios');

  const [displayMode, setDisplayMode] = useState('none');
  const [productIds, setProductIds] = useState([]);
  const [modelId, setModelId] = useState('');           // single 用
  const [modelIdA, setModelIdA] = useState('');         // dual 用 - A
  const [modelIdB, setModelIdB] = useState('');         // dual 用 - B
  const [modelGender, setModelGender] = useState('');
  const [modelGenderA, setModelGenderA] = useState('');
  const [modelGenderB, setModelGenderB] = useState('');
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

  // dual 模式一定要 2 件產品; 其他模式產品上限依模特佔用 slots 而定
  const maxProducts = displayMode === 'none' ? 8 : displayMode === 'dual' ? 2 : 5;
  const productCountOk = displayMode === 'dual' ? productIds.length === 2 : productIds.length >= 2;
  const needsSingleModel = displayMode === 'single';
  const needsDualModel = displayMode === 'dual';
  const modelsOk = needsSingleModel ? !!modelId
    : needsDualModel ? (modelIdA && modelIdB && modelIdA !== modelIdB)
    : true;
  const hasHuman = displayMode === 'single' || displayMode === 'dual' || displayMode === 'random';

  async function handleGenerate() {
    if (!productCountOk) {
      setError(displayMode === 'dual' ? '「2 位模特兒」模式必須正好選 2 件產品' : '至少要選 2 件產品');
      return;
    }
    if (needsSingleModel && !modelId) { setError('請選 1 位模特'); return; }
    if (needsDualModel && (!modelIdA || !modelIdB)) { setError('請選 2 位模特兒 (A + B)'); return; }
    if (needsDualModel && modelIdA === modelIdB) { setError('模特 A 和 B 不可同一位'); return; }
    if (!scenarioId && !compositionRefUrl) { setError('請選情境,或上傳模仿構圖照(2 選 1)'); return; }
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
          modelId: needsSingleModel ? modelId : '',
          modelIds: needsDualModel ? [modelIdA, modelIdB] : [],
          scenarioId,
          textMode, promoInfo, slogan,
          noFace: hasHuman ? noFace : false,
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
        <p className="mt-1 text-sm text-stone-600">
          挑{displayMode === 'dual' ? ' 2 件 ' : ` 2-${maxProducts} 件 `}產品 → AI 合成 1:1 系列圖。
        </p>
      </div>

      {/* 模特兒配置 (4 種) */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">👥 模特兒配置</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DISPLAY_MODES.map((m) => {
            const active = displayMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setDisplayMode(m.key)}
                className={`rounded-lg border p-3 text-left transition ${active ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-400' : 'border-stone-200 hover:bg-stone-50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-sm font-semibold text-stone-900">{m.title}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-stone-600">{m.hint}</p>
                <p className="mt-0.5 text-[10px] text-stone-500">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="card text-center text-stone-500">載入資料庫中…</div>}
      {dataErr && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {dataErr}</div>}

      {!loading && !dataErr && (
        <>
          <div className="card">
            <ProductMultiPicker
              label={displayMode === 'dual' ? '👕 選產品 (需正好 2 件)' : `👕 選產品 (2-${maxProducts} 件)`}
              products={products.items}
              value={productIds}
              onChange={setProductIds}
              maxItems={maxProducts}
            />
          </div>

          {needsSingleModel && (
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

          {needsDualModel && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card border-blue-200 bg-blue-50/30">
                <div className="mb-1.5 text-xs font-medium text-blue-800">
                  👤 模特 A (穿產品 1{selectedProducts[0] ? `: ${selectedProducts[0].name?.slice(0, 20)}` : ''})
                </div>
                <ModelPicker
                  models={models.items.filter((m) => m.id !== modelIdB)}
                  value={modelIdA}
                  onChange={setModelIdA}
                  genderFilter={modelGenderA}
                  onGenderChange={setModelGenderA}
                />
              </div>
              <div className="card border-amber-200 bg-amber-50/30">
                <div className="mb-1.5 text-xs font-medium text-amber-800">
                  👤 模特 B (穿產品 2{selectedProducts[1] ? `: ${selectedProducts[1].name?.slice(0, 20)}` : ''})
                </div>
                <ModelPicker
                  models={models.items.filter((m) => m.id !== modelIdA)}
                  value={modelIdB}
                  onChange={setModelIdB}
                  genderFilter={modelGenderB}
                  onGenderChange={setModelGenderB}
                />
              </div>
            </div>
          )}

          {displayMode === 'random' && (
            <div className="card border-purple-200 bg-purple-50/30 text-xs text-purple-800">
              🎲 隨機模式:AI 會自創 1 位模特兒 — 亞洲女性、自然穿搭、寫實外觀。想指定風格請寫在下方「額外視覺指示」(例:「短髮 25 歲女性」)
            </div>
          )}

          <div className="card">
            <ScenarioPicker scenarios={scenarios.items} value={scenarioId} onChange={setScenarioId} />
            {displayMode === 'none' && (
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
            noFace={hasHuman ? noFace : false}
            setNoFace={setNoFace}
            productSummary={productSummary}
          />
          {!hasHuman && (
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
              disabled={generating || !productCountOk || !modelsOk || (!scenarioId && !compositionRefUrl)}
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
