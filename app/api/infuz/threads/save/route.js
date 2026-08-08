// 貼 Threads Access Token → getMe 驗證 → 存進 connections
import { NextResponse } from 'next/server';
import { loadDb, saveDb } from '@/lib/infuz-db.js';
import { getMe } from '@/lib/infuz-threads.js';

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
    const { accessToken } = await req.json();
    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ error: '請貼 Threads Access Token' }, { status: 400 });
    }

    // 驗證 + 拿 userId + username
    let me;
    try {
      me = await getMe(accessToken);
    } catch (e) {
      return NextResponse.json({ error: `Threads token 無效: ${e.message}` }, { status: 400 });
    }

    const db = await loadDb('connections');
    const main = (db.items || []).find((x) => x.id === 'main') || { id: 'main' };
    const updated = {
      ...main,
      id: 'main',
      threads: {
        userId: me.id,
        username: me.username || '',
        accessToken,
        savedAt: new Date().toISOString(),
      },
    };
    await saveOne('connections', updated);
    return NextResponse.json({ ok: true, threads: { userId: me.id, username: me.username } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
