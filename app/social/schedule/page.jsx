'use client';

// 排程管理 = 主題清單 + 每個主題的排程 (time/days/platforms) + 展開看待發佇列
import { useEffect, useState } from 'react';
import Link from 'next/link';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export default function SchedulePage() {
  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

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
      await load();
    } catch (e) { setError('儲存失敗:' + e.message); }
    finally { setSaving(false); }
  }

  async function deleteTopic(id) {
    if (!confirm('刪除這個主題?待發的文章會一起被刪。')) return;
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    // 順帶刪除該主題的 posts
    const relatedPosts = posts.filter((p) => p.topicId === id);
    for (const p of relatedPosts) {
      await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    }
    load();
  }

  async function toggleSchedule(topic) {
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schedule: { ...topic.schedule, enabled: !topic.schedule.enabled } }),
    });
    load();
  }

  if (loading) return <main className="card">載入中…</main>;

  return (
    <main className="space-y-5">
      <div className="card border-blue-200 bg-blue-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">📅 排程管理</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          所有「主題」清單 + 每個主題的排程時間/星期/平台 + 待發佇列。到點 tick 會從待發佇列取一篇發。
        </p>
      </div>

      {/* 主題清單 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">📋 主題清單 ({topics.length})</h2>
          <div className="flex gap-2">
            <Link href="/social/topics/discover" className="text-xs text-purple-700 hover:underline">💡 AI 發想主題</Link>
            <button onClick={newTopic} className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">+ 手動新增</button>
          </div>
        </div>

        {topics.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            還沒有主題,先<Link href="/social/topics/discover" className="text-purple-700 underline">💡 用 AI 發想</Link>或手動新增
          </div>
        )}

        {topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            posts={posts.filter((p) => p.topicId === topic.id)}
            products={products}
            expanded={expanded.has(topic.id)}
            onToggleExpand={() => {
              const next = new Set(expanded);
              if (next.has(topic.id)) next.delete(topic.id); else next.add(topic.id);
              setExpanded(next);
            }}
            onEdit={() => setEditing(topic)}
            onDelete={() => deleteTopic(topic.id)}
            onToggleSchedule={() => toggleSchedule(topic)}
          />
        ))}
      </div>

      {/* 編輯 modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">
                {editing._isNew ? '➕ 新增主題' : '✏️ 編輯主題'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-700">✕</button>
            </div>

            <TopicEditor editing={editing} setEditing={setEditing} products={products}
              canThreads={canThreads} canIg={canIg} canFb={canFb} />

            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}

            <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
              <button onClick={() => setEditing(null)} className="rounded-md border border-stone-300 px-4 py-1.5 text-sm">取消</button>
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

function TopicRow({ topic, posts, products, expanded, onToggleExpand, onEdit, onDelete, onToggleSchedule }) {
  const queued = posts.filter((p) => p.status === 'queued');
  const published = posts.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const failed = posts.filter((p) => p.status === 'failed');

  const days = topic.schedule?.days?.length === 7 ? '每天' : (topic.schedule?.days || []).map((d) => DAY_NAMES[d]).join('、');
  const platforms = Object.entries(topic.schedule?.platforms || {}).filter(([_, v]) => v).map(([k]) => k[0].toUpperCase() + k.slice(1)).join('/');
  const scheduledEnabled = topic.schedule?.enabled;

  const productNames = (topic.productIds || []).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);

  return (
    <div className={`rounded-lg border ${scheduledEnabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onToggleSchedule} className={`text-[10px] rounded-full px-2 py-0.5 ${scheduledEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
              {scheduledEnabled ? '● 排程中' : '○ 停用'}
            </button>
            <div className="font-semibold text-sm text-stone-900 truncate">{topic.name}</div>
            <span className="text-[10px] rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">
              {topic.type === 'long' ? '📄 長文' : topic.type === 'image' ? '🖼️ 圖片' : '📝 文字'}
            </span>
          </div>
          {topic.description && <p className="mt-1 text-[11px] text-stone-500 line-clamp-2">{topic.description}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-600">
            <span>⏰ {topic.schedule?.time || '未設'} · {days} · {platforms || '無平台'}</span>
            <span>🛒 {productNames.length ? `${productNames.length} 件產品` : '不帶產品'}</span>
            <span className="text-blue-700">📥 待發 {queued.length}</span>
            <span className="text-emerald-700">✓ 已發 {published.length}</span>
            {failed.length > 0 && <span className="text-red-700">✗ 失敗 {failed.length}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Link href={`/social/produce?topic=${topic.id}`} className="text-xs text-purple-700 hover:underline whitespace-nowrap">✨ 產文 →</Link>
          <button onClick={onToggleExpand} className="text-xs text-blue-700 hover:underline">{expanded ? '收起 ▲' : '看佇列 ▼'}</button>
          <button onClick={onEdit} className="text-xs text-stone-600 hover:underline">編輯</button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:underline">刪除</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-200 p-3 space-y-2 bg-stone-50/40">
          <div className="text-[11px] font-semibold text-blue-700">📥 待發佇列 ({queued.length})</div>
          {queued.length === 0 && <div className="text-[11px] text-stone-500 italic">佇列空的 - <Link href={`/social/produce?topic=${topic.id}`} className="text-purple-700 underline">去產文</Link></div>}
          {queued.map((p) => (
            <div key={p.id} className="rounded border border-stone-200 bg-white p-2 text-[11px]">
              {p.imageUrl && <img src={p.imageUrl} className="float-right ml-2 size-14 rounded object-cover" alt="" />}
              <pre className="whitespace-pre-wrap text-stone-800 font-sans line-clamp-3">{p.text}</pre>
              {p.hashtags && <div className="mt-0.5 text-emerald-700 text-[10px]">{p.hashtags}</div>}
            </div>
          ))}
          {published.length > 0 && (
            <>
              <div className="text-[11px] font-semibold text-emerald-700 pt-2">✓ 最近已發 (最新 3)</div>
              {published.slice(0, 3).map((p) => (
                <div key={p.id} className="rounded border border-stone-200 bg-white p-2 text-[11px]">
                  <div className="text-[10px] text-stone-500 mb-0.5">{new Date(p.publishedAt).toLocaleString('zh-TW')}</div>
                  <pre className="whitespace-pre-wrap text-stone-700 font-sans line-clamp-2">{p.text}</pre>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
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
          <label className="label text-xs">圖片比例 (type=image 時用)</label>
          <select className="input" value={editing.aspectRatio || '4:5'} onChange={(e) => setEditing({ ...editing, aspectRatio: e.target.value })}>
            <option value="4:5">4:5</option>
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label text-xs">寫作方向提示 (systemPrompt)</label>
        <textarea className="input min-h-[70px] text-xs" placeholder="例:每篇要有 1 個具體生活場景 + 1 個身形痛點,語氣像姊姊,避免說教感"
          value={editing.systemPrompt} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} />
      </div>

      {editing.type === 'image' && (
        <div>
          <label className="label text-xs">配圖英文 prompt (imagePrompt · 選填,留空產文時 AI 依當篇自動寫)</label>
          <textarea className="input min-h-[60px] text-xs font-mono" placeholder="Editorial fashion photography, Asian female..."
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
