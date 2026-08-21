import Link from 'next/link';
import { HubTile, PageHeader } from './_components.jsx';

// Editorial hub · serial 編號 + 大字, 排程/發想主, 產文/成效/氣候次
// 拒絕 three-equal-column feature cards (taste-skill 明文禁)
export default function SocialHub() {
  return (
    <main className="space-y-10 pb-12 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Content Ops"
        title="社群發文"
        description="從主題發想到排程發文的完整工作流。品牌設定在素材,產品清單在產品頁,發文帳號在系統設定。"
      />

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

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">System flow</div>
        <ol className="text-sm text-zinc-700 leading-relaxed space-y-1.5 list-none">
          <li><span className="font-mono text-zinc-400 mr-2">01</span>主題發想 · 加入清單</li>
          <li><span className="font-mono text-zinc-400 mr-2">02</span>主題產文 (N 篇) · 存入佇列</li>
          <li><span className="font-mono text-zinc-400 mr-2">03</span>排程時間到 · cron tick 從佇列取一篇發</li>
          <li><span className="font-mono text-zinc-400 mr-2">04</span>成效紀錄 · 分平台 / 主題查看</li>
        </ol>
        <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 space-y-1">
          <div>沒連接 Threads / FB? 去 <Link className="text-zinc-900 underline underline-offset-2" href="/settings">系統設定</Link> 底下「多平台直發帳號」連接</div>
          <div>Cron 由 cron-job.org 定期打 <code className="bg-zinc-100 px-1 py-0.5 rounded text-[10px] font-mono">/api/infuz/cron/tick</code></div>
        </div>
      </section>
    </main>
  );
}
