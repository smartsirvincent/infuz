// 素材加入排程 · 自動 ensure「素材發文」topic + 建 queued topic_post 帶 scheduledAt
// body: { assetId, copy, hashtags?, platforms: {fb, ig, threads}, scheduledAt: 'YYYY-MM-DDTHH:mm' }
// 到期由 lib/infuz-topic-scheduler.js tickScheduledPosts() 觸發實際發文
import { NextResponse } from 'next/server';
import { loadDb, saveDb, updateItem } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_TOPIC_ID = 'topic_asset_default';
const DEFAULT_TOPIC_NAME = '素材發文';

async function ensureDefaultTopic() {
  const db = await loadDb('topics');
  const items = db.items || [];
  let topic = items.find((t) => t.id === DEFAULT_TOPIC_ID);
  if (topic) return topic;
  // 建立預設「素材發文」topic (不啟用固定排程 · 依 post.scheduledAt 觸發)
  const now = new Date().toISOString();
  topic = {
    id: DEFAULT_TOPIC_ID,
    name: DEFAULT_TOPIC_NAME,
    description: '從素材庫直接排程的貼文, 依各篇 scheduledAt 到期發出',
    type: 'image',
    productIds: [],
    brandOnly: true,
    systemPrompt: '',
    imagePrompt: '',
    imageSource: 'product_photo',
    aspectRatio: '4:5',
    schedule: {
      enabled: false, // 不用固定排程, 走 tickScheduledPosts
      time: '10:00',
      days: [1, 2, 3, 4, 5],
      platforms: { threads: true, instagram: false, facebook: false },
      lastRunDate: null,
    },
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  };
  await saveDb('topics', { items: [...items, topic] });
  return topic;
}

export async function POST(req) {
  try {
    const { assetId, copy, hashtags = '', platforms = {}, scheduledAt } = await req.json();
    if (!assetId) return NextResponse.json({ error: '缺 assetId' }, { status: 400 });
    if (!scheduledAt) return NextResponse.json({ error: '缺 scheduledAt (YYYY-MM-DDTHH:mm)' }, { status: 400 });

    const scheduledMs = new Date(scheduledAt).getTime();
    if (isNaN(scheduledMs)) return NextResponse.json({ error: 'scheduledAt 格式無效' }, { status: 400 });
    if (scheduledMs < Date.now() - 60 * 1000) {
      return NextResponse.json({ error: '排程時間已過去' }, { status: 400 });
    }

    // Platform key alias
    const platformsMapped = {
      threads: !!(platforms.threads),
      instagram: !!(platforms.instagram || platforms.ig),
      facebook: !!(platforms.facebook || platforms.fb),
    };
    if (!platformsMapped.threads && !platformsMapped.instagram && !platformsMapped.facebook) {
      return NextResponse.json({ error: '至少要選 1 個平台' }, { status: 400 });
    }

    // 讀 asset 拿 imageUrl
    const assetsDb = await loadDb('assets');
    const asset = (assetsDb.items || []).find((a) => a.id === assetId);
    if (!asset) return NextResponse.json({ error: 'asset 不存在' }, { status: 404 });

    // Ensure「素材發文」topic
    const topic = await ensureDefaultTopic();

    // 建 topic_post
    const postsDb = await loadDb('topic_posts');
    const now = new Date().toISOString();
    const post = {
      id: 'tp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      topicId: topic.id,
      text: (copy || '').trim(),
      hashtags,
      imagePrompt: '',
      imageUrl: asset.imageUrl || null,
      pickedProductId: asset.products?.[0]?.id || null,
      includePurchaseUrl: false,
      status: 'queued',
      scheduledAt: new Date(scheduledMs).toISOString(),
      platformsOverride: platformsMapped, // ← tickScheduledPosts 讀這個, 不用 topic.schedule.platforms
      sourceAssetId: assetId,
      createdAt: now,
      publishedAt: null,
      results: null,
    };
    await saveDb('topic_posts', { items: [...(postsDb.items || []), post] });

    // 更新 asset.dispatched.schedule 標記
    const dispatched = { ...(asset.dispatched || {}) };
    dispatched.schedule = {
      at: now,
      scheduledAt: post.scheduledAt,
      topicPostId: post.id,
      platforms: platformsMapped,
    };
    await updateItem('assets', assetId, { dispatched, copy });

    return NextResponse.json({ ok: true, postId: post.id, scheduledAt: post.scheduledAt, topicId: topic.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
