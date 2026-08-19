import Link from 'next/link';

export default function SocialHub() {
  return (
    <main className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">📤 社群發文</h1>
        <p className="mt-2 text-sm text-stone-600">
          單篇即時發文到 Threads / IG / FB 粉專。品牌設定與月度規劃在<Link href="/material" className="text-emerald-700 underline">素材</Link>那邊處理。
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/social/text-post"
          className="group card hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 text-2xl">📝</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-brand-700">文字貼文</h2>
              <p className="mt-1 text-[11px] text-stone-600">純文字 → 直發</p>
              <p className="mt-2 text-[11px] text-stone-500">
                可 AI 建議穿搭 / 觀點文,不需帶產品
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/social/image-post"
          className="group card hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">🖼️</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-purple-700">圖片貼文</h2>
              <p className="mt-1 text-[11px] text-stone-600">從素材庫挑 / 上傳 → 直發</p>
              <p className="mt-2 text-[11px] text-stone-500">
                圖 + AI 產文 → Threads / IG / FB
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/social/link-post"
          className="group card hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">🔗</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-emerald-700">連結貼文</h2>
              <p className="mt-1 text-[11px] text-stone-600">選產品 + 自動加 UTM</p>
              <p className="mt-2 text-[11px] text-stone-500">
                導購型 · UTM 參數在系統設定設
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/social/weather-post"
          className="group card hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">☀️</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-sky-700">氣候即時預約</h2>
              <p className="mt-1 text-[11px] text-stone-600">CWA 氣象 → 到點自動發</p>
              <p className="mt-2 text-[11px] text-stone-500">
                每日/週幾 · 條件觸發(雨/熱/冷)
              </p>
            </div>
          </div>
        </Link>
      </section>

      <div className="card border-stone-100 bg-stone-50 text-xs text-stone-600 space-y-1">
        <div>💡 <strong>發完的貼文</strong>: 自動記錄到 <Link className="text-emerald-700 underline" href="/assets">🗂 素材庫</Link> 對應素材的 dispatched 欄</div>
        <div>💡 <strong>還沒連接 Threads / FB 帳號?</strong> 去 <Link className="text-emerald-700 underline" href="/settings">⚙️ 系統設定</Link> 底下「多平台直發帳號」連接</div>
        <div>💡 <strong>要做整月批次規劃?</strong> 去 <Link className="text-emerald-700 underline" href="/text">📝 文字月度規劃</Link> 或 <Link className="text-emerald-700 underline" href="/image-plan">🖼️ 圖片月度規劃</Link></div>
      </div>
    </main>
  );
}
