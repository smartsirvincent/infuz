'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const EMPTY = {
  id: 'main',
  scheduleWebhook: '',
  postWebhook: '',
  googleSheetUrl: '',
  defaultPlatforms: { fb: false, ig: true, threads: true },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [exists, setExists] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/infuz/settings', { cache: 'no-store' });
      const data = await res.json();
      const main = (data.items || []).find((x) => x.id === 'main');
      if (main) {
        setSettings({ ...EMPTY, ...main });
        setExists(true);
      } else {
        setExists(false);
      }
    } catch (_) {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleSave() {
    setSaving(true);
    setStatus('');
    try {
      const method = exists ? 'PATCH' : 'POST';
      const url = exists ? '/api/infuz/settings?id=main' : '/api/infuz/settings';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus('✓ 已儲存');
      setExists(true);
      setTimeout(() => setStatus(''), 2500);
    } catch (e) {
      setStatus('⚠ 儲存失敗: ' + e.message);
    } finally { setSaving(false); }
  }

  async function handleTest(which) {
    const url = which === 'schedule' ? settings.scheduleWebhook : settings.postWebhook;
    if (!url) { alert('還沒填 URL'); return; }
    setStatus('測試中…');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          test: true,
          source: 'Infuz AI 系統 - settings test',
          when: new Date().toISOString(),
        }),
      });
      const text = await res.text();
      setStatus(`${which} webhook → HTTP ${res.status}: ${text.slice(0, 100)}`);
    } catch (e) {
      setStatus(`${which} webhook 失敗: ${e.message}`);
    }
  }

  function patch(k, v) { setSettings({ ...settings, [k]: v }); }

  if (loading) {
    return <main><div className="card text-center text-stone-500">載入中…</div></main>;
  }

  return (
    <main className="space-y-5">
      <div className="card border-stone-300 bg-stone-50">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">⚙️ 系統設定</h1>
        <p className="mt-1 text-sm text-stone-600">
          設定 webhook + Google Sheet 連結。在 /material 生圖後或 <Link href="/assets" className="text-emerald-700 underline">/assets</Link> 可一鍵發送。
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">🔗 Webhook</h2>

        <div>
          <label className="label text-xs">📅 排程 Webhook URL (傳到排程)</label>
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1 text-sm font-mono"
              placeholder="https://hook.eu2.make.com/..."
              value={settings.scheduleWebhook}
              onChange={(e) => patch('scheduleWebhook', e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleTest('schedule')}
              disabled={!settings.scheduleWebhook}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs hover:bg-stone-50 disabled:opacity-50"
            >
              🔧 測試
            </button>
          </div>
          <p className="mt-1 text-[10px] text-stone-500">用戶點「傳到排程」時送這個 URL。Make/Zapier scenario 接收後寫進 Google Sheet 等。</p>
        </div>

        <div>
          <label className="label text-xs">🚀 發文 Webhook URL (直接發文)</label>
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1 text-sm font-mono"
              placeholder="https://hook.eu2.make.com/..."
              value={settings.postWebhook}
              onChange={(e) => patch('postWebhook', e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleTest('post')}
              disabled={!settings.postWebhook}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs hover:bg-stone-50 disabled:opacity-50"
            >
              🔧 測試
            </button>
          </div>
          <p className="mt-1 text-[10px] text-stone-500">用戶點「直接發文」時送這個 URL。Make scenario 對接 Threads/IG/FB API 立即發。</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">📊 Google Sheet</h2>
        <div>
          <label className="label text-xs">排程 / 紀錄表 URL</label>
          <input
            type="url"
            className="input text-sm"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={settings.googleSheetUrl}
            onChange={(e) => patch('googleSheetUrl', e.target.value)}
          />
          <p className="mt-1 text-[10px] text-stone-500">給用戶查閱用,系統只記錄,不會直接寫 (寫入靠 Make webhook → Sheet)。</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">🎯 預設發佈平台</h2>
        <p className="text-[11px] text-stone-500">生圖完成後 checkbox 的預設值,可一張一張改。</p>
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'fb', label: 'FB' },
            { key: 'ig', label: 'IG' },
            { key: 'threads', label: 'Threads' },
          ].map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={!!(settings.defaultPlatforms || {})[p.key]}
                onChange={(e) => patch('defaultPlatforms', { ...(settings.defaultPlatforms || {}), [p.key]: e.target.checked })}
                className="size-4 rounded border-stone-300 text-emerald-600"
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">📦 Webhook Payload 結構（傳出去的內容）</h2>
        <pre className="overflow-auto rounded-lg bg-stone-900 p-3 text-[10px] text-stone-100">
{`{
  "貼文編號": 23,
  "AI圖片網址": "https://res.cloudinary.com/.../abc.png",
  "AI文案": "今天的小確幸...",
  "發佈FB": false,
  "發佈IG": true,
  "發佈Threads": true,
  // metadata (Make 可用來 filter / route)
  "assetId": "MAT-...",
  "mode": "single",
  "displayMode": "",
  "productNames": "Infuz 方袋錐形彎刀褲",
  "productSKUs": "JW28039",
  "purchaseURLs": "https://goingto.tw/4VVv5",
  "modelName": "小紅",
  "scenarioName": "白底商品照",
  "slogan": "",
  "promoInfo": "",
  "action": "schedule",
  "dispatchedAt": "2026-06-17T..."
}`}
        </pre>
      </div>

      {status && (
        <div className={`card text-sm ${status.startsWith('⚠') ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {status}
        </div>
      )}

      <div className="flex items-center justify-between">
        {settings.googleSheetUrl && (
          <a
            href={settings.googleSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-500 hover:underline"
          >
            開啟 Google Sheet →
          </a>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-50 ml-auto"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>
    </main>
  );
}
