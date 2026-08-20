// 單張重生圖 — 讓「重生一張圖」按鈕用
import { NextResponse } from 'next/server';
import { loadDb } from '@/lib/infuz-db.js';
import { submitAndPollV2WithRetry } from '@/lib/kie-image.js';
import { uploadToCloudinary } from '@/lib/cloudinary.js';
import { enforceFidelityPrompt, productReferenceUrls } from '@/lib/infuz-image-rules.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const { imagePrompt, productId, aspectRatio = '4:5' } = await req.json();
    if (!imagePrompt) return NextResponse.json({ error: '缺 imagePrompt' }, { status: 400 });

    let refs = [];
    if (productId) {
      const db = await loadDb('products');
      const p = (db.items || []).find((x) => x.id === productId);
      refs = productReferenceUrls(p); // 多角度參考照
    }

    const finalPrompt = enforceFidelityPrompt(imagePrompt);
    const kieResult = await submitAndPollV2WithRetry(
      { prompt: finalPrompt, referenceImages: refs, aspect_ratio: aspectRatio },
      { maxRetries: 1 },
    );
    const uploaded = await uploadToCloudinary(kieResult.kieUrl, { folder: 'infuz/topics' });

    return NextResponse.json({ imageUrl: uploaded.url, taskId: kieResult.taskId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
