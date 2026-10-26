'use client';

// 短影音產生器 (KIE image-to-video)
// 流程: 挑一張素材圖 (或貼 URL) → 寫 prompt → 選 1-2 個 model → 平行產出比較
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MaterialVideoPage() {
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [modelCatalog, setModelCatalog] = useState({ models: [], defaults: [], maxAtOnce: 2, templates: [] });
  const [activeTemplateKey, setActiveTemplateKey] = useState('');

  const [sourceMode, setSourceMode] = useState('asset'); // 'asset' | 'url'
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | 上衣 | 下身 | combo
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');

  const [prompt, setPrompt] = useState('Full-body fashion walk, model turns 180 degrees, soft daylight, natural fabric drape, cinematic');
  const [duration, setDuration] = useState(5);
  const [selectedModels, setSelectedModels] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  // 初始載入 assets + model catalog
  useEffect(() => {
    fetch('/api/infuz/assets', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setAssets(d.items || []))
      .catch(() => {}).finally(() => setLoadingAssets(false));
    fetch('/api/infuz/video/models', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => {
        setModelCatalog(d);
        setSelectedModels(d.defaults || []);
      })
      .catch(() => {});
  }, []);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const effectiveImageUrl = sourceMode === 'asset'
    ? (selectedAsset?.imageUrl || '')
    : customImageUrl.trim();

  // 依分類篩素材 (上衣 / 下身 / 組合 / 全部)
  function matchCategory(a) {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'combo') return a.mode === 'combo' || a.mode === 'composition';
    const cats = (a.products || []).map((p) => p.category);
    return cats.includes(categoryFilter);
  }
  const filteredAssets = assets.filter((a) => a.imageUrl && a.mode !== 'video' && matchCategory(a));

  // 依選的 model 動態列秒數選項 (union; 若兩 model 都支援才列, 避免 fallback 混淆)
  const availableSecs = (() => {
    if (selectedModels.length === 0) return [5];
    const sets = selectedModels.map((k) => {
      const spec = modelCatalog.models.find((m) => m.key === k);
      return new Set(spec?.secs || [5]);
    });
    // 聯集 (任一支援就列; UI 用 badge 標誰支援)
    const u = new Set();
    for (const s of sets) for (const v of s) u.add(v);
    return [...u].sort((a, b) => a - b);
  })();

  // 標某秒哪些 model 支援
  function secsSupportedBy(sec) {
    return selectedModels.filter((k) => {
      const spec = modelCatalog.models.find((m) => m.key === k);
      return (spec?.secs || []).includes(sec);
    });
  }

  function toggleModel(key) {
    setSelectedModels((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      if (prev.length >= modelCatalog.maxAtOnce) {
        // 替換最舊的
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
  }

  const estCostUsd = selectedModels.reduce((sum, key) => {
    const spec = modelCatalog.models.find((m) => m.key === key);
    if (!spec) return sum;
    return sum + spec.costUsdPer5s * (duration / 5);
  }, 0);
  const maxEta = Math.max(0, ...selectedModels.map((key) => {
    const spec = modelCatalog.models.find((m) => m.key === key);
    return spec?.typicalDurationSec || 0;
  }));

  async function generate() {
    setError('');
    if (!effectiveImageUrl) { setError('先選一張素材圖或貼 URL'); return; }
    if (selectedModels.length === 0) { setError('至少選 1 個 model'); return; }
    setGenerating(true); setResults([]);
    try {
      const r = await fetch('/api/infuz/video/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageUrl: effectiveImageUrl,
          prompt: prompt.trim(),
          models: selectedModels,
          duration,
        }),
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`伺服器回非 JSON (${r.status}) · 可能 Vercel timeout, 試少選幾個 model`);
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setResults(d.results || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="space-y-6 pb-8">
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">🎬 短影音產生</h1>
          <Link href="/material" className="text-xs text-stone-500 hover:text-stone-900">← 回素材選單</Link>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          從一張靜態圖 (素材庫 or 任意 URL) → KIE image-to-video 轉短影音 · 可挑 2 個 model 平行產做 A/B 比較。
        </p>
      </div>

      {/* Step 1: 挑 input 圖 (依分類篩選) */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">1. 挑一張素材 (或貼 URL)</h2>

        <div className="flex gap-2 text-xs">
          {['asset', 'url'].map((m) => (
            <button key={m} type="button"
              onClick={() => setSourceMode(m)}
              className={`rounded-md px-3 py-1.5 ${sourceMode === m ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >{m === 'asset' ? '📸 從素材庫挑' : '🔗 貼 URL'}</button>
          ))}
        </div>

        {sourceMode === 'asset' && (
          <>
            {/* 分類 tab · 上衣 / 下身 / 組合 */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-stone-500 text-[11px]">分類:</span>
              {[
                { key: 'all',   label: '全部',   emoji: '🗂️' },
                { key: '上衣', label: '上衣',   emoji: '👕' },
                { key: '下身', label: '褲子/裙', emoji: '👖' },
                { key: 'combo', label: '組合',  emoji: '👯' },
              ].map((c) => {
                const n = assets.filter((a) => a.imageUrl && a.mode !== 'video' && (c.key === 'all' ? true : c.key === 'combo' ? (a.mode === 'combo' || a.mode === 'composition') : (a.products || []).some((p) => p.category === c.key))).length;
                const on = categoryFilter === c.key;
                return (
                  <button key={c.key} type="button"
                    onClick={() => setCategoryFilter(c.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`}
                  >{c.emoji} {c.label} <span className="font-mono tabular-nums text-[10px] opacity-60">({n})</span></button>
                );
              })}
            </div>

            {loadingAssets ? (
              <div className="text-xs text-stone-500">載入素材庫…</div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-xs text-amber-700">此分類無素材 · 先去 <Link className="underline" href="/material">產一張</Link> 再回來</div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-[320px] overflow-y-auto sm:grid-cols-6">
                {filteredAssets.slice(0, 60).map((a) => (
                  <button key={a.id} type="button"
                    onClick={() => setSelectedAssetId(a.id)}
                    className={`relative aspect-[4/5] overflow-hidden rounded-md border-2 transition ${selectedAssetId === a.id ? 'border-rose-500 ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-400'}`}
                  >
                    <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                    {selectedAssetId === a.id && <div className="absolute top-1 right-1 size-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">✓</div>}
                    {/* category badge */}
                    {(a.products || [])[0]?.category && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                        {(a.products || [])[0].category}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {sourceMode === 'url' && (
          <input
            type="url"
            className="input text-xs font-mono"
            placeholder="https://..."
            value={customImageUrl}
            onChange={(e) => setCustomImageUrl(e.target.value)}
          />
        )}
        {effectiveImageUrl && (
          <div className="mt-2 flex items-center gap-3 rounded-md bg-stone-50 p-2">
            <img src={effectiveImageUrl} alt="" className="size-20 rounded object-cover border" />
            <div className="text-[10px] text-stone-500 break-all">{effectiveImageUrl.slice(0, 100)}{effectiveImageUrl.length > 100 ? '…' : ''}</div>
          </div>
        )}
      </section>

      {/* Step 2: Prompt + 秒數 */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">2. 動作指示 (prompt · 英文效果較好)</h2>

        {/* 10 個影音模板 · 點 chip 套用 */}
        {modelCatalog.templates.length > 0 && (
          <div>
            <div className="text-[11px] text-stone-500 mb-1.5">💡 快速模板 (點套用 prompt)</div>
            <div className="flex flex-wrap gap-1.5">
              {modelCatalog.templates.map((t) => {
                const on = activeTemplateKey === t.key;
                return (
                  <button key={t.key} type="button"
                    onClick={() => {
                      setPrompt(t.prompt);
                      setActiveTemplateKey(t.key);
                    }}
                    title={t.use + ' · ' + t.prompt}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${on ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'}`}
                  >{t.label}</button>
                );
              })}
            </div>
          </div>
        )}

        <textarea
          className="input min-h-[80px] text-xs leading-relaxed font-mono"
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setActiveTemplateKey(''); }}
          placeholder="例: Full-body fashion walk, model turns 180 degrees, soft daylight, natural fabric drape, cinematic"
        />
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-stone-600">秒數:</span>
          {[4, 5, 6, 8, 10].map((s) => (
            <button key={s} type="button"
              onClick={() => setDuration(s)}
              className={`rounded-md px-2.5 py-1 text-xs ${duration === s ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >{s}s</button>
          ))}
          <span className="text-[10px] text-stone-500 ml-2">(不同 model 支援不同 · 不支援會 fallback 到該 model 的最短)</span>
        </div>
      </section>

      {/* Step 3: 選 model */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">
          3. 選 model (最多 {modelCatalog.maxAtOnce} 個同時產做 A/B · 已選 {selectedModels.length})
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {modelCatalog.models.map((m) => {
            const on = selectedModels.includes(m.key);
            return (
              <button key={m.key} type="button"
                onClick={() => toggleModel(m.key)}
                className={`rounded-lg border p-3 text-left text-xs transition ${on ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-stone-900">{m.label}</div>
                  <div className="text-[10px] font-mono tabular-nums text-stone-500 whitespace-nowrap">${m.costUsdPer5s.toFixed(2)}/5s</div>
                </div>
                <div className="mt-1 text-[11px] text-stone-600 leading-relaxed">{m.hint}</div>
                <div className="mt-1 text-[10px] font-mono text-stone-400">約 {m.typicalDurationSec}s · 支援 {m.secs.join('/')}s</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 4: 秒數 (比例由 input 圖決定) */}
      {selectedModels.length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold text-stone-900">
            4. 秒數 <span className="text-stone-500 text-xs font-normal">(選完 model 動態列出可選秒數)</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {availableSecs.map((s) => {
              const supported = secsSupportedBy(s);
              const allSupport = supported.length === selectedModels.length;
              return (
                <button key={s} type="button"
                  onClick={() => setDuration(s)}
                  title={allSupport ? '所選 model 都支援' : `只有 ${supported.length}/${selectedModels.length} 個 model 支援 · 不支援的會 fallback 到該 model 最短秒數`}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${duration === s ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'} ${!allSupport ? 'ring-1 ring-amber-400' : ''}`}
                >
                  {s}s
                  {!allSupport && <span className="ml-1 text-[9px]">⚠</span>}
                </button>
              );
            })}
          </div>

          <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-[11px] text-stone-600">
            🎞️ <strong>比例:</strong> KIE image-to-video 沒有 aspect_ratio 參數 · <strong>輸出比例跟 input 圖一樣</strong>。
            想要 9:16 直式 (Reels / Shorts) 就挑直式素材 · 想要 1:1 方框就挑方形素材。
          </div>
        </section>
      )}

      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      {/* 送出 */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-center justify-between gap-3">
        <div className="text-xs text-stone-600">
          預估成本: <span className="font-mono tabular-nums text-stone-900 font-semibold">${estCostUsd.toFixed(2)} USD</span>
          <span className="text-stone-400"> · </span>
          等候時間約 <span className="font-mono tabular-nums text-stone-900">{maxEta}s</span>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating || !effectiveImageUrl || selectedModels.length === 0}
          aria-busy={generating || undefined}
          className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {generating && (
            <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin motion-reduce:animate-none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          )}
          {generating ? `影片生成中… 請勿關閉 (約 ${maxEta}s)` : `🎬 開始產 (${selectedModels.length} 支)`}
        </button>
      </div>

      {/* 產出結果 */}
      {results.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">產出結果</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <VideoResultCard key={r.model} result={r} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function VideoResultCard({ result }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function saveToAssets() {
    setSaving(true); setSaveError('');
    try {
      const r = await fetch('/api/infuz/video/save-to-assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoUrl: result.cloudinaryUrl,
          kieModel: result.model,
          costUsd: result.costUsd,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      setSaved(true);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-sm font-semibold text-red-800">❌ {result.model}</div>
        <div className="mt-1 text-[11px] text-red-700 break-words">{result.error}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-stone-900">{result.model}</div>
        <div className="text-[10px] font-mono tabular-nums text-stone-500">${result.costUsd?.toFixed(2)}</div>
      </div>
      <video
        src={result.cloudinaryUrl}
        controls
        className="w-full aspect-[9/16] rounded bg-black object-cover"
        preload="metadata"
      />
      <div className="mt-2 flex items-center gap-2">
        <a href={result.cloudinaryUrl} target="_blank" rel="noreferrer" download
          className="text-[11px] text-stone-600 hover:text-stone-900 underline">⬇ 下載</a>
        <button onClick={saveToAssets} disabled={saving || saved}
          className={`ml-auto rounded-md px-3 py-1 text-[11px] disabled:opacity-60 ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-900 text-white hover:bg-stone-700'}`}
        >{saved ? '✓ 已存素材庫' : saving ? '存中…' : '💾 存素材庫'}</button>
      </div>
      {saveError && <div className="mt-1 text-[10px] text-red-600">⚠ {saveError}</div>}
    </div>
  );
}
