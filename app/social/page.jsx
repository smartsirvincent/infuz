import Link from 'next/link';
import { HubTile, PageHeader } from './_components.jsx';

// Asymmetric bento (依 taste-skill 避開 three-equal-column feature cards)
// 排程/發想為主要工作區(col-span-3), 產文/成效/氣候為次(col-span-2)
export default function SocialHub() {
  return (
    <main className="space-y-6 pb-8">
      <PageHeader
        icon="📤"
        title="社群發文"
        description="完整內容管理系統 · 從主題發想 到 產文 到 排程 到 成效追蹤。品牌設定在 素材,產品在 產品清單。"
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-fr">
        <HubTile href="/social/schedule" icon="📅" tone="blue" className="lg:col-span-3"
          title="排程管理"
          hint="主題清單 + 週歷 + 時間 / 星期 / 平台 · 點卡片看待發佇列與已發歷史" />
        <HubTile href="/social/topics/discover" icon="💡" tone="purple" className="lg:col-span-3"
          title="主題發想"
          hint="描述方向 · AI 建議 N 個主題 · 一鍵加入清單 (自動避開已有)" />
        <HubTile href="/social/produce" icon="✨" tone="fuchsia" className="lg:col-span-2"
          title="主題產文"
          hint="選主題 + 篇數 · AI 產文 · 逐篇編輯 · 存入佇列" />
        <HubTile href="/social/insights" icon="📊" tone="amber" className="lg:col-span-2"
          title="發文成效"
          hint="Threads / IG / FB 分開看 · 依主題 / 日期篩" />
        <HubTile href="/social/weather-post" icon="☀️" tone="sky" className="lg:col-span-2"
          title="氣候即時預約"
          hint="CWA 氣象即時預報 · 條件觸發 (下雨 / 寒流 / 酷熱)" />
      </section>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600 space-y-1.5">
        <div className="flex gap-2"><span>🔄</span><div><strong>系統流程</strong>:主題發想 · 加入清單 · 產文 (N 篇) · 存入佇列 · 排程時間到 tick 從佇列取一篇發 · 成效紀錄</div></div>
        <div className="flex gap-2"><span>🔌</span><div><strong>還沒連接 Threads / FB?</strong> 去 <Link className="text-emerald-700 underline hover:text-emerald-800" href="/settings">系統設定</Link> 底下「多平台直發帳號」連接</div></div>
        <div className="flex gap-2"><span>⏰</span><div><strong>Cron 觸發</strong>:由 cron-job.org 每 N 分鐘打 <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">/api/infuz/cron/tick</code> · 同時處理主題排程 + 氣候即時</div></div>
      </div>
    </main>
  );
}
