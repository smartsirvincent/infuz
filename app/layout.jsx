import './globals.css';

export const metadata = {
  title: 'Infuz — 服飾 · 珠寶內容系統',
  description: 'Infuz 品牌內容管理系統 · 主題發想 · 產文 · 排程 · 成效追蹤',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Montserrat:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bone text-ink antialiased font-sans">
        <header className="sticky top-0 z-30 border-b border-divider bg-bone/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" className="group flex items-baseline gap-2.5 hover:opacity-90 transition motion-reduce:transition-none">
              <span className="font-display text-2xl font-medium text-ink tracking-tight leading-none">Infuz</span>
              <span className="hidden text-[10px] font-mono uppercase tracking-[0.15em] text-muted sm:inline">Content OS</span>
            </a>
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              <NavLink href="/products" label="產品" />
              <NavLink href="/models" label="模特" />
              <NavLink href="/scenarios" label="情境" />
              <NavLink href="/material" label="素材" />
              <NavLink href="/assets" label="素材庫" />
              <NavLink href="/social" label="社群發文" primary />
              <NavLink href="/settings" label="設定" />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
          {children}
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label, primary }) {
  const cls = primary
    ? 'text-ink font-medium underline underline-offset-[6px] decoration-gold decoration-2'
    : 'text-muted hover:text-ink';
  return (
    <a
      href={href}
      className={`text-sm transition duration-200 motion-reduce:transition-none ${cls}`}
    >
      {label}
    </a>
  );
}
