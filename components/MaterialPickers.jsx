'use client';

// 共用元件:產品 / 模特 / 情境 選擇器 + 結果面板
import { useEffect, useState } from 'react';

export const SCENARIO_TYPES = ['情境', '棚拍', '創意', '時尚', '街頭潮流', '組合'];
export const PRODUCT_GENDERS = ['女性', '男性', '中性'];
export const PRODUCT_CATEGORIES = ['上衣', '下身', '外套', '洋裝', '配件', '其他'];

export function useEntityList(kind) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/infuz/${kind}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setItems(data.items || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind]);
  return { items, loading, error };
}

/**
 * 產品 picker:加全選 chip + 性別 + 分類雙篩選 + 搜尋
 * - lockCategory: 若給,該欄分類 filter 鎖死 (例如搭配模式的上衣 picker 鎖在「上衣」)
 */
export function ProductPicker({ label, products, value, onChange, lockCategory }) {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(lockCategory || '');

  // lockCategory 改變時要同步
  useEffect(() => {
    if (lockCategory) setCategoryFilter(lockCategory);
  }, [lockCategory]);

  const filtered = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (genderFilter && p.gender !== genderFilter) return false;
    if (!search) return true;
    return `${p.id} ${p.name} ${p.colors}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = products.find((p) => p.id === value);

  return (
    <div>
      <label className="label">{label}</label>

      {/* 篩選 chips */}
      <div className="mb-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          <FilterChip active={!genderFilter} onClick={() => setGenderFilter('')}>全部性別</FilterChip>
          {PRODUCT_GENDERS.map((g) => (
            <FilterChip key={g} active={genderFilter === g} onClick={() => setGenderFilter(g)}>{g}</FilterChip>
          ))}
        </div>
        {!lockCategory && (
          <div className="flex flex-wrap gap-1">
            <FilterChip active={!categoryFilter} onClick={() => setCategoryFilter('')}>全部分類</FilterChip>
            {PRODUCT_CATEGORIES.map((c) => (
              <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</FilterChip>
            ))}
          </div>
        )}
        {lockCategory && (
          <div className="text-[11px] text-stone-500">分類鎖定: <strong className="text-stone-700">{lockCategory}</strong></div>
        )}
        <input
          className="input text-sm"
          placeholder="🔍 搜尋 SKU / 名稱 / 顏色"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-stone-500">沒有符合的產品 ({products.length} 總筆數)</div>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`flex w-full items-center gap-3 border-b border-stone-100 px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${value === p.id ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}
          >
            {p.image_front ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.image_front} alt={p.name} className="size-12 rounded object-cover" loading="lazy" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded bg-stone-100 text-xl">📷</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-stone-500">{p.id}</div>
              <div className="truncate font-medium text-stone-900">{p.name || '(無名)'}</div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-stone-500">
                {p.gender && <span className={`rounded px-1 ${p.gender === '女性' ? 'bg-pink-100 text-pink-700' : p.gender === '男性' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100'}`}>{p.gender}</span>}
                {p.category && <span>{p.category}</span>}
                {p.colors && <span>· {p.colors}</span>}
                {p.price && <span>· ${p.price}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-1 text-[11px] text-emerald-700">✓ {selected.id} — {selected.name?.slice(0, 30)}</div>
      )}
    </div>
  );
}

/**
 * 多選產品 picker (給組合模式用)
 * value = string[] (ids)
 * 限制: maxItems (預設 6,KIE 參考圖 + model + composition ref 不能超過 10)
 */
