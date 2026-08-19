import Link from 'next/link';

// 五大入口: 排程管理 / 主題發想 / 主題產文 / 發文成效 / 氣候即時
// 舊的四張快發卡 (text-post/image-post/link-post/publish) 檔案保留但不從 hub 出現
export default function SocialHub() {
  return (
    <main className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">📤 社群發文</h1>
        <p className="mt-2 text-sm text-stone-600">
          完整內容管理系統 · 從主題發想 → 產文 → 排程 → 成效追蹤 · 品牌設定在 <Link href="/material" className="text-emerald-700 underline">素材</Link>、產品在 <Link href="/products" className="text-emerald-700 underline">產品</Link>
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          href="/social/schedule"
          icon="📅"
          color="blue"
          title="排程管理"
          hint="主題清單 + 排程時間/星期/平台"
          desc="所有主題一目瞭然 · 展開看待發佇列 · 直接編輯排程"
        />
        <HubCard
          href="/social/topics/discover"
          icon="💡"
          color="purple"
          title="主題發想"
          hint="AI 建議 10 個主題 → 勾選加入"
          desc="描述方向 + 選要帶哪些產品 · Claude 幫你發想連貫的主題系列"
        />
        <HubCard
          href="/social/produce"
          icon="✨"
          color="fuchsia"
          title="主題產文"
          hint="選主題 + 篇數 → 產文 + 生圖"
          desc="AI 依主題設定產出多篇 · 逐篇編輯 · 圖可放大/重生 · 存入佇列"
        />
        <HubCard
          href="/social/insights"
          icon="📊"
          color="amber"
          title="發文成效"
          hint="Threads / IG / FB 分開看"
          desc="依主題/平台/日期篩選 · 點連結到原文 · 深指標之後補"
        />
        <HubCard
          href="/social/weather-post"
          icon="☀️"
          color="sky"
          title="氣候即時預約"
          hint="CWA 氣象 → 到點條件觸發"
          desc="降雨/氣溫達標才發 · 多縣市 · 獨立於主題系統(即時 vs 佇列)"
        />
      </section>

      <div className="card border-stone-100 bg-stone-50 text-xs text-stone-600 space-y-1">
        <div>💡 <strong>系統流程</strong>: 主題發想 → 加入清單 → 產文(N 篇) → 存入佇列 → 排程時間到 tick 從佇列取一篇發 → 成效紀錄</div>
        <div>💡 <strong>還沒連接 Threads / FB 帳號?</strong> 去 <Link className="text-emerald-700 underline" href="/settings">⚙️ 系統設定</Link> 底下「多平台直發帳號」連接</div>
        <div>💡 <strong>Cron 觸發</strong>: 由 cron-job.org 每 N 分鐘打 <code>/api/infuz/cron/tick</code> · 同時處理主題排程 + 氣候即時</div>
      </div>
    </main>
  );
}

const COLOR_MAP = {
  blue: 'hover:border-blue-300 group-hover:text-blue-700 bg-blue-100',
  purple: 'hover:border-purple-300 group-hover:text-purple-700 bg-purple-100',
  fuchsia: 'hover:border-fuchsia-300 group-hover:text-fuchsia-700 bg-fuchsia-100',
  amber: 'hover:border-amber-300 group-hover:text-amber-700 bg-amber-100',
  sky: 'hover:border-sky-300 group-hover:text-sky-700 bg-sky-100',
};

function HubCard({ href, icon, color, title, hint, desc }) {
  const cls = COLOR_MAP[color] || COLOR_MAP.blue;
  const [borderCls, textCls, bgCls] = cls.split(' ');
  return (
    <Link href={href} className={`group card hover:-translate-y-0.5 ${borderCls} hover:shadow-lg transition`}>
      <div className="flex items-start gap-3">
        <div className={`flex size-12 items-center justify-center rounded-xl text-2xl ${bgCls}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-base font-semibold text-stone-900 ${textCls}`}>{title}</h2>
          <p className="mt-1 text-[11px] text-stone-600">{hint}</p>
          <p className="mt-2 text-[11px] text-stone-500">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
