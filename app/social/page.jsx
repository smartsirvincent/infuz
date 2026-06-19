import Link from 'next/link';

export default function SocialHub() {
  return (
    <main className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">📤 社群發文</h1>
        <p className="mt-2 text-sm text-stone-600">
          文字貼文規劃 / 圖片貼文規劃 / Webhook 發文設定 — 三項合在一起管。
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/text"
          className="group card hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 text-2xl">📝</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-brand-700">文字貼文</h2>
              <p className="mt-1 text-[11px] text-stone-600">整月文字文案批次生成</p>
              <p className="mt-2 text-[11px] text-stone-500">
                Infuz 22 SKU 全自動載入 · 也可切「純品牌」模式
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/image-plan"
          className="group card hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">🖼️</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-purple-700">圖片貼文</h2>
              <p className="mt-1 text-[11px] text-stone-600">整月含 AI 圖批次規劃</p>
              <p className="mt-2 text-[11px] text-stone-500">
                AI 主題推薦 + 並行生圖 + xlsx 輸出
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/settings"
          className="group card hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-stone-200 text-2xl">⚙️</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-stone-700">系統設定</h2>
              <p className="mt-1 text-[11px] text-stone-600">Webhook + Google Sheet</p>
              <p className="mt-2 text-[11px] text-stone-500">
                排程 webhook / 發文 webhook / 預設平台
              </p>
            </div>
          </div>
        </Link>
      </section>

      <div className="card border-stone-100 bg-stone-50 text-xs text-stone-600">
        💡 生圖在這之前 — 去 <Link className="text-emerald-700 underline" href="/material">✨ 素材產生</Link> 做 1:1 視覺,完成的圖會自動進 <Link className="text-emerald-700 underline" href="/assets">🗂 素材庫</Link>,在那裡可一鍵發到排程或直接發文。
      </div>
    </main>
  );
}
