// 社群發文 5 頁共用 UI 元件 — Linear/Vercel Dashboard 風
// 中性色為主 · 精緻陰影 · 明確層級 · subtle hover
'use client';

import Link from 'next/link';

// ============================================================
// PageHeader — 每頁頂部
// breadcrumbs = [{href, label}, ...]
// actions = <div>...</div> 右邊按鈕組
// ============================================================
export function PageHeader({ icon, title, description, breadcrumbs, actions, tone = 'neutral' }) {
  const toneMap = {
    neutral: 'bg-white border-stone-200',
    blue: 'bg-gradient-to-br from-blue-50 to-white border-blue-100',
    purple: 'bg-gradient-to-br from-purple-50 to-white border-purple-100',
    fuchsia: 'bg-gradient-to-br from-fuchsia-50 to-white border-fuchsia-100',
    amber: 'bg-gradient-to-br from-amber-50 to-white border-amber-100',
    sky: 'bg-gradient-to-br from-sky-50 to-white border-sky-100',
    emerald: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100',
  };
  return (
    <div className={`rounded-2xl border ${toneMap[tone]} p-5 sm:p-6`}>
      {breadcrumbs?.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-stone-500 mb-3">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? (
                <Link href={b.href} className="hover:text-stone-800 transition">{b.label}</Link>
              ) : (
                <span className="text-stone-800 font-medium">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <span className="text-stone-300">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-2xl leading-none">{icon}</span>}
            <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">{title}</h1>
          </div>
          {description && (
            <p className="mt-1.5 text-sm text-stone-600 leading-relaxed max-w-3xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

// ============================================================
// StatCard — Header 下方一排統計
// ============================================================
export function StatCard({ label, value, sub, tone = 'neutral', icon }) {
  const valueColor = {
    neutral: 'text-stone-900',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    purple: 'text-purple-700',
  }[tone];
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</div>
        {icon && <span className="text-base opacity-60">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl sm:text-3xl font-semibold tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}

// ============================================================
// EmptyState — 空狀態,大 emoji + heading + CTA
// ============================================================
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 py-12 sm:py-16 px-6 text-center space-y-3">
      <div className="text-5xl leading-none">{icon}</div>
      <div className="text-base font-semibold text-stone-800">{title}</div>
      {description && <div className="text-sm text-stone-500 max-w-md mx-auto">{description}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

// ============================================================
// SectionCard — 內容分區
// ============================================================
export function SectionCard({ title, description, actions, children, className = '', padding = 'default' }) {
  const p = { default: 'p-4 sm:p-5', tight: 'p-3', lg: 'p-6' }[padding];
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white ${p} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-stone-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ============================================================
// Chip — 標籤/徽章
// ============================================================
export function Chip({ children, tone = 'neutral', size = 'sm', className = '' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700 border-stone-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    dark: 'bg-stone-900 text-white border-stone-900',
  };
  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium ${tones[tone]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}

// ============================================================
// TabBar — 主題 detail 頁 tabs
// ============================================================
export function TabBar({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-stone-200 -mx-px px-px pb-0 mb-4">
      {tabs.map((t) => {
        const on = value === t.value;
        return (
          <button key={t.value} onClick={() => onChange(t.value)}
            className={`relative px-3 py-2 text-sm font-medium transition ${
              on ? 'text-stone-900' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {typeof t.count === 'number' && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${on ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                  {t.count}
                </span>
              )}
            </span>
            {on && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-stone-900 rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Button — 統一按鈕
// ============================================================
export function Button({ children, tone = 'primary', size = 'md', disabled, onClick, href, type = 'button', className = '', title }) {
  const tones = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-300',
    accent: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'border border-stone-200 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    danger: 'border border-red-200 text-red-700 bg-white hover:bg-red-50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
    purple: 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300',
  };
  const sizes = {
    xs: 'text-xs px-2 py-1 rounded-md',
    sm: 'text-xs px-3 py-1.5 rounded-md',
    md: 'text-sm px-4 py-2 rounded-lg',
    lg: 'text-base px-5 py-2.5 rounded-lg font-medium',
  };
  const cls = `inline-flex items-center justify-center gap-1.5 font-medium transition disabled:cursor-not-allowed ${tones[tone]} ${sizes[size]} ${className}`;
  if (href) return <Link href={href} className={cls} title={title}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>{children}</button>;
}

// ============================================================
// HubTile — /social hub 5 卡
// ============================================================
export function HubTile({ href, icon, title, hint, tone = 'neutral' }) {
  const toneMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', hover: 'hover:border-blue-300' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', hover: 'hover:border-purple-300' },
    fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', hover: 'hover:border-fuchsia-300' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', hover: 'hover:border-amber-300' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', hover: 'hover:border-sky-300' },
  };
  const t = toneMap[tone] || toneMap.blue;
  return (
    <Link href={href}
      className={`group block rounded-2xl border border-stone-200 bg-white p-5 transition ${t.hover} hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className={`flex size-11 items-center justify-center rounded-xl ${t.bg} text-2xl mb-3`}>{icon}</div>
      <h2 className={`text-base font-semibold text-stone-900 group-hover:${t.text} transition`}>{title}</h2>
      <p className="mt-1 text-xs text-stone-500 leading-relaxed">{hint}</p>
    </Link>
  );
}
