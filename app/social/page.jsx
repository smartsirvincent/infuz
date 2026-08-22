'use client';

// Dashboard-first hub · Cormorant display + Montserrat body + gold accent
// ui-ux-pro-max design system: fashion/jewelry palette (Premium black + gold)
// 拒絕 templated tells: 移除 01-05 numbering (5 個 module 是平行不是 sequence)
// Signature: 每個 module tile 帶 live metric, dashboard 即狀態板

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SocialHub() {
  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [realtimeJobs, setRealtimeJobs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/infuz/topics', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/infuz/topic_posts', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/infuz/realtime', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/infuz/assets', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([t, p, rt, a]) => {
      setTopics(t.items || []);
      setPosts(p.items || []);
      setRealtimeJobs(rt.items || []);
      const withImage = (a.items || []).filter((x) => x.imageUrl).sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
      setAssets(withImage);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeTopics = topics.filter((t) => t.schedule?.enabled).length;
  const queued = posts.filter((p) => p.status === 'queued').length;
  const published = posts.filter((p) => p.status === 'published').length;
  const failed = posts.filter((p) => p.status === 'failed').length;
  const activeWeather = realtimeJobs.filter((j) => j.enabled).length;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const publishedThisWeek = posts.filter((p) => p.status === 'published' && (p.publishedAt || '') >= weekAgo).length;

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];

  return (
    <main className="space-y-14 pb-16 max-w-6xl mx-auto text-ink">
      {/* Header · dashboard-first, no marketing hero */}
      <header className="pt-2 pb-6 border-b border-divider">
        <div className="flex items-baseline justify-between gap-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted mb-3">/ social · content ops</div>
            <h1 className="font-display text-4xl sm:text-5xl font-medium text-ink tracking-tight leading-none">
              今天要發什麼
            </h1>
          </div>
          <time className="text-xs font-mono tabular-nums text-muted whitespace-nowrap">
            {dateStr} <span className="text-divider mx-1">·</span> {dow}
          </time>
        </div>

        {/* Live status strip · signature: 6 個真 metric */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-6">
          <Metric label="Topics" value={activeTopics} sub="active" loading={loading} />
          <Metric label="Queue" value={queued} sub="待發" loading={loading} accent={queued > 0} />
          <Metric label="This week" value={publishedThisWeek} sub="published" loading={loading} />
          <Metric label="Total sent" value={published} sub="all-time" loading={loading} />
          <Metric label="Weather" value={activeWeather} sub="triggers" loading={loading} />
          <Metric label="Assets" value={assets.length} sub="in library" loading={loading} />
        </div>
      </header>

      {/* Modules · 平行 5 個入口, 帶 live metric */}
      <section>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted mb-5">Modules</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <ModuleCard href="/social/schedule" size="lg" className="md:col-span-4"
            title="排程管理"
            desc="所有主題清單與週歷儀表板。點卡片進入看待發佇列,或直接在 card 上編輯時間、切換排程開關。"
            metrics={[
              { label: 'topics', value: topics.length },
              { label: 'active', value: activeTopics },
              { label: 'queued', value: queued },
              { label: 'failed', value: failed, muted: failed === 0 },
            ]}
          />
          <ModuleCard href="/social/produce" className="md:col-span-2"
            title="主題產文"
            desc="選主題與篇數,AI 產出 draft"
            metrics={[{ label: 'topics ready', value: topics.length }]}
          />
          <ModuleCard href="/social/topics/discover" className="md:col-span-2"
            title="主題發想"
            desc="描述方向, AI 建議主題卡片"
            metrics={[{ label: 'existing', value: topics.length }]}
          />
          <ModuleCard href="/social/insights" className="md:col-span-2"
            title="發文成效"
            desc="分平台 / 主題 / 日期查看"
            metrics={[{ label: 'sent', value: published }]}
          />
          <ModuleCard href="/social/weather-post" className="md:col-span-2"
            title="氣候即時預約"
            desc="CWA 預報條件觸發"
            metrics={[{ label: 'active jobs', value: activeWeather }]}
          />
        </div>
      </section>

      {/* Latest work · 真產品照 gallery */}
      {(loading || assets.length > 0) && (
        <section>
          <div className="flex items-baseline justify-between gap-4 border-b border-divider pb-3 mb-5">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted">Latest work</div>
              <h2 className="font-display text-2xl font-medium mt-1 tracking-tight">最新產出</h2>
            </div>
            <Link href="/assets" className="text-xs text-muted hover:text-ink transition motion-reduce:transition-none">
              素材庫 <span className="ml-1">→</span>
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0,1,2,3,4,5,6,7].map((i) => <div key={i} className="skeleton aspect-[4/5] rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {assets.slice(0, 8).map((a) => <AssetTile key={a.id} asset={a} />)}
            </div>
          )}
        </section>
      )}

      {/* Footer info · plain */}
      <footer className="pt-6 border-t border-divider text-xs text-muted grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          未連 Threads / FB · <Link href="/settings" className="text-ink hover:underline underline-offset-4 decoration-gold">系統設定 →</Link>
        </div>
        <div>
          產品清單 · <Link href="/products" className="text-ink hover:underline underline-offset-4 decoration-gold">產品資料庫 →</Link>
        </div>
        <div>
          Cron 觸發 · <code className="text-[10px] font-mono text-muted bg-linen rounded px-1.5 py-0.5">/api/infuz/cron/tick</code>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value, sub, loading, accent }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted">{label}</div>
      {loading ? (
        <div className="h-9 w-16 skeleton rounded" />
      ) : (
        <div className={`font-display text-4xl leading-none tabular-nums tracking-tight ${accent ? 'text-gold' : 'text-ink'}`}>
          {value}
        </div>
      )}
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function ModuleCard({ href, title, desc, metrics = [], size = 'sm', className = '' }) {
  const isLg = size === 'lg';
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-lg border border-divider bg-white p-5 sm:p-6 hover:border-ink transition duration-200 motion-reduce:transition-none min-h-[160px] ${className}`}
    >
      <div>
        <h2 className={`font-display font-medium text-ink tracking-tight leading-tight ${isLg ? 'text-3xl' : 'text-xl'}`}>
          {title}
        </h2>
        {desc && (
          <p className={`text-muted leading-relaxed mt-2 ${isLg ? 'text-sm max-w-md' : 'text-xs'}`}>{desc}</p>
        )}
      </div>
      {metrics.length > 0 && (
        <div className={`mt-6 flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t border-divider ${isLg ? '' : 'gap-x-4'}`}>
          {metrics.map((m, i) => (
            <div key={i}>
              <div className={`font-display tabular-nums tracking-tight leading-none ${isLg ? 'text-2xl' : 'text-xl'} ${m.muted ? 'text-muted' : 'text-ink'}`}>
                {m.value}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function AssetTile({ asset }) {
  const productName = asset.products?.[0]?.name || '';
  const scenarioName = asset.scenarioName || '';
  return (
    <Link
      href="/assets"
      className="group relative block overflow-hidden rounded-lg border border-divider bg-linen aspect-[4/5] transition motion-reduce:transition-none hover:border-ink"
      title={productName || scenarioName}
    >
      <img
        src={asset.imageUrl}
        alt={productName || ''}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />
      {(productName || scenarioName) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3 opacity-0 group-hover:opacity-100 transition duration-300 motion-reduce:transition-none">
          {productName && (
            <div className="text-[11px] font-medium text-white truncate leading-tight">{productName}</div>
          )}
          {scenarioName && (
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/70 mt-1">{scenarioName}</div>
          )}
        </div>
      )}
    </Link>
  );
}
