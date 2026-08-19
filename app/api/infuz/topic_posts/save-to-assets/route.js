// 把主題產出的圖 存到素材庫 (assets DB)
// 相容 /assets 現有頁面的 schema
import { NextResponse } from 'next/server';
import { loadDb, saveDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function extractPublicId(cloudinaryUrl) {
  // 從 https://res.cloudinary.com/xxx/image/upload/v1234567/folder/id.png 抽 folder/id
  const m = (cloudinaryUrl || '').match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z]+$/i);
  return m ? m[1] : null;
}

export async function POST(req) {
  try {
    const { postId, draft } = await req.json();

    // 兩種入口: 已存的 post (走 topic_posts) 或 draft (produce 頁還沒存,直接傳 draft data)
    let payload = null;
    if (draft) {
      payload = draft;
    } else if (postId) {
      const postsDb = await loadDb('topic_posts');
      payload = (postsDb.items || []).find((p) => p.id === postId);
      if (!payload) return NextResponse.json({ error: 'post 不存在' }, { status: 404 });
    } else {
      return NextResponse.json({ error: '需 postId 或 draft' }, { status: 400 });
    }

    if (!payload.imageUrl) return NextResponse.json({ error: '這篇沒有圖,不能存素材' }, { status: 400 });

    // 讀 topic 名稱 (作為 scenarioName 標記)
    let topicName = '(主題貼文)';
    if (payload.topicId) {
      const topicsDb = await loadDb('topics');
      const topic = (topicsDb.items || []).find((t) => t.id === payload.topicId);
      if (topic) topicName = topic.name;
    }

    // 讀產品 (存進 asset.products)
    let productPayload = [];
    if (payload.pickedProductId) {
      const productsDb = await loadDb('products');
      const p = (productsDb.items || []).find((x) => x.id === payload.pickedProductId);
      if (p) productPayload = [p];
    }

    // 檢查是否重複 (同 imageUrl 已存在則跳過)
    const assetsDb = await loadDb('assets');
    const existing = (assetsDb.items || []).find((a) => a.imageUrl === payload.imageUrl);
    if (existing) {
      return NextResponse.json({ ok: true, assetId: existing.id, alreadyExists: true });
    }

    const stamp = nowStamp();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const asset = {
      id: `MAT-${stamp}-${rand}`,
      imageUrl: payload.imageUrl,
      cloudinaryPublicId: extractPublicId(payload.imageUrl),
      copy: (payload.text || '').trim() + (payload.hashtags ? `\n\n${payload.hashtags}` : ''),
      products: productPayload,
      mode: 'single',
      modelId: '',
      modelName: '',
      scenarioId: 'TOPIC',
      scenarioName: topicName,
      scenarioType: '主題發文',
      slogan: '',
      promoInfo: '',
      textMode: 'ai',
      noFace: false,
      hasCompositionRef: false,
      source: 'topic', // 標記來源, 未來想篩選用
      sourceTopicId: payload.topicId || null,
      sourcePostId: payload.id || null,
      createdAt: new Date().toISOString(),
    };
    const next = { items: [...(assetsDb.items || []), asset] };
    await saveDb('assets', next);
    return NextResponse.json({ ok: true, assetId: asset.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
