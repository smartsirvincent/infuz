// 發文成效 — 讀 topic_posts + realtime_jobs.lastResult
// MVP: 只顯示發文狀態 + 平台 + permalink; 深指標 (reach/like/comment/share) 之後補
import { NextResponse } from 'next/server';
import { loadDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    const [topicsDb, postsDb, realtimeDb] = await Promise.all([
      loadDb('topics'),
      loadDb('topic_posts'),
      loadDb('realtime_jobs'),
    ]);

    const topics = topicsDb.items || [];
    const posts = (postsDb.items || []).filter((p) => p.status === 'published');
    const realtimePosts = (realtimeDb.items || [])
      .filter((j) => j.lastResult?.ok)
      .map((j) => ({
        id: `rt_${j.id}`,
        topicId: null,
        topicName: `☀️ ${j.name} (氣候即時)`,
        text: j.lastResult.text || '',
        hashtags: j.lastResult.hashtags || '',
        imageUrl: j.lastResult.imageUrl || null,
        publishedAt: j.lastResult.at,
        results: j.lastResult.publishResult || {},
      }));

    // 統計 by platform
    const byPlatform = { threads: 0, instagram: 0, facebook: 0 };
    const all = [
      ...posts.map((p) => ({
        ...p,
        topicName: topics.find((t) => t.id === p.topicId)?.name || '(主題已刪)',
        source: 'topic',
      })),
      ...realtimePosts.map((p) => ({ ...p, source: 'realtime' })),
    ];
    for (const p of all) {
      for (const [k, v] of Object.entries(p.results || {})) {
        if (v?.ok) byPlatform[k] = (byPlatform[k] || 0) + 1;
      }
    }
    all.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

    // 統計 by topic
    const byTopic = {};
    for (const p of all) {
      const key = p.topicName || '(未分類)';
      byTopic[key] = (byTopic[key] || 0) + 1;
    }

    return NextResponse.json({
      posts: all,
      total: all.length,
      byPlatform,
      byTopic,
      topics,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
