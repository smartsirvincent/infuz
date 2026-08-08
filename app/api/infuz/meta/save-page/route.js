// 選好粉專 → 存進 connections DB
import { NextResponse } from 'next/server';
import { loadDb, saveDb } from '@/lib/infuz-db.js';
import { verifyConnection } from '@/lib/infuz-meta.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function saveOne(kind, item) {
  const db = await loadDb(kind);
  const items = (db.items || []).filter((x) => x.id !== item.id);
  items.push(item);
  return saveDb(kind, { items });
}

export async function POST(req) {
  try {
    const {
      pageId, pageName, pageAccessToken, igUserId, igUsername,
    } = await req.json();
    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: 'pageId + pageAccessToken required' }, { status: 400 });
    }

    // 驗證 page token 有效
    await verifyConnection({ pageId, pageAccessToken });

    // Load 現有 connections
    const db = await loadDb('connections');
    const main = (db.items || []).find((x) => x.id === 'main') || { id: 'main' };
    const updated = {
      ...main,
      id: 'main',
      facebook: {
        pageId,
        pageName: pageName || '',
        pageAccessToken,
        igUserId: igUserId || null,
        igUsername: igUsername || null,
        savedAt: new Date().toISOString(),
      },
    };
    await saveOne('connections', updated);

    return NextResponse.json({ ok: true, facebook: updated.facebook });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
