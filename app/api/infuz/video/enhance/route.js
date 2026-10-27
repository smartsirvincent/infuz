// POST /api/infuz/video/enhance
// 用 Cloudinary video transformation 給 KIE 影片加 BGM + 文字 overlay + fade
// 不產新 asset · 只回 enhanced URL · UI 可預覽 · 用戶按「存素材庫」才真的寫入
//
// body: { videoUrl, bgmPublicId?, text?, textPos?, textColor?, fadeInOut? }
import { NextResponse } from 'next/server';
import { buildEnhancedVideoUrl, summarizeFx } from '@/lib/cloudinary-video-fx.js';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      videoUrl,
      bgmPublicId,
      bgmVolume,
      text,
      textFont,
      textSize,
      textColor,
      textPos,
      textY,
      fadeInOut,
    } = body;

    if (!videoUrl) return NextResponse.json({ error: '缺 videoUrl' }, { status: 400 });

    const enhancedUrl = buildEnhancedVideoUrl({
      videoPublicId: videoUrl,
      bgmPublicId,
      bgmVolume,
      text,
      textFont,
      textSize,
      textColor,
      textPos,
      textY,
      fadeInOut: fadeInOut !== false, // 預設 true
    });

    return NextResponse.json({
      ok: true,
      enhancedUrl,
      summary: summarizeFx({ bgmPublicId, text, fadeInOut: fadeInOut !== false }),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
