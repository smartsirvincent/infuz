// 主題發想 — Claude 依方向 + 產品/品牌 建議 10 個主題卡
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { direction = '', defaultType = 'text', productIds = [], count = 10 } = await req.json();

    let productHint = '';
    if (productIds.length) {
      const db = await loadDb('products');
      const items = (db.items || []).filter((p) => productIds.includes(p.id));
      productHint = items.length
        ? `\n\n【綁定產品(產文時輪流帶入)】\n` + items.map((p, i) => `${i + 1}. ${p.name} (${p.category}/${p.gender || '?'})${p.features ? ' · ' + p.features.slice(0, 60) : ''}`).join('\n')
        : '';
    } else {
      productHint = '\n\n(未綁定產品 · 主題會偏向品牌/生活/場景/名言方向)';
    }

    const system = `你是 ${INFUZ_BRAND.brand} 的社群主編。
品牌介紹:${INFUZ_BRAND.brand_summary}
受眾:${INFUZ_BRAND.audience}
品牌人格:${INFUZ_BRAND.brand_persona}

任務:依用戶指定的方向,建議 ${count} 個「主題」— 主題是一組具備連貫寫作角度的貼文系列(例如「梨形身材救星系列」「早晨通勤儀式感」)。
不是單篇文案。每個主題可以延伸出 10-30 篇不同文案。

必須遵守:
- 每個主題要能長期產文,避免只寫一篇就寫完的角度(例如「XX 商品開箱」= NG,「XX 場景系列」= OK)
- 台灣繁體用語,不用對岸詞
- 主題差異化,不要 10 個都在講顯瘦
- type 有 3 種選擇: 'text'(短文 100-200 字) / 'long'(長文 300-600 字) / 'image'(圖文並茂,會 AI 生圖)`;

    const user = `方向:${direction || '(用戶未指定 — 由你判斷本品牌適合的角度)'}
預設類型:${defaultType} (可以每個主題自己決定不同類型)
${productHint}

請回傳 JSON:
{
  "topics": [
    {
      "name": "主題名(中文,≤ 15 字)",
      "description": "這個主題在寫什麼、為誰寫、切入角度(50-100 字)",
      "suggestedType": "text" | "long" | "image",
      "sampleHook": "這個主題典型的第一句 hook 範例(讓用戶能感受口吻)",
      "postingAngle": "產文時要注意的方向提示(給 AI 產文用,30-80 字)"
    },
    ...
  ]
}`;

    const result = await callJSON({
      system,
      user,
      maxTokens: 4000,
      temperature: 0.85,
      endpoint: 'topics-discover',
    });

    return NextResponse.json({
      topics: (result.topics || []).slice(0, count),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
