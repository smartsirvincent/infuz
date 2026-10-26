// POST /api/infuz/video/generate
// 從一張 input 圖 + prompt + 1-2 個 model 平行產短影音
// 回傳 N 個 Cloudinary URL (已下載上傳, 可直接存 assets)
//
// body: { imageUrl, prompt, models: ['kling/...','wan-...'], duration?: 5 }
import { NextResponse } from 'next/server';
import { generateMultiModel, downloadVideo, VIDEO_MODELS } from '@/lib/kie-video.js';
import { uploadToCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_MODELS_AT_ONCE = 2; // Vercel 300s · Kling+wan 平行最保險

export async function POST(req) {
  try {
    const body = await req.json();
    const { imageUrl, prompt, duration = 5 } = body;
    let { models } = body;

    if (!imageUrl) return NextResponse.json({ error: '缺 imageUrl' }, { status: 400 });
    if (!Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: '至少選 1 個 model' }, { status: 400 });
    }
    // filter 有效 model + cap 2 個
    models = models.filter((m) => VIDEO_MODELS[m]).slice(0, MAX_MODELS_AT_ONCE);
    if (models.length === 0) {
      return NextResponse.json({ error: '所有 model 都不支援' }, { status: 400 });
    }

    // 平行跑 KIE
    const kieResults = await generateMultiModel({ models, imageUrl, prompt, duration });

    // 把成功的 video 下載 + 上傳 Cloudinary (video URL 20 分鐘就會失效)
    const final = await Promise.all(kieResults.map(async (r) => {
      if (!r.ok) return r;
      try {
        const buf = await downloadVideo(r.kieUrl);
        const uploaded = await uploadToCloudinary(buf, {
          folder: 'infuz/videos',
          resourceType: 'video',
        });
        return {
          ...r,
          cloudinaryUrl: uploaded.url,
          cloudinaryPublicId: uploaded.publicId,
          costUsd: VIDEO_MODELS[r.model].costUsdPer5s * (duration / 5),
        };
      } catch (e) {
        return { ...r, ok: false, error: `上傳 Cloudinary 失敗: ${e.message}` };
      }
    }));

    const anyOk = final.some((r) => r.ok);
    return NextResponse.json({
      ok: anyOk,
      results: final,
    });
  } catch (e) {
    console.error('[video/generate]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
