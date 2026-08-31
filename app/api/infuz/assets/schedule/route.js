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
  // 建立預設「素材發文」topic · 排程 enabled=true · 每天 10:00
  // tickTopics 到點會從佇列 FIFO 取一篇發
  const now = new Date().toISOString();
  topic = {
    id: DEFAULT_TOPIC_ID,
    name: DEFAULT_TOPIC_NAME,
    description: '素材庫排程貼文 · 依這個主題的時間到點自動發, 佇列 FIFO',
    type: 'image',
    productIds: [],
    brandOnly: true,
    systemPrompt: '',
    imagePrompt: '',
    imageSource: 'product_photo',
    aspectRatio: '4:5',
    schedule: {
      enabled: true,          // 走 tickTopics FIFO
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
    const { assetId, copy, hashtags = '', platforms = {} } = await req.json();
    if (!assetId) return NextResponse.json({ error: '缺 assetId' }, { status: 400 });

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

    // 建 topic_post · 不帶 scheduledAt · 走 tickTopics 依 topic.schedule.time 到點 FIFO
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
      platformsOverride: platformsMapped, // tickTopics 若讀到會用這個, 否則用 topic.schedule.platforms
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
      topicId: topic.id,
      topicPostId: post.id,
      platforms: platformsMapped,
    };
    await updateItem('assets', assetId, { dispatched, copy });

    return NextResponse.json({
      ok: true,
      postId: post.id,
      topicId: topic.id,
      topicName: topic.name,
      topicSchedule: topic.schedule,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
