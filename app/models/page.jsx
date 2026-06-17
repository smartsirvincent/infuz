'use client';

import { useState } from 'react';
import { useInfuzDb, Field, TextInput, TextArea, DbHeader } from '@/components/DbAdminCommon';

const EMPTY = {
  id: '', name: '', style: '', reference_image: '',
  skin_tone: '', hairstyle: '', notes: '',
};

export default function ModelsPage() {
  const { items, loading, error, saving, add, update, remove } = useInfuzDb('models');
  const [editing, setEditing] = useState(null);

  function startNew() { setEditing({ ...EMPTY }); }
  function startEdit(item) { setEditing({ ...EMPTY, ...item }); }
  async function handleSave() {
    if (!editing.id?.trim() || !editing.name?.trim()) {
      alert('模特兒編號 + 名稱 必填');
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

  return (
    <main className="space-y-5">
      <DbHeader
        title="👤 模特兒資料庫"
        hint="管理生圖會用到的模特兒角色。每個模特一張參考圖,AI 會固定外觀。"
        count={items.length}
        onAdd={startNew}
        loading={loading}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠ {error}</div>}

      {loading ? (
        <div className="card text-center text-stone-500">載入中…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((m) => (
            <article key={m.id} className="card flex gap-3 hover:border-emerald-300">
              {m.reference_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.reference_image} alt={m.name} className="size-28 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="flex size-28 items-center justify-center rounded-lg bg-stone-100 text-3xl">👤</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-stone-500">{m.id}</div>
                <div className="text-base font-medium text-stone-900">{m.name}</div>
                <p className="mt-1 line-clamp-3 text-xs text-stone-600">{m.style}</p>
                <div className="mt-1 flex gap-2 text-[11px] text-stone-500">
                  {m.skin_tone && <span>膚色: {m.skin_tone}</span>}
                  {m.hairstyle && <span>髮: {m.hairstyle?.slice(0, 20)}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => startEdit(m)} className="text-xs text-brand-600 hover:underline">編輯</button>
                  <button onClick={() => handleDelete(m.id)} className="text-xs text-red-600 hover:underline">刪除</button>
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="col-span-full card text-center text-stone-500">尚無模特兒,按右上 ＋ 新增</div>
          )}
        </div>
      )}

      {editing && (
        <ModelEditModal
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

function ModelEditModal({ item, setItem, saving, onSave, onCancel }) {
  function patch(k, v) { setItem({ ...item, [k]: v }); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-auto">
      <div className="card w-full max-w-2xl my-8">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{item.id ? '✏️ 編輯模特' : '➕ 新增模特'}</h2>
          <button onClick={onCancel} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="模特兒編號 *" hint="例: A / B / C / 自訂代號">
            <TextInput value={item.id} onChange={(v) => patch('id', v)} />
          </Field>
          <Field label="名稱 *">
            <TextInput value={item.name} onChange={(v) => patch('name', v)} placeholder="例: 小紅" />
          </Field>
          <Field label="風格描述" full hint="盡量描述: 性別 / 年齡感 / 身材 / 五官特徵 / 妝感 / 性格 — AI 會用這段保持人物一致">
            <TextArea value={item.style} onChange={(v) => patch('style', v)} rows={5} placeholder="例: 韓系空氣感短髮 20 歲中期亞洲女性..." />
          </Field>
          <Field label="參考圖片 URL" full>
            <TextInput value={item.reference_image} onChange={(v) => patch('reference_image', v)} placeholder="https://..." />
          </Field>
          <Field label="膚色">
            <TextInput value={item.skin_tone} onChange={(v) => patch('skin_tone', v)} placeholder="例: 白 / 自然小麥色" />
          </Field>
          <Field label="髮型">
            <TextInput value={item.hairstyle} onChange={(v) => patch('hairstyle', v)} placeholder="例: 短髮 / 長直髮" />
          </Field>
          <Field label="備註" full>
            <TextArea value={item.notes} onChange={(v) => patch('notes', v)} rows={2} />
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
