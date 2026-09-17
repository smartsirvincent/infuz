// 批次寫入 topics (從主題發想勾選來的)
import { NextResponse } from 'next/server';
import { loadDb, saveDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { topics = [], productIds = [], imageSource } = await req.json();
    const applyImageSource = imageSource === 'product_photo' || imageSource === 'ai_generated' ? imageSource : null;
    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: '至少要 1 個主題' }, { status: 400 });
    }
    const db = await loadDb('topics');
    const now = new Date().toISOString();
    const withIds = topics.map((t, i) => {
      const type = t.suggestedType || t.type || 'text';
      return {
      id: 't_' + Date.now().toString(36) + '_' + i,
      name: t.name || `主題 ${i + 1}`,
      description: t.description || '',
      type,
      productIds: t.productIds || productIds || [],
      brandOnly: !(t.productIds?.length || productIds.length),
      systemPrompt: t.postingAngle || '',
      imagePrompt: t.imagePrompt || '',
      aspectRatio: '4:5',
      // 只有 type=image 才記 imageSource · 預設 ai_generated (若 discover 沒帶就 null 讓 produce 走預設)
      ...(type === 'image' && applyImageSource ? { imageSource: applyImageSource } : {}),
      schedule: {
        enabled: false,
        time: '10:00',
        days: [1, 2, 3, 4, 5],
        platforms: { threads: true, instagram: false, facebook: false },
        lastRunDate: null,
      },
      createdAt: now,
      updatedAt: now,
      };
    });
    const nextItems = [...(db.items || []), ...withIds];
    await saveDb('topics', { items: nextItems });
    return NextResponse.json({ ok: true, added: withIds.length, ids: withIds.map((x) => x.id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
