'use client';

// 氣候即時預約發文
// 到指定時間 → 抓中央氣象署當下預報 → 依觸發條件判斷是否要發 → 產文 → 發布
// 排程列表在下方,可新增/編輯/刪除/暫停

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_PROMPT = `依當下的氣溫與降雨機率,給 25-40 歲的通勤女性一則穿搭建議。
不要一開頭就講產品,先從天氣/場景切入,最後自然帶到我們的褲款(強調顯瘦/舒適/版型),
或直接寫生活觀察,不推銷。長度 100-180 字。`;

export default function WeatherPostPage() {
  const [meta, setMeta] = useState(null); // { items, modules, weather }
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 正在編輯的 job (null = 新增)
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
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
        location: '臺北市',
        minPoP: '',
        minMaxT: '',
        maxMinT: '',
        prompt: DEFAULT_PROMPT,
        imagePrompt: '',
      },
    });
    setPreview(null);
    setError('');
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
          到指定時間 → 抓中央氣象署預報 → 依觸發條件產出當下應景的貼文 → 直發 Threads / IG / FB。
        </p>
        {!weatherReady && (
          <div className="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-800">
            ⚠ CWA_API_KEY 環境變數尚未設定 — 到 Vercel 或 <code>.env</code> 加上這顆 key(<a className="underline" href="https://opendata.cwa.gov.tw/user/authkey" target="_blank" rel="noreferrer">免費申請</a>) 才能抓氣象資料。
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
            onEdit={() => { setEditing(job); setPreview(null); setError(''); }}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label text-xs">排程名稱</label>
              <input className="input text-sm" value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">縣市</label>
              <select className="input text-sm" value={editing.config.location}
                onChange={(e) => setEditing({ ...editing, config: { ...editing.config, location: e.target.value } })}
              >
                {(meta?.weather?.locations || []).map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="label text-xs">發文時間</label>
              <input type="time" className="input text-sm" value={editing.time}
                onChange={(e) => setEditing({ ...editing, time: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label text-xs">星期幾發</label>
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
            <div className="text-[11px] font-semibold text-stone-700">🎯 觸發條件 (全空 = 每次都發)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="label text-[10px]">降雨機率 ≥ %</label>
                <input type="number" className="input text-sm" placeholder="例:60"
                  value={editing.config.minPoP}
                  onChange={(e) => setEditing({ ...editing, config: { ...editing.config, minPoP: e.target.value } })}
                />
              </div>
              <div>
                <label className="label text-[10px]">最高溫 ≥ °C</label>
                <input type="number" className="input text-sm" placeholder="例:30"
                  value={editing.config.minMaxT}
                  onChange={(e) => setEditing({ ...editing, config: { ...editing.config, minMaxT: e.target.value } })}
                />
              </div>
              <div>
                <label className="label text-[10px]">最低溫 ≤ °C</label>
                <input type="number" className="input text-sm" placeholder="例:15"
                  value={editing.config.maxMinT}
                  onChange={(e) => setEditing({ ...editing, config: { ...editing.config, maxMinT: e.target.value } })}
                />
              </div>
            </div>
            <div className="text-[10px] text-stone-500">滿足任一條件即觸發 (OR)。例如降雨 ≥60% ∪ 最低溫 ≤15°C</div>
          </div>

          <div>
            <label className="label text-xs">產文提示詞</label>
            <textarea className="input min-h-[120px] text-xs leading-relaxed"
              value={editing.config.prompt}
              onChange={(e) => setEditing({ ...editing, config: { ...editing.config, prompt: e.target.value } })}
            />
            <div className="mt-1 text-[10px] text-stone-500">品牌人格 / 受眾 / 台灣用語會自動帶入,這裡只寫這個排程特有的方向</div>
          </div>

          <div>
            <label className="label text-xs flex items-center gap-2">
              <input type="checkbox" checked={editing.withImage}
                onChange={(e) => setEditing({ ...editing, withImage: e.target.checked })}
                className="size-3.5 rounded border-stone-300"
              /> 產 AI 配圖 (實驗性,MVP 未實裝,先不勾)
            </label>
            {editing.withImage && (
              <textarea className="input min-h-[80px] text-xs leading-relaxed mt-1"
                placeholder="配圖英文 prompt (KIE)。留空用預設"
                value={editing.config.imagePrompt}
                onChange={(e) => setEditing({ ...editing, config: { ...editing.config, imagePrompt: e.target.value } })}
              />
            )}
          </div>

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

          {/* 試發預覽 */}
          {preview && <PreviewBox data={preview} />}

          <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-3">
            <button onClick={() => { setEditing(null); setPreview(null); }} className="text-xs text-stone-500 hover:underline">取消</button>
            <div className="flex gap-2">
              <button onClick={tryPreview} disabled={previewing || !weatherReady}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50 disabled:opacity-50">
                {previewing ? '生成中…' : '🔎 試發預覽(不真發)'}
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
        <div>💡 <strong>執行時機</strong>:Vercel Cron 每 5 分鐘打一次 <code>/api/infuz/cron/tick</code>,到點才會執行。</div>
        <div>💡 <strong>錯過補發</strong>:同時段內 6 小時內錯過會補發,超過就跳過(避免發舊資料)。</div>
        <div>💡 <strong>觸發條件</strong>:任何條件滿足即觸發,例如「降雨 ≥60%」用在雨天穿搭提醒、「最低溫 ≤15」用在寒流保暖建議。</div>
      </div>
    </main>
  );
}

function JobRow({ job, onEdit, onDelete, onToggle }) {
  const days = job.days?.length === 7 ? '每天' : (job.days || []).map((d) => DAY_NAMES[d]).join('、');
  const platformLabels = Object.entries(job.platforms || {}).filter(([_, v]) => v).map(([k]) => k[0].toUpperCase() + k.slice(1)).join('/');
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
          </div>
          <div className="mt-1 text-[11px] text-stone-600">
            📍 {job.config?.location} · ⏰ {job.time} · 📆 {days} · 📤 {platformLabels}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500">🎯 條件:{condText}</div>
          {job.lastResult && (
            <div className={`mt-1 text-[10px] rounded px-2 py-1 ${job.lastResult.ok ? 'bg-emerald-50 text-emerald-700' : job.lastResult.skipped ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              上次({new Date(job.lastResult.at).toLocaleString('zh-TW')}): {job.lastResult.ok ? '✓ 已發' : job.lastResult.skipped ? `- 跳過:${job.lastResult.reason}` : `✗ ${job.lastResult.error || '失敗'}`}
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

function PreviewBox({ data }) {
  if (!data.fire) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
        <div className="font-semibold text-amber-800">✋ 目前不會發文</div>
        <div className="mt-1 text-amber-700">{data.reason}</div>
        {data.snapshot && <SnapshotPreview snap={data.snapshot} />}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-emerald-800">✓ 會發文 - {data.reason}</div>
      {data.snapshot && <SnapshotPreview snap={data.snapshot} />}
      <div className="mt-2 rounded bg-white p-2">
        <div className="text-[10px] text-stone-500 mb-1">生成的貼文:</div>
        <pre className="whitespace-pre-wrap text-xs text-stone-900 font-sans">{data.preview?.text}</pre>
        {data.preview?.hashtags && <div className="mt-1 text-[10px] text-emerald-700">{data.preview.hashtags}</div>}
        {data.preview?.imagePrompt && (
          <details className="mt-2 border-t border-stone-100 pt-1">
            <summary className="text-[10px] text-stone-500 cursor-pointer">配圖 prompt (英文)</summary>
            <pre className="mt-1 whitespace-pre-wrap text-[10px] text-stone-600">{data.preview.imagePrompt}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function SnapshotPreview({ snap }) {
  return (
    <div className="mt-1 rounded bg-white/70 p-1.5">
      <div className="text-[10px] text-stone-500">📊 抓到的氣象:</div>
      {(snap.periods || []).map((p, i) => (
        <div key={i} className="text-[10px] text-stone-700">
          {p.label}: {p.wx} · 雨{p.pop ?? '-'}% · {p.minT ?? '-'}–{p.maxT ?? '-'}°C
        </div>
      ))}
    </div>
  );
}
