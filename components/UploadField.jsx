'use client';

import { useState } from 'react';

/**
 * 共用上傳元件 — 上傳 + URL 顯示 + 預覽
 * value/onChange = URL 字串
 * folder = 'products' | 'models' | 'scenarios' | 'misc'
 */
export function UploadField({ value, onChange, folder = 'misc', placeholder = 'https://… 或點上傳', accept = 'image/png,image/jpeg,image/webp' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`/api/infuz/upload?folder=${folder}`, { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onChange(d.url);
    } catch (e) {
      setError(e.message);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          className="input flex-1 text-sm font-mono"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <label className={`flex cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs whitespace-nowrap hover:bg-stone-50 ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
          {uploading ? '上傳中…' : '📷 上傳'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs hover:bg-red-50 hover:text-red-600"
            title="清除"
          >
            ✕
          </button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-2 rounded-md bg-stone-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="size-12 rounded object-cover" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
          <span className="truncate text-[10px] text-stone-500">{value}</span>
        </div>
      )}
      {error && <div className="text-[11px] text-red-600">⚠ {error}</div>}
    </div>
  );
}
