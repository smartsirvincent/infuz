// 社群發文 5 頁共用 UI 元件 · Editorial monochrome (Vercel Dashboard + Linear + Substack)
// - 一個 accent (brand orange 只用於主 CTA), 其餘 zinc 灰階
// - Heading 大字 tight tracking, 無 emoji 裝飾
// - Cards border-only, hover 微陰影
// - motion-reduce friendly
'use client';

import Link from 'next/link';

// ============================================================
// PageHeader · editorial · 大字 heading + 麵包屑 + 右邊 actions
// ============================================================
export function PageHeader({ title, description, breadcrumbs, actions, eyebrow }) {
  return (
    <header className="pt-2 pb-6 border-b border-zinc-200">
      {breadcrumbs?.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-4 font-mono">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? (
                <Link href={b.href} className="hover:text-zinc-900 transition">{b.label}</Link>
              ) : (
                <span className="text-zinc-900">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <span className="text-zinc-300">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">{eyebrow}</div>
          )}
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 tracking-tight leading-[1.15]">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

// ============================================================
// StatCard · 大數字主宰, 極簡
// ============================================================
export function StatCard({ label, value, sub, tone = 'neutral' }) {
  const valueColor = {
    neutral: 'text-zinc-950',
    accent: 'text-brand-600',
    muted: 'text-zinc-400',
    positive: 'text-emerald-600',
    warn: 'text-amber-600',
    danger: 'text-red-600',
  }[tone] || 'text-zinc-950';
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300">
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

// ============================================================
// EmptyState · editorial · 極簡, 無大 emoji
// ============================================================
export function EmptyState({ title, description, action, mark }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-16 px-6 text-center space-y-4">
      {mark && <div className="text-3xl leading-none text-zinc-300 font-mono">{mark}</div>}
      <div className="text-base font-medium text-zinc-950">{title}</div>
      {description && <div className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">{description}</div>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

// ============================================================
// SectionCard · 內容分區, 純白 + border
// ============================================================
export function SectionCard({ title, description, actions, children, className = '', padding = 'default' }) {
  const p = { default: 'p-5 sm:p-6', tight: 'p-4', lg: 'p-6 sm:p-8' }[padding];
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white ${p} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-zinc-950 tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ============================================================
// Chip · border-only 為主, 精緻
// ============================================================
export function Chip({ children, tone = 'neutral', size = 'sm', variant = 'solid', className = '' }) {
  const solidTones = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    accent: 'bg-brand-50 text-brand-700 border-brand-200',
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    dark: 'bg-zinc-950 text-white border-zinc-950',
    // fallback tones for legacy pages · 全部 map 到 neutral 灰 (editorial monochrome)
    blue: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    purple: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    fuchsia: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    sky: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  };
  const outlineTones = {
    neutral: 'border-zinc-300 text-zinc-700 bg-white',
    accent: 'border-brand-300 text-brand-700 bg-white',
    positive: 'border-emerald-300 text-emerald-700 bg-white',
    warn: 'border-amber-300 text-amber-700 bg-white',
    danger: 'border-red-300 text-red-700 bg-white',
    dark: 'border-zinc-950 text-zinc-950 bg-white',
  };
  const tones = variant === 'outline' ? outlineTones : solidTones;
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
// TabBar · Vercel 風下劃線, 極簡
// ============================================================
export function TabBar({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-zinc-200 mb-5">
      {tabs.map((t) => {
        const on = value === t.value;
        return (
          <button key={t.value} onClick={() => onChange(t.value)}
            className={`relative px-3 py-2.5 text-sm transition -mb-px ${
              on ? 'text-zinc-950 font-medium' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              {t.label}
              {typeof t.count === 'number' && (
                <span className={`text-[10px] font-mono tabular-nums rounded px-1.5 py-0.5 min-w-[20px] text-center ${on ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                  {t.count}
                </span>
              )}
            </span>
            {on && <span className="absolute -bottom-px left-0 right-0 h-px bg-zinc-950" />}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Button · Vercel dashboard 風
// ============================================================
export function Button({ children, tone = 'primary', size = 'md', disabled, onClick, href, type = 'button', className = '', title }) {
  const tones = {
    // 主要動作用黑底白字 (Vercel/Linear 風)
    primary: 'bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-zinc-300',
    // 品牌強調用 accent (只用於重要「產文/發文」)
    accent: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    // 次要, 白底邊框
    secondary: 'border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50',
    // 透明, 只有 hover
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
    // 破壞性
    danger: 'border border-red-200 text-red-700 bg-white hover:bg-red-50 hover:border-red-300',
    // 正向
    positive: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  };
  const sizes = {
    xs: 'text-xs px-2 py-1 rounded-md',
    sm: 'text-xs px-3 py-1.5 rounded-md',
    md: 'text-sm px-4 py-2 rounded-md',
    lg: 'text-sm px-5 py-2.5 rounded-md font-medium',
  };
  const cls = `inline-flex items-center justify-center gap-1.5 font-medium transition disabled:cursor-not-allowed motion-reduce:transition-none ${tones[tone]} ${sizes[size]} ${className}`;
  if (href) return <Link href={href} className={cls} title={title}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>{children}</button>;
}

// ============================================================
// Skeleton · Loading 佔位, 取代「載入中...」文字
// ============================================================
export function Skeleton({ className = 'h-4 w-full', rounded = 'md' }) {
  const r = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl', full: 'rounded-full' }[rounded];
  return <div className={`skeleton ${r} ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-4 w-16" rounded="full" />
        <Skeleton className="h-4 w-12" rounded="full" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="size-10" rounded="xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ============================================================
// HubTile · Editorial · Serial 編號 + 大字, 無 emoji 主宰
// ============================================================
export function HubTile({ href, index, title, hint, size = 'sm', className = '' }) {
  const isLarge = size === 'lg';
  return (
    <Link href={href}
      className={`group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-900 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] motion-reduce:transition-none ${isLarge ? 'sm:p-8' : ''} ${className}`}
    >
      <div>
        {index && (
          <div className="text-[10px] font-mono tracking-widest text-zinc-400 mb-3">{index}</div>
        )}
        <h2 className={`font-editorial font-semibold text-zinc-950 tracking-tight leading-tight ${isLarge ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>{title}</h2>
        {hint && <p className={`text-zinc-500 leading-relaxed ${isLarge ? 'text-sm mt-3' : 'text-[13px] mt-2'}`}>{hint}</p>}
      </div>
      <div className="mt-6 flex items-center gap-1 text-xs text-zinc-400 group-hover:text-zinc-900 transition">
        <span>進入</span>
        <span className="group-hover:translate-x-0.5 transition-transform motion-reduce:transform-none">→</span>
      </div>
    </Link>
  );
}
