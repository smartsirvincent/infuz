// 批次存入 topic_posts queue (status=queued)
import { NextResponse } from 'next/server';
import { loadDb, saveDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { posts = [] } = await req.json();
    if (!posts.length) return NextResponse.json({ error: '至少 1 篇' }, { status: 400 });

    const db = await loadDb('topic_posts');
    const now = new Date().toISOString();
    const withIds = posts.map((p, i) => ({
      id: 'tp_' + Date.now().toString(36) + '_' + i,
      topicId: p.topicId,
      text: p.text,
      hashtags: p.hashtags || '',
      imagePrompt: p.imagePrompt || '',
      imageUrl: p.imageUrl || null,
      pickedProductId: p.pickedProductId || null,
      status: 'queued',
      createdAt: now,
      scheduledAt: null,
      publishedAt: null,
      results: null,
    }));
    const next = { items: [...(db.items || []), ...withIds] };
    await saveDb('topic_posts', next);
    return NextResponse.json({ ok: true, added: withIds.length, ids: withIds.map((x) => x.id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
