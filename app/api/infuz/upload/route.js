// Infuz 上傳圖片到 Cloudinary,依用途分類
// query: ?folder=products|models|scenarios|misc
import { NextResponse } from 'next/server';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_FOLDERS = new Set(['products', 'models', 'scenarios', 'misc']);

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: '雲端儲存未設定' }, { status: 503 });
    }
    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'misc';
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: `unknown folder: ${folder}` }, { status: 400 });
    }
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !file.arrayBuffer) {
      return NextResponse.json({ error: '請上傳圖片檔' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const up = await uploadToCloudinary(buffer, { folder: `infuz/${folder}` });
    return NextResponse.json({ url: up.url, publicId: up.publicId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
