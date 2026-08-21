'use client';

// 發文成效 · 分平台 (Threads/IG/FB) + 按主題篩選
// MVP: 顯示發文狀態 + 平台圖示 + permalink · 深指標之後補
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader, StatCard, EmptyState } from '../_components.jsx';

const PLATFORM_META = {
  threads: { label: '🧵 Threads', color: 'bg-black text-white' },
  instagram: { label: '📷 IG', color: 'bg-pink-600 text-white' },
  facebook: { label: '👍 FB', color: 'bg-blue-600 text-white' },
};

export default function InsightsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch('/api/infuz/insights', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data?.posts) return [];
    const cutoffMs = dateRange === 'all' ? 0 : Date.now() - Number(dateRange.replace('d', '')) * 86400000;
    return data.posts.filter((p) => {
      if (cutoffMs && new Date(p.publishedAt).getTime() < cutoffMs) return false;
      if (topicFilter !== 'all' && p.topicName !== topicFilter) return false;
      if (platformFilter !== 'all' && !p.results?.[platformFilter]?.ok) return false;
      return true;
    });
  }, [data, platformFilter, topicFilter, dateRange]);

  if (loading) return <main className="card">載入中…</main>;
  if (!data) return <main className="card">無法載入</main>;

  const uniqueTopics = Array.from(new Set((data.posts || []).map((p) => p.topicName).filter(Boolean)));

  return (
    <main className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="發文成效"
        breadcrumbs={[{ href: '/social', label: '社群發文' }, { label: '發文成效' }]}
        description="所有已發貼文,分平台 / 主題 / 日期篩選。點連結到原文看實際互動。深指標之後補上。"
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={data.total} />
        <StatCard label="Threads" value={data.byPlatform.threads || 0} />
        <StatCard label="Instagram" value={data.byPlatform.instagram || 0} />
        <StatCard label="Facebook" value={data.byPlatform.facebook || 0} />
      </section>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label text-xs">平台</label>
            <select className="input text-sm" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="all">全部平台</option>
              <option value="threads">🧵 只看 Threads</option>
              <option value="instagram">📷 只看 IG</option>
              <option value="facebook">👍 只看 FB</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">主題</label>
            <select className="input text-sm" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
              <option value="all">全部主題</option>
              {uniqueTopics.map((t) => (
                <option key={t} value={t}>{t} ({data.byTopic[t]})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">時間</label>
            <select className="input text-sm" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="7d">近 7 天</option>
              <option value="30d">近 30 天</option>
              <option value="90d">近 90 天</option>
              <option value="all">全部</option>
            </select>
          </div>
        </div>
        <div className="text-[11px] text-stone-500">符合條件:{filtered.length} 篇</div>
      </div>

      {/* Posts list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card text-center text-sm text-stone-500 py-8">
            這個條件下沒有發文紀錄
          </div>
        )}
        {filtered.map((p) => (
          <PostRow key={p.id} post={p} onZoom={(url) => setLightbox(url)} />
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </main>
  );
}

function PostRow({ post, onZoom }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start gap-3">
        {post.imageUrl && (
          <button onClick={() => onZoom(post.imageUrl)} className="shrink-0">
            <img src={post.imageUrl} alt="" className="size-20 rounded object-cover border hover:opacity-80" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] rounded bg-stone-100 px-1.5 py-0.5 text-stone-600 truncate max-w-[200px]">
              {post.topicName || '(未分類)'}
            </span>
            <span className="text-[10px] text-stone-500">
              {new Date(post.publishedAt).toLocaleString('zh-TW')}
            </span>
          </div>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-stone-800 font-sans line-clamp-3">{post.text}</pre>
          {post.hashtags && <div className="mt-0.5 text-[10px] text-emerald-700 line-clamp-1">{post.hashtags}</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(post.results || {}).map(([k, r]) => {
              const meta = PLATFORM_META[k];
              if (!meta || !r?.ok) return null;
              const el = (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${meta.color}`}>
                  {meta.label} ✓
                </span>
              );
              return r.permalink ? (
                <a key={k} href={r.permalink} target="_blank" rel="noreferrer" className="hover:opacity-80" title="開原文">{el}</a>
              ) : (
                <span key={k}>{el}</span>
              );
            })}
            {Object.entries(post.results || {}).map(([k, r]) => {
              if (!r || r.ok) return null;
              return (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700" title={r.error}>
                  {PLATFORM_META[k]?.label || k} ✗
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
