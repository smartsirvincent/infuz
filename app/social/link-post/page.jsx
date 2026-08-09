'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DEFAULT_UTM = {
  source: { threads: 'threads', instagram: 'ig', facebook: 'fb' },
  medium: 'social',
  campaign: 'infuz_social',
};

/**
 * 幫 URL 加 UTM 參數
 */
function withUtm(url, platformId, utmCfg) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const src = utmCfg?.source?.[platformId] || platformId;
    if (src) u.searchParams.set('utm_source', src);
    if (utmCfg?.medium) u.searchParams.set('utm_medium', utmCfg.medium);
    if (utmCfg?.campaign) u.searchParams.set('utm_campaign', utmCfg.campaign);
    return u.toString();
  } catch (_) {
    return url;
  }
}

export default function LinkPostPage() {
  const [products, setProducts] = useState([]);
  const [conn, setConn] = useState(null);
  const [utm, setUtm] = useState(DEFAULT_UTM);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState('');
  const [textBody, setTextBody] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [platforms, setPlatforms] = useState({ threads: true, facebook: true });
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [pRes, cRes, sRes] = await Promise.all([
          fetch('/api/infuz/products', { cache: 'no-store' }),
          fetch('/api/infuz/connections', { cache: 'no-store' }),
          fetch('/api/infuz/settings', { cache: 'no-store' }),
        ]);
        const pData = await pRes.json();
        const cData = await cRes.json();
        const sData = await sRes.json();
        setProducts(pData.items || []);
        setConn((cData.items || []).find((x) => x.id === 'main') || null);
        const settings = (sData.items || []).find((x) => x.id === 'main');
        if (settings?.utm) setUtm({ ...DEFAULT_UTM, ...settings.utm, source: { ...DEFAULT_UTM.source, ...(settings.utm.source || {}) } });
      } catch (_) {} finally { setLoading(false); }
    })();
  }, []);

  const selected = products.find((p) => p.id === productId);
  const canThreads = !!conn?.threads?.accessToken;
  const canFb = !!conn?.facebook?.pageAccessToken;

  async function suggestCopy() {
    if (!selected) { setError('先選產品'); return; }
    setSuggesting(true);
    setError('');
    try {
      const r = await fetch('/api/infuz/suggest-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'link-post',
          products: [selected],
          scenario: '導購連結貼文',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      // 移除 AI 可能自動加的 URL,由發文時動態加 UTM 版
      setTextBody((d.copy || '').replace(/https?:\/\/\S+/g, '').trim());
    } catch (e) { setError('AI 建議失敗:' + e.message); }
    finally { setSuggesting(false); }
  }

  async function handlePublish() {
    if (!selected) { setError('先選產品'); return; }
    if (!selected.purchase_url) { setError('這個產品沒設購買網址 (去 /products 補)'); return; }
    if (!textBody.trim()) { setError('要有文案'); return; }
    const wanted = Object.keys(platforms).filter((k) => platforms[k]);
    if (wanted.length === 0) { setError('至少要選 1 個平台'); return; }
    setError('');
    setPublishing(true);
    setResult(null);

    // 各平台不同 UTM URL,分別發送
    const perPlatform = {};
    for (const p of wanted) {
      const url = withUtm(selected.purchase_url, p, utm);
      perPlatform[p] = { text: `${textBody}\n\n👉 ${url}` };
    }

    try {
      // 分平台依序發 (因為每個平台文案不同,不能一次發)
      const results = {};
      await Promise.all(wanted.map(async (p) => {
        const singlePlatform = { threads: false, instagram: false, facebook: false };
        singlePlatform[p] = true;
        const r = await fetch('/api/infuz/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: perPlatform[p].text,
            platforms: singlePlatform,
          }),
        });
        const d = await r.json();
        if (r.ok && d.results) {
          results[p] = d.results[p];
        } else {
          results[p] = { ok: false, error: d.error || `HTTP ${r.status}` };
        }
      }));
      setResult({ ok: Object.values(results).every((r) => r?.ok), results });
    } catch (e) { setError(e.message); }
    finally { setPublishing(false); }
  }

  const filtered = products.filter((p) => {
    if (!search) return true;
    return `${p.id} ${p.name} ${p.colors}`.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <main><div className="card text-center text-stone-500">載入中…</div></main>;

  return (
    <main className="space-y-5">
      <div className="card border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">🔗 連結貼文</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          選一個產品 → 系統自動加 <code className="rounded bg-white px-1 text-[11px]">utm_source/medium/campaign</code> → AI 產文 → 直發 Threads / FB 粉專。
        </p>
        <p className="mt-1 text-[11px] text-stone-500">UTM 參數在 <Link href="/settings" className="underline">/settings</Link> 設定</p>
      </div>

      {/* 選產品 */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">1. 選要導購的產品</h2>
        <input
          className="input text-sm"
          placeholder="🔍 搜尋 SKU / 名稱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
            {selected.image_front && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={selected.image_front} alt="" className="size-16 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-stone-500">{selected.id}</div>
              <div className="text-sm font-medium text-stone-900 truncate">{selected.name}</div>
              <div className="text-[10px] text-stone-500 break-all">🔗 {selected.purchase_url || '(尚未設購買網址)'}</div>
            </div>
            <button onClick={() => setProductId('')} className="text-xs text-stone-500 hover:text-red-600">✕ 換</button>
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white">
            {filtered.slice(0, 30).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                className="flex w-full items-center gap-2 border-b border-stone-100 p-2 text-left text-xs hover:bg-emerald-50 last:border-b-0"
              >
                {p.image_front && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image_front} alt="" className="size-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-stone-500">{p.id}</div>
                  <div className="truncate text-stone-800">{p.name}</div>
                  {!p.purchase_url && <div className="text-[10px] text-amber-600">⚠ 沒購買網址</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 文案 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">2. 文案 (連結會自動加在結尾)</h2>
          <button
            type="button"
            onClick={suggestCopy}
            disabled={suggesting || !selected}
            className="text-[11px] text-emerald-700 hover:underline disabled:opacity-50"
          >
            {suggesting ? '生成中…' : '✨ AI 建議'}
          </button>
        </div>
        <textarea
          className="input min-h-[140px] text-sm leading-relaxed"
          value={textBody}
          onChange={(e) => setTextBody(e.target.value)}
          placeholder="寫貼文文案 或 選好產品後按 AI 建議..."
        />
        {selected?.purchase_url && (
          <div className="rounded-lg bg-stone-50 p-2 text-[11px] text-stone-600">
            <div className="font-medium mb-1">📎 各平台的 URL 預覽 (自動加 UTM):</div>
            <div className="space-y-0.5 font-mono text-[10px] break-all">
              <div>🧵 <span className="text-blue-700">{withUtm(selected.purchase_url, 'threads', utm)}</span></div>
              <div>👍 <span className="text-blue-700">{withUtm(selected.purchase_url, 'facebook', utm)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* 平台 */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">3. 選平台</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PlatformBox label="🧵 Threads" enabled={canThreads} checked={platforms.threads} onChange={(v) => setPlatforms({ ...platforms, threads: v })} />
          <PlatformBox label="👍 Facebook 粉專" enabled={canFb} checked={platforms.facebook} onChange={(v) => setPlatforms({ ...platforms, facebook: v })} />
        </div>
        <p className="text-[10px] text-stone-500">📷 Instagram bio 才能放連結,不支援貼文帶超連結,這裡不列</p>
      </div>

      {error && !publishing && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || !selected || !textBody.trim()}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {publishing ? '發送中…' : '🚀 一鍵發文 (帶 UTM)'}
        </button>
      </div>

      {publishing && <div className="card text-center text-sm text-stone-700">🚀 發送中… (各平台獨立發送)</div>}
      {result && !publishing && <PublishResult result={result} />}
    </main>
  );
}

function PlatformBox({ label, enabled, checked, onChange }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border p-3 ${!enabled ? 'border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed' : checked ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-stone-200 hover:bg-stone-50 cursor-pointer'}`}>
      <input type="checkbox" checked={checked && enabled} disabled={!enabled} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-stone-300 text-emerald-600" />
      <div className="flex-1">
        <div className="text-sm font-medium text-stone-900">{label}</div>
        {!enabled && <div className="text-[10px] text-red-600">尚未連接 (去 /settings)</div>}
      </div>
    </label>
  );
}

function PublishResult({ result }) {
  return (
    <div className="card space-y-2">
      <h2 className={`text-lg font-semibold ${result.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {result.ok ? '🎉 全部平台發送成功' : '⚠ 部分平台結果'}
      </h2>
      {Object.entries(result.results || {}).map(([k, r]) => (
        <div key={k} className={`rounded-lg border p-2 text-sm ${r?.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div>{r?.ok ? '✓' : '✗'} <strong>{k}</strong> {r?.ms && `(${(r.ms / 1000).toFixed(1)}s)`}</div>
          {r?.permalink && <a href={r.permalink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">{r.permalink}</a>}
          {!r?.ok && r?.error && <div className="text-xs text-red-700">{r.error}</div>}
        </div>
      ))}
    </div>
  );
}
