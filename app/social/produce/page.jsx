'use client';

// 主題產文 — 選 topic + 篇數 → Claude 產 N 篇 draft → 每篇編輯/重生圖 → 存入佇列
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ProducePageInner() {
  const searchParams = useSearchParams();
  const initialTopicId = searchParams.get('topic') || '';

  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch('/api/infuz/topics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setTopics(d.items || []);
        if (!initialTopicId && d.items?.length) setTopicId(d.items[0].id);
      })
      .catch(() => {});
  }, [initialTopicId]);

  const topic = topics.find((t) => t.id === topicId);
  const isImage = topic?.type === 'image';

  async function produce() {
    if (!topicId) { setError('先選主題'); return; }
    setGenerating(true); setError(''); setDrafts([]); setSelected(new Set());
    try {
      const r = await fetch('/api/infuz/topics/produce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId, count }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setDrafts(d.posts || []);
      setSelected(new Set((d.posts || []).map((p) => p._localId)));
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
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
    <main className="space-y-5">
      <div className="card border-fuchsia-200 bg-fuchsia-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">✨ 主題產文</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          選主題 + 篇數 → AI 依主題設定產出多篇 → 逐篇編輯 → 加入待發佇列(依主題排程時間自動發)。
        </p>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,120px,auto]">
          <div>
            <label className="label text-xs">🎯 選主題</label>
            <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">--- 選主題 ---</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type === 'long' ? '長文' : t.type === 'image' ? '圖片' : '文字'} · {(t.productIds || []).length} 產品)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">📊 篇數</label>
            <input type="number" min={1} max={20} className="input"
              value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div className="flex items-end">
            <button onClick={produce} disabled={generating || !topicId}
              className="w-full rounded-lg bg-fuchsia-600 px-5 py-2.5 text-sm text-white hover:bg-fuchsia-700 disabled:opacity-50">
              {generating ? (isImage ? `產文+生圖中(約 ${count * 30}s)…` : '產文中…') : '🚀 開始產文'}
            </button>
          </div>
        </div>

        {topic && (
          <div className="rounded-lg bg-stone-50 p-2 text-[11px] text-stone-600">
            <div><strong>{topic.name}</strong> · {topic.description || '(無描述)'}</div>
            <div className="text-stone-500 mt-0.5">
              類型: {topic.type === 'long' ? '📄 長文 300-600 字' : topic.type === 'image' ? '🖼️ 圖片 100-200 字 + AI 生圖' : '📝 文字 100-200 字'}
              {(topic.productIds || []).length > 0 && ` · 綁定 ${(topic.productIds || []).length} 件產品(輪流帶入)`}
            </div>
          </div>
        )}

        {topics.length === 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            還沒有主題 · <Link href="/social/topics/discover" className="underline">先去 AI 發想主題</Link>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}
      </div>

      {drafts.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800">📝 產出 {drafts.length} 篇 (已選 {selected.size})</h2>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSelected(new Set(drafts.map((d) => d._localId)))} className="text-stone-600 hover:underline">全選</button>
              <button onClick={() => setSelected(new Set())} className="text-stone-600 hover:underline">全清</button>
            </div>
          </div>

          {drafts.map((d) => (
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
              onZoom={(url) => setLightbox(url)}
            />
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

function DraftCard({ draft, on, onToggle, onChange, onRemove, onRegenImage, onZoom }) {
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${on ? 'border-emerald-300 bg-emerald-50/30' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={on} onChange={onToggle} className="size-4 rounded border-stone-300 mt-1" />
        <div className="flex-1 min-w-0 space-y-2">
          {draft.pickedProductName && (
            <div className="flex items-center gap-2 text-[11px] text-stone-600">
              {draft.pickedProductImage && <img src={draft.pickedProductImage} alt="" className="size-8 rounded object-cover border" />}
              <span>🛒 帶產品:<strong>{draft.pickedProductName}</strong></span>
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
