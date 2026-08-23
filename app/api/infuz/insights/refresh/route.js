// 刷新單篇貼文的成效指標 · 從 Meta Graph + Threads Graph 抓 insights
// body: { postId } (topic_posts 的 id)
// 回: { insightsByPlatform: { threads:{...}, instagram:{...}, facebook:{...} }, errors: {...} }
// 也會 PATCH topic_posts.insightsByPlatform 存起來
import { NextResponse } from 'next/server';
import { loadDb, updateItem } from '@/lib/infuz-db.js';
import { getInstagramInsights, getFacebookInsights } from '@/lib/infuz-meta.js';
import { getThreadsInsights } from '@/lib/infuz-threads.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: '缺 postId' }, { status: 400 });

    const [postsDb, connsDb] = await Promise.all([
      loadDb('topic_posts'),
      loadDb('connections'),
    ]);
    const post = (postsDb.items || []).find((p) => p.id === postId);
    if (!post) return NextResponse.json({ error: 'post 不存在' }, { status: 404 });
    if (post.status !== 'published') return NextResponse.json({ error: 'post 尚未發布' }, { status: 400 });

    const conn = (connsDb.items || []).find((x) => x.id === 'main') || {};
    const results = post.results || {};
    const insightsByPlatform = { ...(post.insightsByPlatform || {}) };
    const errors = {};

    // Threads · post.results.threads.ids[0] 是 parent media id
    if (results.threads?.ok && results.threads?.ids?.[0] && conn.threads?.accessToken) {
      try {
        insightsByPlatform.threads = await getThreadsInsights(conn.threads, results.threads.ids[0]);
      } catch (e) { errors.threads = e.message; }
    }

    // Instagram
    if (results.instagram?.ok && results.instagram?.ids?.[0] && conn.facebook?.pageAccessToken) {
      try {
        insightsByPlatform.instagram = await getInstagramInsights(conn.facebook, results.instagram.ids[0]);
      } catch (e) { errors.instagram = e.message; }
    }

    // Facebook
    if (results.facebook?.ok && results.facebook?.ids?.[0] && conn.facebook?.pageAccessToken) {
      try {
        insightsByPlatform.facebook = await getFacebookInsights(conn.facebook, results.facebook.ids[0]);
      } catch (e) { errors.facebook = e.message; }
    }

    // 存回 topic_posts
    await updateItem('topic_posts', postId, {
      insightsByPlatform,
      insightsUpdatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      insightsByPlatform,
      errors: Object.keys(errors).length ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
