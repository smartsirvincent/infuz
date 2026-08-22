'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HubTile, PageHeader } from './_components.jsx';
import { BRAND_HERO, BRAND_DIVIDER } from './_brand-assets.js';

// Product-forward hub · Hero band + 5 卡 + Latest work grid (真產品照從 assets DB 抓)
export default function SocialHub() {
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  useEffect(() => {
    fetch('/api/infuz/assets', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const withImage = (d.items || [])
          .filter((a) => a.imageUrl)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAssets(withImage);
      })
      .catch(() => {})
      .finally(() => setLoadingAssets(false));
  }, []);

  const latest = assets.slice(0, 8);

  return (
    <main className="space-y-12 pb-16 max-w-6xl mx-auto">
      {/* Hero band · Brand atmosphere */}
      {BRAND_HERO ? (
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100 aspect-[21/9] sm:aspect-[24/9]">
          <img src={BRAND_HERO} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 sm:p-10">
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-3">Content Ops · 內容作業系統</div>
            <h1 className="font-editorial text-3xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.1] max-w-2xl">
              社群發文
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              從主題發想到排程發文的完整工作流。品牌設定在素材,產品在產品頁,發文帳號在系統設定。
            </p>
          </div>
        </section>
      ) : (
        <PageHeader eyebrow="Content Ops" title="社群發文" description="完整內容工作流" />
      )}

      {/* Latest work · 真產品/模特圖 gallery */}
      {(loadingAssets || latest.length > 0) && (
        <section>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Latest work</div>
              <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-zinc-950 tracking-tight mt-0.5">最新產出</h2>
            </div>
            <Link href="/assets" className="text-xs text-zinc-500 hover:text-zinc-950 transition motion-reduce:transition-none">
              前往素材庫 →
            </Link>
          </div>
          {loadingAssets ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0,1,2,3,4,5,6,7].map((i) => (
                <div key={i} className="skeleton aspect-[4/5] rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {latest.map((a) => (
                <AssetTile key={a.id} asset={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Divider band */}
      {BRAND_DIVIDER && (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 aspect-[21/3] bg-zinc-100">
          <img src={BRAND_DIVIDER} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Hub tiles · Asymmetric bento */}
      <section>
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Modules</div>
          <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-zinc-950 tracking-tight mt-0.5">五個入口</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <HubTile href="/social/schedule" index="01" size="lg" className="lg:col-span-3 lg:row-span-2"
            title="排程管理"
            hint="所有主題清單 + 週歷儀表板 + 排程時間與平台。點卡片進入看待發佇列與已發歷史,或直接在 card 上編輯時間。" />
          <HubTile href="/social/topics/discover" index="02" size="lg" className="lg:col-span-3"
            title="主題發想"
            hint="描述方向 · AI 建議主題卡片 · 勾選加入清單。系統自動避開已有主題,每次可指定產出數量。" />
          <HubTile href="/social/produce" index="03" className="lg:col-span-2"
            title="主題產文"
            hint="選主題與篇數,AI 產文,逐篇編輯後入佇列。" />
          <HubTile href="/social/insights" index="04" className="lg:col-span-2"
            title="發文成效"
            hint="Threads / Instagram / Facebook 分開查看,依主題與日期篩選。" />
          <HubTile href="/social/weather-post" index="05" className="lg:col-span-2"
            title="氣候即時預約"
            hint="接中央氣象署即時預報,條件觸發(下雨 / 寒流 / 酷熱)自動發。" />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">System flow</div>
          <ol className="text-sm text-zinc-700 leading-loose space-y-1 list-none">
            <li className="flex gap-3"><span className="font-mono text-zinc-400 tabular-nums shrink-0">01</span><span>主題發想 · 加入清單</span></li>
            <li className="flex gap-3"><span className="font-mono text-zinc-400 tabular-nums shrink-0">02</span><span>主題產文 · 存入佇列</span></li>
            <li className="flex gap-3"><span className="font-mono text-zinc-400 tabular-nums shrink-0">03</span><span>排程時間到 · cron 從佇列取一篇發</span></li>
            <li className="flex gap-3"><span className="font-mono text-zinc-400 tabular-nums shrink-0">04</span><span>成效紀錄 · 分平台 / 主題查看</span></li>
          </ol>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">Quick links</div>
          <div className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">未接 Threads / FB</span>
              <Link href="/settings" className="text-zinc-950 hover:underline underline-offset-2">系統設定 →</Link>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">產品清單</span>
              <Link href="/products" className="text-zinc-950 hover:underline underline-offset-2">產品資料庫 →</Link>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-500">Cron 觸發</span>
              <code className="text-[10px] font-mono text-zinc-700 bg-zinc-100 rounded px-1.5 py-0.5">/api/infuz/cron/tick</code>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AssetTile({ asset }) {
  const productName = asset.products?.[0]?.name || '';
  const scenarioName = asset.scenarioName || '';
  return (
    <Link
      href="/assets"
      className="group relative block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 aspect-[4/5] transition motion-reduce:transition-none hover:border-zinc-900"
      title={productName || scenarioName}
    >
      <img
        src={asset.imageUrl}
        alt={productName || ''}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />
      {(productName || scenarioName) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 opacity-0 group-hover:opacity-100 transition motion-reduce:transition-none">
          {productName && (
            <div className="text-[11px] font-medium text-white truncate leading-tight">{productName}</div>
          )}
          {scenarioName && (
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/70 mt-0.5">{scenarioName}</div>
          )}
        </div>
      )}
    </Link>
  );
}
