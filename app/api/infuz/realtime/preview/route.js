// 試發 — 不真的發,只跑 shouldFire + buildContent,把會生成的內容回給前端看
import { NextResponse } from 'next/server';
import { getModule } from '@/lib/infuz-realtime.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
        snapshots: check.snapshots,
      });
    }
    // 真呼 KIE 生圖 (maxDuration 300s 撐得住 KIE 30-120s)
    const built = await mod.buildContent({
      config: config || {},
      snapshot: check.snapshot,
      snapshots: check.snapshots,
      withImage: Boolean(withImage),
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
