// 一稿三發 — 直接串 Threads/IG/FB API,不用 webhook
import { NextResponse } from 'next/server';
import { loadDb, updateItem } from '@/lib/infuz-db.js';
import { PLATFORMS } from '@/lib/infuz-platforms.js';
import { adapt, preflight } from '@/lib/infuz-adapt.js';
import { publishInstagram, publishFacebook } from '@/lib/infuz-meta.js';
import { publishThread } from '@/lib/infuz-threads.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      assetId,               // 選填,若給則發完更新 asset.dispatched.direct + 沒 imageUrl 時自動讀
      text,                  // 文案 (必填)
      hashtags,              // IG 用,空白/逗號分隔
    } = body;
    let imageUrl = body.imageUrl;

    // Platform key alias: {fb, ig, threads} → {facebook, instagram, threads}
    const rawPlatforms = body.platforms || {};
    const platforms = {
      threads: !!(rawPlatforms.threads),
      instagram: !!(rawPlatforms.instagram || rawPlatforms.ig),
      facebook: !!(rawPlatforms.facebook || rawPlatforms.fb),
    };

    // 若給 assetId 但沒給 imageUrl, 從 asset 讀
    if (assetId && !imageUrl) {
      try {
        const assetsDb = await loadDb('assets');
        const asset = (assetsDb.items || []).find((a) => a.id === assetId);
        if (asset?.imageUrl) imageUrl = asset.imageUrl;
      } catch (_) { /* 讀不到就繼續, 讓下面 preflight 擋 */ }
    }

    if (!text?.trim() && !imageUrl) {
      return NextResponse.json({ error: '文字或圖片至少要一個' }, { status: 400 });
    }

    const wanted = Object.keys(PLATFORMS).filter((p) => platforms[p]);
    if (wanted.length === 0) {
      return NextResponse.json({ error: '至少要選 1 個平台' }, { status: 400 });
    }

    // Load connections
    const db = await loadDb('connections');
    const conn = (db.items || []).find((x) => x.id === 'main') || {};

    // Preflight 各平台
    const preflightErrors = {};
    for (const p of wanted) {
      const err = preflight(text, imageUrl, p);
      if (err) preflightErrors[p] = err;
    }
    // 缺對應 connection 的
    if (wanted.includes('threads') && !conn.threads?.accessToken) {
      preflightErrors.threads = '尚未連接 Threads 帳號 (去 /social/accounts)';
    }
    if ((wanted.includes('instagram') || wanted.includes('facebook')) && !conn.facebook?.pageAccessToken) {
      if (wanted.includes('instagram')) preflightErrors.instagram = '尚未連接 FB 粉專 (IG 走 FB Graph API)';
      if (wanted.includes('facebook')) preflightErrors.facebook = '尚未連接 FB 粉專';
    }
    if (wanted.includes('instagram') && conn.facebook?.pageAccessToken && !conn.facebook?.igUserId) {
      preflightErrors.instagram = '這個 FB 粉專沒連結 IG 商業帳號';
    }

    // 對 wanted 中被 preflight 擋掉的移除
    const proceed = wanted.filter((p) => !preflightErrors[p]);
    if (proceed.length === 0) {
      return NextResponse.json({
        error: '所有平台都無法發文',
        preflightErrors,
      }, { status: 400 });
    }

    // 並行發送 (Threads 內部有分段, IG 有 container 等待, FB 快)
    const results = {};
    await Promise.all(proceed.map(async (platformId) => {
      try {
        const t0 = Date.now();
        const adapted = adapt(text, platformId, { hashtags });
        if (platformId === 'threads') {
          const r = await publishThread(conn.threads, adapted.chunks, imageUrl || null);
          results.threads = { ok: true, ids: r.ids, permalink: r.firstPermalink, ms: Date.now() - t0 };
        } else if (platformId === 'instagram') {
          const r = await publishInstagram(conn.facebook, { caption: adapted.caption, imageUrl });
          results.instagram = { ok: true, ids: r.ids, permalink: r.permalink, ms: Date.now() - t0 };
        } else if (platformId === 'facebook') {
          const r = await publishFacebook(conn.facebook, { message: adapted.message, imageUrl: imageUrl || null });
          results.facebook = { ok: true, ids: r.ids, permalink: r.permalink, ms: Date.now() - t0 };
        }
      } catch (e) {
        results[platformId] = { ok: false, error: e.message };
      }
    }));

    // 沒發成功的平台 + preflight 錯誤合併
    for (const [p, err] of Object.entries(preflightErrors)) {
      results[p] = { ok: false, error: err, preflight: true };
    }

    // 更新 asset 的 dispatched 紀錄
    if (assetId) {
      try {
        const assetsDb = await loadDb('assets');
        const asset = (assetsDb.items || []).find((a) => a.id === assetId);
        if (asset) {
          const dispatched = { ...(asset.dispatched || {}) };
          dispatched.direct = {
            at: new Date().toISOString(),
            platforms: results,
            copy: text,
          };
          await updateItem('assets', assetId, { dispatched, copy: text });
        }
      } catch (_) { /* 不致命 */ }
    }

    const allOk = Object.values(results).every((r) => r.ok);
    return NextResponse.json({
      ok: allOk,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
