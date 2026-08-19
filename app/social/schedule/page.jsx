'use client';

// 排程管理 (主題清單) — card grid, 每張 card 是一個主題摘要, 點進入 detail 看完整貼文
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function SchedulePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParamId = searchParams.get('edit');

  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // ?edit=xxx 從 detail 頁跳回時自動開編輯
    if (editParamId && topics.length && !editing) {
      const t = topics.find((x) => x.id === editParamId);
      if (t) setEditing(t);
    }
  }, [editParamId, topics, editing]);

  async function load() {
    setLoading(true);
    try {
      const [tRes, pRes, prodRes, cRes] = await Promise.all([
        fetch('/api/infuz/topics', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/topic_posts', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/products', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/connections', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setTopics(tRes.items || []);
      setPosts(pRes.items || []);
      setProducts(prodRes.items || []);
      setConn((cRes.items || []).find((x) => x.id === 'main') || null);
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
        const r = await fetch(`${url}?id=${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...editing, updatedAt: new Date().toISOString() }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
      }
      setEditing(null);
      if (editParamId) router.replace('/social/schedule');
      await load();
    } catch (e) { setError('儲存失敗:' + e.message); }
    finally { setSaving(false); }
  }

  async function toggleSchedule(topic, e) {
    e.preventDefault(); e.stopPropagation();
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schedule: { ...topic.schedule, enabled: !topic.schedule.enabled } }),
    });
    load();
  }

  if (loading) return <main className="card">載入中…</main>;

  const filtered = topics.filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));
  const totalQueued = posts.filter((p) => p.status === 'queued').length;
  const totalPublished = posts.filter((p) => p.status === 'published').length;
  const totalFailed = posts.filter((p) => p.status === 'failed').length;

  return (
    <main className="space-y-5">
      <div className="card border-blue-200 bg-blue-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">📅 排程管理</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          所有主題清單 · 點卡片進入看完整貼文 · 到點 tick 從佇列取一篇發
        </p>
      </div>

      {/* 全站統計 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="主題總數" value={topics.length} sub={`${topics.filter((t) => t.schedule?.enabled).length} 個排程中`} />
        <StatBox label="待發" value={totalQueued} color="blue" sub="佇列中,到點自動發" />
        <StatBox label="已發" value={totalPublished} color="emerald" sub="累計成功" />
        <StatBox label="失敗" value={totalFailed} color="red" sub={totalFailed > 0 ? '需檢查' : '沒有失敗 ✨'} />
      </section>

      {/* 工具列 */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <input className="input text-sm flex-1 min-w-[200px]" placeholder="🔍 搜尋主題名..."
            value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Link href="/social/topics/discover"
            className="rounded-md bg-purple-600 px-3 py-2 text-xs text-white hover:bg-purple-700 whitespace-nowrap">
            💡 AI 發想主題
          </Link>
          <button onClick={newTopic}
            className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 whitespace-nowrap">
            + 手動新增
          </button>
        </div>
      </div>

      {/* 主題 grid */}
      {filtered.length === 0 && (
        <div className="card text-center py-12 space-y-3">
          <div className="text-4xl">📝</div>
          <div className="text-stone-600 text-sm">
            {topics.length === 0 ? '還沒有任何主題' : `沒有符合「${filter}」的主題`}
          </div>
          {topics.length === 0 && (
            <Link href="/social/topics/discover" className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">
              💡 用 AI 幫你發想 3 個試試
            </Link>
          )}
        </div>
      )}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((topic) => (
          <TopicCard key={topic.id}
            topic={topic}
            posts={posts.filter((p) => p.topicId === topic.id)}
            products={products}
            onToggleSchedule={(e) => toggleSchedule(topic, e)}
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
              <button onClick={() => { setEditing(null); if (editParamId) router.replace('/social/schedule'); }}
                className="text-stone-400 hover:text-stone-700">✕</button>
            </div>
            <TopicEditor editing={editing} setEditing={setEditing} products={products}
              canThreads={canThreads} canIg={canIg} canFb={canFb} />
            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}
            <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
              <button onClick={() => { setEditing(null); if (editParamId) router.replace('/social/schedule'); }}
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

function TopicCard({ topic, posts, products, onToggleSchedule }) {
  const queued = posts.filter((p) => p.status === 'queued').length;
  const published = posts.filter((p) => p.status === 'published').length;
  const failed = posts.filter((p) => p.status === 'failed').length;

  const scheduledEnabled = topic.schedule?.enabled;
  const days = topic.schedule?.days?.length === 7 ? '每天' : (topic.schedule?.days || []).map((d) => DAY_NAMES[d]).join('');
  const platformIcons = Object.entries(topic.schedule?.platforms || {}).filter(([_, v]) => v).map(([k]) => ({ threads: '🧵', instagram: '📷', facebook: '👍' })[k]).join(' ');
  const boundProducts = (topic.productIds || []).map((id) => products.find((p) => p.id === id)).filter(Boolean);

  const typeInfo = {
    text: { label: '📝 文字', bg: 'bg-blue-100 text-blue-700' },
    long: { label: '📄 長文', bg: 'bg-emerald-100 text-emerald-700' },
    image: { label: '🖼️ 圖片', bg: 'bg-purple-100 text-purple-700' },
  }[topic.type] || { label: topic.type, bg: 'bg-stone-100 text-stone-700' };

  return (
    <Link href={`/social/schedule/${topic.id}`}
      className={`group rounded-xl border p-4 space-y-3 transition hover:-translate-y-0.5 hover:shadow-md ${scheduledEnabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-80'}`}>
      {/* Top row: title + type + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-stone-900 truncate group-hover:text-blue-700">{topic.name}</div>
          {topic.description && (
            <p className="mt-0.5 text-[11px] text-stone-500 line-clamp-2 leading-relaxed">{topic.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 ${typeInfo.bg}`}>{typeInfo.label}</span>
      </div>

      {/* 排程摘要 */}
      <div className="rounded-lg bg-stone-50 border border-stone-200 p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-stone-700">
            <span>⏰ {topic.schedule?.time || '未設'}</span>
            <span className="text-stone-400">·</span>
            <span>{days || '無'}</span>
            <span className="text-stone-400">·</span>
            <span>{platformIcons || '(無平台)'}</span>
          </div>
          <button onClick={onToggleSchedule}
            className={`text-[9px] rounded-full px-1.5 py-0.5 shrink-0 ${scheduledEnabled ? 'bg-emerald-500 text-white' : 'bg-stone-300 text-stone-600'}`}>
            {scheduledEnabled ? '● ON' : '○ OFF'}
          </button>
        </div>
      </div>

      {/* 產品 + 貼文計數 */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-stone-500">🛒 {boundProducts.length > 0 ? `${boundProducts.length} 件產品` : '不帶產品'}</span>
        <div className="flex gap-2">
          <span className="text-blue-700">📥 {queued}</span>
          <span className="text-emerald-700">✓ {published}</span>
          {failed > 0 && <span className="text-red-700">✗ {failed}</span>}
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

      {editing.type === 'image' && (
        <div>
          <label className="label text-xs">配圖英文 prompt (imagePrompt · 選填,留空 AI 依當篇自動寫)</label>
          <textarea className="input min-h-[60px] text-xs font-mono"
            placeholder="Editorial fashion photography, Asian female..."
            value={editing.imagePrompt || ''} onChange={(e) => setEditing({ ...editing, imagePrompt: e.target.value })} />
        </div>
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
              {products.filter((p) => !productFilter || (p.name + p.category + p.gender).toLowerCase().includes(productFilter.toLowerCase())).map((p) => {
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
