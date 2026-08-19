'use client';

// 氣候即時預約發文
// 支援多縣市(任一達標即發) + 配圖(從產品庫隨機挑女裝,KIE image-to-image)
import { useEffect, useState } from 'react';
import Link from 'next/link';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_PROMPT = `依當下的氣溫與降雨機率,給 25-40 歲的通勤女性一則穿搭建議。
不要一開頭就講產品,先從天氣/場景切入,最後自然帶到我們的褲款(強調顯瘦/舒適/版型),
或直接寫生活觀察,不推銷。長度 100-180 字。`;

export default function WeatherPostPage() {
  const [meta, setMeta] = useState(null);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [rtRes, connRes] = await Promise.all([
        fetch('/api/infuz/realtime', { cache: 'no-store' }),
        fetch('/api/infuz/connections', { cache: 'no-store' }),
      ]);
      setMeta(await rtRes.json());
      const connData = await connRes.json();
      setConn((connData.items || []).find((x) => x.id === 'main') || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function newJob() {
    setEditing({
      name: '每日穿搭天氣提醒',
      moduleId: 'weather',
      time: '08:30',
      days: [1, 2, 3, 4, 5],
      platforms: { threads: true, facebook: false, instagram: false },
      withImage: false,
      enabled: true,
      config: {
        locations: ['臺北市'],
        minPoP: '',
        minMaxT: '',
        maxMinT: '',
        prompt: DEFAULT_PROMPT,
        imagePrompt: '',
        productPool: 'female',
        modelGender: 'female',
        aspectRatio: '4:5',
      },
    });
    setPreview(null);
    setError('');
  }

  function normalizeForEdit(job) {
    // 舊資料相容 (location -> locations[])
    const config = { ...job.config };
    if (!config.locations && config.location) config.locations = [config.location];
    if (!config.locations) config.locations = ['臺北市'];
    if (!config.productPool) config.productPool = 'female';
    if (!config.modelGender) config.modelGender = 'female';
    if (!config.aspectRatio) config.aspectRatio = '4:5';
    return { ...job, config };
  }

  async function trySave() {
    setSaving(true); setError('');
    try {
      const body = editing;
      const url = '/api/infuz/realtime';
      const method = body.id ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setEditing(null);
      setPreview(null);
      await load();
    } catch (e) { setError('儲存失敗:' + e.message); }
    finally { setSaving(false); }
  }

  async function tryDelete(id) {
    if (!confirm('刪除這個排程?')) return;
    await fetch(`/api/infuz/realtime?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  }

  async function toggleEnabled(job) {
    await fetch('/api/infuz/realtime', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: job.id, enabled: !job.enabled }),
    });
    load();
  }

  async function tryPreview() {
    setPreviewing(true); setError(''); setPreview(null);
    try {
      const r = await fetch('/api/infuz/realtime/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          moduleId: editing.moduleId,
          config: editing.config,
          withImage: editing.withImage,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPreview(d);
    } catch (e) { setError('試發失敗:' + e.message); }
    finally { setPreviewing(false); }
  }

  async function suggestImagePrompt() {
    setSuggesting(true); setError('');
    try {
      const r = await fetch('/api/infuz/realtime/suggest-image-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locations: editing.config.locations,
          modelGender: editing.config.modelGender,
          productPool: editing.config.productPool,
          prompt: editing.config.prompt,
          aspectRatio: editing.config.aspectRatio,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setEditing({ ...editing, config: { ...editing.config, imagePrompt: d.imagePrompt } });
    } catch (e) { setError('建議失敗:' + e.message); }
    finally { setSuggesting(false); }
  }

  async function fireNow() {
    setError('');
    if (!confirm('立即觸發所有已排程的 job (照原本的觸發條件過濾)?')) return;
    try {
      const r = await fetch('/api/infuz/cron/tick', { method: 'POST' });
      const d = await r.json();
      alert(`tick 完成:嘗試 ${d.tried} · 已發 ${d.fired} · 跳過 ${d.skipped}` + (d.errors?.length ? '\n錯誤:\n' + d.errors.join('\n') : ''));
      load();
    } catch (e) { setError('觸發失敗:' + e.message); }
  }

  if (loading) return <main className="card">載入中…</main>;

  const canThreads = !!conn?.threads?.accessToken;
  const canFb = !!conn?.facebook?.pageAccessToken;
  const canIg = !!conn?.facebook?.igUserId;
  const weatherReady = meta?.weather?.ready;

  return (
    <main className="space-y-5">
      <div className="card border-sky-200 bg-sky-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">☀️ 氣候即時預約</h1>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          到指定時間 → 抓中央氣象署預報(可多縣市) → 依觸發條件產出當下應景的貼文 → 選配從產品庫隨機挑一件搭配生圖 → 直發 Threads / IG / FB。
        </p>
        {!weatherReady && (
          <div className="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-800">
            ⚠ CWA_API_KEY 環境變數尚未設定 — 到 Vercel 加上這顆 key 才能抓氣象資料。
          </div>
        )}
      </div>

      {/* 排程列表 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">📅 已排程 ({meta?.items?.length || 0})</h2>
          <div className="flex gap-2">
            <button onClick={fireNow} className="text-[11px] text-stone-600 hover:text-emerald-700 underline">⚡ 立即觸發 tick</button>
            <button onClick={newJob} className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">+ 新增排程</button>
          </div>
        </div>
        {(meta?.items || []).length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            還沒有排程,按「+ 新增排程」建一個
          </div>
        )}
        {(meta?.items || []).map((job) => (
          <JobRow
            key={job.id}
            job={job}
            onEdit={() => { setEditing(normalizeForEdit(job)); setPreview(null); setError(''); }}
            onDelete={() => tryDelete(job.id)}
            onToggle={() => toggleEnabled(job)}
          />
        ))}
      </div>

      {/* 編輯區 */}
      {editing && (
        <div className="card space-y-4 border-emerald-200">
          <h2 className="text-base font-semibold text-stone-900">
            {editing.id ? '✏️ 編輯排程' : '➕ 新增排程'}
          </h2>

          <div>
            <label className="label text-xs">排程名稱</label>
            <input className="input text-sm" value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>

          {/* 多選縣市 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0 text-xs">📍 縣市 (可複選 · 任一縣市達觸發條件就發)</label>
              <span className="text-[10px] text-stone-500">已選 {editing.config.locations.length} 個</span>
            </div>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
              {(meta?.weather?.locations || []).map((loc) => {
                const on = editing.config.locations.includes(loc);
                return (
                  <button key={loc} type="button"
                    onClick={() => {
                      const next = on ? editing.config.locations.filter((x) => x !== loc) : [...editing.config.locations, loc];
                      setEditing({ ...editing, config: { ...editing.config, locations: next } });
                    }}
                    className={`rounded-md px-2 py-1 text-[11px] ${on ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >{loc}</button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="label text-xs">⏰ 發文時間</label>
              <input type="time" className="input text-sm" value={editing.time}
                onChange={(e) => setEditing({ ...editing, time: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label text-xs">📆 星期幾發</label>
              <div className="flex gap-2 pt-1">
                {DAY_NAMES.map((n, i) => {
                  const on = editing.days.includes(i);
                  return (
                    <button key={i} type="button"
                      onClick={() => setEditing({
                        ...editing,
                        days: on ? editing.days.filter((d) => d !== i) : [...editing.days, i].sort(),
                      })}
                      className={`size-8 rounded-md text-xs font-medium ${on ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                    >{n}</button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-stone-700">🎯 觸發條件 (OR · 全空 = 每次都發)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <NumField label="降雨機率 ≥ %" value={editing.config.minPoP} placeholder="例:60"
                onChange={(v) => setEditing({ ...editing, config: { ...editing.config, minPoP: v } })}
              />
              <NumField label="最高溫 ≥ °C" value={editing.config.minMaxT} placeholder="例:30"
                onChange={(v) => setEditing({ ...editing, config: { ...editing.config, minMaxT: v } })}
              />
              <NumField label="最低溫 ≤ °C" value={editing.config.maxMinT} placeholder="例:15"
                onChange={(v) => setEditing({ ...editing, config: { ...editing.config, maxMinT: v } })}
              />
            </div>
          </div>

          <div>
            <label className="label text-xs">📝 產文提示詞</label>
            <textarea className="input min-h-[120px] text-xs leading-relaxed"
              value={editing.config.prompt}
              onChange={(e) => setEditing({ ...editing, config: { ...editing.config, prompt: e.target.value } })}
            />
            <div className="mt-1 text-[10px] text-stone-500">品牌人格 / 受眾 / 台灣用語會自動帶入</div>
          </div>

          {/* AI 配圖 */}
          <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 space-y-3">
            <label className="label text-xs flex items-center gap-2 !mb-0">
              <input type="checkbox" checked={editing.withImage}
                onChange={(e) => setEditing({ ...editing, withImage: e.target.checked })}
                className="size-3.5 rounded border-stone-300"
              /> 🖼️ 產 AI 配圖(從產品庫隨機挑一件搭配生圖)
            </label>

            {editing.withImage && (
              <div className="space-y-3 pl-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="label text-[10px]">👔 從哪批產品挑</label>
                    <select className="input text-xs"
                      value={editing.config.productPool}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, productPool: e.target.value } })}
                    >
                      <option value="female">女裝(gender=女性 或 無)</option>
                      <option value="male">男裝(gender=男性)</option>
                      <option value="all">全部(不限)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">👤 模特兒</label>
                    <select className="input text-xs"
                      value={editing.config.modelGender}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, modelGender: e.target.value } })}
                    >
                      <option value="female">女性</option>
                      <option value="male">男性</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">📐 圖片比例</label>
                    <select className="input text-xs"
                      value={editing.config.aspectRatio}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, aspectRatio: e.target.value } })}
                    >
                      <option value="4:5">4:5 (IG 直式)</option>
                      <option value="1:1">1:1 (方形)</option>
                      <option value="9:16">9:16 (限動)</option>
                      <option value="16:9">16:9 (橫式)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label !mb-0 text-[10px]">🎨 配圖 imagePrompt(英文,給 KIE)</label>
                    <button onClick={suggestImagePrompt} disabled={suggesting}
                      className="text-[10px] text-purple-700 hover:underline disabled:opacity-50"
                    >{suggesting ? '生成中…' : '✨ AI 建議一版'}</button>
                  </div>
                  <textarea className="input min-h-[90px] text-[11px] leading-relaxed font-mono"
                    placeholder="留空發文時 AI 會依當下天氣+挑到的產品自動寫。或按上面『AI 建議一版』先看範本再改。"
                    value={editing.config.imagePrompt}
                    onChange={(e) => setEditing({ ...editing, config: { ...editing.config, imagePrompt: e.target.value } })}
                  />
                  <div className="mt-1 text-[10px] text-stone-500">
                    💡 KIE 會用挑到的產品照當 image-to-image reference,所以生出來的模特兒會穿那件產品。
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 平台 */}
          <div>
            <div className="text-xs font-semibold text-stone-700 mb-1">📤 發到哪些平台</div>
            <div className="grid grid-cols-3 gap-2">
              <PlatBox label="🧵 Threads" enabled={canThreads} checked={editing.platforms.threads}
                onChange={(v) => setEditing({ ...editing, platforms: { ...editing.platforms, threads: v } })}
              />
              <PlatBox label="📷 IG" enabled={canIg && editing.withImage} checked={editing.platforms.instagram}
                onChange={(v) => setEditing({ ...editing, platforms: { ...editing.platforms, instagram: v } })}
                hint={!editing.withImage ? '需勾 AI 配圖' : !canIg ? '未連 IG' : ''}
              />
              <PlatBox label="👍 FB" enabled={canFb} checked={editing.platforms.facebook}
                onChange={(v) => setEditing({ ...editing, platforms: { ...editing.platforms, facebook: v } })}
              />
            </div>
          </div>

          <label className="label text-xs flex items-center gap-2">
            <input type="checkbox" checked={editing.enabled}
              onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              className="size-3.5 rounded border-stone-300"
            /> 啟用此排程
          </label>

          {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}

          {preview && <PreviewBox data={preview} />}

          <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-3">
            <button onClick={() => { setEditing(null); setPreview(null); }} className="text-xs text-stone-500 hover:underline">取消</button>
            <div className="flex gap-2">
              <button onClick={tryPreview} disabled={previewing || !weatherReady}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50 disabled:opacity-50">
                {previewing ? '生成中…' : '🔎 試發預覽(產文+挑產品,不生圖)'}
              </button>
              <button onClick={trySave} disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? '存中…' : '💾 儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card border-stone-100 bg-stone-50 text-xs text-stone-600 space-y-1">
        <div>💡 <strong>多縣市</strong>:任一縣市達觸發條件就發,文案會提到所有選中縣市的天氣。</div>
        <div>💡 <strong>AI 配圖</strong>:從產品庫過濾後隨機挑一件當「今天要搭配」的單品,KIE 用產品照當 reference 生模特兒穿搭圖。</div>
        <div>💡 <strong>Cron</strong>:由 cron-job.org 定時打 <code>/api/infuz/cron/tick</code> 觸發,錯過 6h 內會補發。</div>
      </div>
    </main>
  );
}

function JobRow({ job, onEdit, onDelete, onToggle }) {
  const days = job.days?.length === 7 ? '每天' : (job.days || []).map((d) => DAY_NAMES[d]).join('、');
  const platformLabels = Object.entries(job.platforms || {}).filter(([_, v]) => v).map(([k]) => k[0].toUpperCase() + k.slice(1)).join('/');
  const locs = job.config?.locations || (job.config?.location ? [job.config.location] : []);
  const conds = [];
  if (job.config?.minPoP) conds.push(`雨≥${job.config.minPoP}%`);
  if (job.config?.minMaxT) conds.push(`≥${job.config.minMaxT}°`);
  if (job.config?.maxMinT) conds.push(`≤${job.config.maxMinT}°`);
  const condText = conds.length ? conds.join(' ∪ ') : '每次都發';
  return (
    <div className={`rounded-lg border p-3 ${job.enabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className={`text-xs rounded-full px-2 py-0.5 ${job.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
              {job.enabled ? '● 啟用' : '○ 停用'}
            </button>
            <div className="font-medium text-sm text-stone-900 truncate">{job.name}</div>
            {job.withImage && <span className="text-[10px] bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">🖼️ 配圖</span>}
          </div>
          <div className="mt-1 text-[11px] text-stone-600">
            📍 {locs.length > 2 ? `${locs.slice(0, 2).join('/')} +${locs.length - 2}` : locs.join('/')} · ⏰ {job.time} · 📆 {days} · 📤 {platformLabels}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500">🎯 條件:{condText}</div>
          {job.lastResult && (
            <div className={`mt-1 text-[10px] rounded px-2 py-1 ${job.lastResult.ok ? 'bg-emerald-50 text-emerald-700' : job.lastResult.skipped ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              上次({new Date(job.lastResult.at).toLocaleString('zh-TW')}): {job.lastResult.ok ? '✓ 已發' : job.lastResult.skipped ? `- 跳過:${job.lastResult.reason}` : `✗ ${job.lastResult.error || '失敗'}`}
              {job.lastResult.pickedProduct && <span className="ml-1 text-purple-700">· 搭配 {job.lastResult.pickedProduct.name}</span>}
              {job.lastResult.imageError && <div className="text-red-600 mt-0.5">⚠ 生圖失敗:{job.lastResult.imageError}</div>}
              {job.lastResult.text && <div className="mt-0.5 text-stone-600 whitespace-pre-line line-clamp-2">{job.lastResult.text}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">編輯</button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:underline">刪除</button>
        </div>
      </div>
    </div>
  );
}

function PlatBox({ label, enabled, checked, onChange, hint }) {
  return (
    <label className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${!enabled ? 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed' : checked ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-stone-200 hover:bg-stone-50 cursor-pointer'}`}>
      <input type="checkbox" checked={checked && enabled} disabled={!enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-stone-300"
      />
      <div className="flex-1">
        <div className="text-stone-900">{label}</div>
        {hint && <div className="text-[9px] text-stone-500">{hint}</div>}
      </div>
    </label>
  );
}

function NumField({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label className="label text-[10px]">{label}</label>
      <input type="number" className="input text-sm" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PreviewBox({ data }) {
  if (!data.fire) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
        <div className="font-semibold text-amber-800">✋ 目前不會發文</div>
        <div className="mt-1 text-amber-700">{data.reason}</div>
        {data.snapshots?.length ? data.snapshots.map((s, i) => <SnapshotPreview key={i} snap={s} />) : (data.snapshot && <SnapshotPreview snap={data.snapshot} />)}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-emerald-800">✓ 會發文 - {data.reason}</div>
      {data.preview?.snapshots?.length ? data.preview.snapshots.map((s, i) => <SnapshotPreview key={i} snap={s} />) : (data.snapshot && <SnapshotPreview snap={data.snapshot} />)}
      {data.preview?.pickedProduct && (
        <div className="rounded bg-white p-2 flex items-center gap-2">
          <img src={data.preview.pickedProduct.image} alt="" className="size-14 rounded object-cover border" />
          <div className="text-[11px] text-stone-700">🎯 挑到搭配單品:<strong>{data.preview.pickedProduct.name}</strong></div>
        </div>
      )}
      {data.preview?.imageUrl && (
        <div className="rounded bg-white p-2">
          <div className="text-[10px] text-stone-500 mb-1">🖼️ 生成的配圖:</div>
          <img src={data.preview.imageUrl} alt="generated" className="max-w-full rounded border" />
        </div>
      )}
      {data.preview?.imageError && (
        <div className="rounded bg-red-50 p-2 text-[11px] text-red-700">⚠ 生圖失敗:{data.preview.imageError}</div>
      )}
      {data.preview?.imagePrompt && !data.preview?.imageUrl && (
        <div className="rounded bg-purple-50 border border-purple-200 p-2 text-[10px] text-purple-700">
          ℹ️ 預覽不真的生圖(避免 Vercel Hobby 60s 限制),實際到點 tick 時才會呼叫 KIE 生一張。想看真圖按下方「⚡ 立即觸發 tick」。
        </div>
      )}
      <div className="mt-2 rounded bg-white p-2">
        <div className="text-[10px] text-stone-500 mb-1">生成的貼文:</div>
        <pre className="whitespace-pre-wrap text-xs text-stone-900 font-sans">{data.preview?.text}</pre>
        {data.preview?.hashtags && <div className="mt-1 text-[10px] text-emerald-700">{data.preview.hashtags}</div>}
        {data.preview?.imagePrompt && (
          <details className="mt-2 border-t border-stone-100 pt-1">
            <summary className="text-[10px] text-stone-500 cursor-pointer">imagePrompt (英文)</summary>
            <pre className="mt-1 whitespace-pre-wrap text-[10px] text-stone-600">{data.preview.imagePrompt}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function SnapshotPreview({ snap }) {
  return (
    <div className="rounded bg-white/70 p-1.5">
      <div className="text-[10px] text-stone-500">📊 {snap.location}:</div>
      {(snap.periods || []).map((p, i) => (
        <div key={i} className="text-[10px] text-stone-700">
          {p.label}: {p.wx} · 雨{p.pop ?? '-'}% · {p.minT ?? '-'}–{p.maxT ?? '-'}°C
        </div>
      ))}
    </div>
  );
}
