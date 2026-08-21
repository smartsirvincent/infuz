'use client';

// 主題產文 · 選 topic + 篇數 → Claude 產 N 篇 draft → 每篇編輯/重生圖 → 存入佇列
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader, Chip, Button } from '../_components.jsx';

function ProducePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTopicId = searchParams.get('topic') || '';

  const [topics, setTopics] = useState([]);
  const [products, setProducts] = useState([]);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  // 本次覆寫 (只影響這次產文, 可勾 saveBack 存回主題)
  const [showOverrides, setShowOverrides] = useState(false);
  const [ov, setOv] = useState({ systemPrompt: '', imagePrompt: '', productIds: [], imageSource: 'ai_generated', noFace: false, removeHead: false, promoInfo: '' });
  const [saveBack, setSaveBack] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productFilter, setProductFilter] = useState('');

  useEffect(() => {
    fetch('/api/infuz/topics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setTopics(d.items || []);
        if (!initialTopicId && d.items?.length) setTopicId(d.items[0].id);
      })
      .catch(() => {});
    fetch('/api/infuz/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProducts(d.items || []))
      .catch(() => {});
  }, [initialTopicId]);

  const topic = topics.find((t) => t.id === topicId);
  const isImage = topic?.type === 'image';

  // 選 topic 變時, 用 topic 的值初始化 overrides
  useEffect(() => {
    if (!topic) return;
    setOv({
      systemPrompt: topic.systemPrompt || '',
      imagePrompt: topic.imagePrompt || '',
      productIds: topic.productIds || [],
      imageSource: topic.imageSource || 'ai_generated',
      noFace: Boolean(topic.noFace),
      removeHead: Boolean(topic.removeHead),
      promoInfo: topic.promoInfo || '',
    });
    setShowOverrides(false);
    setSaveBack(false);
  }, [topicId, topic?.id]);

  const overridesChanged = topic && (
    ov.systemPrompt !== (topic.systemPrompt || '') ||
    ov.imagePrompt !== (topic.imagePrompt || '') ||
    JSON.stringify(ov.productIds) !== JSON.stringify(topic.productIds || []) ||
    ov.imageSource !== (topic.imageSource || 'ai_generated') ||
    ov.noFace !== Boolean(topic.noFace) ||
    ov.removeHead !== Boolean(topic.removeHead) ||
    ov.promoInfo !== (topic.promoInfo || '')
  );

  // Progressive · 每篇獨立呼 API (count=1 startIndex=i), 每篇獨立 300s 不會撞 timeout
  // Concurrent workers · 圖片 3 workers, 文字 5 workers, 一篇好一篇 push
  async function produce() {
    if (!topicId) { setError('先選主題'); return; }
    setGenerating(true); setError(''); setDrafts([]); setSelected(new Set());
    setProgress({ done: 0, total: count });

    const useProductPhoto = ov.imageSource === 'product_photo';
    const isImageAI = isImage && !useProductPhoto;
    const CONCURRENCY = isImageAI ? 3 : 5;

    let started = 0;
    const worker = async () => {
      while (true) {
        const i = started++;
        if (i >= count) return;
        try {
          const body = { topicId, count: 1, startIndex: i };
          if (overridesChanged) {
            body.overrides = ov;
            // 只在第 0 篇時 saveBack, 避免每篇 PATCH
            body.saveBack = i === 0 && saveBack;
          }
          const r = await fetch('/api/infuz/topics/produce', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          // 先看 content-type, 避免 timeout 回 HTML 讓 JSON.parse 炸「Unexpected token 'A'」
          const ct = r.headers.get('content-type') || '';
          if (!ct.includes('application/json')) {
            throw new Error(`伺服器回非 JSON (${r.status}) · 可能 timeout, 稍後重試這篇`);
          }
          const d = await r.json();
          if (r.ok && d.posts?.length) {
            setDrafts((prev) => [...prev, ...d.posts]);
            setSelected((prev) => {
              const next = new Set(prev);
              d.posts.forEach((p) => next.add(p._localId));
              return next;
            });
          } else {
            setDrafts((prev) => [...prev, {
              _localId: `err_${Date.now()}_${i}`,
              _isError: true,
              _errorMsg: d.error || `HTTP ${r.status}`,
              _seq: i + 1,
              topicId, text: '', hashtags: '',
            }]);
          }
        } catch (e) {
          setDrafts((prev) => [...prev, {
            _localId: `err_${Date.now()}_${i}`,
            _isError: true,
            _errorMsg: e.message,
            _seq: i + 1,
            topicId, text: '', hashtags: '',
          }]);
        } finally {
          setProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    // saveBack refresh topics
    if (saveBack && overridesChanged) {
      try {
        const tRes = await fetch('/api/infuz/topics', { cache: 'no-store' });
        const tData = await tRes.json();
        setTopics(tData.items || []);
      } catch (_) {}
    }

    setGenerating(false);
  }

  async function retryOneDraft(errDraft) {
    const i = (errDraft._seq || 1) - 1;
    // 移除 error placeholder
    setDrafts((prev) => prev.filter((d) => d._localId !== errDraft._localId));
    try {
      const body = { topicId, count: 1, startIndex: i };
      if (overridesChanged) body.overrides = ov;
      const r = await fetch('/api/infuz/topics/produce', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`HTTP ${r.status} · 仍然失敗`);
      const d = await r.json();
      if (r.ok && d.posts?.length) {
        setDrafts((prev) => [...prev, ...d.posts]);
        setSelected((prev) => { const n = new Set(prev); d.posts.forEach(p => n.add(p._localId)); return n; });
      } else {
        setDrafts((prev) => [...prev, { _localId: `err_${Date.now()}_r`, _isError: true, _errorMsg: d.error || `HTTP ${r.status}`, _seq: i + 1, topicId, text: '', hashtags: '' }]);
      }
    } catch (e) {
      setDrafts((prev) => [...prev, { _localId: `err_${Date.now()}_r`, _isError: true, _errorMsg: e.message, _seq: i + 1, topicId, text: '', hashtags: '' }]);
    }
  }

  async function deleteTopic() {
    if (!topic) return;
    if (!confirm(`刪除主題「${topic.name}」?\n連同該主題所有 (待發/已發/失敗) 文章一起刪除,無法復原。`)) return;
    try {
      // 先撈該 topic 的 posts 一起刪
      const pRes = await fetch('/api/infuz/topic_posts', { cache: 'no-store' });
      const pData = await pRes.json();
      const related = (pData.items || []).filter((p) => p.topicId === topic.id);
      await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, { method: 'DELETE' });
      for (const p of related) {
        await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      }
      router.push('/social/schedule');
    } catch (e) { setError('刪除失敗:' + e.message); }
  }

  async function saveDraftToAssets(draft) {
    const idx = drafts.findIndex((d) => d._localId === draft._localId);
    if (idx < 0) return;
    updateDraft(draft._localId, { _savingAsset: true });
    try {
      const r = await fetch('/api/infuz/topic_posts/save-to-assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draft: {
            topicId: draft.topicId,
            text: draft.text,
            hashtags: draft.hashtags,
            imageUrl: draft.imageUrl,
            imagePrompt: draft.imagePrompt,
            pickedProductId: draft.pickedProductId,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      updateDraft(draft._localId, { _savingAsset: false, _savedAssetId: d.assetId });
    } catch (e) {
      updateDraft(draft._localId, { _savingAsset: false });
      alert('存素材失敗:' + e.message);
    }
  }

  async function regenImage(draft) {
    const idx = drafts.findIndex((d) => d._localId === draft._localId);
    if (idx < 0) return;
    const updated = [...drafts];
    updated[idx] = { ...draft, _regenerating: true };
    setDrafts(updated);
    try {
      const r = await fetch('/api/infuz/topics/produce/regen-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: draft.imagePrompt,
          productId: draft.pickedProductId,
          aspectRatio: topic?.aspectRatio || '4:5',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const upd2 = [...drafts];
      upd2[idx] = { ...draft, imageUrl: d.imageUrl, imageError: null, _regenerating: false };
      setDrafts(upd2);
    } catch (e) {
      const upd3 = [...drafts];
      upd3[idx] = { ...draft, imageError: e.message, _regenerating: false };
      setDrafts(upd3);
    }
  }

  async function saveToQueue() {
    setSaving(true); setError('');
    try {
      const posts = drafts.filter((d) => selected.has(d._localId));
      const r = await fetch('/api/infuz/topics/produce/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ posts }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      alert(`已加入 ${d.added} 篇到待發佇列 · 到點會依主題排程自動發`);
      setDrafts([]); setSelected(new Set());
    } catch (e) { setError('儲存失敗:' + e.message); }
    finally { setSaving(false); }
  }

  function updateDraft(localId, patch) {
    setDrafts(drafts.map((d) => (d._localId === localId ? { ...d, ...patch } : d)));
  }

  function removeDraft(localId) {
    setDrafts(drafts.filter((d) => d._localId !== localId));
    const next = new Set(selected); next.delete(localId); setSelected(next);
  }

  return (
    <main className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Produce"
        title="主題產文"
        breadcrumbs={[{ href: '/social', label: '社群發文' }, { label: '主題產文' }]}
        description="選主題與篇數,AI 產出多篇 draft,逐篇編輯後加入待發佇列。"
      />

      <div className="card space-y-4">
        <div>
          <label className="label text-xs">🎯 選主題</label>
          <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">--- 選主題 ---</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {topic && (
          <>
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`shrink-0 text-[11px] rounded px-2 py-0.5 ${
                  topic.type === 'long' ? 'bg-emerald-600 text-white' :
                  topic.type === 'image' ? 'bg-purple-600 text-white' :
                  'bg-blue-600 text-white'
                }`}>
                  {topic.type === 'long' ? '📄 長文 300-600 字' : topic.type === 'image' ? '🖼️ 圖片 100-200 字' : '📝 文字 100-200 字'}
                </span>
                <div className="text-sm text-stone-800 font-medium flex-1 min-w-0 truncate">{topic.name}</div>
                <button onClick={deleteTopic}
                  className="text-[11px] text-red-600 hover:bg-red-50 rounded px-2 py-0.5 border border-red-200 shrink-0"
                  title="刪除主題(含所有文章)">
                  🗑 刪除主題
                </button>
              </div>
              {topic.description && <p className="text-[11px] text-stone-600 leading-relaxed">{topic.description}</p>}
              {(ov.productIds || []).length > 0 && (
                <div className="text-[11px] text-emerald-700">🛒 綁定 {ov.productIds.length} 件產品(產文時輪流帶入)</div>
              )}
            </div>

            {/* 本次覆寫展開區 */}
            <details className="rounded-lg border border-stone-200" open={showOverrides} onToggle={(e) => setShowOverrides(e.currentTarget.open)}>
              <summary className="cursor-pointer px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between">
                <span className="font-semibold">⚙️ 本次覆寫 (寫作方向 / 圖片 prompt / 產品 / 圖片來源)</span>
                {overridesChanged && <span className="text-[10px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">已修改</span>}
              </summary>
              <div className="border-t border-stone-200 p-3 space-y-3 bg-stone-50/40">
                <div>
                  <label className="label text-[10px]">寫作方向 systemPrompt</label>
                  <textarea className="input min-h-[80px] text-xs leading-relaxed"
                    placeholder="留空則不加指示 (只依品牌人格 + 主題描述寫)"
                    value={ov.systemPrompt}
                    onChange={(e) => setOv({ ...ov, systemPrompt: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label text-[10px]">🎁 促銷訊息 (選填 · 每篇會融入)</label>
                  <textarea className="input min-h-[50px] text-xs leading-relaxed"
                    placeholder="例:週年慶滿千折 100"
                    value={ov.promoInfo}
                    onChange={(e) => setOv({ ...ov, promoInfo: e.target.value })}
                  />
                </div>

                {isImage && (
                  <div>
                    <label className="label text-[10px]">🖼️ 圖片來源 (本次)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setOv({ ...ov, imageSource: 'product_photo' })}
                        className={`rounded-md border p-2 text-left text-xs ${ov.imageSource === 'product_photo' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                      >
                        <div className="font-semibold text-stone-900">📸 原本產品圖</div>
                        <div className="text-[10px] text-stone-500 mt-0.5">直接用產品照 · 100% 保真 · 免費秒回</div>
                      </button>
                      <button type="button"
                        onClick={() => setOv({ ...ov, imageSource: 'ai_generated' })}
                        className={`rounded-md border p-2 text-left text-xs ${ov.imageSource === 'ai_generated' ? 'border-purple-500 bg-purple-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                      >
                        <div className="font-semibold text-stone-900">🎨 AI 生圖</div>
                        <div className="text-[10px] text-stone-500 mt-0.5">KIE image-to-image · 模特兒穿搭 · 30-60s/篇</div>
                      </button>
                    </div>
                  </div>
                )}

                {isImage && ov.imageSource === 'ai_generated' && (
                  <>
                    <div>
                      <label className="label text-[10px]">🎨 圖片 imagePrompt (英文, 選填, 留空 AI 依當篇自動寫)</label>
                      <textarea className="input min-h-[70px] text-[11px] font-mono leading-relaxed"
                        placeholder="Editorial fashion photography, Asian woman..."
                        value={ov.imagePrompt}
                        onChange={(e) => setOv({ ...ov, imagePrompt: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-[11px] cursor-pointer bg-amber-50/60 border border-amber-200 rounded-lg p-2">
                        <input type="checkbox" checked={ov.noFace}
                          onChange={(e) => setOv({ ...ov, noFace: e.target.checked, removeHead: e.target.checked ? false : ov.removeHead })}
                          className="size-3.5 rounded border-stone-300" />
                        <div>
                          <div className="font-semibold text-amber-900">🙈 不露臉</div>
                          <div className="text-[10px] text-stone-600">頭在,看不到臉</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 text-[11px] cursor-pointer bg-stone-100 border border-stone-300 rounded-lg p-2">
                        <input type="checkbox" checked={ov.removeHead}
                          onChange={(e) => setOv({ ...ov, removeHead: e.target.checked, noFace: e.target.checked ? false : ov.noFace })}
                          className="size-3.5 rounded border-stone-300" />
                        <div>
                          <div className="font-semibold text-stone-900">✂️ 去除頭部</div>
                          <div className="text-[10px] text-stone-600">頸部以下</div>
                        </div>
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label !mb-0 text-[10px]">🛒 綁定產品 (本次可加/減)</label>
                    <button type="button" onClick={() => setShowProductPicker(!showProductPicker)}
                      className="text-[10px] text-emerald-700 hover:underline">
                      {showProductPicker ? '收起 ▲' : `選產品... (已選 ${ov.productIds.length})`}
                    </button>
                  </div>
                  {ov.productIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {products.filter((p) => ov.productIds.includes(p.id)).map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                          {p.name.slice(0, 15)}
                          <button onClick={() => setOv({ ...ov, productIds: ov.productIds.filter((x) => x !== p.id) })} className="text-emerald-500 hover:text-red-600">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {showProductPicker && (
                    <div className="rounded-lg border border-stone-200 bg-white p-2 space-y-2">
                      <input className="input text-xs" placeholder="搜尋..." value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
                      <div className="max-h-[180px] overflow-y-auto space-y-1">
                        {products.filter((p) => !p.paused && (!productFilter || (p.name + p.category + (p.gender || '')).toLowerCase().includes(productFilter.toLowerCase()))).map((p) => {
                          const on = ov.productIds.includes(p.id);
                          return (
                            <label key={p.id} className={`flex items-center gap-2 rounded-md p-1.5 text-[11px] cursor-pointer ${on ? 'bg-emerald-100' : 'hover:bg-stone-100'}`}>
                              <input type="checkbox" checked={on}
                                onChange={(e) => {
                                  const next = e.target.checked ? [...ov.productIds, p.id] : ov.productIds.filter((x) => x !== p.id);
                                  setOv({ ...ov, productIds: next });
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

                {overridesChanged && (
                  <label className="flex items-center gap-2 text-[11px] text-stone-700 cursor-pointer border-t border-stone-200 pt-2">
                    <input type="checkbox" checked={saveBack}
                      onChange={(e) => setSaveBack(e.target.checked)}
                      className="size-3.5 rounded border-stone-300" />
                    <span>同時把這些改動<strong>存回主題</strong>(下次不用再改)</span>
                  </label>
                )}
              </div>
            </details>
          </>
        )}

        <div>
          <label className="label text-xs">📊 這次產幾篇</label>
          <div className="flex gap-2 items-center flex-wrap">
            {[3, 10, 30, 100].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)}
                className={`flex-1 min-w-[60px] rounded-md px-3 py-2 text-sm font-medium ${count === n ? 'bg-fuchsia-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >{n} 篇</button>
            ))}
            <input type="number" min={1} max={100} className="input w-20 text-sm"
              value={count} onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          {isImage && ov.imageSource === 'ai_generated' && count > 10 && (
            <div className="mt-1 text-[10px] text-amber-700">
              ⏳ AI 生圖 {count} 篇約需 {Math.ceil(count / 5) * 60}s (backend 每批 5 篇分批處理)。建議 30 篇內為安全範圍
            </div>
          )}
          {(!isImage || ov.imageSource === 'product_photo') && count > 30 && (
            <div className="mt-1 text-[10px] text-stone-500">
              ⏱ 文字類型 {count} 篇約需 {Math.ceil(count / 20) * 15}s
            </div>
          )}
        </div>

        {topics.length === 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            還沒有主題 · <Link href="/social/topics/discover" className="underline font-semibold">先去 AI 發想主題</Link>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}

        <button onClick={produce} disabled={generating || !topicId}
          className="w-full rounded-lg bg-fuchsia-600 px-5 py-3 text-base font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50">
          {generating ? (isImage ? `⏳ 產文+生圖中(約 ${count * 45}s)…` : '⏳ 產文中…') : `🚀 開始產 ${count} 篇`}
        </button>
      </div>

      {/* Progress bar (生成中) */}
      {generating && progress.total > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-700">生成中 <span className="font-mono tabular-nums text-zinc-950">{progress.done}/{progress.total}</span></span>
            <span className="text-zinc-500 font-mono tabular-nums">{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-zinc-950 transition-all duration-300 motion-reduce:transition-none" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            每篇獨立呼叫 API · {isImage && ov.imageSource === 'ai_generated' ? '3 個並發' : '5 個並發'} · 一好一顯示,不用等全部
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-950 tracking-tight">
              產出 <span className="font-mono tabular-nums">{drafts.filter(d => !d._isError).length}</span> 篇
              {drafts.some(d => d._isError) && <span className="text-red-600 text-xs ml-2">({drafts.filter(d => d._isError).length} 失敗)</span>}
              <span className="ml-2 text-xs text-zinc-500 font-normal">已選 {selected.size}</span>
            </h2>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSelected(new Set(drafts.map((d) => d._localId)))} className="text-stone-600 hover:underline">全選</button>
              <button onClick={() => setSelected(new Set())} className="text-stone-600 hover:underline">全清</button>
            </div>
          </div>

          {drafts.map((d) => (
            d._isError ? (
              <div key={d._localId} className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-red-800">第 {d._seq} 篇失敗</div>
                  <div className="text-red-700 mt-0.5 break-all">{d._errorMsg}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => retryOneDraft(d)} className="text-blue-700 hover:underline whitespace-nowrap">🔄 重試</button>
                  <button onClick={() => removeDraft(d._localId)} className="text-red-500 hover:underline whitespace-nowrap">移除</button>
                </div>
              </div>
            ) : (
              <DraftCard key={d._localId} draft={d}
                on={selected.has(d._localId)}
                onToggle={() => {
                  const next = new Set(selected);
                  if (next.has(d._localId)) next.delete(d._localId); else next.add(d._localId);
                  setSelected(next);
                }}
                onChange={(patch) => updateDraft(d._localId, patch)}
                onRemove={() => removeDraft(d._localId)}
                onRegenImage={() => regenImage(d)}
                onSaveToAssets={() => saveDraftToAssets(d)}
                onZoom={(url) => setLightbox(url)}
              />
            )
          ))}

          <div className="flex justify-end border-t border-stone-200 pt-3">
            <button onClick={saveToQueue} disabled={saving || selected.size === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? '存中…' : `✓ 加入 ${selected.size} 篇到待發佇列`}
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </main>
  );
}

function DraftCard({ draft, on, onToggle, onChange, onRemove, onRegenImage, onSaveToAssets, onZoom }) {
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${on ? 'border-emerald-300 bg-emerald-50/30' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={on} onChange={onToggle} className="size-4 rounded border-stone-300 mt-1" />
        <div className="flex-1 min-w-0 space-y-2">
          {draft.pickedProductName && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 flex items-center gap-2 flex-wrap">
              {draft.pickedProductImage && (
                <button type="button" onClick={() => onZoom(draft.pickedProductImage)}
                  className="shrink-0 group relative">
                  <img src={draft.pickedProductImage} alt="" className="size-14 rounded object-cover border" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded transition flex items-center justify-center text-white opacity-0 group-hover:opacity-100 text-[10px]">🔍</div>
                </button>
              )}
              <div className="flex-1 min-w-0 text-[11px] text-stone-700">
                <div className="text-stone-500 text-[10px]">📸 產品參考照 (點放大比對生成圖)</div>
                <div className="font-medium truncate">🛒 {draft.pickedProductName}</div>
              </div>
              {draft.pickedProductPurchaseUrl && (
                <label className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-700 cursor-pointer bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  <input type="checkbox"
                    checked={!!draft.includePurchaseUrl}
                    onChange={(e) => onChange({ includePurchaseUrl: e.target.checked })}
                    className="size-3.5 rounded border-stone-300" />
                  🔗 帶購買連結
                </label>
              )}
            </div>
          )}
          <div>
            <label className="label text-[10px]">文案</label>
            <textarea className="input min-h-[120px] text-sm leading-relaxed"
              value={draft.text} onChange={(e) => onChange({ text: e.target.value })} />
            <div className="mt-0.5 text-[10px] text-stone-500">字數:{(draft.text || '').length}</div>
          </div>
          <div>
            <label className="label text-[10px]">Hashtags</label>
            <input className="input text-xs" value={draft.hashtags} onChange={(e) => onChange({ hashtags: e.target.value })} />
          </div>

          {(draft.imageUrl || draft.imagePrompt || draft.imageError) && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-2 space-y-2">
              <div className="flex items-start gap-3">
                {draft._regenerating ? (
                  <div className="size-40 rounded border-2 border-dashed border-purple-300 flex items-center justify-center text-xs text-purple-600 bg-white">
                    🔄 重生中…
                  </div>
                ) : draft.imageUrl ? (
                  <button onClick={() => onZoom(draft.imageUrl)}
                    className="shrink-0 group relative"
                  >
                    <img src={draft.imageUrl} alt="" className="size-40 rounded object-cover border" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded transition flex items-center justify-center text-white opacity-0 group-hover:opacity-100 text-xs">
                      🔍 放大
                    </div>
                  </button>
                ) : (
                  <div className="size-40 rounded border-2 border-dashed border-red-300 flex items-center justify-center text-[10px] text-red-600 bg-white p-2 text-center">
                    ⚠ 沒生成<br />{draft.imageError}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-purple-700 font-semibold">🎨 配圖</div>
                    <div className="flex gap-2 text-[10px]">
                      {draft.imageUrl && draft._savedAssetId && <span className="text-emerald-600">✓ 已存</span>}
                      {draft.imageUrl && !draft._savedAssetId && (
                        <button onClick={onSaveToAssets} disabled={draft._savingAsset}
                          className="text-amber-700 hover:underline disabled:opacity-50">
                          {draft._savingAsset ? '存中…' : '💾 存素材庫'}
                        </button>
                      )}
                      <button onClick={() => setShowImagePrompt(!showImagePrompt)} className="text-stone-600 hover:underline">
                        {showImagePrompt ? '收起 prompt' : '看/改 prompt'}
                      </button>
                      <button onClick={onRegenImage} disabled={!draft.imagePrompt || draft._regenerating}
                        className="text-purple-700 hover:underline disabled:opacity-50">🔄 重生一張</button>
                    </div>
                  </div>
                  {showImagePrompt && (
                    <textarea className="input min-h-[100px] text-[10px] font-mono leading-relaxed"
                      value={draft.imagePrompt || ''}
                      onChange={(e) => onChange({ imagePrompt: e.target.value })}
                      placeholder="英文 image-to-image prompt" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={onRemove} className="text-red-500 hover:text-red-700 text-xs shrink-0">✕ 刪</button>
      </div>
    </div>
  );
}

export default function ProducePage() {
  return (
    <Suspense fallback={<main className="card">載入中…</main>}>
      <ProducePageInner />
    </Suspense>
  );
}
