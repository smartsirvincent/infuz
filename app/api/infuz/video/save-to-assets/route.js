// POST /api/infuz/video/save-to-assets
// 把產出的影片存進 assets DB (mode=video)
// body: { videoUrl, kieModel, costUsd, duration, prompt, sourceImageUrl }
import { NextResponse } from 'next/server';
import { loadDb, appendItems } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const body = await req.json();
    const { videoUrl, kieModel, costUsd, duration, prompt, sourceImageUrl } = body;
    if (!videoUrl) return NextResponse.json({ error: '缺 videoUrl' }, { status: 400 });

    const cur = await loadDb('assets');
    const existingMax = (cur.items || []).reduce((m, a) => Math.max(m, Number(a.postNumber) || 0), 0);
    const postNumber = existingMax + 1;

    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const slug = (kieModel || 'vid').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();

    const asset = {
      id: `VID-${ts}-${slug}`,
      postNumber,
      mode: 'video',
      videoUrl,
      imageUrl: videoUrl, // 保留欄位,舊 UI 若靠 imageUrl 顯示 thumbnail 不會壞
      sourceImageUrl: sourceImageUrl || '',
      kieModel: kieModel || '',
      costUsd: Number(costUsd) || 0,
      duration: Number(duration) || 5,
      prompt: prompt || '',
      products: [],
      modelId: '',
      modelName: '',
      scenarioId: '',
      copy: '',
      dispatched: {},
      createdAt: new Date().toISOString(),
    };
    await appendItems('assets', asset);
    return NextResponse.json({ ok: true, assetId: asset.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
