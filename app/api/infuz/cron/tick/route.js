// Vercel Cron 端點 — 每 5 分鐘 (見 vercel.json) 打一次
// 走 realtime scheduler tick,把「已到點」的 job 執行掉
//
// 可加 CRON_SECRET 環境變數避免被亂打:
//   請求 header 需帶 Authorization: Bearer $CRON_SECRET (Vercel Cron 會自動帶)
import { NextResponse } from 'next/server';
import { tick } from '@/lib/infuz-realtime.js';
import { tickTopics } from '@/lib/infuz-topic-scheduler.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req) {
  // Vercel Cron 會帶 Authorization: Bearer $CRON_SECRET
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    // 平行跑氣候即時 + 主題排程 (兩套獨立)
    const [realtimeStats, topicStats] = await Promise.allSettled([tick(), tickTopics()]);
    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      realtime: realtimeStats.status === 'fulfilled' ? realtimeStats.value : { error: realtimeStats.reason?.message },
      topics: topicStats.status === 'fulfilled' ? topicStats.value : { error: topicStats.reason?.message },
    });
  } catch (e) {
    console.error('[cron/tick] 錯誤:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// 手動觸發也接受 POST
export async function POST(req) {
  return GET(req);
}
