// 把 asset 送到 webhook (排程 / 發文)
import { NextResponse } from 'next/server';
import { loadDb, updateItem } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function getSettings() {
  const db = await loadDb('settings');
  return (db.items || []).find((x) => x.id === 'main') || {};
}

export async function POST(req) {
  try {
    const {
      assetId,
      action,           // 'schedule' | 'post'
      platforms = {},   // { fb: bool, ig: bool, threads: bool }
      copy = '',        // 文案 (用戶可改)
    } = await req.json();

    if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    if (!['schedule', 'post'].includes(action)) {
      return NextResponse.json({ error: 'action must be schedule or post' }, { status: 400 });
    }

    // Load asset
    const assetsDb = await loadDb('assets');
    const asset = (assetsDb.items || []).find((a) => a.id === assetId);
    if (!asset) return NextResponse.json({ error: `asset ${assetId} not found` }, { status: 404 });

    // Load settings → webhook URL
    const settings = await getSettings();
    const url = action === 'schedule' ? settings.scheduleWebhook : settings.postWebhook;
    if (!url) {
      return NextResponse.json({
        error: `${action === 'schedule' ? '排程' : '發文'} webhook 還沒設定。請去 /settings 填入。`,
      }, { status: 400 });
    }

    // Build payload (含所有需要欄位)
    const payload = {
      貼文編號: asset.postNumber || asset.id,
      AI圖片網址: asset.imageUrl || '',
      AI文案: copy || asset.copy || '',
      發佈FB: !!platforms.fb,
      發佈IG: !!platforms.ig,
      發佈Threads: !!platforms.threads,
      // metadata (extra,給 Make/Zapier filter 用)
      assetId: asset.id,
      mode: asset.mode || '',
      displayMode: asset.displayMode || '',
      productNames: (asset.products || []).map((p) => p.name).join(' + '),
      productSKUs: (asset.products || []).map((p) => p.id).join(','),
      purchaseURLs: (asset.products || []).map((p) => p.purchase_url).filter(Boolean).join(' '),
      modelName: asset.modelName || '',
      scenarioName: asset.scenarioName || '',
      slogan: asset.slogan || '',
      promoInfo: asset.promoInfo || '',
      action,
      dispatchedAt: new Date().toISOString(),
    };

    // Send to webhook
    let webhookResp = '';
    let webhookOk = false;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      webhookResp = (await r.text()).slice(0, 500);
      webhookOk = r.ok;
      if (!r.ok) {
        return NextResponse.json({
          error: `webhook 回 HTTP ${r.status}: ${webhookResp.slice(0, 200)}`,
          payload,
        }, { status: 502 });
      }
    } catch (e) {
      return NextResponse.json({ error: `webhook 連線失敗:${e.message}`, payload }, { status: 502 });
    }

    // 更新 asset 的 dispatch 紀錄
    const dispatched = { ...(asset.dispatched || {}) };
    dispatched[action] = {
      at: new Date().toISOString(),
      platforms,
      resp: webhookResp.slice(0, 200),
      ok: webhookOk,
    };
    // 同時 persist 文案讓之後重發可用
    await updateItem('assets', assetId, { dispatched, copy: copy || asset.copy || '' });

    return NextResponse.json({
      ok: true,
      action,
      webhookResp: webhookResp.slice(0, 200),
      payload,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
