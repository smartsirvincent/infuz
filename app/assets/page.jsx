'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MODES = [
  { value: '', label: '全部' },
  { value: 'single', label: '單件' },
  { value: 'combo', label: '搭配' },
];

export default function AssetsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // 點圖放大

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/infuz/assets', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // 最新在前
      const sorted = (data.items || []).slice().sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setItems(sorted);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleDelete(id) {
    if (!confirm(`確定刪除 ${id}?\n(只從清單拿掉,Cloudinary 上的圖檔不會動)`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/infuz/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      alert('刪除失敗: ' + e.message);
    } finally { setBusy(false); }
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      alert('✓ 已複製: ' + label);
    } catch (_) {
      prompt('手動複製:', text);
    }
  }

  const filtered = items.filter((it) => {
    if (modeFilter && it.mode !== modeFilter) return false;
    if (!filter) return true;
    const f = filter.toLowerCase();
    const productMatch = (it.products || []).some(
      (p) => `${p.id} ${p.name}`.toLowerCase().includes(f)
    );
    return productMatch
      || (it.id || '').toLowerCase().includes(f)
      || (it.modelName || '').toLowerCase().includes(f)
      || (it.scenarioName || '').toLowerCase().includes(f);
  });

  return (
    <main className="space-y-5">
      <div className="card border-emerald-200 bg-emerald-50/40">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">🗂 素材資料庫</h1>
        <p className="mt-1 text-sm text-stone-600">
          所有從 <Link href="/material/single" className="underline text-emerald-700">單件</Link> 或 <Link href="/material/combo" className="underline text-emerald-700">搭配</Link> 生成的圖片自動入庫。
        </p>
        {!loading && (
          <p className="mt-2 text-xs text-emerald-700">
            共 <strong>{items.length}</strong> 張素材
          </p>
        )}
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="🔍 搜尋編號 / 衣服名稱 / SKU / 模特 / 情境"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || busy}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
        >
          ↻ 重新整理
        </button>
      </div>

      {loading ? (
        <div className="card text-center text-stone-500">載入中…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <article key={a.id} className="card flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setPreview(a)}
                className="block overflow-hidden rounded-lg bg-stone-100 hover:opacity-90"
              >
                {a.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.imageUrl} alt={a.id} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-stone-400">📷</div>
                )}
              </button>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-stone-500">{a.id}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${a.mode === 'combo' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {a.mode === 'combo' ? '搭配' : '單件'}
                  </span>
                </div>

                {(a.products || []).map((p, i) => (
                  <div key={i} className="text-xs">
                    <div className="font-medium text-stone-800">
                      {a.mode === 'combo' && (
                        <span className="mr-1 text-[10px] text-stone-500">{i === 0 ? '上衣' : '下身'}:</span>
                      )}
                      {p.name || p.id}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                      <span className="font-mono">{p.id}</span>
                      {p.purchase_url ? (
                        <>
                          <span>·</span>
                          <a href={p.purchase_url} target="_blank" rel="noreferrer" className="truncate text-emerald-700 hover:underline">
                            {p.purchase_url.replace(/^https?:\/\//, '').slice(0, 25)}…
                          </a>
                          <button
                            type="button"
                            onClick={() => copyText(p.purchase_url, '購買網址')}
                            className="text-stone-400 hover:text-stone-700"
                            title="複製連結"
                          >
                            📋
                          </button>
                        </>
                      ) : (
                        <span className="text-stone-400">無購買連結</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="text-[10px] text-stone-500">
                  {a.modelName && <>模特: {a.modelName} · </>}
                  {a.scenarioName && <>情境: {a.scenarioName} · </>}
                  {a.createdAt && <>{new Date(a.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</>}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <a
                    href={a.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                  >
                    ⬇ 下載
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(a.imageUrl, '圖片網址')}
                    className="rounded-md border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                  >
                    📎 複製圖片網址
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    disabled={busy}
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    🗑 刪除
                  </button>
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full card text-center text-stone-500">
              {items.length === 0 ? '尚無素材,去 /material/single 或 /material/combo 生圖' : '沒有符合的素材'}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-full max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.imageUrl} alt={preview.id} className="max-h-[85vh] rounded-lg" />
            <div className="mt-2 text-center text-xs text-stone-300">{preview.id} · 點任一處關閉</div>
          </div>
        </div>
      )}
    </main>
  );
}
