// Cron 端點 · 每天 00:00 台北時間刷新最近 30 天貼文的成效
// 排程建議:cron-job.org 或 Windows Task Scheduler 打 GET /api/infuz/cron/refresh-insights
// 台北 00:00 = UTC 16:00
import { NextResponse } from 'next/server';
import { loadDb, updateItem } from '@/lib/infuz-db.js';
import { getInstagramInsights, getFacebookInsights } from '@/lib/infuz-meta.js';
import { getThreadsInsights } from '@/lib/infuz-threads.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const cutoff = Date.now() - 30 * 86400000;
  try {
    const [postsDb, connsDb] = await Promise.all([
      loadDb('topic_posts'),
      loadDb('connections'),
    ]);
    const conn = (connsDb.items || []).find((x) => x.id === 'main') || {};
    const recent = (postsDb.items || []).filter((p) => {
      if (p.status !== 'published') return false;
      const t = p.publishedAt ? new Date(p.publishedAt).getTime() : 0;
      return t >= cutoff;
    });

    const stats = { total: recent.length, refreshed: 0, errors: [] };

    for (const post of recent) {
      const results = post.results || {};
      const insightsByPlatform = { ...(post.insightsByPlatform || {}) };
      let touched = false;

      if (results.threads?.ok && results.threads?.ids?.[0] && conn.threads?.accessToken) {
        try {
          insightsByPlatform.threads = await getThreadsInsights(conn.threads, results.threads.ids[0]);
          touched = true;
        } catch (e) { stats.errors.push(`${post.id}/threads: ${e.message}`); }
      }
      if (results.instagram?.ok && results.instagram?.ids?.[0] && conn.facebook?.pageAccessToken) {
        try {
          insightsByPlatform.instagram = await getInstagramInsights(conn.facebook, results.instagram.ids[0]);
          touched = true;
        } catch (e) { stats.errors.push(`${post.id}/ig: ${e.message}`); }
      }
      if (results.facebook?.ok && results.facebook?.ids?.[0] && conn.facebook?.pageAccessToken) {
        try {
          insightsByPlatform.facebook = await getFacebookInsights(conn.facebook, results.facebook.ids[0]);
          touched = true;
        } catch (e) { stats.errors.push(`${post.id}/fb: ${e.message}`); }
      }

      if (touched) {
        await updateItem('topic_posts', post.id, {
          insightsByPlatform,
          insightsUpdatedAt: new Date().toISOString(),
        });
        stats.refreshed++;
      }
    }

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      ...stats,
      // 只回前 10 條錯誤避免爆量
      errors: stats.errors.slice(0, 10),
      errorTotal: stats.errors.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
