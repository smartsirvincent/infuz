// 立即發文 — 不等排程時間, 直接發指定的 topic_post
// body: { postId, platforms? } - 若給 platforms 覆蓋 topic 排程平台
import { NextResponse } from 'next/server';
import { loadDb, updateItem } from '@/lib/infuz-db.js';
import { buildTextWithLink } from '@/lib/topic-publish-helper.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const { postId, platforms: overridePlatforms } = await req.json();
    if (!postId) return NextResponse.json({ error: '缺 postId' }, { status: 400 });

    const postsDb = await loadDb('topic_posts');
    const post = (postsDb.items || []).find((p) => p.id === postId);
    if (!post) return NextResponse.json({ error: 'post 不存在' }, { status: 404 });
    if (post.status === 'published') return NextResponse.json({ error: '這篇已經發過' }, { status: 400 });

    const [topicsDb, productsDb, settingsDb] = await Promise.all([
      loadDb('topics'),
      loadDb('products'),
      loadDb('settings'),
    ]);
    const topic = (topicsDb.items || []).find((t) => t.id === post.topicId);
    const platforms = overridePlatforms || topic?.schedule?.platforms || { threads: true };

    const settings = (settingsDb.items || []).find((s) => s.id === 'main') || {};
    const utmCfg = settings.utm || null;

    // 組合最終文本 (含 hashtags + 選配的購買連結+UTM)
    const finalText = buildTextWithLink({ post, productsDb, utmCfg });

    // 呼叫 publish endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');

    const res = await fetch(`${baseUrl}/api/infuz/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: finalText,
        imageUrl: post.imageUrl || null,
        hashtags: '',
        platforms,
      }),
    });
    const publishResult = await res.json();

    await updateItem('topic_posts', postId, {
      status: publishResult.ok ? 'published' : 'failed',
      publishedAt: new Date().toISOString(),
      results: publishResult.results || null,
      error: publishResult.ok ? null : publishResult.error || 'publish failed',
    });

    return NextResponse.json({
      ok: publishResult.ok,
      results: publishResult.results,
      error: publishResult.error,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
