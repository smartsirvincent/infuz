import Link from 'next/link';

export default function MaterialChooser() {
  return (
    <main className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">✨ 素材產生</h1>
        <p className="mt-2 text-sm text-stone-600">
          從產品 / 模特 / 情境資料庫挑出來,AI 合成 <strong>1:1 一張視覺</strong>。生成後自動入<Link href="/assets" className="text-emerald-700 underline">素材庫</Link>。
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/material/single"
          className="group card hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">👕</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-emerald-700">單件</h2>
              <p className="mt-1 text-[11px] text-stone-600">1 件 + 1 模特 + 1 情境</p>
              <p className="mt-2 text-[11px] text-stone-500">單品介紹 / 新品上架</p>
            </div>
          </div>
        </Link>

        <Link
          href="/material/combo"
          className="group card hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">👯</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-purple-700">搭配</h2>
              <p className="mt-1 text-[11px] text-stone-600">上衣 + 下身 + 模特 + 情境</p>
              <p className="mt-2 text-[11px] text-stone-500">OOTD / 整套穿搭</p>
            </div>
          </div>
        </Link>

        <Link
          href="/material/composition"
          className="group card hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg transition"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-2xl">🎨</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 group-hover:text-orange-700">組合</h2>
              <p className="mt-1 text-[11px] text-stone-600">多件 (2-6 件) — 純陳列 / 搭配模特</p>
              <p className="mt-2 text-[11px] text-stone-500">系列圖 / lookbook / flat lay</p>
            </div>
          </div>
        </Link>
      </section>

      <div className="card border-stone-100 bg-stone-50 text-xs text-stone-600">
        💡 找不到想用的產品 / 模特 / 情境? 先去 <Link className="text-emerald-700 underline" href="/products">產品資料庫</Link> / <Link className="text-emerald-700 underline" href="/models">模特</Link> / <Link className="text-emerald-700 underline" href="/scenarios">情境</Link> 新增,再回來生圖。
      </div>
    </main>
  );
}
