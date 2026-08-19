// 試發 — 不真的發,只跑 shouldFire + buildContent,把會生成的內容回給前端看
import { NextResponse } from 'next/server';
import { getModule } from '@/lib/infuz-realtime.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { moduleId, config, withImage } = await req.json();
    const mod = getModule(moduleId);
    if (!mod) return NextResponse.json({ error: `未知的模組: ${moduleId}` }, { status: 400 });
    if (!mod.isReady()) return NextResponse.json({ error: `${mod.label} 尚未就緒 (可能缺 API key)` }, { status: 400 });

    const check = await mod.shouldFire(config || {});
    if (!check.fire) {
      return NextResponse.json({
        fire: false,
        reason: check.reason,
        snapshot: check.snapshot,
      });
    }
    // preview 不真的生圖(Vercel Hobby 60s 上限撐不住 KIE 30-120s)
    // 只跑產文 + 挑產品 + 回 imagePrompt, 讓用戶預覽會發什麼; 實際生圖交給 tick
    const built = await mod.buildContent({
      config: config || {},
      snapshot: check.snapshot,
      snapshots: check.snapshots,
      withImage: Boolean(withImage),
      dryRunImage: true,
    });
    return NextResponse.json({
      fire: true,
      reason: check.reason,
      snapshot: check.snapshot,
      preview: built,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
