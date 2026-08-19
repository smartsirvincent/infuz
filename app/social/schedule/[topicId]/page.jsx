'use client';

// 單一主題詳情 — 完整 topic 資訊 + 所有貼文(queued/published/failed)完整內容
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { buildTextWithLink } from '@/lib/topic-publish-helper.js';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const TAB = { queued: '📥 待發', published: '✓ 已發', failed: '✗ 失敗' };

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId;

  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queued');
  const [lightbox, setLightbox] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [topicId]);

  async function load() {
    setLoading(true);
    try {
      const [tRes, pRes, prodRes, sRes] = await Promise.all([
        fetch('/api/infuz/topics', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/topic_posts', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/products', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/infuz/settings', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setTopic((tRes.items || []).find((t) => t.id === topicId) || null);
      setPosts((pRes.items || []).filter((p) => p.topicId === topicId));
      setProducts(prodRes.items || []);
      setSettings((sRes.items || []).find((s) => s.id === 'main') || {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function deletePost(id) {
    if (!confirm('刪掉這篇?')) return;
    await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  }

  async function retryPost(post) {
    await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(post.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'queued', error: null }),
    });
    load();
  }

  async function toggleIncludeLink(post, checked) {
    await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(post.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ includePurchaseUrl: checked }),
    });
    // 樂觀 UI 更新
    setPosts(posts.map((p) => p.id === post.id ? { ...p, includePurchaseUrl: checked } : p));
  }

  async function publishNow(post) {
    if (!confirm(`立即發這篇到 ${describePlatforms(topic?.schedule?.platforms)}?`)) return;
    setPublishingId(post.id); setError('');
    try {
      const r = await fetch('/api/infuz/topic_posts/publish-now', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      alert('✓ 已發文!到「已發」tab 看結果');
      await load();
      setTab('published');
    } catch (e) {
      setError('發文失敗:' + e.message);
    } finally { setPublishingId(null); }
  }

  function describePlatforms(platforms) {
    if (!platforms) return 'Threads';
    const parts = [];
    if (platforms.threads) parts.push('Threads');
    if (platforms.instagram) parts.push('IG');
    if (platforms.facebook) parts.push('FB');
    return parts.join('/') || '(未選平台)';
  }

  async function toggleSchedule() {
    if (!topic) return;
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schedule: { ...topic.schedule, enabled: !topic.schedule.enabled } }),
    });
    load();
  }

  async function deleteTopic() {
    if (!confirm(`刪除主題「${topic.name}」?待發/已發 ${posts.length} 篇文章也會一起刪掉。`)) return;
    await fetch(`/api/infuz/topics?id=${encodeURIComponent(topic.id)}`, { method: 'DELETE' });
    for (const p of posts) {
      await fetch(`/api/infuz/topic_posts?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    }
    router.push('/social/schedule');
  }

  if (loading) return <main className="card">載入中…</main>;
  if (!topic) return (
    <main className="card">
      找不到這個主題 · <Link href="/social/schedule" className="text-blue-700 underline">回主題清單</Link>
    </main>
  );

  const byStatus = {
    queued: posts.filter((p) => p.status === 'queued').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    published: posts.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')),
    failed: posts.filter((p) => p.status === 'failed'),
  };

  const boundProducts = (topic.productIds || []).map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const days = topic.schedule?.days?.length === 7 ? '每天' : (topic.schedule?.days || []).map((d) => DAY_NAMES[d]).join('、');
  const platforms = Object.entries(topic.schedule?.platforms || {}).filter(([_, v]) => v).map(([k]) => ({ threads: '🧵 T', instagram: '📷 IG', facebook: '👍 FB' })[k]).join(' ');

  return (
    <main className="space-y-5">
      {/* 麵包屑 */}
      <div className="text-xs text-stone-500 flex items-center gap-2">
        <Link href="/social" className="hover:underline">📤 社群發文</Link>
        <span>›</span>
        <Link href="/social/schedule" className="hover:underline">📅 排程管理</Link>
        <span>›</span>
        <span className="text-stone-800 font-medium">{topic.name}</span>
      </div>

      {/* Header */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-stone-900">{topic.name}</h1>
              <span className="text-[10px] rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">
                {topic.type === 'long' ? '📄 長文' : topic.type === 'image' ? '🖼️ 圖片' : '📝 文字'}
              </span>
              <button onClick={toggleSchedule}
                className={`text-[10px] rounded-full px-2 py-0.5 ${topic.schedule?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
                {topic.schedule?.enabled ? '● 排程中' : '○ 停用中'}
              </button>
            </div>
            {topic.description && <p className="mt-1 text-sm text-stone-600">{topic.description}</p>}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Link href={`/social/produce?topic=${topic.id}`}
              className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs text-white hover:bg-fuchsia-700 whitespace-nowrap text-center">
              ✨ 產文
            </Link>
            <Link href={`/social/schedule?edit=${topic.id}`}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50 text-center">
              ✏️ 編輯
            </Link>
            <button onClick={deleteTopic}
              className="rounded-md border border-red-200 text-red-600 px-3 py-1.5 text-xs hover:bg-red-50">
              🗑️ 刪除
            </button>
          </div>
        </div>

        {/* 排程 + 產品資訊 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
            <div className="text-[10px] text-blue-800 font-semibold">📅 排程</div>
            <div className="mt-1 text-xs text-stone-800">
              {topic.schedule?.time ? (
                <>⏰ 每{days} {topic.schedule.time} · {platforms || '(無平台)'}</>
              ) : (
                '(未設排程)'
              )}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
            <div className="text-[10px] text-emerald-800 font-semibold">🛒 綁定產品 ({boundProducts.length})</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {boundProducts.length === 0 && <span className="text-xs text-stone-500">不帶產品 · 依品牌人格發文</span>}
              {boundProducts.slice(0, 4).map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-stone-700 border border-emerald-100">
                  {p.image_front && <img src={p.image_front} alt="" className="size-3.5 rounded object-cover" />}
                  {p.name.slice(0, 12)}
                </span>
              ))}
              {boundProducts.length > 4 && <span className="text-[10px] text-stone-500 self-center">+{boundProducts.length - 4}</span>}
            </div>
          </div>
        </div>

        {topic.systemPrompt && (
          <details className="rounded-lg bg-stone-50 p-2.5">
            <summary className="text-[10px] text-stone-600 cursor-pointer font-semibold">📝 寫作方向(產文時的 systemPrompt)</summary>
            <p className="mt-1 text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{topic.systemPrompt}</p>
          </details>
        )}
      </div>

      {/* Tabs */}
      <div className="card space-y-3">
        <div className="flex gap-1 border-b border-stone-200 -mt-2 -mx-2 px-2 pb-2">
          {Object.entries(TAB).map(([k, label]) => {
            const on = tab === k;
            const cnt = byStatus[k].length;
            return (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${on ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}`}>
                {label} <span className={`text-[10px] ml-1 rounded-full px-1.5 py-0.5 ${on ? 'bg-white' : 'bg-stone-100'}`}>{cnt}</span>
              </button>
            );
          })}
        </div>

        {byStatus[tab].length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            {tab === 'queued' && (
              <>
                佇列是空的 · <Link href={`/social/produce?topic=${topic.id}`} className="text-fuchsia-700 underline">去產文</Link>
              </>
            )}
            {tab === 'published' && '還沒有已發的文章'}
            {tab === 'failed' && '沒有失敗的文章 ✨'}
          </div>
        )}

        {byStatus[tab].map((post) => (
          <FullPostCard key={post.id} post={post} products={products}
            settings={settings}
            onZoom={(url) => setLightbox(url)}
            onDelete={() => deletePost(post.id)}
            onRetry={tab === 'failed' ? () => retryPost(post) : null}
            onPublishNow={tab === 'queued' ? () => publishNow(post) : null}
            onToggleLink={(checked) => toggleIncludeLink(post, checked)}
            onSaveToAssets={async () => {
              if (!post.imageUrl) return;
              const r = await fetch('/api/infuz/topic_posts/save-to-assets', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ postId: post.id }),
              });
              const d = await r.json();
              if (!r.ok) return alert('失敗:' + d.error);
              alert(d.alreadyExists ? '這張圖已在素材庫' : `✓ 已存到素材庫 (${d.assetId})`);
            }}
            publishing={publishingId === post.id}
          />
        ))}
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">⚠ {error}</div>}

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </main>
  );
}

function FullPostCard({ post, products, settings, onZoom, onDelete, onRetry, onPublishNow, onToggleLink, onSaveToAssets, publishing }) {
  const picked = post.pickedProductId ? products.find((p) => p.id === post.pickedProductId) : null;
  const hasLink = picked?.purchase_url;
  const utm = settings?.utm;
  // 用 helper 拼接完整發文預覽 (含 hashtags + 連結)
  const previewText = buildTextWithLink({
    post: { ...post, pickedProductId: post.pickedProductId },
    productsDb: { items: products },
    utmCfg: utm,
  });

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {post.imageUrl && (
          <button onClick={() => onZoom(post.imageUrl)} className="shrink-0 group relative">
            <img src={post.imageUrl} alt="" className="size-32 rounded object-cover border" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded transition flex items-center justify-center text-white opacity-0 group-hover:opacity-100 text-xs">
              🔍 放大
            </div>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
            {post.status === 'queued' && <>📥 待發 · 建於 {new Date(post.createdAt).toLocaleString('zh-TW')}</>}
            {post.status === 'published' && <>✓ 已發於 {new Date(post.publishedAt).toLocaleString('zh-TW')}</>}
            {post.status === 'failed' && <>✗ 發文失敗</>}
            {picked && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                🛒 {picked.name.slice(0, 15)}
              </span>
            )}
          </div>

          {/* 完整發文預覽 (含 hashtags + 帶連結時的 URL) */}
          <pre className="mt-2 whitespace-pre-wrap text-sm text-stone-900 font-sans leading-relaxed">{previewText}</pre>

          {/* 參考產品照 (可點放大, 對比生成圖) */}
          {picked?.image_front && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
              <button onClick={() => onZoom(picked.image_front)} className="shrink-0 group relative">
                <img src={picked.image_front} alt="" className="size-16 rounded object-cover border" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded transition flex items-center justify-center text-white opacity-0 group-hover:opacity-100 text-[10px]">
                  🔍
                </div>
              </button>
              <div className="flex-1 min-w-0 text-[11px] text-stone-600">
                <div className="text-stone-500 text-[10px]">📸 產品參考照 (KIE 生圖 reference)</div>
                <div className="text-stone-900 font-medium truncate">{picked.name}</div>
                {picked.purchase_url && (
                  <a href={picked.purchase_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline break-all">{picked.purchase_url}</a>
                )}
              </div>
            </div>
          )}

          {/* 帶購買連結 toggle - 只有 queued + 有 pickedProduct + product 有 purchase_url 才顯示 */}
          {post.status === 'queued' && hasLink && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 space-y-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!post.includePurchaseUrl}
                  onChange={(e) => onToggleLink(e.target.checked)}
                  className="size-4 rounded border-stone-300" />
                <span className="font-medium text-emerald-800">🔗 發文時附上購買連結 (含 UTM)</span>
              </label>
              {!utm && (
                <div className="text-[10px] text-amber-700">
                  💡 <Link href="/settings" className="underline">設定 UTM 參數</Link> 追蹤來源
                </div>
              )}
            </div>
          )}

          {post.status === 'published' && post.results && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(post.results).map(([k, r]) => {
                if (!r?.ok) return null;
                const el = (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                    k === 'threads' ? 'bg-black text-white' :
                    k === 'instagram' ? 'bg-pink-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>
                    {k === 'threads' ? '🧵 Threads' : k === 'instagram' ? '📷 IG' : '👍 FB'} ✓
                  </span>
                );
                return r.permalink ? (
                  <a key={k} href={r.permalink} target="_blank" rel="noreferrer" className="hover:opacity-80" title="開原文">{el}</a>
                ) : (
                  <span key={k}>{el}</span>
                );
              })}
            </div>
          )}

          {post.status === 'failed' && post.error && (
            <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">⚠ {post.error}</div>
          )}

          {post.imagePrompt && (
            <details className="mt-2">
              <summary className="text-[10px] text-stone-500 cursor-pointer hover:text-purple-700">🎨 image prompt</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[10px] text-stone-600 font-mono bg-stone-50 p-2 rounded">{post.imagePrompt}</pre>
            </details>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {onPublishNow && (
            <button onClick={onPublishNow} disabled={publishing}
              className="rounded-md bg-fuchsia-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-fuchsia-700 disabled:opacity-50 whitespace-nowrap font-medium">
              {publishing ? '⏳ 發送…' : '🚀 立即發文'}
            </button>
          )}
          {onRetry && (
            <button onClick={onRetry} className="text-[11px] text-blue-700 hover:underline">🔄 重試</button>
          )}
          {post.imageUrl && onSaveToAssets && (
            <button onClick={onSaveToAssets}
              className="rounded-md border border-amber-300 text-amber-700 px-2.5 py-1 text-[11px] hover:bg-amber-50 whitespace-nowrap">
              💾 存素材庫
            </button>
          )}
          <button onClick={onDelete} className="text-[11px] text-red-600 hover:underline">🗑️ 刪除</button>
        </div>
      </div>
    </div>
  );
}

// UI 預覽 UTM URL (跟後端 withUtm 邏輯一致, threads 平台為預覽)
function withUtmPreview(url, utmCfg, platformId = 'threads') {
  if (!utmCfg || !url) return url;
  try {
    const u = new URL(url);
    const source = (utmCfg.source || {})[platformId] || platformId || 'social';
    if (source) u.searchParams.set('utm_source', source);
    if (utmCfg.medium) u.searchParams.set('utm_medium', utmCfg.medium);
    if (utmCfg.campaign) u.searchParams.set('utm_campaign', utmCfg.campaign);
    return u.toString();
  } catch { return url; }
}
