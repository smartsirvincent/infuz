// 一次抓三平台的粉絲數 (Threads / IG / FB)
// GET /api/infuz/insights/followers
import { NextResponse } from 'next/server';
import { loadDb } from '@/lib/infuz-db.js';
import { getFacebookFollowers, getInstagramFollowers } from '@/lib/infuz-meta.js';
import { getThreadsFollowers } from '@/lib/infuz-threads.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const db = await loadDb('connections');
    const conn = (db.items || []).find((x) => x.id === 'main') || {};
    const out = { threads: null, instagram: null, facebook: null, errors: {} };

    // 平行抓 3 個
    await Promise.all([
      (async () => {
        if (!conn.threads?.accessToken) { out.errors.threads = '未連接 Threads'; return; }
        try { out.threads = await getThreadsFollowers(conn.threads); }
        catch (e) { out.errors.threads = e.message; }
      })(),
      (async () => {
        if (!conn.facebook?.igUserId || !conn.facebook?.pageAccessToken) { out.errors.instagram = '未連接 IG 商業帳號'; return; }
        try { out.instagram = await getInstagramFollowers(conn.facebook); }
        catch (e) { out.errors.instagram = e.message; }
      })(),
      (async () => {
        if (!conn.facebook?.pageId || !conn.facebook?.pageAccessToken) { out.errors.facebook = '未連接 FB 粉專'; return; }
        try { out.facebook = await getFacebookFollowers(conn.facebook); }
        catch (e) { out.errors.facebook = e.message; }
      })(),
    ]);

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
