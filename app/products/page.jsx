'use client';

import { useState } from 'react';
import { useInfuzDb, Field, TextInput, TextArea, DbHeader } from '@/components/DbAdminCommon';
import { UploadField } from '@/components/UploadField';

const CATEGORIES = ['上衣', '下身', '外套', '洋裝', '配件', '其他'];
const GENDERS = ['女性', '男性', '中性'];
const EMPTY = {
  id: '', sku: '', name: '', features: '', colors: '',
  image_front: '', image_back: '', image_detail: '',
  purchase_url: '', price: '', category: '下身', gender: '女性',
};

export default function ProductsPage() {
  const { items, loading, error, saving, add, update, remove } = useInfuzDb('products');
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  function startNew() {
    setEditing({ ...EMPTY });
  }
  function startEdit(item) {
    setEditing({ ...EMPTY, ...item });
  }
  async function handleSave() {
    if (!editing.id?.trim() || !editing.name?.trim()) {
      alert('產品編號 + 名稱 必填');
      return;
    }
    const item = { ...editing, id: editing.id.trim(), sku: editing.sku || editing.id.trim() };
    const exists = items.find((x) => x.id === item.id);
    const ok = exists ? await update(item.id, item) : await add(item);
    if (ok) setEditing(null);
  }
  async function handleDelete(id) {
    if (!confirm(`確定刪除 ${id}?`)) return;
    if (await remove(id)) {
      if (editing?.id === id) setEditing(null);
    }
  }

  const filtered = items.filter((it) => {
    if (filter && !`${it.id} ${it.name} ${it.colors}`.toLowerCase().includes(filter.toLowerCase())) return false;
    if (categoryFilter && it.category !== categoryFilter) return false;
    if (genderFilter && it.gender !== genderFilter) return false;
    return true;
  });

  return (
    <main className="space-y-5">
      <DbHeader
        title="👕 產品資料庫"
        hint="管理 Infuz 所有 SKU。新增 / 修改 / 刪除都會直接同步到雲端。"
        count={items.length}
        onAdd={startNew}
        loading={loading}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="🔍 搜尋 SKU / 名稱 / 顏色"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">全部分類</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">全部性別</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card text-center text-stone-500">載入中…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <article key={p.id} className="card flex gap-3 hover:border-emerald-300">
              {p.image_front ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.image_front} alt={p.name} className="size-24 rounded-md object-cover" loading="lazy" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-md bg-stone-100 text-2xl">📷</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-stone-500">{p.id}</div>
                <div className="truncate text-sm font-medium text-stone-900">{p.name || '(無名)'}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-stone-500">
                  {p.gender && <span className={`rounded px-1.5 py-0.5 ${p.gender === '女性' ? 'bg-pink-100 text-pink-700' : p.gender === '男性' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100'}`}>{p.gender}</span>}
                  {p.category && <span className="rounded bg-stone-100 px-1.5 py-0.5">{p.category}</span>}
                  {p.colors && <span>{p.colors}</span>}
                  {p.price && <span className="text-emerald-700">${p.price}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-brand-600 hover:underline">編輯</button>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 hover:underline">刪除</button>
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full card text-center text-stone-500">沒有符合的產品</div>
          )}
        </div>
      )}

      {editing && (
        <ProductEditModal
          item={editing}
          setItem={setEditing}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function ProductEditModal({ item, setItem, saving, onSave, onCancel }) {
  function patch(k, v) { setItem({ ...item, [k]: v }); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-auto">
      <div className="card w-full max-w-3xl my-8">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{item.id ? '✏️ 編輯產品' : '➕ 新增產品'}</h2>
          <button onClick={onCancel} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="產品編號 (SKU) *">
            <TextInput value={item.id} onChange={(v) => patch('id', v)} placeholder="例: JW28039" />
          </Field>
          <Field label="分類">
            <select
              value={item.category || ''}
              onChange={(e) => patch('category', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="性別">
            <select
              value={item.gender || '女性'}
              onChange={(e) => patch('gender', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
            >
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="產品名稱 *" full>
            <TextInput value={item.name} onChange={(v) => patch('name', v)} placeholder="例: 【Infuz 潮流時尚】方袋錐形彎刀褲" />
          </Field>
          <Field label="產品特色" full>
            <TextArea value={item.features} onChange={(v) => patch('features', v)} rows={4} placeholder="▪︎ 賣點 1&#10;▪︎ 賣點 2" />
          </Field>
          <Field label="顏色 (用 / 分隔)">
            <TextInput value={item.colors} onChange={(v) => patch('colors', v)} placeholder="例: 墨黑/丹寧藍" />
          </Field>
          <Field label="價格">
            <TextInput value={item.price} onChange={(v) => patch('price', v)} placeholder="例: 880" />
          </Field>
          <Field label="圖片 1 (正面)" full>
            <UploadField value={item.image_front} onChange={(v) => patch('image_front', v)} folder="products" />
          </Field>
          <Field label="圖片 2 (背面)" full>
            <UploadField value={item.image_back} onChange={(v) => patch('image_back', v)} folder="products" />
          </Field>
          <Field label="圖片 3 (細節)" full>
            <UploadField value={item.image_detail} onChange={(v) => patch('image_detail', v)} folder="products" />
          </Field>
          <Field label="購買網址" full>
            <TextInput value={item.purchase_url} onChange={(v) => patch('purchase_url', v)} placeholder="https://..." />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">取消</button>
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
