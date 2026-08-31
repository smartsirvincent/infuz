// Diagnostic · 檢查 Vercel FB_APP_ID + FB_APP_SECRET 是否正確載入 + 是否匹配
// GET /api/infuz/meta/debug
// 回傳:
//   - env: { hasAppId, hasAppSecret, appIdLen, appSecretLen, appIdPreview }
//   - appTokenTest: 用 client_credentials grant 換 app access token, 成功 = 配對正確
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET() {
  const appId = process.env.FB_APP_ID || '';
  const appSecret = process.env.FB_APP_SECRET || '';

  const env = {
    hasAppId: !!appId,
    hasAppSecret: !!appSecret,
    appIdLen: appId.length,
    appSecretLen: appSecret.length,
    appIdPreview: appId ? `${appId.slice(0, 4)}...${appId.slice(-4)}` : '(missing)',
    // 檢查是否有前後空白/換行 (最常見坑)
    appIdHasWhitespace: appId !== appId.trim(),
    appSecretHasWhitespace: appSecret !== appSecret.trim(),
  };

  let appTokenTest = { ok: false, error: 'not tested' };

  if (appId && appSecret) {
    try {
      // client_credentials grant → 換 app access token
      // 這個 endpoint 只驗 App ID + Secret 是否匹配, 不需要 user token
      const url = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${encodeURIComponent(appId.trim())}&client_secret=${encodeURIComponent(appSecret.trim())}&grant_type=client_credentials`;
      const r = await fetch(url);
      const d = await r.json();
      if (r.ok && d.access_token) {
        appTokenTest = { ok: true, message: 'App ID + Secret 匹配! Meta 認可這組 credential。 現在 Token 換長效 應該會成功。', tokenPreview: `${d.access_token.slice(0, 15)}...` };
      } else {
        appTokenTest = { ok: false, error: d.error?.message || `HTTP ${r.status}`, code: d.error?.code, raw: JSON.stringify(d).slice(0, 300) };
      }
    } catch (e) {
      appTokenTest = { ok: false, error: e.message };
    }
  }

  return NextResponse.json({ env, appTokenTest }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
