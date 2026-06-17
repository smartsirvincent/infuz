// AI 標語建議
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYS = `你是 Infuz (台灣服飾 + 珠寶品牌) 的廣告標語寫手。

任務:根據產品 + 品牌人格,出 5 個短標語,每句 ≤ 14 個字,要適合渲染到圖中當主標。

風格規則:
- 知性 + 療癒 (Infuz 品牌人格:像懂妳的姊姊)
- 有畫面、有共鳴,不要 AI 味
- 不要罐頭口號 (NG: 「美麗自信」「優雅出眾」這種)
- 點出「為亞洲身型而生」/「修飾身形」/「日常穿搭」這類具體承諾
- 避免「最」「第一」「保證」這類誇大字

輸出 JSON 格式:
{
  "slogans": ["標語1", "標語2", "標語3", "標語4", "標語5"]
}`;

export async function POST(req) {
  try {
    const { productSummary = '', brandPersona = '' } = await req.json();
    const user = `**品牌人格**: ${brandPersona || '知性、療癒、像懂妳的姊姊。'}

**這次主推產品/搭配**:
${productSummary || '(未提供,請走通用 Infuz 風格)'}

請出 5 個 ≤ 14 字短標語。直接回 JSON,不要任何前後說明。`;
    const parsed = await callJSON({ system: SYS, user, maxTokens: 800, temperature: 0.9 });
    if (!Array.isArray(parsed.slogans)) {
      return NextResponse.json({ slogans: [] });
    }
    return NextResponse.json({ slogans: parsed.slogans.slice(0, 5) });
  } catch (e) {
    return NextResponse.json({ error: e.message, slogans: [] }, { status: 500 });
  }
}
