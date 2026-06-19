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
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);

  async function refreshUsage() {
    setUsageLoading(true);
    try {
      const r = await fetch('/api/infuz/usage', { cache: 'no-store' });
      const d = await r.json();
      const main = (d.items || []).find((x) => x.id === 'main') || { anthropic: {}, kie: {}, by_endpoint: {} };
      setUsage(main);
    } catch (_) {} finally { setUsageLoading(false); }
  }

  async function resetUsage() {
    if (!confirm('確定把所有累計用量歸零?(費率不會變)')) return;
    try {
      const r = await fetch('/api/infuz/usage?id=main', { method: 'DELETE' });
      if (r.ok) await refreshUsage();
    } catch (_) {}
  }

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

  useEffect(() => { refresh(); refreshUsage(); }, []);

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

      <UsageCard usage={usage} loading={usageLoading} onReset={resetUsage} onRefresh={refreshUsage} />

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
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1 text-sm"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={settings.googleSheetUrl}
              onChange={(e) => patch('googleSheetUrl', e.target.value)}
            />
            <a
              href={settings.googleSheetUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { if (!settings.googleSheetUrl) e.preventDefault(); }}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${settings.googleSheetUrl ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}
            >
              🔗 開啟 Sheet
            </a>
          </div>
          <p className="mt-1 text-[10px] text-stone-500">填入後右邊按鈕直接開啟,系統只記錄,不會直接寫 (寫入靠 Make webhook → Sheet)。</p>
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

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>
    </main>
  );
}

// ============== 用量 / 費用卡片 ==============
const PRICING = {
  anthropic: {
    'claude-sonnet-4-5': { in: 3.0, out: 15.0 },
    'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
    'claude-sonnet': { in: 3.0, out: 15.0 },
    'claude-haiku-4-5': { in: 0.80, out: 4.0 },
    'claude-haiku': { in: 0.80, out: 4.0 },
    'claude-opus-4-7': { in: 15.0, out: 75.0 },
    'claude-opus': { in: 15.0, out: 75.0 },
    default: { in: 3.0, out: 15.0 },
  },
  kie: {
    'gpt-image-2': 0.045,
    'gpt-image-2-image-to-image': 0.045,
    default: 0.045,
  },
};

function priceAnthropic(model) {
  return PRICING.anthropic[model] || PRICING.anthropic.default;
}
function priceKie(model) {
  return PRICING.kie[model] || PRICING.kie.default;
}
function $(n) {
  return '$' + (Number(n) || 0).toFixed(4);
}
function num(n) {
  return (Number(n) || 0).toLocaleString();
}

function UsageCard({ usage, loading, onReset, onRefresh }) {
  if (loading) {
    return <div className="card text-center text-stone-500">載入用量中…</div>;
  }
  if (!usage) return null;

  let total = 0;
  const anthropicRows = Object.entries(usage.anthropic || {}).map(([model, m]) => {
    const p = priceAnthropic(model);
    const inCost = ((m.input_tokens || 0) / 1_000_000) * p.in;
    const outCost = ((m.output_tokens || 0) / 1_000_000) * p.out;
    const cost = inCost + outCost;
    total += cost;
    return { model, p, m, inCost, outCost, cost };
  });
  const kieRows = Object.entries(usage.kie || {}).map(([model, m]) => {
    const perImage = priceKie(model);
    const cost = (m.count || 0) * perImage;
    total += cost;
    return { model, m, perImage, cost };
  });

  const byEndpoint = Object.entries(usage.by_endpoint || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="card space-y-4 border-emerald-200 bg-emerald-50/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">💰 已花費 / 用量</h2>
          <p className="mt-1 text-[11px] text-stone-600">
            {usage.lastUpdated
              ? <>最後更新: {new Date(usage.lastUpdated).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</>
              : '尚無使用紀錄'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-700">${total.toFixed(2)}</div>
          <div className="text-[10px] text-stone-500">USD 估算 (累計)</div>
        </div>
      </div>

      {/* Anthropic */}
      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-stone-800">🤖 Anthropic (Claude)</h3>
        {anthropicRows.length === 0 ? (
          <p className="text-[11px] text-stone-500">尚無 Claude 呼叫</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-stone-500">
                <tr>
                  <th className="text-left">模型</th>
                  <th className="text-right">呼叫</th>
                  <th className="text-right">Input tok</th>
                  <th className="text-right">Output tok</th>
                  <th className="text-right">費率 in/out</th>
                  <th className="text-right">小計</th>
                </tr>
              </thead>
              <tbody>
                {anthropicRows.map((r) => (
                  <tr key={r.model} className="border-t border-stone-200">
                    <td className="py-1 font-mono">{r.model}</td>
                    <td className="text-right">{r.m.calls || 0}</td>
                    <td className="text-right">{num(r.m.input_tokens)}</td>
                    <td className="text-right">{num(r.m.output_tokens)}</td>
                    <td className="text-right text-stone-500">${r.p.in}/${r.p.out} per M</td>
                    <td className="text-right font-semibold">{$(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KIE */}
      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-stone-800">🎨 KIE.ai (圖片生成)</h3>
        {kieRows.length === 0 ? (
          <p className="text-[11px] text-stone-500">尚無 KIE 生圖</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-stone-500">
                <tr>
                  <th className="text-left">模型</th>
                  <th className="text-right">張數</th>
                  <th className="text-right">總耗時</th>
                  <th className="text-right">費率 / 張</th>
                  <th className="text-right">小計</th>
                </tr>
              </thead>
              <tbody>
                {kieRows.map((r) => (
                  <tr key={r.model} className="border-t border-stone-200">
                    <td className="py-1 font-mono">{r.model}</td>
                    <td className="text-right">{num(r.m.count)}</td>
                    <td className="text-right text-stone-500">{Math.round((r.m.ms_total || 0) / 1000)}s</td>
                    <td className="text-right text-stone-500">${r.perImage}</td>
                    <td className="text-right font-semibold">{$(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By endpoint */}
      {byEndpoint.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-stone-500 hover:text-stone-800">📊 各 endpoint 呼叫次數 ({byEndpoint.length})</summary>
          <ul className="mt-2 space-y-1">
            {byEndpoint.map(([ep, n]) => (
              <li key={ep} className="flex justify-between border-t border-stone-100 py-1">
                <span className="font-mono text-stone-700">{ep}</span>
                <span className="text-stone-500">{n} 次</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-emerald-200 pt-3 text-[10px] text-stone-500">
        <p>⚠ 費率為估算 (Anthropic 公開定價 + KIE 估 $0.045/張)。實際以兩個服務 dashboard 為準。</p>
        <p className="mt-1">📝 含本系統所有 AI 呼叫:文字推薦、生圖、視覺分析、文案建議、模特生成等。</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onRefresh} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs hover:bg-stone-50">↻ 重新整理</button>
        <button type="button" onClick={onReset} className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">🔄 歸零</button>
      </div>
    </div>
  );
}
