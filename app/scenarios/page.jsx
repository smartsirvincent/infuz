'use client';

import { useState } from 'react';
import { useInfuzDb, Field, TextInput, TextArea, DbHeader } from '@/components/DbAdminCommon';
import { UploadField } from '@/components/UploadField';

const TYPES = ['情境', '棚拍', '創意', '時尚', '街頭潮流', '組合'];
const EMPTY = { id: '', type: '情境', name: '', prompt: '' };

export default function ScenariosPage() {
  const { items, loading, error, saving, add, update, remove } = useInfuzDb('scenarios');
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [filter, setFilter] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState('');

  function nextId() {
    const used = items.map((x) => x.id?.match(/^SC(\d+)/)?.[1]).filter(Boolean).map(Number);
    const nextNum = used.length > 0 ? Math.max(...used) + 1 : 1;
    return `SC${String(nextNum).padStart(3, '0')}`;
  }
  function startNew() {
    setEditing({ ...EMPTY, id: nextId() });
  }
  async function handleUploadAndAnalyze(file) {
    if (!file) return;
    setAnalyzeErr('');
    setAnalyzing(true);
    try {
      // 1. 上傳
      const form = new FormData();
      form.append('file', file);
      const upRes = await fetch('/api/infuz/upload?folder=scenarios', { method: 'POST', body: form });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || `上傳 HTTP ${upRes.status}`);

      // 2. 視覺分析
      const anRes = await fetch('/api/infuz/analyze-composition', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: upData.url }),
      });
      const anData = await anRes.json();
      if (!anRes.ok) throw new Error(anData.error || `分析 HTTP ${anRes.status}`);

      // 3. 自動開啟編輯 modal,prompt 預填
      setEditing({
        ...EMPTY,
        id: nextId(),
        type: '情境',
        name: '',
        prompt: anData.composition_prompt || '',
        // 額外保留參考圖 URL (可選欄位)
        reference_image: upData.url,
      });
    } catch (e) {
      setAnalyzeErr(e.message);
    } finally { setAnalyzing(false); }
  }
  function startEdit(item) { setEditing({ ...EMPTY, ...item }); }
  async function handleSave() {
    if (!editing.id?.trim() || !editing.name?.trim()) {
      alert('編號 + 名稱 必填');
      return;
    }
    const item = { ...editing, id: editing.id.trim() };
    const exists = items.find((x) => x.id === item.id);
    const ok = exists ? await update(item.id, item) : await add(item);
    if (ok) setEditing(null);
  }
  async function handleDelete(id) {
    if (!confirm(`確定刪除 ${id}?`)) return;
    if (await remove(id) && editing?.id === id) setEditing(null);
  }

  const filtered = items.filter((it) => {
    if (typeFilter && it.type !== typeFilter) return false;
    if (filter && !`${it.id} ${it.name} ${it.prompt}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="space-y-5">
      <DbHeader
        title="🎬 情境資料庫"
        hint="管理生圖的場景模板。指令裡用 {{product}} 當作衣物的位置代碼,生圖時會自動代入產品。"
        count={items.length}
        onAdd={startNew}
        loading={loading}
      />

      {/* 上傳分析建立 */}
      <div className="card border-purple-200 bg-purple-50/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-purple-900">📷 從照片建立情境</h3>
            <p className="mt-0.5 text-[11px] text-purple-700">上傳一張靈感圖 → AI 視覺分析 → 自動產出中文構圖提示詞</p>
          </div>
          <label className={`cursor-pointer rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700 ${analyzing ? 'opacity-50 cursor-wait' : ''}`}>
            {analyzing ? '⏳ 分析中…' : '📷 上傳照片建立'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={analyzing}
              onChange={(e) => { handleUploadAndAnalyze(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        </div>
        {analyzeErr && <div className="mt-2 text-xs text-red-600">⚠ {analyzeErr}</div>}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠ {error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="🔍 搜尋編號 / 名稱 / 指令"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">全部型態</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card text-center text-stone-500">載入中…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <article key={s.id} className="card hover:border-emerald-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-stone-500">{s.id}</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-700">{s.type}</span>
                    <span className="text-sm font-medium text-stone-900">{s.name}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-stone-600">{s.prompt}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(s)} className="text-xs text-brand-600 hover:underline">編輯</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 hover:underline">刪除</button>
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="card text-center text-stone-500">沒有符合的情境</div>
          )}
        </div>
      )}

      {editing && (
        <ScenarioEditModal
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

function ScenarioEditModal({ item, setItem, saving, onSave, onCancel }) {
  function patch(k, v) { setItem({ ...item, [k]: v }); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-auto">
      <div className="card w-full max-w-3xl my-8">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{item.id ? '✏️ 編輯情境' : '➕ 新增情境'}</h2>
          <button onClick={onCancel} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="編號 *">
            <TextInput value={item.id} onChange={(v) => patch('id', v)} placeholder="例: SC030" />
          </Field>
          <Field label="型態">
            <select
              value={item.type || ''}
              onChange={(e) => patch('type', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="名稱 *">
            <TextInput value={item.name} onChange={(v) => patch('name', v)} placeholder="例: 咖啡廳約會" />
          </Field>
          <Field label="情境指令" full hint="中文或英文都可。用 {{product}} 標示產品的位置 — 生圖時會自動替換成 SKU 名稱。">
            <TextArea value={item.prompt} onChange={(v) => patch('prompt', v)} rows={8} placeholder="A stylish woman wearing {{product}} in a cozy modern café. Warm natural lighting..." />
          </Field>
          <Field label="參考圖 (選填,記錄靈感來源)" full>
            <UploadField value={item.reference_image} onChange={(v) => patch('reference_image', v)} folder="scenarios" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">取消</button>
          <button onClick={onSave} disabled={saving} className="btn-primary">{saving ? '儲存中…' : '儲存'}</button>
        </div>
      </div>
    </div>
  );
}
