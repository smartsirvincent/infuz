'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SocialAccountsPage() {
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/infuz/connections', { cache: 'no-store' });
      const d = await r.json();
      const main = (d.items || []).find((x) => x.id === 'main') || null;
      setConn(main);
    } catch (_) {} finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <main className="space-y-5">
      <div className="card border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">🔑 社群帳號連接</h1>
            <p className="mt-1 text-sm text-stone-600">連完就能去 <Link className="underline text-emerald-700" href="/social/publish">🚀 多平台直發</Link> 一鍵發到 Threads / IG / FB 粉專。</p>
          </div>
          <Link href="/social" className="text-xs text-stone-500 hover:underline">← 回社群發文</Link>
        </div>
      </div>

      {loading ? (
        <div className="card text-center text-stone-500">載入中…</div>
      ) : (
        <>
          <FacebookCard conn={conn} onSaved={refresh} />
          <ThreadsCard conn={conn} onSaved={refresh} />
          <SetupGuide />
        </>
      )}
    </main>
  );
}

// ============== FB / IG (共用 Graph API + FB Page Token) ==============

function FacebookCard({ conn, onSaved }) {
  const [userToken, setUserToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scopes, setScopes] = useState(null);
  const [pages, setPages] = useState(null);
  const [longToken, setLongToken] = useState('');
  const current = conn?.facebook;

  async function handleLink() {
    setError('');
    setScopes(null);
    setPages(null);
    setBusy(true);
    try {
      const r = await fetch('/api/infuz/meta/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userToken: userToken.trim() }),
      });
      const d = await r.json();
      setScopes(d.scopes || null);
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPages(d.pages || []);
      setLongToken(d.longLived?.token || '');
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  async function handleSelectPage(p) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/infuz/meta/save-page', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: p.pageId,
          pageName: p.pageName,
          pageAccessToken: p.pageAccessToken,
          igUserId: p.igUserId,
          igUsername: p.igUsername,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPages(null);
      setUserToken('');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">👍</span>
        <h2 className="text-lg font-semibold text-stone-900">Facebook 粉專 + Instagram</h2>
        {current?.pageId && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">已連接</span>
        )}
      </div>

      {current?.pageId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div><strong>粉專:</strong> {current.pageName} ({current.pageId})</div>
          {current.igUserId ? (
            <div className="mt-0.5"><strong>IG:</strong> @{current.igUsername} ({current.igUserId})</div>
          ) : (
            <div className="mt-0.5 text-amber-700">⚠ 沒有連結 IG 商業帳號 — IG 發文會失敗</div>
          )}
          <div className="mt-1 text-[10px] text-stone-500">存於 {current.savedAt ? new Date(current.savedAt).toLocaleString('zh-TW') : '?'}</div>
        </div>
      )}

      <div>
        <label className="label text-xs">FB User Access Token</label>
        <textarea
          className="input min-h-[80px] text-xs font-mono"
          placeholder="EAAxxxxx... (從 Graph API Explorer / 自家 App 生成)"
          value={userToken}
          onChange={(e) => setUserToken(e.target.value)}
        />
        <p className="mt-1 text-[10px] text-stone-500">
          從 <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="underline">Graph API Explorer</a> 或自家 App 拿到一個 short-lived token 貼進來,系統會自動換成長效
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleLink}
          disabled={busy || !userToken.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '處理中…' : '🔗 檢查 + 列出粉專'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}

      {scopes && (
        <div className={`rounded-lg border p-2 text-[11px] ${scopes.missing?.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <div className="font-medium">Token 權限檢查</div>
          <div>Granted: {scopes.granted?.slice(0, 8).join(', ') || '(none)'}</div>
          {scopes.missing?.length > 0 && (
            <div className="mt-1">
              <strong>⚠ 缺:</strong> {scopes.missingLabels?.join(' / ')}
            </div>
          )}
          {scopes.expired && <div className="text-red-700">⚠ Token 已過期</div>}
          {scopes.appId && <div className="mt-0.5 text-stone-500">App ID: {scopes.appId}</div>}
        </div>
      )}

      {pages && pages.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-stone-700">選一個粉專 (存好長效 token):</div>
          <div className="space-y-1.5">
            {pages.map((p) => (
              <button
                key={p.pageId}
                type="button"
                onClick={() => handleSelectPage(p)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
              >
                <div>
                  <div className="font-medium text-stone-900">{p.pageName}</div>
                  <div className="text-[10px] text-stone-500">
                    Page {p.pageId}
                    {p.igUsername ? ` · IG @${p.igUsername}` : ' · 無 IG'}
                  </div>
                </div>
                <span className="text-xs text-emerald-700">選這個 →</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {pages && pages.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          ⚠ 這個 token 沒管理任何粉專 (或 pages_show_list 權限沒開)
        </div>
      )}
    </div>
  );
}

// ============== Threads (獨立 Graph API) ==============

function ThreadsCard({ conn, onSaved }) {
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = conn?.threads;

  async function handleSave() {
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/infuz/threads/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setAccessToken('');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🧵</span>
        <h2 className="text-lg font-semibold text-stone-900">Threads (獨立帳號)</h2>
        {current?.userId && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">已連接</span>
        )}
      </div>

      {current?.userId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div><strong>帳號:</strong> @{current.username} ({current.userId})</div>
          <div className="mt-1 text-[10px] text-stone-500">存於 {current.savedAt ? new Date(current.savedAt).toLocaleString('zh-TW') : '?'}</div>
        </div>
      )}

      <div>
        <label className="label text-xs">Threads Access Token</label>
        <textarea
          className="input min-h-[80px] text-xs font-mono"
          placeholder="THQxxxx... (從 Threads Graph API 產)"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
        <p className="mt-1 text-[10px] text-stone-500">
          去 <a href="https://developers.facebook.com/docs/threads/get-started" target="_blank" rel="noreferrer" className="underline">Threads Graph API</a> 用 App 產一個 long-lived token 貼進來
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !accessToken.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? '驗證中…' : '💾 驗證 + 儲存'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">⚠ {error}</div>}
    </div>
  );
}

// ============== Setup 指南 ==============

function SetupGuide() {
  return (
    <details className="card border-stone-200 text-xs">
      <summary className="cursor-pointer text-sm font-medium text-stone-700">📖 新申請 FB App 的完整步驟</summary>
      <div className="mt-3 space-y-2 text-stone-600">
        <div>
          <div className="font-medium text-stone-800">1. 到 Meta for Developers 建 App</div>
          <div className="pl-3">→ 開 <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline text-emerald-700">developers.facebook.com/apps</a> → Create App → 「Business」型別 → 名稱例:「Infuz 社群系統」</div>
        </div>
        <div>
          <div className="font-medium text-stone-800">2. 加產品 (2 個)</div>
          <ul className="pl-3 space-y-0.5">
            <li>• <strong>Facebook Login for Business</strong></li>
            <li>• <strong>Instagram → Instagram API with Facebook Login</strong> (走這條,不是舊的 Basic Display)</li>
          </ul>
        </div>
        <div>
          <div className="font-medium text-stone-800">3. 拿 App ID + App Secret</div>
          <div className="pl-3">左邊 App settings → Basic,把 App ID + App Secret 存進 Vercel 環境變數:</div>
          <pre className="mt-1 rounded bg-stone-900 p-2 text-[10px] text-stone-100">FB_APP_ID=xxx
FB_APP_SECRET=xxx
GRAPH_API_VERSION=v25.0</pre>
        </div>
        <div>
          <div className="font-medium text-stone-800">4. 加測試人員 (要能存取 IG / FB 粉專)</div>
          <div className="pl-3">Roles → Roles → Add Testers → 加自己的 FB 帳號 → 對方要接受邀請</div>
        </div>
        <div>
          <div className="font-medium text-stone-800">5. 產 User Token</div>
          <div className="pl-3">
            開 <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="underline text-emerald-700">Graph API Explorer</a> → 選你的 App → Get User Access Token → 勾:
          </div>
          <ul className="pl-6 mt-0.5 space-y-0.5 text-[10px]">
            <li>• pages_show_list, pages_manage_posts, pages_read_engagement</li>
            <li>• instagram_basic, instagram_content_publish, instagram_manage_insights</li>
            <li>• threads_basic, threads_content_publish (Threads 產品要另外加)</li>
          </ul>
          <div className="pl-3 mt-0.5">Generate → 貼到上方 FB User Token 欄</div>
        </div>
        <div>
          <div className="font-medium text-stone-800">6. Threads Token (獨立)</div>
          <div className="pl-3">
            App 內加 <strong>Threads</strong> 產品 → 用 threads_basic + threads_content_publish 走 <a href="https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions" target="_blank" rel="noreferrer" className="underline text-emerald-700">Threads 官方文件</a> 產長效 token → 貼到下方 Threads 欄
          </div>
        </div>
      </div>
    </details>
  );
}
