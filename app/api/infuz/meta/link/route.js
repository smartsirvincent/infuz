// 貼 FB User Token → 換長效 → 檢查 scopes → 回粉專清單
import { NextResponse } from 'next/server';
import { checkScopes, exchangeLongLivedUserToken, listPages } from '@/lib/infuz-meta.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { userToken } = await req.json();
    if (!userToken || typeof userToken !== 'string') {
      return NextResponse.json({ error: '請貼 FB User Access Token' }, { status: 400 });
    }

    // 1. 檢查 token 的 scopes
    const scopes = await checkScopes(userToken).catch(() => null);

    // 2. 換長效 token
    let longLived;
    try {
      longLived = await exchangeLongLivedUserToken(userToken);
    } catch (e) {
      const msg = e.message || '';
      const isSecretErr = /client secret|invalid.*app|app.*credential|app.*invalid/i.test(msg);
      const hint = isSecretErr
        ? '·\n\n👉 修法: Vercel Env vars 的 FB_APP_SECRET 跟 App Dashboard → Settings → Basic 對不上。 重貼 App Secret (按 Show 才顯示原碼), 存檔後 redeploy 才會生效。'
        : '';
      return NextResponse.json({
        error: `Token 換長效失敗: ${msg}${hint}`,
        scopes,
      }, { status: 400 });
    }

    // 3. 列粉專
    let pages;
    try {
      pages = await listPages(longLived.token);
    } catch (e) {
      return NextResponse.json({
        error: `列粉專失敗: ${e.message}`,
        scopes,
        longLived,
      }, { status: 400 });
    }

    return NextResponse.json({
      scopes,
      longLived: {
        token: longLived.token,
        isLongLived: longLived.longLived,
        expiresIn: longLived.expiresIn,
      },
      pages,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
