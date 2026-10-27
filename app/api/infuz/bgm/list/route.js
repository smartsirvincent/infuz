// GET /api/infuz/bgm/list
// 回 BGM catalog · 同時用 Cloudinary Admin API 檢查哪些真的已上傳
// available: true/false 讓 UI 標示「待上傳」
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { BGM_LIBRARY } from '@/lib/bgm-catalog.js';

export const runtime = 'nodejs';
export const maxDuration = 15;

function configCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('CLOUDINARY_CLOUD_NAME not set');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function GET() {
  try {
    configCloudinary();
    // 列 Cloudinary 內 infuz/bgm/ 下所有 video resources
    let existing = new Set();
    try {
      const r = await cloudinary.api.resources({
        type: 'upload',
        resource_type: 'video',
        prefix: 'infuz/bgm/',
        max_results: 50,
      });
      existing = new Set((r.resources || []).map((x) => x.public_id));
    } catch (e) {
      console.error('[bgm/list] admin api fail:', e.message);
    }

    // 若 Admin API 沒抓到 (Vercel serverless 偶爾 fail), 樂觀標 available=true 讓 UI 可選
    // Enhance API 真正跑時若 BGM 不存在 Cloudinary 會回 404, UI 收到會顯示錯
    const catalog = BGM_LIBRARY.map((b) => ({
      ...b,
      available: existing.size > 0 ? existing.has(b.publicId) : true,
    }));
    const availableCount = catalog.filter((b) => b.available).length;

    return NextResponse.json({
      catalog,
      availableCount,
      total: catalog.length,
      hint: availableCount === 0
        ? '尚未上傳任何 BGM · 請去 Cloudinary Console 的 infuz/bgm/ 資料夾上傳 mp3'
        : `${availableCount}/${catalog.length} 首已就緒`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, catalog: BGM_LIBRARY }, { status: 500 });
  }
}
