// GET /api/infuz/insights/followers-history?from=YYYY-MM-DD&to=YYYY-MM-DD
// 回傳期間內每日粉絲快照 (Threads/IG/FB)
import { NextResponse } from 'next/server';
import { loadDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  try {
    const db = await loadDb('followers_history');
    let items = db.items || [];
    if (from) items = items.filter((x) => x.date >= from);
    if (to) items = items.filter((x) => x.date <= to);
    items.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
