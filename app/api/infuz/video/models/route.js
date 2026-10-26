// GET /api/infuz/video/models
// 回傳可用的 KIE video model 清單 + 預設勾選 · 給 UI render
import { NextResponse } from 'next/server';
import { VIDEO_MODELS, DEFAULT_VIDEO_MODELS } from '@/lib/kie-video.js';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    models: Object.entries(VIDEO_MODELS).map(([key, spec]) => ({
      key,
      label: spec.label,
      hint: spec.hint,
      secs: spec.secs,
      costUsdPer5s: spec.costUsdPer5s,
      typicalDurationSec: spec.typicalDurationSec,
    })),
    defaults: DEFAULT_VIDEO_MODELS,
    maxAtOnce: 2,
  });
}
