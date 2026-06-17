'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useEntityList, ProductPicker, ModelPicker, ScenarioPicker, ResultPanel,
} from '@/components/MaterialPickers';

export default function MaterialSinglePage() {
  const products = useEntityList('products');
  const models = useEntityList('models');
  const scenarios = useEntityList('scenarios');

  const [productId, setProductId] = useState('');
  const [modelId, setModelId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!productId || !modelId || !scenarioId) {
      setError('產品 / 模特 / 情境 都必選');
      return;
    }
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/infuz/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'single', productId, modelId, scenarioId, extraPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setResult(null);
    setError('');
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
        <p className="mt-1 text-sm text-stone-600">挑 1 件衣服 + 1 模特 + 1 情境,AI 合成 1:1 視覺。</p>
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
              <ModelPicker models={models.items} value={modelId} onChange={setModelId} />
            </div>
          </div>

          <div className="card">
            <ScenarioPicker scenarios={scenarios.items} value={scenarioId} onChange={setScenarioId} />
          </div>

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

          <ResultPanel result={result} onReset={reset} generating={generating} error={generating ? null : null} />
        </>
      )}
    </main>
  );
}
