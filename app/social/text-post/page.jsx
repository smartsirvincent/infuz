'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TextPostPage() {
  const [conn, setConn] = useState(null);
  const [text, setText] = useState('');
  const [platforms, setPlatforms] = useState({ threads: true, facebook: false });
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [topicHint, setTopicHint] = useState(''); // 用戶給 AI 的方向提示 (可空)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/infuz/connections', { cache: 'no-store' });
        const d = await r.json();
        setConn((d.items || []).find((x) => x.id === 'main') || null);
      } catch (_) {}
    })();
  }, []);

  const canThreads = !!conn?.threads?.accessToken;
  const canFb = !!conn?.facebook?.pageAccessToken;

  async function suggestCopy() {
    setSuggesting(true);
    setError('');
    try {
      const r = await fetch('/api/infuz/suggest-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'text-post',
          products: [],
          scenario: topicHint || '穿搭建議',
          slogan: topicHint,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setText(d.copy || '');
    } catch (e) { setError('AI 建議失敗:' + e.message); }
    finally { setSuggesting(false); }
  }

  async function handlePublish() {
    if (!text.trim()) { setError('要有文案'); return; }
    if (!platforms.threads && !platforms.facebook) { setError('至少要選 1 個平台'); return; }
    setError('');
    setPublishing(true);
    setResult(null);
    try {
      const r = await fetch('/api/infuz/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, platforms }),
      });
      const d = await r.json();
      setResult(d);
      if (!r.ok && !d.results) throw new Error(d.error || `HTTP ${r.status}`);
    } catch (e) { setError(e.message); }
    finally { setPublishing(false); }
  }

  return (
    <main className="space-y-5">
      <div className="card border-brand-200 bg-brand-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">📝 文字貼文</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">純文字 → 直發 Threads / FB 粉專。IG 需要圖片,這個入口不支援。</p>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label text-xs">主題方向 (選填,讓 AI 幫寫方向)</label>
          <input
            className="input text-sm"
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            placeholder="例:秋冬顯瘦穿搭 / 假胯困擾觀點 / 週末約會穿搭"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label !mb-0 text-xs">文案內容</label>
            <button
              type="button"
              onClick={suggestCopy}
              disabled={suggesting}
              className="text-[11px] text-emerald-700 hover:underline disabled:opacity-50"
            >
              {suggesting ? '生成中…' : '✨ AI 建議'}
            </button>
          </div>
          <textarea
            className="input min-h-[180px] text-sm leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="寫貼文文案 或 上方輸入方向後按 AI 建議..."
          />
          <div className="mt-1 text-[10px] text-stone-500">字數:{text.length} · Threads 超過 500 會分回覆串</div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">📤 選平台</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PlatformBox pKey="threads" label="🧵 Threads" enabled={canThreads} checked={platforms.threads} onChange={(v) => setPlatforms({ ...platforms, threads: v })} />
          <PlatformBox pKey="facebook" label="👍 Facebook 粉專" enabled={canFb} checked={platforms.facebook} onChange={(v) => setPlatforms({ ...platforms, facebook: v })} />
        </div>
        <p className="text-[10px] text-stone-500">📷 Instagram 需要圖片, 用<Link href="/social/image-post" className="underline text-emerald-700">圖片貼文</Link>入口</p>
      </div>

      {error && !publishing && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || !text.trim()}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {publishing ? '發送中…' : '🚀 一鍵發文'}
        </button>
      </div>

      {publishing && <div className="card text-center text-sm text-stone-700">🚀 發送中…</div>}
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
        {result.ok ? '🎉 發送成功' : '⚠ 部分平台失敗'}
      </h2>
      {Object.entries(result.results || {}).map(([k, r]) => (
        <div key={k} className={`rounded-lg border p-2 text-sm ${r.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div>
            {r.ok ? '✓' : '✗'} <strong>{k}</strong> {r.ok && r.ms && `(${(r.ms / 1000).toFixed(1)}s)`}
          </div>
          {r.permalink && <a href={r.permalink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">{r.permalink}</a>}
          {!r.ok && r.error && <div className="text-xs text-red-700">{r.error}</div>}
        </div>
      ))}
    </div>
  );
}
