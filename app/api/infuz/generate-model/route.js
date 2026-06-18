// AI 生成模特兒參考圖 (KIE V2, 3:4 portrait)
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    }
    const {
      style = '',
      name = '',
      gender = '',
      skin_tone = '',
      hairstyle = '',
      extraPrompt = '',
    } = await req.json();

    if (!style.trim() && !gender) {
      return NextResponse.json({ error: '請至少提供風格描述或性別' }, { status: 400 });
    }

    const parts = [];
    parts.push('Professional fashion model reference photo. 3/4 body shot showing face clearly, suitable for use as a character reference in future fashion shoots.');
    if (gender === '女性') parts.push('Subject: Asian female model.');
    else if (gender === '男性') parts.push('Subject: Asian male model.');
    if (style.trim()) parts.push(`Style and characteristics: ${style.trim().slice(0, 400)}`);
    if (skin_tone) parts.push(`Skin tone: ${skin_tone}.`);
    if (hairstyle) parts.push(`Hairstyle: ${hairstyle}.`);
    parts.push('Clean studio background (light gray / off-white / neutral). Soft, even, directional lighting. Natural neutral expression, calm posture, looking toward camera.');
    parts.push('Photorealistic, high resolution, sharp focus on face. The model should be wearing simple neutral clothing (plain top / basic pants — NOT a specific branded outfit) so the photo can be reused as a character reference.');
    if (extraPrompt) parts.push(`Extra: ${extraPrompt}`);

    const taskId = await submitImageV2({
      prompt: parts.join(' '),
      referenceImages: [],
      aspect_ratio: '3:4',
    });
    const kieUrl = await pollImageV2(taskId);
    const buf = await downloadImage(kieUrl);
    const up = await uploadToCloudinary(buf, { folder: 'infuz/models' });

    return NextResponse.json({ url: up.url, kieTaskId: taskId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
