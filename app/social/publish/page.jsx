'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLATFORM_INFO = [
  { key: 'threads', label: 'Threads', emoji: '🧵' },
  { key: 'instagram', label: 'Instagram', emoji: '📷' },
  { key: 'facebook', label: 'Facebook 粉專', emoji: '👍' },
];

export default function SocialPublishPage() {
  const [assets, setAssets] = useState([]);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pickedAsset, setPickedAsset] = useState(null);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hashtags, setHashtags] = useState('#Infuz #顯瘦寬褲');
  const [platforms, setPlatforms] = useState({ threads: true, instagram: false, facebook: false });

  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [aRes, cRes] = await Promise.all([
          fetch('/api/infuz/assets', { cache: 'no-store' }),
          fetch('/api/infuz/connections', { cache: 'no-store' }),
        ]);
        const aData = await aRes.json();
        const cData = await cRes.json();
        setAssets((aData.items || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        setConn((cData.items || []).find((x) => x.id === 'main') || null);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  function pickAsset(a) {
    setPickedAsset(a);
    setImageUrl(a.imageUrl || '');
    if (a.copy) setText(a.copy);
    setResult(null);
    setError('');
  }

  function clearAsset() {
    setPickedAsset(null);
    setImageUrl('');
    setResult(null);
  }

  const canIg = !!conn?.facebook?.igUserId;
  const canFb = !!conn?.facebook?.pageAccessToken;
  const canThreads = !!conn?.threads?.accessToken;
  const hasImage = !!imageUrl?.trim();

  async function handlePublish() {
    if (!text.trim() && !imageUrl.trim()) {
      setError('要有文字或圖片');
      return;
    }
    const wanted = Object.keys(platforms).filter((k) => platforms[k]);
    if (wanted.length === 0) {
      setError('至少要選 1 個平台');
      return;
    }
    setError('');
    setPublishing(true);
    setResult(null);
    try {
      const r = await fetch('/api/infuz/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: pickedAsset?.id || null,
          text,
          imageUrl: imageUrl || null,
          hashtags,
          platforms,
        }),
      });
      const d = await r.json();
      setResult(d);
      if (!r.ok && !d.results) throw new Error(d.error || `HTTP ${r.status}`);
    } catch (e) {
      setError(e.message);
    } finally { setPublishing(false); }
  }

  if (loading) {
    return <main><div className="card text-center text-stone-500">載入中…</div></main>;
  }

  return (
    <main className="space-y-5">
      <div className="card border-blue-200 bg-blue-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">🚀 多平台直發</h1>
            <p className="mt-1 text-sm text-stone-600">直接串 Threads / IG / FB Graph API 發文,不用 webhook。</p>
          </div>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {canThreads ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">🧵 Threads 已連 @{conn.threads.username}</span>
            : <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">🧵 Threads 未連</span>}
          {canFb ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">👍 FB 已連 {conn.facebook.pageName}</span>
            : <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">👍 FB 未連</span>}
          {canIg ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">📷 IG 已連 @{conn.facebook.igUsername}</span>
            : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">📷 IG 未連</span>}
          <Link href="/social/accounts" className="text-blue-600 underline">帳號管理 →</Link>
        </div>
      </div>

      {/* 內容 */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">📝 貼文內容</h2>

        {/* 挑素材 */}
        <div>
          <label className="label text-xs">從素材庫挑一張 (選填,可直接寫純文字發)</label>
          {pickedAsset ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              {pickedAsset.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pickedAsset.imageUrl} alt="" className="size-16 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-stone-500">{pickedAsset.id}</div>
                <div className="text-sm font-medium text-stone-900 truncate">
                  {(pickedAsset.products || []).map((p) => p.name).join(' + ') || '(無產品名)'}
                </div>
              </div>
              <button onClick={clearAsset} className="text-xs text-stone-500 hover:text-red-600">✕ 換一張</button>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white">
              {assets.length === 0 && <div className="p-4 text-center text-xs text-stone-500">尚無素材 (先去 /material 生圖)</div>}
              {assets.slice(0, 20).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickAsset(a)}
                  className="flex w-full items-center gap-3 border-b border-stone-100 p-2 text-left text-xs hover:bg-emerald-50 last:border-b-0"
                >
                  {a.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.imageUrl} alt="" className="size-12 rounded object-cover" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded bg-stone-100 text-lg">📷</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-stone-500">{a.id}</div>
                    <div className="truncate text-stone-800">{(a.products || []).map((p) => p.name).join(' + ') || '?'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 圖片 URL (可覆蓋 / 自填) */}
        <div>
          <label className="label text-xs">圖片 URL (選填)</label>
          <input
            type="url"
            className="input text-sm font-mono"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://res.cloudinary.com/..."
          />
        </div>

        {/* 文案 */}
        <div>
          <label className="label text-xs">文案 (Threads/IG/FB 共用)</label>
          <textarea
            className="input min-h-[140px] text-sm leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="寫貼文文案..."
          />
          <div className="mt-1 text-[10px] text-stone-500">
            字數:{text.length} · Threads 超過 500 會自動分回覆串 · IG 上限 2200 · FB 上限 63k
          </div>
        </div>

        {/* Hashtags (IG 專用) */}
        <div>
          <label className="label text-xs">Hashtags (IG 專用,空白 / 逗號分隔)</label>
          <input
            type="text"
            className="input text-sm"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#Infuz #顯瘦寬褲"
          />
        </div>
      </div>

      {/* 平台 */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">📤 選發佈平台</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PLATFORM_INFO.map((p) => {
            const isConnected = p.key === 'threads' ? canThreads : p.key === 'facebook' ? canFb : canIg;
            const needsImg = p.key === 'instagram' && !hasImage;
            const disabled = !isConnected || needsImg;
            return (
              <label
                key={p.key}
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${disabled ? 'border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed' : platforms[p.key] ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-stone-200 hover:bg-stone-50 cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={platforms[p.key] && !disabled}
                  disabled={disabled}
                  onChange={(e) => setPlatforms({ ...platforms, [p.key]: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-stone-300 text-emerald-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-stone-900">{p.emoji} {p.label}</div>
                  {!isConnected && <div className="text-[10px] text-red-600">尚未連接</div>}
                  {isConnected && needsImg && <div className="text-[10px] text-amber-700">需要圖片</div>}
                  {isConnected && !needsImg && <div className="text-[10px] text-emerald-600">✓ 可發</div>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {error && !publishing && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || (!text.trim() && !imageUrl.trim())}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {publishing ? '🚀 發送中… (可能 30-90 秒)' : '🚀 一鍵發文'}
        </button>
      </div>

      {publishing && (
        <div className="card text-center">
          <div className="mx-auto mb-2 size-10 animate-spin rounded-full border-4 border-stone-200 border-t-blue-500"></div>
          <p className="text-sm text-stone-700">正在依序發到各平台…</p>
          <p className="mt-1 text-[11px] text-stone-500">Threads / IG 有 media container 處理,可能 30-90 秒</p>
        </div>
      )}

      {result && !publishing && <ResultCard result={result} />}
    </main>
  );
}

function ResultCard({ result }) {
  return (
    <div className="card space-y-3">
      <h2 className={`text-lg font-semibold ${result.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {result.ok ? '🎉 全部平台發送成功' : '⚠ 部分平台發送結果'}
      </h2>
      <div className="space-y-2">
        {Object.entries(result.results || {}).map(([platformId, r]) => {
          const info = PLATFORM_INFO.find((x) => x.key === platformId);
          return (
            <div key={platformId} className={`rounded-lg border p-3 text-sm ${r.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <span>{info?.emoji}</span>
                <strong>{info?.label || platformId}</strong>
                {r.ok ? <span className="text-emerald-700">✓ 成功</span> : <span className="text-red-700">✗ 失敗</span>}
                {r.ms > 0 && <span className="ml-auto text-[10px] text-stone-500">{(r.ms / 1000).toFixed(1)}s</span>}
              </div>
              {r.ok && r.permalink && (
                <a href={r.permalink} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-blue-600 underline break-all">
                  🔗 {r.permalink}
                </a>
              )}
              {r.ok && r.ids && (
                <div className="mt-0.5 text-[10px] text-stone-500 font-mono">ID: {r.ids.join(', ')}</div>
              )}
              {!r.ok && r.error && (
                <div className="mt-1 text-xs text-red-700">{r.preflight ? '⚠ ' : '❌ '}{r.error}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
