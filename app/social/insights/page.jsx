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
  const [followers, setFollowers] = useState(null); // {threads, instagram, facebook, errors}
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // 快捷 preset 按鈕: 選了就自動填 from/to
  function applyPreset(preset) {
    setDateRange(preset);
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    if (preset === 'all') {
      setFromDate(''); setToDate('');
      return;
    }
    const days = Number(preset.replace('d', ''));
    const from = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
    setFromDate(from);
    setToDate(to);
  }

  useEffect(() => {
    fetch('/api/infuz/insights', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    // 平行抓 followers
    fetch('/api/infuz/insights/followers', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setFollowers(d))
      .catch(() => {})
      .finally(() => setLoadingFollowers(false));
  }, []);

  async function refreshAllInsights() {
    if (!data?.posts?.length) return;
    setRefreshingAll(true);
    const topicPosts = data.posts.filter((p) => p.source === 'topic');
    let ok = 0, fail = 0;
    for (const p of topicPosts) {
      try {
        const r = await fetch('/api/infuz/insights/refresh', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ postId: p.id }),
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }
    // reload
    const fresh = await fetch('/api/infuz/insights', { cache: 'no-store' }).then((r) => r.json());
    setData(fresh);
    setRefreshingAll(false);
    alert(`批次刷新完成 · 成功 ${ok} · 失敗 ${fail}${topicPosts.length < data.posts.length ? ` (氣候即時 ${data.posts.length - topicPosts.length} 篇跳過)` : ''}`);
  }

  const filtered = useMemo(() => {
    if (!data?.posts) return [];
    // 有 from/to 就用 range; from 到 to 各給日界 (00:00 / 23:59:59)
    const fromMs = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : 0;
    const toMs = toDate ? new Date(toDate + 'T23:59:59.999').getTime() : Infinity;
    return data.posts.filter((p) => {
      const pubMs = p.publishedAt ? new Date(p.publishedAt).getTime() : 0;
      if (fromMs && pubMs < fromMs) return false;
      if (toMs !== Infinity && pubMs > toMs) return false;
      if (topicFilter !== 'all' && p.topicName !== topicFilter) return false;
      if (platformFilter !== 'all' && !p.results?.[platformFilter]?.ok) return false;
      return true;
    });
  }, [data, platformFilter, topicFilter, fromDate, toDate]);

  // 初始載入時套用預設 30d 讓 from/to 有值
  useEffect(() => { if (data && !fromDate && !toDate) applyPreset('30d'); }, [data]);

  if (loading) return <main className="card">載入中…</main>;
  if (!data) return <main className="card">無法載入</main>;

  const uniqueTopics = Array.from(new Set((data.posts || []).map((p) => p.topicName).filter(Boolean)));

  // Aggregate (依 filter 過濾後): by-topic + by-platform 累加深指標
  const aggregate = computeAggregate(filtered);

  return (
    <main className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="發文成效"
        breadcrumbs={[{ href: '/social', label: '社群發文' }, { label: '發文成效' }]}
        description="粉絲數 + 貼文成效 · 依主題/平台/日期彙總。抓不到指標請按刷新 (Meta 抓取通常延遲 10-30 分鐘)"
        actions={
          <button onClick={refreshAllInsights} disabled={refreshingAll}
            className="text-xs px-3 py-1.5 rounded-md border border-divider text-ink hover:bg-linen disabled:opacity-50"
          >{refreshingAll ? '刷新中…' : '🔄 批次刷新指標'}</button>
        }
      />

      {/* Followers · 3 平台目前總粉絲/追蹤 */}
      <section>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Followers</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FollowerCard label="🧵 Threads" data={followers?.threads} error={followers?.errors?.threads} loading={loadingFollowers} />
          <FollowerCard label="📷 Instagram" data={followers?.instagram} error={followers?.errors?.instagram} loading={loadingFollowers} />
          <FollowerCard label="👍 Facebook" data={followers?.facebook} error={followers?.errors?.facebook} loading={loadingFollowers} />
        </div>
      </section>

      {/* Posts count · 4 卡 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total posts" value={data.total} />
        <StatCard label="Threads posts" value={data.byPlatform.threads || 0} />
        <StatCard label="IG posts" value={data.byPlatform.instagram || 0} />
        <StatCard label="FB posts" value={data.byPlatform.facebook || 0} />
      </section>

      {/* Filters */}
      <div className="rounded-2xl border border-divider bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>

        {/* Date range · from/to + preset 快捷 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0 text-xs">日期範圍</label>
            <div className="flex gap-1">
              {[
                { key: '7d', label: '近 7 天' },
                { key: '30d', label: '近 30 天' },
                { key: '90d', label: '近 90 天' },
                { key: 'all', label: '全部' },
              ].map((p) => (
                <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
                  className="text-[10px] px-2 py-0.5 rounded border border-divider text-muted hover:border-ink hover:text-ink transition motion-reduce:transition-none"
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">From</div>
              <input type="date" className="input text-sm" value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setDateRange('custom'); }}
                max={toDate || undefined}
              />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">To</div>
              <input type="date" className="input text-sm" value={toDate}
                onChange={(e) => { setToDate(e.target.value); setDateRange('custom'); }}
                min={fromDate || undefined}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-divider">
          <span>符合條件 · <span className="font-mono tabular-nums text-ink font-medium">{filtered.length}</span> 篇</span>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); setDateRange('all'); }}
              className="text-xs text-muted hover:text-ink underline underline-offset-2"
            >清除日期</button>
          )}
        </div>
      </div>

      {/* Aggregate · 依主題 + 依平台的深指標總和 */}
      {filtered.length > 0 && (aggregate.byPlatformTotals.threads.count + aggregate.byPlatformTotals.instagram.count + aggregate.byPlatformTotals.facebook.count > 0) && (
        <section className="rounded-2xl border border-divider bg-white p-5 space-y-5">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">Aggregate</div>
            <h2 className="text-sm font-semibold text-ink mt-1">彙總指標 (依主題 / 平台)</h2>
          </div>

          {/* By platform totals · 4 metric */}
          <div>
            <div className="text-[11px] text-muted mb-2">依平台合計 (加總指標)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['threads', 'instagram', 'facebook'].map((p) => (
                <PlatformAggBlock key={p} platform={p} data={aggregate.byPlatformTotals[p]} />
              ))}
            </div>
          </div>

          {/* By topic table */}
          {aggregate.byTopic.length > 0 && (
            <div>
              <div className="text-[11px] text-muted mb-2">依主題合計</div>
              <div className="overflow-x-auto border border-divider rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-linen/40">
                    <tr className="border-b border-divider">
                      <th className="text-left px-3 py-2 text-muted font-medium">主題</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">篇數</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">瀏覽/曝光</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">觸及</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">讚</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">留言</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregate.byTopic.map((row) => (
                      <tr key={row.topicName} className="border-b border-zinc-100 last:border-0 hover:bg-linen/30">
                        <td className="px-3 py-2 text-ink font-medium">{row.topicName}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.impressions || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.reach || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.likes || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.comments || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 沒 aggregate 資料的提示 */}
      {filtered.length > 0 && (aggregate.byPlatformTotals.threads.count + aggregate.byPlatformTotals.instagram.count + aggregate.byPlatformTotals.facebook.count === 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">⚠ 沒有指標數據</div>
          <div className="text-xs text-amber-700">已發貼文尚未載入深指標(每篇 [📊 讀取指標] 或上方 [🔄 批次刷新])。 剛發不到 30 分鐘的貼文, Meta / Threads 抓取有延遲, 通常需等 10-30 分鐘。</div>
        </section>
      )}

      {/* Posts list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card text-center text-sm text-stone-500 py-8">
            這個條件下沒有發文紀錄
          </div>
        )}
        {filtered.map((p) => (
          <PostRow key={p.id} post={p} onZoom={(url) => setLightbox(url)}
            onRefresh={async () => {
              if (p.source !== 'topic') { alert('氣候即時發文暫不支援深指標'); return; }
              const r = await fetch('/api/infuz/insights/refresh', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ postId: p.id }),
              });
              const d = await r.json();
              if (!r.ok) return alert('刷新失敗:' + d.error);
              // reload data
              const fresh = await fetch('/api/infuz/insights', { cache: 'no-store' }).then((r) => r.json());
              setData(fresh);
              if (d.errors) {
                const msg = Object.entries(d.errors).map(([k, v]) => `${k}: ${v}`).join('\n');
                alert('部分平台失敗:\n' + msg);
              }
            }}
          />
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

function PostRow({ post, onZoom, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const insights = post.insightsByPlatform || {};
  const hasAnyInsights = Object.keys(insights).length > 0;

  async function handleRefresh() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  return (
    <div className="rounded-lg border border-divider bg-white p-4">
      <div className="flex items-start gap-3">
        {post.imageUrl && (
          <button onClick={() => onZoom(post.imageUrl)} className="shrink-0">
            <img src={post.imageUrl} alt="" className="size-20 rounded object-cover border hover:opacity-80" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[10px] rounded bg-linen px-1.5 py-0.5 text-muted truncate max-w-[200px]">
                {post.topicName || '(未分類)'}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-muted">
                {new Date(post.publishedAt).toLocaleString('zh-TW')}
              </span>
            </div>
            {post.source === 'topic' && (
              <button onClick={handleRefresh} disabled={refreshing}
                className="text-[11px] text-muted hover:text-ink disabled:opacity-50 shrink-0"
                title="從 Meta / Threads Graph 抓最新成效"
              >
                {refreshing ? '刷新中…' : hasAnyInsights ? '🔄 更新指標' : '📊 讀取指標'}
              </button>
            )}
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-ink font-sans line-clamp-3">{post.text}</pre>
          {post.hashtags && <div className="mt-0.5 text-[10px] text-emerald-700 line-clamp-1">{post.hashtags}</div>}

          {/* 平台徽章 (published + permalink) */}
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

          {/* 深指標 (若有) */}
          {hasAnyInsights && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {insights.threads && <InsightsBlock label="🧵 Threads" data={insights.threads} keys={['views', 'likes', 'replies', 'reposts']} />}
              {insights.instagram && <InsightsBlock label="📷 IG" data={insights.instagram} keys={['impressions', 'reach', 'likes', 'comments', 'saved']} />}
              {insights.facebook && <InsightsBlock label="👍 FB" data={insights.facebook} keys={['impressions', 'reach', 'reactions', 'clicks']} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightsBlock({ label, data, keys }) {
  const labelMap = {
    views: '瀏覽', impressions: '曝光', reach: '觸及',
    likes: '讚', comments: '留言', replies: '回覆', reposts: '轉發',
    saved: '收藏', reactions: '互動', clicks: '點擊',
  };
  return (
    <div className="rounded-md border border-divider bg-linen/40 p-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {keys.map((k) => (
          data[k] != null && (
            <div key={k} className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">{labelMap[k] || k}</span>
              <span className="font-mono tabular-nums font-medium text-ink">{data[k].toLocaleString?.() ?? data[k]}</span>
            </div>
          )
        ))}
      </div>
      {data.fetchedAt && <div className="mt-1 text-[9px] font-mono text-muted">{new Date(data.fetchedAt).toLocaleString('zh-TW')}</div>}
    </div>
  );
}

// ==================================================================
// Followers 卡 · 每平台單獨顯示
// ==================================================================
function FollowerCard({ label, data, error, loading }) {
  return (
    <div className="rounded-xl border border-divider bg-white p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</div>
      {loading ? (
        <div className="h-9 w-16 skeleton rounded mt-2" />
      ) : error ? (
        <>
          <div className="mt-2 text-lg font-semibold text-muted">—</div>
          <div className="text-[10px] text-amber-700 mt-1 leading-tight">{error}</div>
        </>
      ) : data ? (
        <>
          <div className="mt-2 text-2xl sm:text-3xl font-display font-semibold tabular-nums text-ink">
            {data.followers?.toLocaleString?.() ?? data.followers ?? '—'}
          </div>
          <div className="text-[10px] text-muted mt-1">
            {data.username && <>@{data.username} · </>}
            {data.mediaCount != null && <>發文 {data.mediaCount} · </>}
            粉絲
          </div>
          {data.followersError && <div className="text-[10px] text-amber-700 mt-0.5">粉絲數: {data.followersError}</div>}
        </>
      ) : (
        <div className="mt-2 text-lg text-muted">—</div>
      )}
    </div>
  );
}

// ==================================================================
// PlatformAggBlock · 平台總指標
// ==================================================================
function PlatformAggBlock({ platform, data }) {
  const meta = { threads: '🧵 Threads', instagram: '📷 Instagram', facebook: '👍 Facebook' }[platform] || platform;
  const items = platform === 'threads'
    ? [ ['views', '瀏覽'], ['likes', '讚'], ['replies', '回覆'], ['reposts', '轉發'] ]
    : platform === 'instagram'
    ? [ ['impressions', '曝光'], ['reach', '觸及'], ['likes', '讚'], ['comments', '留言'], ['saved', '收藏'] ]
    : [ ['impressions', '曝光'], ['reach', '觸及'], ['reactions', '互動'], ['clicks', '點擊'] ];
  return (
    <div className="rounded-lg border border-divider bg-linen/40 p-3">
      <div className="text-[11px] font-medium text-ink mb-2">{meta} <span className="text-muted font-mono text-[10px]">{data.count} 篇</span></div>
      {data.count === 0 ? (
        <div className="text-[10px] text-muted">尚未有發文</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {items.map(([k, label]) => (
            <div key={k} className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">{label}</span>
              <span className="font-mono tabular-nums font-medium text-ink">{data[k] != null ? data[k].toLocaleString() : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// computeAggregate · 從 filtered posts 算 by-topic + by-platform 總指標
// ==================================================================
function computeAggregate(posts) {
  const byPlatformTotals = {
    threads:   { count: 0, views: 0, likes: 0, replies: 0, reposts: 0 },
    instagram: { count: 0, impressions: 0, reach: 0, likes: 0, comments: 0, saved: 0 },
    facebook:  { count: 0, impressions: 0, reach: 0, reactions: 0, clicks: 0 },
  };
  const byTopicMap = {};

  for (const p of posts) {
    const ins = p.insightsByPlatform || {};
    // by-platform totals (count 依 post 有 published 該平台成功計)
    for (const platform of ['threads', 'instagram', 'facebook']) {
      if (p.results?.[platform]?.ok) {
        byPlatformTotals[platform].count++;
        const pIns = ins[platform];
        if (pIns) {
          for (const k of Object.keys(byPlatformTotals[platform])) {
            if (k === 'count') continue;
            if (typeof pIns[k] === 'number') byPlatformTotals[platform][k] += pIns[k];
          }
        }
      }
    }

    // by-topic aggregate
    const topicName = p.topicName || '(未分類)';
    if (!byTopicMap[topicName]) {
      byTopicMap[topicName] = { topicName, count: 0, impressions: 0, reach: 0, likes: 0, comments: 0 };
    }
    const t = byTopicMap[topicName];
    t.count++;
    // 加總三平台的 impressions/reach/likes/comments (若某平台沒該 metric 用 0)
    for (const platform of ['threads', 'instagram', 'facebook']) {
      const pIns = ins[platform];
      if (!pIns) continue;
      t.impressions += (pIns.impressions ?? pIns.views ?? 0);
      t.reach += (pIns.reach ?? 0);
      t.likes += (pIns.likes ?? pIns.reactions ?? 0);
      t.comments += (pIns.comments ?? pIns.replies ?? 0);
    }
  }

  const byTopic = Object.values(byTopicMap).sort((a, b) => b.count - a.count);
  return { byPlatformTotals, byTopic };
}
