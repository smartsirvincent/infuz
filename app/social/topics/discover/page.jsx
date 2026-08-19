'use client';

// 主題發想 — 描述方向 + 選產品 → Claude 建議 10 個主題 → 勾選加入
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DiscoverPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [direction, setDirection] = useState('');
  const [defaultType, setDefaultType] = useState('text');
  const [productIds, setProductIds] = useState([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/infuz/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProducts(d.items || []))
      .catch(() => {});
  }, []);

  const pickedProducts = products.filter((p) => productIds.includes(p.id));

  async function askAI() {
    setSuggesting(true); setError(''); setSuggested([]); setSelected(new Set());
    try {
      const r = await fetch('/api/infuz/topics/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction, defaultType, productIds, count: 10 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSuggested(d.topics || []);
      setSelected(new Set((d.topics || []).map((_, i) => i))); // 預設全選
    } catch (e) { setError(e.message); }
    finally { setSuggesting(false); }
  }

  async function saveSelected() {
    setSaving(true); setError('');
    try {
      const topics = suggested.filter((_, i) => selected.has(i));
      const r = await fetch('/api/infuz/topics/bulk-add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topics, productIds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      alert(`已加入 ${d.added} 個主題到主題清單`);
      router.push('/social/schedule');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <main className="space-y-5">
      <div className="card border-purple-200 bg-purple-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">💡 主題發想</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          描述要走的方向 + 選要帶哪些產品(可不帶) → AI 建議 10 個「主題」 → 勾選加入主題清單。
          每個主題之後可產出 10-30 篇連貫的文案。
        </p>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label text-xs">🧭 方向 (選填)</label>
          <textarea
            className="input min-h-[70px] text-sm"
            placeholder="例:秋冬顯瘦系列 / 通勤穿搭 / 品牌哲學 / 早晨儀式感... 留空由 AI 自由發揮"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          />
        </div>

        <div>
          <label className="label text-xs">📝 預設類型</label>
          <div className="flex gap-2">
            {[
              { key: 'text', label: '📝 文字 (100-200 字)' },
              { key: 'long', label: '📄 長文 (300-600 字)' },
              { key: 'image', label: '🖼️ 圖片 (AI 生圖)' },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setDefaultType(o.key)}
                className={`rounded-md px-3 py-1.5 text-xs ${defaultType === o.key ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >{o.label}</button>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-stone-500">AI 建議時可能會每個主題選不同類型,這只是提示</div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label !mb-0 text-xs">🎯 綁定產品 (選填)</label>
            <button
              type="button"
              onClick={() => setShowProductPicker(!showProductPicker)}
              className="text-[11px] text-emerald-700 hover:underline"
            >
              {showProductPicker ? '收起 ▲' : `選產品... (已選 ${productIds.length})`}
            </button>
          </div>
          {pickedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {pickedProducts.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  {p.name.slice(0, 20)}
                  <button onClick={() => setProductIds(productIds.filter((x) => x !== p.id))} className="text-emerald-500 hover:text-red-600">✕</button>
                </span>
              ))}
            </div>
          )}
          {showProductPicker && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
              <input
                className="input text-xs"
                placeholder="搜尋名稱/分類..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              />
              <div className="max-h-[240px] overflow-y-auto space-y-1">
                {products.filter((p) => !productFilter || (p.name + p.category + p.gender).toLowerCase().includes(productFilter.toLowerCase())).map((p) => {
                  const on = productIds.includes(p.id);
                  return (
                    <label key={p.id} className={`flex items-center gap-2 rounded-md p-1.5 text-[11px] cursor-pointer ${on ? 'bg-emerald-100' : 'hover:bg-stone-100'}`}>
                      <input type="checkbox" checked={on}
                        onChange={(e) => setProductIds(e.target.checked ? [...productIds, p.id] : productIds.filter((x) => x !== p.id))}
                        className="size-3.5 rounded border-stone-300"
                      />
                      {p.image_front && <img src={p.image_front} alt="" className="size-8 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-stone-900 truncate">{p.name}</div>
                        <div className="text-stone-500 text-[10px]">{p.category} · {p.gender || '不分'}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="text-[10px] text-stone-500">共 {products.length} 筆產品</div>
            </div>
          )}
          <div className="mt-1 text-[10px] text-stone-500">
            💡 不選 = 只依品牌人格發想主題;選了 = 主題會綁這些產品,產文時會輪流帶入
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}

        <div className="flex justify-end">
          <button onClick={askAI} disabled={suggesting}
            className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50">
            {suggesting ? '💭 AI 發想中(約 30s)…' : '💡 AI 建議 10 個主題'}
          </button>
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800">
              🎁 AI 建議 {suggested.length} 個主題 (已選 {selected.size})
            </h2>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSelected(new Set(suggested.map((_, i) => i)))} className="text-stone-600 hover:underline">全選</button>
              <button onClick={() => setSelected(new Set())} className="text-stone-600 hover:underline">全清</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggested.map((t, i) => {
              const on = selected.has(i);
              return (
                <label key={i} className={`rounded-lg border p-3 text-xs cursor-pointer ${on ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={on}
                      onChange={() => {
                        const next = new Set(selected);
                        if (on) next.delete(i); else next.add(i);
                        setSelected(next);
                      }}
                      className="size-4 rounded border-stone-300 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm text-stone-900">{t.name}</div>
                        <span className="text-[10px] rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">
                          {t.suggestedType === 'long' ? '📄 長文' : t.suggestedType === 'image' ? '🖼️ 圖片' : '📝 文字'}
                        </span>
                      </div>
                      <p className="mt-1 text-stone-600 leading-relaxed">{t.description}</p>
                      {t.sampleHook && (
                        <div className="mt-1.5 rounded bg-white/60 px-2 py-1 text-[11px] italic text-stone-500">
                          Hook 範例:「{t.sampleHook}」
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end border-t border-stone-200 pt-3">
            <button onClick={saveSelected} disabled={saving || selected.size === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? '存中…' : `✓ 加入 ${selected.size} 個到主題清單`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