export function ProductMultiPicker({ label, products, value = [], onChange, maxItems = 6 }) {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  function toggle(id) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      if (value.length >= maxItems) {
        alert(`最多 ${maxItems} 件`);
        return;
      }
      onChange([...value, id]);
    }
  }
  function removeItem(id) {
    onChange(value.filter((x) => x !== id));
  }

  const filtered = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (genderFilter && p.gender !== genderFilter) return false;
    if (!search) return true;
    return `${p.id} ${p.name} ${p.colors}`.toLowerCase().includes(search.toLowerCase());
  });

  const selectedProducts = value
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div>
      <label className="label">{label}</label>

      {/* 已選清單 */}
      {selectedProducts.length > 0 && (
        <div className="mb-2 rounded-lg border border-emerald-300 bg-emerald-50/40 p-2">
          <div className="mb-1 text-[11px] text-emerald-700">
            已選 <strong>{selectedProducts.length}</strong> / {maxItems} 件
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedProducts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-1 text-[11px]"
              >
                {p.image_front && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image_front} alt={p.name} className="size-5 rounded object-cover" />
                )}
                <span className="font-mono text-stone-500">{p.id}</span>
                <span className="max-w-[100px] truncate text-stone-800">{p.name}</span>
                <button
                  type="button"
                  onClick={() => removeItem(p.id)}
                  className="ml-0.5 text-stone-400 hover:text-red-600"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 篩選 */}
      <div className="mb-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          <FilterChip active={!genderFilter} onClick={() => setGenderFilter('')}>全部性別</FilterChip>
          {PRODUCT_GENDERS.map((g) => (
            <FilterChip key={g} active={genderFilter === g} onClick={() => setGenderFilter(g)}>{g}</FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <FilterChip active={!categoryFilter} onClick={() => setCategoryFilter('')}>全部分類</FilterChip>
          {PRODUCT_CATEGORIES.map((c) => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</FilterChip>
          ))}
        </div>
        <input
          className="input text-sm"
          placeholder="🔍 搜尋 SKU / 名稱 / 顏色"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 列表 (click toggle) */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-stone-500">沒有符合的產品</div>
        )}
        {filtered.map((p) => {
          const checked = value.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`flex w-full items-center gap-3 border-b border-stone-100 px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${checked ? 'bg-emerald-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="size-4 rounded border-stone-300 text-emerald-600"
              />
              {p.image_front ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.image_front} alt={p.name} className="size-12 rounded object-cover" loading="lazy" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded bg-stone-100 text-xl">📷</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] text-stone-500">{p.id}</div>
                <div className="truncate font-medium text-stone-900">{p.name || '(無名)'}</div>
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-stone-500">
                  {p.gender && <span className={`rounded px-1 ${p.gender === '女性' ? 'bg-pink-100 text-pink-700' : p.gender === '男性' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100'}`}>{p.gender}</span>}
                  {p.category && <span>{p.category}</span>}
                  {p.colors && <span>· {p.colors}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
    >
      {children}
    </button>
  );
}

export function ModelPicker({ models, value, onChange, genderFilter, onGenderChange }) {
  const filtered = genderFilter ? models.filter((m) => m.gender === genderFilter) : models;
  return (
    <div>
      <label className="label">👤 選模特兒</label>
      {onGenderChange && (
        <div className="mb-2 flex flex-wrap gap-1">
          <FilterChip active={!genderFilter} onClick={() => onGenderChange('')}>全部</FilterChip>
          <FilterChip active={genderFilter === '女性'} onClick={() => onGenderChange('女性')}>女性</FilterChip>
          <FilterChip active={genderFilter === '男性'} onClick={() => onGenderChange('男性')}>男性</FilterChip>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center text-xs hover:border-emerald-300 ${value === m.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-stone-200 bg-white'}`}
          >
            {m.reference_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={m.reference_image} alt={m.name} className="size-16 rounded-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-stone-100 text-2xl">👤</div>
            )}
            <div className="font-medium text-stone-900">{m.name}</div>
            <div className="text-[10px] text-stone-500">
              {m.id}{m.gender ? ` · ${m.gender}` : ''}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">沒有符合的模特</div>
        )}
      </div>
    </div>
  );
}

/**
 * 兩段式情境 picker:
 * 上排 = 型態 (限定 6 種)
 * 下方 = 該型態的情境清單
 */
export function ScenarioPicker({ scenarios, value, onChange }) {
  const [type, setType] = useState('');
  const selected = scenarios.find((s) => s.id === value);

  const filtered = type ? scenarios.filter((s) => s.type === type) : scenarios;

  return (
    <div>
      <label className="label">🎬 選情境</label>

      {/* Step 1: 型態 */}
      <div className="mb-2.5">
        <div className="text-[11px] font-medium text-stone-500 mb-1">第 1 步 — 選型態</div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!type} onClick={() => setType('')}>全部</FilterChip>
          {SCENARIO_TYPES.map((t) => (
            <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
              {t} ({scenarios.filter((s) => s.type === t).length})
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Step 2: 情境 */}
      <div>
        <div className="text-[11px] font-medium text-stone-500 mb-1">
          第 2 步 — {type ? `「${type}」型態下的情境 (${filtered.length} 個)` : `從全部 ${filtered.length} 個情境選 1`}
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`block w-full border-b border-stone-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${value === s.id ? 'bg-emerald-50 ring-1 ring-emerald-400' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-stone-500">{s.id}</span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px]">{s.type}</span>
                <span className="font-medium text-stone-900">{s.name}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] text-stone-500">{s.prompt}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-stone-500">該型態目前沒情境</div>
          )}
        </div>
      </div>
      {selected && (
        <div className="mt-1 text-[11px] text-emerald-700">✓ {selected.id} — {selected.name}</div>
      )}
    </div>
  );
}

/**
 * 上傳模仿構圖的圖片 + Vision 分析
 * onAnalyzed({ compositionPrompt, url }) 回傳分析結果
 */
export function CompositionUploader({ uploadedUrl, setUploadedUrl, compositionPrompt, setCompositionPrompt }) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  async function handleUpload(file) {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/material/upload-ref', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setUploadedUrl(d.url);
      // 自動分析
      await analyze(d.url);
    } catch (e) {
      setError('上傳失敗:' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function analyze(url) {
    setAnalyzing(true);
    try {
      const r = await fetch('/api/infuz/analyze-composition', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setCompositionPrompt(d.composition_prompt || '');
    } catch (e) {
      setError('分析失敗:' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function clear() {
    setUploadedUrl(null);
    setCompositionPrompt('');
    setPreview(null);
    setError('');
  }

  return (
    <div className="card border-purple-200 bg-purple-50/30 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-purple-900">🖼 上傳模仿構圖 (選填)</h3>
        {(uploadedUrl || preview) && (
          <button type="button" onClick={clear} className="text-xs text-stone-500 hover:text-red-600">清除</button>
        )}
      </div>

      {!preview ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-white py-6 text-center text-xs text-purple-600 hover:bg-purple-50">
          <span className="text-2xl">📷</span>
          <span>上傳一張你喜歡的構圖照</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="構圖" className="size-24 rounded-md object-cover" />
          <div className="flex-1 text-xs">
            <div className="text-purple-700">
              {uploading ? '上傳中…' : analyzing ? '🔍 AI 解析構圖中…' : uploadedUrl ? '✓ 已上傳並分析' : '預覽中'}
            </div>
            {error && <div className="mt-1 text-red-600">{error}</div>}
          </div>
        </div>
      )}

      {uploadedUrl && (
        <div>
          <label className="label text-xs">AI 解析後的構圖提示詞 (可改)</label>
          <textarea
            className="input min-h-[100px] text-xs leading-relaxed"
            value={compositionPrompt}
            onChange={(e) => setCompositionPrompt(e.target.value)}
            placeholder={analyzing ? 'AI 正在分析…' : '上傳後會自動填入'}
          />
          <p className="mt-1 text-[10px] text-purple-700">💡 只取構圖（鏡頭角度 / 排版 / 光線 / 留白），不抄具體內容。</p>
        </div>
      )}
    </div>
  );
}

/**
 * 文字模式 + AI 標語 + 不要人臉
 */
export function GenerationOptions({
  textMode, setTextMode,
  promoInfo, setPromoInfo,
  slogan, setSlogan,
  noFace, setNoFace,
  productSummary,
  brandPersona = '',
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  async function suggestSlogans() {
    setSuggesting(true);
    try {
      const r = await fetch('/api/infuz/suggest-slogan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productSummary, brandPersona }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.slogans)) {
        setSuggestions(d.slogans);
      }
    } catch (_) {}
    finally { setSuggesting(false); }
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold text-stone-800">⚙️ 生圖選項</h3>

      <div>
        <div className="label text-xs">圖中文字模式</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <ModeRadio active={textMode === 'none'} onClick={() => setTextMode('none')} label="純情境圖" hint="圖中沒文字" />
          <ModeRadio active={textMode === 'promo'} onClick={() => setTextMode('promo')} label="加促銷資訊" hint="例: 限時 5 折" />
          <ModeRadio active={textMode === 'slogan'} onClick={() => setTextMode('slogan')} label="加標語" hint="AI 可建議" />
        </div>
      </div>

      {textMode === 'promo' && (
        <div>
          <label className="label text-xs">促銷資訊 (會渲染到圖中)</label>
          <input
            className="input text-sm"
            value={promoInfo}
            onChange={(e) => setPromoInfo(e.target.value)}
            placeholder="例: 限時 5 折 / 滿千折百 / 新品 9 折"
          />
        </div>
      )}

      {textMode === 'slogan' && (
        <div>
          <div className="flex items-center justify-between">
            <label className="label text-xs !mb-0">標語 (會渲染到圖中)</label>
            <button
              type="button"
              onClick={suggestSlogans}
              disabled={suggesting}
              className="text-[11px] text-emerald-700 hover:underline disabled:opacity-50"
            >
              {suggesting ? '建議中…' : '✨ AI 建議標語'}
            </button>
          </div>
          <input
            className="input text-sm"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder="例: 為亞洲身材而生"
          />
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlogan(s)}
                  className={`block w-full rounded-md border px-2 py-1 text-left text-xs ${slogan === s ? 'border-emerald-400 bg-emerald-50' : 'border-stone-200 hover:bg-stone-50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 hover:bg-stone-50">
        <input
          type="checkbox"
          checked={noFace}
          onChange={(e) => setNoFace(e.target.checked)}
          className="size-4 rounded border-stone-300 text-emerald-600"
        />
        <div className="text-xs">
          <div className="font-medium text-stone-800">不要人臉</div>
          <div className="text-[10px] text-stone-500">構圖會避開正面臉部（背面 / 側面 / 頭部出鏡 / 鏡頭聚焦在身體 + 衣服）</div>
        </div>
      </label>
    </div>
  );
}

function ModeRadio({ active, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition ${active ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-stone-200 hover:bg-stone-50'}`}
    >
      <div className="text-sm font-medium text-stone-800">{label}</div>
      <div className="text-[10px] text-stone-500">{hint}</div>
    </button>
  );
}

export function ResultPanel({ result, onReset, generating, error, onSwapTop, onSwapBottom, mode }) {
  if (generating) {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-3 size-12 animate-spin rounded-full border-4 border-stone-200 border-t-emerald-500"></div>
        <p className="text-sm text-stone-700">🎨 AI 生圖中…</p>
        <p className="mt-1 text-xs text-stone-500">通常 30-90 秒</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="text-sm text-red-700">❌ {error}</p>
        <button onClick={onReset} className="mt-2 text-xs text-red-600 underline">重試</button>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">🎉 生成完成</h2>
        <button onClick={onReset} className="text-xs text-stone-500 hover:text-stone-900">清除</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.url} alt="result" className="mx-auto aspect-square w-full max-w-md rounded-lg object-cover" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-stone-500">耗時 {Math.round((result.kieMs || 0) / 1000)}s</span>
        <div className="flex flex-wrap gap-2">
          {onSwapTop && (
            <button onClick={onSwapTop} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-700 hover:bg-blue-100">
              🔁 換上衣再生
            </button>
          )}
          {onSwapBottom && (
            <button onClick={onSwapBottom} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100">
              🔁 換下身再生
            </button>
          )}
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            download
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            ⬇ 下載
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * 換產品的 modal:給結果頁的「換上衣 / 換下身」用
 */
export function SwapProductModal({ open, products, currentId, lockCategory, onPick, onCancel, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-auto">
      <div className="card w-full max-w-2xl my-8">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onCancel} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>
        <ProductPicker
          label="挑新的"
          products={products.filter((p) => p.id !== currentId)}
          value=""
          onChange={onPick}
          lockCategory={lockCategory}
        />
      </div>
    </div>
  );
}
