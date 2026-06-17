'use client';

// 共用元件:產品 / 模特 / 情境 選擇器 + 共用生圖 hook
import { useEffect, useState } from 'react';

export function useEntityList(kind) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/infuz/${kind}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setItems(data.items || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind]);
  return { items, loading, error };
}

export function ProductPicker({ label, products, value, onChange, categoryFilter }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!search) return true;
    return `${p.id} ${p.name} ${p.colors}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = products.find((p) => p.id === value);

  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input mb-2 text-sm"
        placeholder="🔍 搜尋 SKU / 名稱 / 顏色"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-stone-500">沒有符合的產品</div>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`flex w-full items-center gap-3 border-b border-stone-100 px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${value === p.id ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}
          >
            {p.image_front ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.image_front} alt={p.name} className="size-12 rounded object-cover" loading="lazy" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded bg-stone-100 text-xl">📷</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-stone-500">{p.id}</div>
              <div className="truncate font-medium text-stone-900">{p.name || '(無名)'}</div>
              <div className="text-[10px] text-stone-500">{p.category}{p.colors ? ` · ${p.colors}` : ''}{p.price ? ` · $${p.price}` : ''}</div>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-1 text-[11px] text-emerald-700">✓ 已選 {selected.id} — {selected.name?.slice(0, 30)}</div>
      )}
    </div>
  );
}

export function ModelPicker({ models, value, onChange }) {
  return (
    <div>
      <label className="label">👤 選模特兒</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center text-xs hover:border-emerald-300 ${value === m.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-stone-200 bg-white'}`}
          >
            {m.reference_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={m.reference_image} alt={m.name} className="size-16 rounded-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-stone-100 text-2xl">👤</div>
            )}
            <div className="font-medium text-stone-900">{m.name}</div>
            <div className="text-[10px] text-stone-500">{m.id}</div>
          </button>
        ))}
        {models.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">尚無模特兒</div>
        )}
      </div>
    </div>
  );
}

export function ScenarioPicker({ scenarios, value, onChange }) {
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const types = Array.from(new Set(scenarios.map((s) => s.type).filter(Boolean)));
  const filtered = scenarios.filter((s) => {
    if (typeFilter && s.type !== typeFilter) return false;
    if (!search) return true;
    return `${s.id} ${s.name} ${s.prompt}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = scenarios.find((s) => s.id === value);
  return (
    <div>
      <label className="label">🎬 選情境</label>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="🔍 搜尋編號 / 名稱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">全部型態</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`block w-full border-b border-stone-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${value === s.id ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-stone-500">{s.id}</span>
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px]">{s.type}</span>
              <span className="font-medium text-stone-900">{s.name}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] text-stone-500">{s.prompt}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-stone-500">沒有符合的情境</div>
        )}
      </div>
      {selected && (
        <div className="mt-1 text-[11px] text-emerald-700">✓ 已選 {selected.id} — {selected.name}</div>
      )}
    </div>
  );
}

export function ResultPanel({ result, onReset, generating, error }) {
  if (generating) {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-3 size-12 animate-spin rounded-full border-4 border-stone-200 border-t-emerald-500"></div>
        <p className="text-sm text-stone-700">🎨 AI 生圖中…</p>
        <p className="mt-1 text-xs text-stone-500">通常 30-60 秒</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="text-sm text-red-700">❌ {error}</p>
        <button onClick={onReset} className="mt-2 text-xs text-red-600 underline">重試</button>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">🎉 生成完成</h2>
        <button onClick={onReset} className="text-xs text-stone-500 hover:text-stone-900">再生一張</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.url} alt="result" className="mx-auto aspect-square w-full max-w-md rounded-lg object-cover" />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-stone-500">耗時 {Math.round((result.kieMs || 0) / 1000)}s</span>
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          download
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          ⬇ 下載
        </a>
      </div>
    </div>
  );
}
