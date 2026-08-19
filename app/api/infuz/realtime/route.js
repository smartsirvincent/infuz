// Realtime jobs CRUD
// GET  → 列出所有 job + weather 模組狀態
// POST → 新增 job (body 為 job 物件, id 自動生成)
// PUT  → 更新 job (body 需含 id + patch)
// DELETE?id=xxx → 刪除
import { NextResponse } from 'next/server';
import { loadDb, appendItems, updateItem, deleteItem } from '@/lib/infuz-db.js';
import { listModules, getModule } from '@/lib/infuz-realtime.js';
import { CWA_LOCATIONS, isConfigured as weatherReady } from '@/lib/infuz-weather.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const db = await loadDb('realtime_jobs');
    return NextResponse.json({
      items: db.items || [],
      modules: listModules(),
      weather: {
        ready: weatherReady(),
        locations: CWA_LOCATIONS,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const mod = getModule(body.moduleId);
    if (!mod) return NextResponse.json({ error: `未知的模組: ${body.moduleId}` }, { status: 400 });
    if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
      return NextResponse.json({ error: 'time 格式必須是 HH:MM' }, { status: 400 });
    }
    const job = {
      id: 'rt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: body.name || '新的即時發文',
      moduleId: body.moduleId,
      config: body.config || {},
      time: body.time,
      days: Array.isArray(body.days) && body.days.length ? body.days : [0, 1, 2, 3, 4, 5, 6],
      platforms: body.platforms || { threads: true },
      withImage: Boolean(body.withImage),
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString(),
      lastRunDate: null,
      lastResult: null,
    };
    await appendItems('realtime_jobs', job);
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: '缺 id' }, { status: 400 });
    const { id, ...patch } = body;
    await updateItem('realtime_jobs', id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺 id' }, { status: 400 });
    await deleteItem('realtime_jobs', id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
