'use client';

// 通用 hook + 共用元件 給 3 個 DB CRUD 頁面用
import { useEffect, useState } from 'react';

export function useInfuzDb(kind) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/infuz/${kind}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [kind]);

  async function add(item) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/infuz/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      return true;
    } catch (e) {
      setError('新增失敗:' + e.message);
      return false;
    } finally { setSaving(false); }
  }

  async function update(id, patch) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/infuz/${kind}?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      return true;
    } catch (e) {
      setError('儲存失敗:' + e.message);
      return false;
    } finally { setSaving(false); }
  }

  async function remove(id) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/infuz/${kind}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      return true;
    } catch (e) {
      setError('刪除失敗:' + e.message);
      return false;
    } finally { setSaving(false); }
  }

  return { items, loading, error, saving, add, update, remove, refresh };
}

export function Field({ label, children, hint, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-stone-700">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-stone-500">{hint}</p>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || ''}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      rows={rows}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || ''}
    />
  );
}

export function DbHeader({ title, hint, count, onAdd, addLabel = '＋ 新增', loading }) {
  return (
    <div className="card border-emerald-200 bg-emerald-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">{title}</h1>
          {hint && <p className="mt-1 text-sm text-stone-600">{hint}</p>}
          {!loading && (
            <p className="mt-2 text-xs text-emerald-700">目前共 <strong>{count}</strong> 筆</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
