import Link from 'next/link';
import { HubTile, PageHeader } from './_components.jsx';
import { BRAND_HERO, BRAND_DIVIDER } from './_brand-assets.js';

// Editorial hub · serial 編號 + 大字, 排程/發想主, 產文/成效/氣候次
// 拒絕 three-equal-column feature cards (taste-skill 明文禁)
export default function SocialHub() {
  return (
    <main className="space-y-10 pb-12 max-w-6xl mx-auto">
      {/* Hero band · Brand atmosphere image + 大字 title */}
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
        <PageHeader
          eyebrow="Content Ops"
          title="社群發文"
          description="從主題發想到排程發文的完整工作流。品牌設定在素材,產品清單在產品頁,發文帳號在系統設定。"
        />
      )}

      {/* Asymmetric bento · 排程/發想為大卡, 其餘三個為次 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
      </section>

      {/* 品牌氛圍 divider band */}
      {BRAND_DIVIDER && (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 aspect-[21/3] bg-zinc-100">
          <img src={BRAND_DIVIDER} alt="" className="w-full h-full object-cover" />
        </div>
      )}

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
