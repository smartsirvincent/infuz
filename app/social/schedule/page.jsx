'use client';

// 排程管理 (主題清單) · card grid, 每張 card 是一個主題摘要, 點進入 detail 看完整貼文
import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader, StatCard, EmptyState, Chip, Button, SkeletonCard, Skeleton } from '../_components.jsx';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function SchedulePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParamId = searchParams.get('edit');

  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [realtimeJobs, setRealtimeJobs] = useState([]);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ref 追蹤「剛存過就別再開」 (避免 saveTopic 完 setEditing(null) 但 URL 還沒清時 useEffect 重開)
  const justSavedRef = useRef(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // ?edit=xxx 從 detail 頁跳回時自動開編輯
    // 依賴只用 editParamId + topics.length: setEditing(null) 不會觸發此 effect 重跑
    if (!editParamId || topics.length === 0) return;
    if (justSavedRef.current === editParamId) {
      justSavedRef.current = null; // 一次性保護
      return;
    }
    const t = topics.find((x) => x.id === editParamId);
    if (t) setEditing(t);
  }, [editParamId, topics.length]);

  async function load() {
    setLoading(true);
    try {
      const [tRes, pRes, prodRes, cRes, rtRes] = await Promise.all([
        fetch('/api/infuz/topics', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/topic_posts', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/products', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/connections', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/realtime', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setTopics(tRes.items || []);
      setPosts(pRes.items || []);
      setProducts(prodRes.items || []);
      setConn((cRes.items || []).find((x) => x.id === 'main') || null);
      setRealtimeJobs(rtRes.items || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const canThreads = !!conn?.threads?.accessToken;
  const canFb = !!conn?.facebook?.pageAccessToken;
  const canIg = !!conn?.facebook?.igUserId;

  function newTopic() {
    setEditing({
      _isNew: true,
      name: '新主題',
      description: '',
      type: 'text',
      productIds: [],
      brandOnly: true,
      systemPrompt: '',
      imagePrompt: '',
      aspectRatio: '4:5',
      schedule: {
        enabled: true,
        time: '10:00',
        days: [1, 2, 3, 4, 5],
        platforms: { threads: true, instagram: false, facebook: false },
        lastRunDate: null,
      },
    });
  }

  async function saveTopic() {
    setSaving(true); setError('');
    try {
      const url = '/api/infuz/topics';
      if (editing._isNew) {
        const { _isNew, ...body } = editing;
        const id = 't_' + Date.now().toString(36);
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
      } else {
        // 排除 UI-only key (_isNew 之類的) 才 PATCH
        const { _isNew, ...body } = editing;
        const r = await fetch(`${url}?id=${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, updatedAt: new Date().toISOString() }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
      }
      closeEditor(); // 統一 close (含清 URL param + ref 標記防 useEffect 重開)
      await load();
    } catch (e) { setError('儲存失敗:' + e.message); }
    finally { setSaving(false); }
  }

  // 統一 close: 存/取消/× 都走這個, 一律清 URL + 標記 ref 防 useEffect 重開
  function closeEditor() {
    if (editParamId) {
      justSavedRef.current = editParamId;
      router.replace('/social/schedule');
    }
    setEditing(null);
  }

  async function toggleSchedule(topic, e) {
    e.preventDefault(); e.stopPropagation();
    const sch = topic.schedule || {};
    // 帶 sensible defaults, 避免只有 enabled=true 但沒 time/days/platforms 導致 tick 略過
    const newSchedule = {
      ...sch,
      enabled: !sch.enabled,
      time: sch.time || '10:00',
      days: (sch.days && sch.days.length) ? sch.days : [1, 2, 3, 4, 5],
      platforms: sch.platforms || { threads: true },
    };
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schedule: newSchedule }),
    });
    load();
  }

  async function patchTopicTime(topic, newTime, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!newTime) return;
    const sch = topic.schedule || {};
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schedule: {
          ...sch,
          time: newTime,
          days: (sch.days && sch.days.length) ? sch.days : [1, 2, 3, 4, 5],
          platforms: sch.platforms || { threads: true },
          enabled: sch.enabled !== false,
        },
      }),
    });
    load();
  }

  async function deleteTopic(topic, e) {
    e.preventDefault(); e.stopPropagation();
    const relatedPosts = posts.filter((p) => p.topicId === topic.id);
    const msg = relatedPosts.length
      ? `刪除主題「${topic.name}」?\n\n連同 ${relatedPosts.length} 篇 (待發/已發/失敗) 文章一起刪除,無法復原。`
      : `刪除主題「${topic.name}」?`;
    if (!confirm(msg)) return;
    try {
      await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, { method: 'DELETE' });
      for (const p of relatedPosts) {
        await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      }
      await load();
    } catch (err) { setError('刪除失敗:' + err.message); }
  }

  if (loading) return (
    <main className="space-y-6 pb-8">
      <div className="pt-2 pb-6 border-b border-zinc-200">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 mt-4" />
        <Skeleton className="h-4 w-96 mt-3" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24" rounded="xl" />)}
      </div>
      <Skeleton className="h-64" rounded="2xl" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[0,1,2,3,4,5].map((i) => <SkeletonCard key={i} />)}
      </div>
    </main>
  );

  const filtered = topics.filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));
  const totalQueued = posts.filter((p) => p.status === 'queued').length;
  const totalPublished = posts.filter((p) => p.status === 'published').length;
  const totalFailed = posts.filter((p) => p.status === 'failed').length;

  return (
    <main className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Schedule"
        title="排程管理"
        breadcrumbs={[{ href: '/social', label: '社群發文' }, { label: '排程管理' }]}
        description="所有主題清單 · 點卡片進入看完整貼文 · 到點 cron 從佇列取一篇自動發"
        actions={
          <Button onClick={newTopic} tone="primary" size="sm">+ 手動新增主題</Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="主題總數" value={topics.length} sub={`${topics.filter((t) => t.schedule?.enabled).length} 個排程中`} />
        <StatCard label="待發" value={totalQueued} sub="佇列中,到點自動發" />
        <StatCard label="已發" value={totalPublished} tone="positive" sub="累計成功" />
        <StatCard label="失敗" value={totalFailed} tone={totalFailed > 0 ? 'danger' : 'muted'} sub={totalFailed > 0 ? '需檢查' : '沒有失敗'} />
      </section>

      {/* 週歷儀表板 */}
      <WeeklyCalendar topics={topics} realtimeJobs={realtimeJobs} products={products} />

      {/* 搜尋列 */}
      <div className="relative">
        <input
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 pl-10 text-sm placeholder-stone-400 outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition"
          placeholder="搜尋主題名..."
          value={filter} onChange={(e) => setFilter(e.target.value)}
        />
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
      </div>

      {/* 主題 grid */}
      {filtered.length === 0 && (
        <EmptyState
          mark={topics.length === 0 ? '— No topics yet —' : '— No match —'}
          title={topics.length === 0 ? '還沒有任何主題' : `沒有符合「${filter}」的主題`}
          description={topics.length === 0 ? '主題是一組具備連貫寫作角度的貼文系列。用 AI 幫你發想幾個開始。' : '試試別的關鍵字'}
          action={topics.length === 0 && (
            <Button href="/social/topics/discover" tone="primary">用 AI 發想 3 個試試</Button>
          )}
        />
      )}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((topic) => (
          <TopicCard key={topic.id}
            topic={topic}
            posts={posts.filter((p) => p.topicId === topic.id)}
            products={products}
            onToggleSchedule={(e) => toggleSchedule(topic, e)}
            onChangeTime={(t, e) => patchTopicTime(topic, t, e)}
            onDelete={(e) => deleteTopic(topic, e)}
          />
        ))}
      </section>

      {/* 編輯 modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">
                {editing._isNew ? '➕ 新增主題' : '✏️ 編輯主題'}
              </h3>
              <button onClick={closeEditor}
                className="text-stone-400 hover:text-stone-700">✕</button>
            </div>
            <TopicEditor editing={editing} setEditing={setEditing} products={products}
              canThreads={canThreads} canIg={canIg} canFb={canFb} />
            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}
            <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
              <button onClick={closeEditor}
                className="rounded-md border border-stone-300 px-4 py-1.5 text-sm">取消</button>
              <button onClick={saveTopic} disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? '存中…' : '💾 儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatBox({ label, value, sub, color }) {
  const colorCls = color === 'blue' ? 'text-blue-700' : color === 'emerald' ? 'text-emerald-700' : color === 'red' ? 'text-red-700' : 'text-stone-900';
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${colorCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function WeeklyCalendar({ topics, realtimeJobs = [], products = [] }) {
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  const taipeiNow = new Date(Date.now() + 8 * 3600 * 1000);
  const todayDow = taipeiNow.getUTCDay();

  const bySlot = {};
  const addToSlot = (time, days, item) => {
    if (!bySlot[time]) bySlot[time] = {};
    for (const d of days) {
      if (!bySlot[time][d]) bySlot[time][d] = [];
      bySlot[time][d].push(item);
    }
  };

  for (const t of topics) {
    if (!t.schedule?.enabled || !t.schedule?.time) continue;
    const days = (t.schedule.days || []).length ? t.schedule.days : [0, 1, 2, 3, 4, 5, 6];
    // 是否會帶連結: topic.includePurchaseUrl && 綁定產品至少 1 件有 purchase_url
    const boundHasLink = (t.productIds || []).some((id) => products.find((p) => p.id === id)?.purchase_url);
    const hasLink = !!(t.includePurchaseUrl && boundHasLink);
    addToSlot(t.schedule.time, days, {
      kind: 'topic',
      id: t.id,
      name: t.name,
      type: t.type,
      hasLink,
      platforms: t.schedule.platforms,
      href: `/social/schedule/${t.id}`,
    });
  }

  for (const j of realtimeJobs) {
    if (!j.enabled || !j.time) continue;
    const days = (j.days && j.days.length) ? j.days : [0, 1, 2, 3, 4, 5, 6];
    addToSlot(j.time, days, {
      kind: 'realtime',
      id: j.id,
      name: j.name || '氣候即時',
      type: 'weather',
      hasLink: false,
      platforms: j.platforms,
      href: `/social/weather-post`,
    });
  }

  const slots = Object.keys(bySlot).sort();
  const activeCount = topics.filter((t) => t.schedule?.enabled).length
    + realtimeJobs.filter((j) => j.enabled).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-200">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Weekly overview</div>
          <h2 className="font-editorial text-lg font-semibold text-zinc-950 tracking-tight mt-0.5">本週排程</h2>
        </div>
        <div className="text-[11px] font-mono tabular-nums text-zinc-500">
          {activeCount === 0 ? '無啟用排程' : `${activeCount} active`}
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500">
          {topics.length === 0 ? '還沒有主題' : '所有主題都停用中 · 進主題頁面點「排程中」開啟'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 w-16 sticky left-0 bg-white">Time</th>
                {dayOrder.map((d, i) => (
                  <th key={d} className={`text-left px-2 py-3 min-w-[110px] ${d === todayDow ? 'text-zinc-950 bg-zinc-50' : 'text-zinc-500'}`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className={d === todayDow ? 'font-semibold' : 'font-medium'}>{dayLabels[i]}</span>
                      {d === todayDow && <span className="text-[9px] text-zinc-500 font-normal font-mono">TODAY</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((time) => (
                <tr key={time} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-[11px] text-zinc-700 sticky left-0 bg-white">{time}</td>
                  {dayOrder.map((d) => {
                    const items = bySlot[time]?.[d] || [];
                    return (
                      <td key={d} className={`px-2 py-2 align-top ${d === todayDow ? 'bg-zinc-50/60' : ''}`}>
                        <div className="flex flex-col gap-1">
                          {items.length === 0 && <span className="text-zinc-300 text-[10px]">·</span>}
                          {items.map((it) => {
                            const typeInfo = {
                              weather: { label: '氣候', stripe: 'bg-sky-500',    chip: 'bg-sky-50 text-sky-700 border-sky-200' },
                              long:    { label: '長文', stripe: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                              image:   { label: '圖片', stripe: 'bg-gold',        chip: 'bg-gold-soft text-gold border-gold/40' },
                              text:    { label: '文字', stripe: 'bg-zinc-400',    chip: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
                            }[it.type] || { label: '', stripe: 'bg-zinc-300', chip: 'bg-zinc-50 text-zinc-500 border-zinc-200' };
                            const titleParts = [it.name, typeInfo.label, it.hasLink ? '帶連結' : ''].filter(Boolean);
                            return (
                              <Link key={it.id} href={it.href}
                                className="group flex items-stretch gap-0 rounded-md border border-zinc-200 bg-white overflow-hidden hover:border-zinc-900 transition motion-reduce:transition-none"
                                title={titleParts.join(' · ')}
                              >
                                <span className={`w-1 shrink-0 ${typeInfo.stripe}`} aria-hidden="true" />
                                <div className="min-w-0 flex-1 px-2 py-1.5">
                                  <div className="text-[11px] font-medium truncate text-zinc-900 group-hover:text-zinc-950">{it.name}</div>
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-mono uppercase tracking-wider border ${typeInfo.chip}`}>
                                      {typeInfo.label}
                                    </span>
                                    {it.hasLink && (
                                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-mono uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200" title="帶購買連結">
                                        link
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TopicCard({ topic, posts, products, onToggleSchedule, onChangeTime, onDelete }) {
  const queued = posts.filter((p) => p.status === 'queued').length;
  const published = posts.filter((p) => p.status === 'published').length;
  const failed = posts.filter((p) => p.status === 'failed').length;

  const scheduledEnabled = topic.schedule?.enabled;
  const days = topic.schedule?.days?.length === 7 ? '每天' : (topic.schedule?.days || []).map((d) => DAY_NAMES[d]).join('');
  const platformIcons = Object.entries(topic.schedule?.platforms || {}).filter(([_, v]) => v).map(([k]) => ({ threads: '🧵', instagram: '📷', facebook: '👍' })[k]).join(' ');
  const boundProducts = (topic.productIds || []).map((id) => products.find((p) => p.id === id)).filter(Boolean);

  const typeInfo = {
    text: { icon: '📝', label: '文字', tone: 'neutral' },
    long: { icon: '📄', label: '長文', tone: 'emerald' },
    image: { icon: '🖼️', label: '圖片', tone: 'accent' },
  }[topic.type] || { icon: '·', label: topic.type, tone: 'neutral' };

  // 檢查是否會帶購買連結: topic.includePurchaseUrl 且至少 1 件綁定產品有 purchase_url
  const willIncludeLink = !!(topic.includePurchaseUrl && boundProducts.some((p) => p?.purchase_url));

  return (
    <Link href={`/social/schedule/${topic.id}`}
      className={`group relative rounded-2xl border p-5 space-y-4 transition motion-reduce:transition-none hover:border-zinc-900 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] ${scheduledEnabled ? 'border-zinc-200 bg-white' : 'border-zinc-200 bg-zinc-50/60 opacity-70'}`}>
      {/* 刪除按鈕 (hover 才顯示,右上角) */}
      <button onClick={onDelete}
        className="absolute top-3 right-3 z-10 rounded-full bg-white/95 border border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 size-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all motion-reduce:transition-none"
        title="刪除主題"
      >✕</button>

      {/* Top row */}
      <div className="pr-8 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 類型 chip · icon 更醒目 */}
          <Chip tone={typeInfo.tone} size="xs" variant="outline">
            <span className="text-[10px]">{typeInfo.icon}</span>
            <span>{typeInfo.label}</span>
          </Chip>
          {/* 帶連結 chip · 只有 topic 打開 includePurchaseUrl 才顯示 */}
          {willIncludeLink && (
            <Chip tone="emerald" size="xs" variant="outline" title="每篇會附上購買連結+UTM">
              <span className="text-[10px]">🔗</span>
              <span>帶連結</span>
            </Chip>
          )}
          {/* ON/OFF 明顯 button, 可 click 切換 */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSchedule(e); }}
            title={scheduledEnabled ? '點擊停用排程' : '點擊啟用排程'}
            className={`ml-auto inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 cursor-pointer transition font-mono uppercase tracking-widest ${scheduledEnabled ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-950 hover:text-white'}`}
          >
            <span className={`inline-block size-1.5 rounded-full ${scheduledEnabled ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
            {scheduledEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <h3 className="font-editorial font-semibold text-lg text-zinc-950 truncate group-hover:text-zinc-700 tracking-tight leading-snug">{topic.name}</h3>
        {topic.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{topic.description}</p>
        )}
      </div>

      {/* 排程摘要 · time inline 編輯 */}
      <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-[11px] text-zinc-700">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="time"
            value={topic.schedule?.time || '10:00'}
            onClick={(e) => e.preventDefault()}
            onChange={(e) => onChangeTime(e.target.value, e)}
            className="font-mono tabular-nums font-medium text-zinc-950 bg-transparent border-b border-dashed border-zinc-300 hover:border-zinc-900 focus:border-zinc-950 outline-none px-0.5 cursor-pointer w-[65px] text-[11px]"
            title="點時間直接改"
          />
          <span className="text-zinc-300">·</span>
          <span className="text-zinc-500">{days || '無'}</span>
          <span className="text-zinc-300">·</span>
          <span className="text-zinc-500 font-mono tracking-wider text-[10px]">{platformIcons || '—'}</span>
        </div>
      </div>

      {/* 產品 + 貼文計數 */}
      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-zinc-100">
        <span className="text-zinc-500">
          {boundProducts.length > 0 ? `${boundProducts.length} 件產品` : '不帶產品'}
        </span>
        <div className="flex gap-3 font-mono tabular-nums text-[11px]">
          <span className="text-zinc-500" title="待發"><span className="text-zinc-950 font-medium">{queued}</span> queued</span>
          <span className="text-zinc-500" title="已發"><span className="text-zinc-950 font-medium">{published}</span> sent</span>
          {failed > 0 && <span className="text-red-600" title="失敗"><span className="font-medium">{failed}</span> fail</span>}
        </div>
      </div>
    </Link>
  );
}

function TopicEditor({ editing, setEditing, products, canThreads, canIg, canFb }) {
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const picked = products.filter((p) => (editing.productIds || []).includes(p.id));

  function updateSch(patch) {
    setEditing({ ...editing, schedule: { ...editing.schedule, ...patch } });
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="label text-xs">主題名稱</label>
        <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
      </div>
      <div>
        <label className="label text-xs">主題描述</label>
        <textarea className="input min-h-[60px] text-xs" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs">類型</label>
          <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
            <option value="text">📝 文字 (100-200 字)</option>
            <option value="long">📄 長文 (300-600 字)</option>
            <option value="image">🖼️ 圖片 (AI 生圖)</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">圖片比例 (type=image 用)</label>
          <select className="input" value={editing.aspectRatio || '4:5'} onChange={(e) => setEditing({ ...editing, aspectRatio: e.target.value })}>
            <option value="4:5">4:5</option>
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label text-xs">寫作方向 (systemPrompt · 產文時的主要指示)</label>
        <textarea className="input min-h-[90px] text-xs leading-relaxed"
          placeholder="例:每篇要有 1 個具體生活場景 + 1 個身形痛點,語氣像姊姊,避免說教感"
          value={editing.systemPrompt} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} />
      </div>

      <div>
        <label className="label text-xs">🎁 促銷訊息 (選填 · 產文時 AI 會自然帶入)</label>
        <textarea className="input min-h-[60px] text-xs leading-relaxed"
          placeholder="例:週年慶滿千折 100 · 加購第二件 5 折 · 免運至 12/31"
          value={editing.promoInfo || ''} onChange={(e) => setEditing({ ...editing, promoInfo: e.target.value })} />
        <div className="mt-1 text-[10px] text-stone-500">留空 = 一般文案 · 有內容 = 每篇文案融入這個訊息(不是硬廣告口吻)</div>
      </div>

      {editing.type === 'image' && (
        <>
          <div>
            <label className="label text-xs">🖼️ 圖片來源 (預設)</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => setEditing({ ...editing, imageSource: 'product_photo' })}
                className={`rounded-md border p-2 text-left text-xs ${(editing.imageSource || 'ai_generated') === 'product_photo' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
              >
                <div className="font-semibold text-stone-900">📸 原本產品圖</div>
                <div className="text-[10px] text-stone-500 mt-0.5">直接用產品照 · 100% 保真 · 免費秒回</div>
              </button>
              <button type="button"
                onClick={() => setEditing({ ...editing, imageSource: 'ai_generated' })}
                className={`rounded-md border p-2 text-left text-xs ${(editing.imageSource || 'ai_generated') === 'ai_generated' ? 'border-purple-500 bg-purple-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
              >
                <div className="font-semibold text-stone-900">🎨 AI 生圖</div>
                <div className="text-[10px] text-stone-500 mt-0.5">KIE image-to-image · 模特兒穿搭 · 30-60s/篇</div>
              </button>
            </div>
            <div className="mt-1 text-[10px] text-stone-500">產文時仍可臨時覆寫這個選擇</div>
          </div>
          {(editing.imageSource || 'ai_generated') === 'ai_generated' && (
            <>
              <div>
                <label className="label text-xs">配圖英文 prompt (imagePrompt · 選填,留空 AI 依當篇自動寫)</label>
                <textarea className="input min-h-[60px] text-xs font-mono"
                  placeholder="Editorial fashion photography, Asian female..."
                  value={editing.imagePrompt || ''} onChange={(e) => setEditing({ ...editing, imagePrompt: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer bg-amber-50/60 border border-amber-200 rounded-lg p-2">
                  <input type="checkbox" checked={!!editing.noFace}
                    onChange={(e) => setEditing({ ...editing, noFace: e.target.checked, removeHead: e.target.checked ? false : editing.removeHead })}
                    className="size-4 rounded border-stone-300" />
                  <div>
                    <div className="font-semibold text-amber-900">🙈 不露臉</div>
                    <div className="text-[10px] text-stone-600 mt-0.5">頭在但看不到臉(背影/側臉/被頭髮遮/裁掉臉)</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer bg-stone-100 border border-stone-300 rounded-lg p-2">
                  <input type="checkbox" checked={!!editing.removeHead}
                    onChange={(e) => setEditing({ ...editing, removeHead: e.target.checked, noFace: e.target.checked ? false : editing.noFace })}
                    className="size-4 rounded border-stone-300" />
                  <div>
                    <div className="font-semibold text-stone-900">✂️ 去除頭部</div>
                    <div className="text-[10px] text-stone-600 mt-0.5">頸部以下,整個頭裁掉,聚焦服裝身型</div>
                  </div>
                </label>
              </div>
            </>
          )}
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label !mb-0 text-xs">🛒 綁定產品 (產文輪流帶入)</label>
          <button type="button" onClick={() => setShowProductPicker(!showProductPicker)}
            className="text-[11px] text-emerald-700 hover:underline">
            {showProductPicker ? '收起 ▲' : `選產品... (已選 ${(editing.productIds || []).length})`}
          </button>
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {picked.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                {p.name.slice(0, 18)}
                <button onClick={() => setEditing({ ...editing, productIds: editing.productIds.filter((x) => x !== p.id) })} className="text-emerald-500 hover:text-red-600">✕</button>
              </span>
            ))}
          </div>
        )}
        {showProductPicker && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
            <input className="input text-xs" placeholder="搜尋..." value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {products.filter((p) => !p.paused && (!productFilter || (p.name + p.category + p.gender).toLowerCase().includes(productFilter.toLowerCase()))).map((p) => {
                const on = (editing.productIds || []).includes(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-2 rounded-md p-1.5 text-[11px] cursor-pointer ${on ? 'bg-emerald-100' : 'hover:bg-stone-100'}`}>
                    <input type="checkbox" checked={on}
                      onChange={(e) => {
                        const next = e.target.checked ? [...(editing.productIds || []), p.id] : (editing.productIds || []).filter((x) => x !== p.id);
                        setEditing({ ...editing, productIds: next, brandOnly: next.length === 0 });
                      }}
                      className="size-3.5 rounded border-stone-300" />
                    {p.image_front && <img src={p.image_front} alt="" className="size-8 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-stone-900 truncate">{p.name}</div>
                      <div className="text-stone-500 text-[10px]">{p.category} · {p.gender || '不分'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 發文選項 */}
      {(editing.productIds || []).length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox"
              checked={!!editing.includePurchaseUrl}
              onChange={(e) => setEditing({ ...editing, includePurchaseUrl: e.target.checked })}
              className="size-4 rounded border-stone-300 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-800">🔗 產文時預設「附上購買連結」</div>
              <div className="text-[10px] text-stone-600 mt-0.5">
                打開後: 這個主題產出的每篇 draft 會自動勾選帶連結 (UTM 從 <Link href="/settings" className="text-emerald-700 underline">系統設定</Link> 帶)。
                產完/待發時仍可個別取消。
              </div>
            </div>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-blue-800">📅 排程設定</div>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={editing.schedule?.enabled}
              onChange={(e) => updateSch({ enabled: e.target.checked })}
              className="size-3.5 rounded border-stone-300" />
            啟用排程
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div>
            <label className="label text-[10px]">時間</label>
            <input type="time" className="input text-xs" value={editing.schedule?.time || '10:00'}
              onChange={(e) => updateSch({ time: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <label className="label text-[10px]">星期</label>
            <div className="flex gap-1 pt-0.5">
              {DAY_NAMES.map((n, i) => {
                const on = (editing.schedule?.days || []).includes(i);
                return (
                  <button key={i} type="button" onClick={() => {
                    const days = editing.schedule?.days || [];
                    const next = on ? days.filter((d) => d !== i) : [...days, i].sort();
                    updateSch({ days: next });
                  }}
                    className={`size-7 rounded-md text-[10px] font-medium ${on ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                  >{n}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <div className="label text-[10px]">平台</div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { k: 'threads', label: '🧵 Threads', enabled: canThreads },
              { k: 'instagram', label: '📷 IG', enabled: canIg && editing.type === 'image' },
              { k: 'facebook', label: '👍 FB', enabled: canFb },
            ].map((p) => {
              const on = editing.schedule?.platforms?.[p.k];
              return (
                <label key={p.k} className={`flex items-center gap-1 rounded-md border p-1.5 text-[11px] ${!p.enabled ? 'opacity-40 cursor-not-allowed' : on ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-stone-200 hover:bg-stone-50 cursor-pointer'}`}>
                  <input type="checkbox" checked={on && p.enabled} disabled={!p.enabled}
                    onChange={(e) => updateSch({ platforms: { ...editing.schedule?.platforms, [p.k]: e.target.checked } })}
                    className="size-3.5 rounded border-stone-300" />
                  {p.label}
                </label>
              );
            })}
          </div>
          {editing.type !== 'image' && <div className="text-[10px] text-stone-500 mt-1">IG 需 type=image 才能發</div>}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<main className="card">載入中…</main>}>
      <SchedulePageInner />
    </Suspense>
  );
}
