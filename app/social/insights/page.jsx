'use client';

// 發文成效 · 粉絲趨勢 + 流量趨勢 + 貼文類型比較 + 近期發文 table
// 資料來源:
//   /api/infuz/insights                → 貼文清單 + 深指標 (insightsByPlatform)
//   /api/infuz/insights/followers      → 當下即時粉絲數
//   /api/infuz/insights/followers-history?from&to → 每日粉絲快照 (由 cron 00:00 存)
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../_components.jsx';

const PLATFORM_META = {
  threads: { label: '🧵 Threads', badge: 'bg-black text-white', line: '#000000' },
  instagram: { label: '📷 IG', badge: 'bg-pink-600 text-white', line: '#DB2777' },
  facebook: { label: '👍 FB', badge: 'bg-blue-600 text-white', line: '#2563EB' },
};
const TYPE_META = {
  text: { label: '純文字' },
  long: { label: '長文串' },
  image: { label: '圖文' },
};

export default function InsightsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState(null);
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [history, setHistory] = useState([]);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  function applyPreset(preset) {
    setDateRange(preset);
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    if (preset === 'all') { setFromDate(''); setToDate(''); return; }
    if (preset === 'yesterday') {
      const y = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      setFromDate(y); setToDate(y); return;
    }
    const days = Number(preset.replace('d', ''));
    const from = new Date(today.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
    setFromDate(from); setToDate(to);
  }

  useEffect(() => {
    fetch('/api/infuz/insights', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setData(d))
      .catch(() => {}).finally(() => setLoading(false));
    fetch('/api/infuz/insights/followers', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setFollowers(d))
      .catch(() => {}).finally(() => setLoadingFollowers(false));
  }, []);

  // 依 fromDate/toDate 抓 followers-history
  useEffect(() => {
    const qs = new URLSearchParams();
    if (fromDate) qs.set('from', fromDate);
    if (toDate) qs.set('to', toDate);
    fetch(`/api/infuz/insights/followers-history?${qs}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setHistory(d.items || []))
      .catch(() => {});
  }, [fromDate, toDate]);

  async function refreshAllInsights() {
    setRefreshingAll(true);
    try {
      // 觸發 cron endpoint · 一次全刷 (含 followers 快照)
      const r = await fetch('/api/infuz/cron/refresh-insights', { cache: 'no-store' });
      const d = await r.json();
      const fresh = await fetch('/api/infuz/insights', { cache: 'no-store' }).then((r) => r.json());
      setData(fresh);
      const freshFollowers = await fetch('/api/infuz/insights/followers', { cache: 'no-store' }).then((r) => r.json());
      setFollowers(freshFollowers);
      // reload history
      const qs = new URLSearchParams();
      if (fromDate) qs.set('from', fromDate);
      if (toDate) qs.set('to', toDate);
      const freshHist = await fetch(`/api/infuz/insights/followers-history?${qs}`, { cache: 'no-store' }).then((r) => r.json());
      setHistory(freshHist.items || []);
      alert(`更新完成 · 貼文 ${d.refreshed}/${d.total}${d.errorTotal ? ` · ${d.errorTotal} 條錯誤` : ''}`);
    } catch (e) {
      alert('更新失敗:' + e.message);
    } finally {
      setRefreshingAll(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data?.posts) return [];
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

  useEffect(() => { if (data && !fromDate && !toDate) applyPreset('30d'); }, [data]);

  const uniqueTopics = Array.from(new Set((data?.posts || []).map((p) => p.topicName).filter(Boolean)));

  // 流量趨勢 · 依 publishedAt 分日 sum(views/impressions across platforms)
  const trafficSeries = useMemo(() => computeTrafficSeries(filtered, fromDate, toDate), [filtered, fromDate, toDate]);
  // 粉絲成長趨勢 · 依 history + platform
  const followersSeries = useMemo(() => computeFollowersSeries(history), [history]);
  // 貼文類型比較 · 依 topicType 分組 · 平均 views/likes/replies
  const typeStats = useMemo(() => computeTypeStats(filtered), [filtered]);

  const lastSnapshot = history[history.length - 1]?.savedAt;

  if (loading) return <main className="card">載入中…</main>;
  if (!data) return <main className="card">無法載入</main>;

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="發文成效"
        breadcrumbs={[{ href: '/social', label: '社群發文' }, { label: '發文成效' }]}
        description="粉絲趨勢 · 流量趨勢 · 貼文類型比較 · 每天 00:00 台北時間自動刷新"
        actions={
          <button onClick={refreshAllInsights} disabled={refreshingAll}
            className="text-xs px-3 py-1.5 rounded-md border border-divider text-ink hover:bg-linen disabled:opacity-50"
          >{refreshingAll ? '更新中…' : '🔄 立即更新全部數據'}</button>
        }
      />

      {/* Date range · 4 preset + from/to */}
      <section className="rounded-2xl border border-divider bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'yesterday', label: '昨天' },
            { key: '7d', label: '近 7 天' },
            { key: '30d', label: '近 30 天' },
            { key: 'all', label: '全部' },
          ].map((p) => (
            <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${
                dateRange === p.key
                  ? 'bg-ink text-white border-ink'
                  : 'border-divider text-muted hover:border-ink hover:text-ink'
              }`}
            >{p.label}</button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-muted">從</span>
            <input type="date" className="input text-sm w-auto" value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setDateRange('custom'); }}
              max={toDate || undefined}
            />
            <span className="text-[11px] text-muted">到</span>
            <input type="date" className="input text-sm w-auto" value={toDate}
              onChange={(e) => { setToDate(e.target.value); setDateRange('custom'); }}
              min={fromDate || undefined}
            />
          </div>
        </div>
        <div className="text-[11px] text-muted">
          期間內共 <span className="font-mono tabular-nums text-ink font-medium">{filtered.length}</span> 篇已發佈貼文有成效數據。
          {lastSnapshot && <>上次每日快照:{new Date(lastSnapshot).toLocaleString('zh-TW')}</>}
        </div>
      </section>

      {/* Followers 卡 · 3 平台 · 大字 stat */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BigFollowerCard label="🧵 Threads" data={followers?.threads} error={followers?.errors?.threads} loading={loadingFollowers} />
        <BigFollowerCard label="📷 Instagram" data={followers?.instagram} error={followers?.errors?.instagram} loading={loadingFollowers} />
        <BigFollowerCard label="👍 Facebook" data={followers?.facebook} error={followers?.errors?.facebook} loading={loadingFollowers} />
      </section>

      {/* 粉絲成長趨勢 · MultiLineChart */}
      <section className="rounded-2xl border border-divider bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-2 rounded-full bg-blue-600" />
          <h2 className="text-sm font-semibold text-ink">粉絲成長趨勢</h2>
        </div>
        {followersSeries.hasData ? (
          <MultiLineChart series={followersSeries.series} height={220} />
        ) : (
          <div className="text-xs text-muted py-8 text-center">
            尚無足夠快照 · 每天 00:00 台北時間會自動存一筆。 也可以按上方 [🔄 立即更新全部數據] 手動存。
          </div>
        )}
      </section>

      {/* 流量趨勢 · 期間內每日總瀏覽 */}
      <section className="rounded-2xl border border-divider bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-2 rounded-full bg-blue-600" />
          <h2 className="text-sm font-semibold text-ink">流量趨勢 <span className="text-xs text-muted font-normal">(期間內每日發文總瀏覽)</span></h2>
        </div>
        {trafficSeries.hasData ? (
          <MultiLineChart series={[{ name: '總瀏覽', color: '#2563EB', points: trafficSeries.points, fill: true }]} height={220} />
        ) : (
          <div className="text-xs text-muted py-8 text-center">期間內沒有含指標的發文</div>
        )}
      </section>

      {/* 貼文類型比較 · 3 bar chart */}
      <section className="rounded-2xl border border-divider bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-2 rounded-full bg-blue-600" />
          <h2 className="text-sm font-semibold text-ink">貼文類型比較 <span className="text-xs text-muted font-normal">(平均值 · 依主題類型分組)</span></h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TypeAvgChart title="平均瀏覽" metric="views" stats={typeStats} color="#2563EB" />
          <TypeAvgChart title="平均按讚" metric="likes" stats={typeStats} color="#2563EB" />
          <TypeAvgChart title="平均回覆" metric="replies" stats={typeStats} color="#2563EB" />
        </div>
      </section>

      {/* 近期發文成效 · Table */}
      <section className="rounded-2xl border border-divider bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="size-2 rounded-full bg-blue-600" />
          <h2 className="text-sm font-semibold text-ink">近期發文成效</h2>
        </div>

        {/* filter row */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          <select className="input text-xs w-auto" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="all">全部平台</option>
            <option value="threads">🧵 Threads</option>
            <option value="instagram">📷 IG</option>
            <option value="facebook">👍 FB</option>
          </select>
          <select className="input text-xs w-auto" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="all">全部主題</option>
            {uniqueTopics.map((t) => (
              <option key={t} value={t}>{t} ({data.byTopic[t]})</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-muted">共 {filtered.length} 篇</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-xs text-muted py-8 text-center">這個條件下沒有發文</div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead className="border-b border-divider">
                <tr>
                  <th className="text-left py-2 pr-2 text-muted font-medium">日期</th>
                  <th className="text-left py-2 pr-2 text-muted font-medium">主題</th>
                  <th className="text-left py-2 pr-2 text-muted font-medium">類型</th>
                  <th className="text-left py-2 pr-2 text-muted font-medium">內容</th>
                  <th className="text-right py-2 px-2 text-muted font-medium">瀏覽</th>
                  <th className="text-right py-2 px-2 text-muted font-medium">按讚</th>
                  <th className="text-right py-2 px-2 text-muted font-medium">回覆/留言</th>
                  <th className="text-right py-2 px-2 text-muted font-medium">轉發/分享</th>
                  <th className="text-right py-2 px-2 text-muted font-medium">互動率</th>
                  <th className="text-right py-2 pl-2 text-muted font-medium">動作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <PostTableRow key={p.id} post={p}
                    expanded={expandedPostId === p.id}
                    onToggle={() => setExpandedPostId(expandedPostId === p.id ? null : p.id)}
                    onZoom={(url) => setLightbox(url)}
                    onRefresh={async () => {
                      if (p.source !== 'topic') { alert('氣候即時發文暫不支援深指標'); return; }
                      const r = await fetch('/api/infuz/insights/refresh', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ postId: p.id }),
                      });
                      const d = await r.json();
                      if (!r.ok) return alert('刷新失敗:' + d.error);
                      const fresh = await fetch('/api/infuz/insights', { cache: 'no-store' }).then((r) => r.json());
                      setData(fresh);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </main>
  );
}

// ==================================================================
// BigFollowerCard · 大字粉絲數
// ==================================================================
function BigFollowerCard({ label, data, error, loading }) {
  return (
    <div className="rounded-xl border border-divider bg-white p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</div>
      {loading ? (
        <div className="h-9 w-20 skeleton rounded mt-2" />
      ) : error ? (
        <>
          <div className="mt-2 text-2xl font-semibold text-muted">—</div>
          <div className="text-[10px] text-amber-700 mt-1 leading-tight">{error}</div>
        </>
      ) : data ? (
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          {data.username && <span className="text-xs text-muted font-mono truncate max-w-[130px]">@{data.username}</span>}
          <span className="text-3xl sm:text-4xl font-display font-semibold tabular-nums text-blue-600">
            {data.followers?.toLocaleString?.() ?? data.followers ?? '—'}
          </span>
          <span className="text-xs text-muted">粉絲</span>
        </div>
      ) : (
        <div className="mt-2 text-2xl text-muted">—</div>
      )}
      {data?.followersError && <div className="text-[10px] text-amber-700 mt-1">粉絲數: {data.followersError}</div>}
    </div>
  );
}

// ==================================================================
// PostTableRow · 表格行 · 可展開看留言/深指標
// ==================================================================
function PostTableRow({ post, expanded, onToggle, onZoom, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const ins = post.insightsByPlatform || {};
  // 選一個主要平台的指標 (Threads 優先, 再 IG, 再 FB)
  const primary = ins.threads || ins.instagram || ins.facebook || {};
  const views = primary.views ?? primary.impressions ?? null;
  const likes = primary.likes ?? primary.reactions ?? null;
  const replies = primary.replies ?? primary.comments ?? null;
  const shares = primary.reposts ?? primary.shares ?? null;
  const engRate = views && (likes + replies + shares) > 0
    ? `${(((likes || 0) + (replies || 0) + (shares || 0)) / views * 100).toFixed(1)}%`
    : (views ? '0%' : '—');

  async function handleRefresh(e) {
    e?.stopPropagation();
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  const typeMeta = TYPE_META[post.topicType] || TYPE_META.text;
  const dateStr = post.publishedAt
    ? `${new Date(post.publishedAt).getMonth() + 1}/${new Date(post.publishedAt).getDate()}`
    : '—';

  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-linen/30 cursor-pointer" onClick={onToggle}>
        <td className="py-2 pr-2 font-mono tabular-nums text-ink">{dateStr}</td>
        <td className="py-2 pr-2 text-ink truncate max-w-[90px]">{post.topicName?.replace(/^☀️ /, '') || '—'}</td>
        <td className="py-2 pr-2 text-muted text-[11px]">{typeMeta.label}</td>
        <td className="py-2 pr-2 text-blue-700 truncate max-w-[220px]">{post.text?.split('\n')[0]?.slice(0, 30) || '—'}...</td>
        <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">{views != null ? views.toLocaleString() : '—'}</td>
        <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">{likes != null ? likes : '—'}</td>
        <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">{replies != null ? replies : '—'}</td>
        <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">{shares != null ? shares : '—'}</td>
        <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">{engRate}</td>
        <td className="py-2 pl-2 text-right">
          {post.source === 'topic' && (
            <button onClick={handleRefresh} disabled={refreshing}
              className="text-[10px] px-2 py-0.5 rounded border border-divider text-muted hover:text-ink hover:border-ink disabled:opacity-50"
              title="刷新此篇"
            >{refreshing ? '…' : '刷新'}</button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-linen/40 border-b border-zinc-100 p-4">
            <div className="flex items-start gap-3">
              {post.imageUrl && (
                <button onClick={(e) => { e.stopPropagation(); onZoom(post.imageUrl); }} className="shrink-0">
                  <img src={post.imageUrl} alt="" className="size-24 rounded object-cover border hover:opacity-80" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted font-mono mb-1">
                  {new Date(post.publishedAt).toLocaleString('zh-TW')}
                </div>
                <pre className="text-xs text-ink font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">{post.text}</pre>
                {post.hashtags && <div className="mt-1 text-[10px] text-emerald-700">{post.hashtags}</div>}
                {/* 平台徽章 + permalink */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(post.results || {}).map(([k, r]) => {
                    if (!r?.ok) return null;
                    const meta = PLATFORM_META[k];
                    const el = (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${meta?.badge || 'bg-zinc-200'}`}>
                        {meta?.label || k} ✓
                      </span>
                    );
                    return r.permalink ? (
                      <a key={k} href={r.permalink} target="_blank" rel="noreferrer" className="hover:opacity-80">{el}</a>
                    ) : <span key={k}>{el}</span>;
                  })}
                </div>
                {/* 各平台深指標分別列 */}
                {Object.keys(ins).length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ins.threads && <MiniInsights label="🧵 Threads" data={ins.threads} keys={['views', 'likes', 'replies', 'reposts', 'quotes']} />}
                    {ins.instagram && <MiniInsights label="📷 IG" data={ins.instagram} keys={['views', 'reach', 'likes', 'comments', 'saved', 'shares']} />}
                    {ins.facebook && <MiniInsights label="👍 FB" data={ins.facebook} keys={['reactions', 'clicks']} />}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MiniInsights({ label, data, keys }) {
  const labelMap = {
    views: '瀏覽', impressions: '曝光', reach: '觸及',
    likes: '讚', comments: '留言', replies: '回覆', reposts: '轉發', quotes: '引用',
    saved: '收藏', shares: '分享', reactions: '互動', clicks: '點擊',
  };
  return (
    <div className="rounded-md border border-divider bg-white p-2">
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
    </div>
  );
}

// ==================================================================
// MultiLineChart · SVG · series = [{name, color, points:[{date, value}], fill?}]
// ==================================================================
function MultiLineChart({ series, height = 220 }) {
  const W = 800;
  const PAD_L = 40, PAD_R = 12, PAD_T = 10, PAD_B = 24;

  // 收集所有日期 · x 軸
  const allDates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();
  if (allDates.length === 0) return <div className="text-xs text-muted py-4 text-center">無資料</div>;

  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v != null);
  const maxY = Math.max(1, ...values);
  const minY = Math.min(0, ...values);
  const rangeY = maxY - minY || 1;

  const dateIndex = (d) => allDates.indexOf(d);
  const xOf = (d) => PAD_L + (allDates.length === 1 ? (W - PAD_L - PAD_R) / 2 : dateIndex(d) / (allDates.length - 1) * (W - PAD_L - PAD_R));
  const yOf = (v) => height - PAD_B - ((v - minY) / rangeY) * (height - PAD_T - PAD_B);

  // Y 軸 4 條 gridline
  const gridSteps = 4;
  const yGrid = Array.from({ length: gridSteps + 1 }, (_, i) => minY + (rangeY * i / gridSteps));

  // X 軸 label · 只顯示 6 個
  const xLabelStep = Math.max(1, Math.floor(allDates.length / 6));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Y gridlines + label */}
        {yGrid.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={yOf(v)} x2={W - PAD_R} y2={yOf(v)} stroke="#F4F4F5" />
            <text x={PAD_L - 4} y={yOf(v) + 3} textAnchor="end" fontSize="9" fill="#71717A">{Math.round(v).toLocaleString()}</text>
          </g>
        ))}
        {/* X label */}
        {allDates.map((d, i) => (
          i % xLabelStep === 0 && (
            <text key={d} x={xOf(d)} y={height - 6} textAnchor="middle" fontSize="9" fill="#71717A">
              {d.slice(5)}
            </text>
          )
        ))}
        {/* Series */}
        {series.map((s, si) => {
          const pts = s.points.filter((p) => p.value != null);
          if (pts.length === 0) return null;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
          const fillPath = s.fill && pts.length > 1
            ? `${path} L${xOf(pts[pts.length - 1].date).toFixed(1)},${yOf(minY).toFixed(1)} L${xOf(pts[0].date).toFixed(1)},${yOf(minY).toFixed(1)} Z`
            : null;
          return (
            <g key={si}>
              {fillPath && <path d={fillPath} fill={s.color} fillOpacity="0.12" />}
              <path d={path} stroke={s.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      {series.length > 1 && (
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// TypeAvgChart · 3 bars (純文字/長文串/圖文)
// ==================================================================
function TypeAvgChart({ title, metric, stats, color }) {
  const bars = [
    { key: 'text', label: '純文字', value: stats.text[metric] || 0 },
    { key: 'long', label: '長文串', value: stats.long[metric] || 0 },
    { key: 'image', label: '圖文', value: stats.image[metric] || 0 },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="border border-divider rounded-lg p-3">
      <div className="text-[11px] text-muted mb-2">{title}</div>
      <svg viewBox="0 0 200 130" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Y max label */}
        <text x="4" y="12" fontSize="9" fill="#71717A">{Math.ceil(max)}</text>
        <line x1="30" y1="10" x2="200" y2="10" stroke="#F4F4F5" />
        <line x1="30" y1="55" x2="200" y2="55" stroke="#F4F4F5" />
        <text x="4" y="58" fontSize="9" fill="#71717A">{Math.round(max / 2)}</text>
        <line x1="30" y1="100" x2="200" y2="100" stroke="#E4E4E7" />
        <text x="4" y="103" fontSize="9" fill="#71717A">0</text>

        {bars.map((b, i) => {
          const barW = 36;
          const gap = 20;
          const x = 40 + i * (barW + gap);
          const h = (b.value / max) * 90;
          const y = 100 - h;
          return (
            <g key={b.key}>
              <rect x={x} y={y} width={barW} height={h} fill={color} rx="1" />
              <text x={x + barW / 2} y="118" textAnchor="middle" fontSize="10" fill="#3F3F46">{b.label}</text>
              {b.value > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
                  {b.value < 10 ? b.value.toFixed(1) : Math.round(b.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==================================================================
// helpers
// ==================================================================
function computeTrafficSeries(posts, fromDate, toDate) {
  // 依 publishedAt (日期) 分組, sum 每篇 primary views
  const byDate = {};
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const d = p.publishedAt.slice(0, 10);
    const ins = p.insightsByPlatform || {};
    const primary = ins.threads || ins.instagram || ins.facebook || {};
    const v = primary.views ?? primary.impressions ?? 0;
    byDate[d] = (byDate[d] || 0) + v;
  }
  // 填補 fromDate → toDate 每日
  const start = fromDate || Object.keys(byDate).sort()[0];
  const end = toDate || Object.keys(byDate).sort().pop();
  const points = [];
  if (start && end) {
    const s = new Date(start + 'T00:00:00').getTime();
    const e = new Date(end + 'T00:00:00').getTime();
    for (let t = s; t <= e; t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      points.push({ date: d, value: byDate[d] || 0 });
    }
  }
  return { points, hasData: points.some((p) => p.value > 0) };
}

function computeFollowersSeries(history) {
  const series = [
    { name: 'Threads', color: PLATFORM_META.threads.line, points: [] },
    { name: 'Instagram', color: PLATFORM_META.instagram.line, points: [] },
    { name: 'Facebook', color: PLATFORM_META.facebook.line, points: [] },
  ];
  for (const h of history) {
    if (h.threads?.followers != null) series[0].points.push({ date: h.date, value: h.threads.followers });
    if (h.instagram?.followers != null) series[1].points.push({ date: h.date, value: h.instagram.followers });
    if (h.facebook?.followers != null) series[2].points.push({ date: h.date, value: h.facebook.followers });
  }
  const nonEmpty = series.filter((s) => s.points.length > 0);
  return { series: nonEmpty, hasData: nonEmpty.some((s) => s.points.length > 0) };
}

function computeTypeStats(posts) {
  const buckets = {
    text: { count: 0, views: 0, likes: 0, replies: 0 },
    long: { count: 0, views: 0, likes: 0, replies: 0 },
    image: { count: 0, views: 0, likes: 0, replies: 0 },
  };
  for (const p of posts) {
    const t = p.topicType || 'text';
    if (!buckets[t]) continue;
    const b = buckets[t];
    b.count++;
    const ins = p.insightsByPlatform || {};
    const primary = ins.threads || ins.instagram || ins.facebook || {};
    b.views += (primary.views ?? primary.impressions ?? 0);
    b.likes += (primary.likes ?? primary.reactions ?? 0);
    b.replies += (primary.replies ?? primary.comments ?? 0);
  }
  const result = {};
  for (const [k, b] of Object.entries(buckets)) {
    result[k] = b.count === 0
      ? { views: 0, likes: 0, replies: 0 }
      : { views: b.views / b.count, likes: b.likes / b.count, replies: b.replies / b.count };
  }
  return result;
}
