'use client';

import { useState } from 'react';

export const POST_STYLES = ['觀點短文', '情境敘事', '對白文', '自言自語', '教學文', '客戶見證', '清單文'];
export const PAIN_POINTS = ['身形修飾', '穿搭場合', '季節氣候', '時間壓力', '經濟', '心理', '知識'];

export const DEFAULT_DIMENSIONS = {
  styles: [...POST_STYLES],         // 全勾
  painPoints: [...PAIN_POINTS],     // 全勾
  interactionRatio: { story: 30, engagement: 40, brand: 30 },
};

export function PostDimensions({ value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const v = { ...DEFAULT_DIMENSIONS, ...(value || {}) };

  const ratioSum = (v.interactionRatio.story || 0) + (v.interactionRatio.engagement || 0) + (v.interactionRatio.brand || 0);

  function toggleStyle(s) {
    const next = v.styles.includes(s) ? v.styles.filter((x) => x !== s) : [...v.styles, s];
    onChange({ ...v, styles: next });
  }
  function togglePain(p) {
    const next = v.painPoints.includes(p) ? v.painPoints.filter((x) => x !== p) : [...v.painPoints, p];
    onChange({ ...v, painPoints: next });
  }
  function patchRatio(k, n) {
    const next = Math.max(0, Math.min(100, Number(n) || 0));
    onChange({ ...v, interactionRatio: { ...v.interactionRatio, [k]: next } });
  }
  function normalizeRatio() {
    const sum = ratioSum;
    if (sum === 0) return;
    const factor = 100 / sum;
    onChange({
      ...v,
      interactionRatio: {
        story: Math.round(v.interactionRatio.story * factor),
        engagement: Math.round(v.interactionRatio.engagement * factor),
        brand: Math.round(v.interactionRatio.brand * factor),
      },
    });
  }
  function reset() {
    onChange({ ...DEFAULT_DIMENSIONS });
  }

  return (
    <div className="card border-stone-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            🎯 進階變數 (選填) — 讓主題更多元
          </h3>
          <p className="mt-0.5 text-[11px] text-stone-500">
            文體 {v.styles.length}/{POST_STYLES.length} · 痛點 {v.painPoints.length}/{PAIN_POINTS.length} · 互動比 {v.interactionRatio.story}:{v.interactionRatio.engagement}:{v.interactionRatio.brand}
          </p>
        </div>
        <span className="text-stone-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-stone-100 pt-4">
          {/* === 維度 A 文體 === */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">📝 文體變化 (複選)</label>
              <span className="text-[11px] text-stone-500">{v.styles.length} / {POST_STYLES.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POST_STYLES.map((s) => {
                const active = v.styles.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    className={`rounded-full px-3 py-1 text-xs transition ${active ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {active ? '✓ ' : ''}{s}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-stone-500">不勾不會出現該文體的主題</p>
          </div>

          {/* === 維度 B 痛點 === */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">🎯 痛點切入 (複選)</label>
              <span className="text-[11px] text-stone-500">{v.painPoints.length} / {PAIN_POINTS.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_POINTS.map((p) => {
                const active = v.painPoints.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePain(p)}
                    className={`rounded-full px-3 py-1 text-xs transition ${active ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {active ? '✓ ' : ''}{p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* === 維度 F 互動目標比例 === */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">🎲 互動目標比例 (加總 100%)</label>
              <button
                type="button"
                onClick={normalizeRatio}
                className="text-[11px] text-emerald-600 hover:underline"
              >
                自動湊 100%
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'story', label: '📖 故事型', hint: '個人經歷 / 客人故事 / 對白情境' },
                { key: 'engagement', label: '💬 高互動', hint: '反問 / 投票 / 標朋友 / 引留言' },
                { key: 'brand', label: '🏷 品牌型', hint: '品牌觀點 / 哲學 / 語錄 / 形象建立' },
              ].map((row) => (
                <div key={row.key} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-stone-200 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-stone-800">{row.label}</div>
                    <div className="text-[10px] text-stone-500">{row.hint}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={v.interactionRatio[row.key]}
                      onChange={(e) => patchRatio(row.key, e.target.value)}
                      className="w-16 rounded-md border border-stone-300 px-2 py-1 text-right text-sm"
                    />
                    <span className="text-xs text-stone-500">%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className={`mt-1.5 text-[11px] ${ratioSum === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {ratioSum === 100 ? '✓ 加總 100%' : `⚠ 目前加總 ${ratioSum}% (建議按「自動湊 100%」)`}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-stone-500 hover:underline"
            >
              全部重設預設值
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
