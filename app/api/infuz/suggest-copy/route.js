// 給生成的圖片配 Threads/IG/FB 貼文文案
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYS = `你是 Infuz (台灣服飾 + 珠寶品牌) 的社群貼文文案寫手。

任務:根據產品 + 情境 + 模式,為這張視覺寫一段 Threads/IG/FB 通用貼文。

風格:
- 知性、療癒、像懂妳的姊姊
- 短句、換行多,給人「她懂我」的感覺
- 把問題歸咎於版型而非妳
- 80-160 字,含 1-2 行 hook + 賣點 + 軟性 CTA
- 結尾可帶 1-2 個 hashtag (例 #Infuz #顯瘦寬褲)

避免:
- 「最」「第一」「保證」這類誇大字
- 罐頭口號 (「美麗自信」「優雅出眾」)
- AI 味的對稱句

輸出 JSON 格式:
{
  "copy": "完整的繁體中文貼文文案"
}`;

export async function POST(req) {
  try {
    const {
      mode = 'single',
      displayMode = '',
      products = [],     // [{ name, features, colors, ... }]
      scenario = '',     // 情境名稱
      slogan = '',
      promoInfo = '',
    } = await req.json();

    const productLines = products.map((p, i) =>
      `${i + 1}. ${p.name || p.id}${p.colors ? ` (${p.colors})` : ''} — ${(p.features || '').replace(/\n+/g, ' ').slice(0, 120)}`
    ).join('\n');

    const modeLabel = mode === 'single' ? '單品介紹'
      : mode === 'combo' ? '上下身穿搭'
      : displayMode === 'display' ? '系列陳列 (無模特)' : '多件搭配';

    const user = `**模式**: ${modeLabel}
**情境**: ${scenario || '一般'}
${slogan ? `**主標語 (圖中有)**: ${slogan}\n` : ''}${promoInfo ? `**促銷資訊**: ${promoInfo}\n` : ''}
**產品**:
${productLines || '(無)'}

請寫一段 80-160 字的 Threads/IG/FB 貼文。直接回 JSON,不要任何前後說明。`;

    const parsed = await callJSON({ system: SYS, user, maxTokens: 800, temperature: 0.85 });
    return NextResponse.json({ copy: parsed.copy || '' });
  } catch (e) {
    return NextResponse.json({ error: e.message, copy: '' }, { status: 500 });
  }
}
