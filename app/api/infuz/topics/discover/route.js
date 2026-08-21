// 主題發想 — Claude 依方向 + 產品/品牌 + 已存在主題 建議 N 個主題卡
// count: 1 / 3 / 5 / 7 (預設 5)
// existingNames: 從 topics DB 撈, 讓 Claude 避開已有名稱, 不建重複主題
// defaultType: 建議的全部照這個類型(text/long/image), 不再混
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TYPE_HINT = {
  text: '短文 100-200 字, 適合 Threads 快讀',
  long: '長文 300-600 字, 適合 FB 長貼文/深度觀點',
  image: '圖文並茂, 100-200 字 + AI 生一張搭配圖',
};

export async function POST(req) {
  try {
    const { direction = '', defaultType = 'text', productIds = [], count = 5 } = await req.json();
    const N = [1, 3, 5, 7].includes(count) ? count : 5;
    const type = ['text', 'long', 'image'].includes(defaultType) ? defaultType : 'text';

    // 讀已有 topics, 提供給 Claude 排除清單
    const topicsDb = await loadDb('topics');
    const existingTopics = topicsDb.items || [];
    const existingNames = existingTopics.map((t) => t.name).filter(Boolean);

    let productHint = '';
    if (productIds.length) {
      const db = await loadDb('products');
      const items = (db.items || []).filter((p) => productIds.includes(p.id) && !p.paused);
      productHint = items.length
        ? `\n\n【綁定產品(產文時輪流帶入)】\n` + items.map((p, i) => {
            const feat = typeof p.features === 'string' ? p.features : Array.isArray(p.features) ? p.features.join(', ') : '';
            return `${i + 1}. ${p.name} (${p.category}/${p.gender || '?'})${feat ? ' · ' + feat.slice(0, 60) : ''}`;
          }).join('\n')
        : '';
    } else {
      productHint = '\n\n(未綁定產品 · 主題會偏向品牌/生活/場景/觀點方向)';
    }

    const avoidBlock = existingNames.length
      ? `\n\n【已存在的主題(絕對不要建議名稱或角度相似的)】\n${existingNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n請發想「明顯不同角度」的新主題, 名稱不能重複, 切入點也要有差異化。`
      : '';

    const system = `你是 ${INFUZ_BRAND.brand} 的社群主編。
品牌介紹:${INFUZ_BRAND.brand_summary}
受眾:${INFUZ_BRAND.audience}
品牌人格:${INFUZ_BRAND.brand_persona}

任務:依用戶指定方向, 建議 ${N} 個「主題」— 主題是一組具備連貫寫作角度的貼文系列(例如「梨形身材救星系列」「早晨通勤儀式感」), 不是單篇文案。每個主題可延伸出 10-30 篇不同文案。

【強制規範】
- 全部主題的 type 都必須是 "${type}" (${TYPE_HINT[type]}), 不可混其他類型
- 每個主題差異化, 避免 ${N} 個都在講同一件事
- 主題要能長期產文, 避免「XX 商品開箱」這類只寫一篇就結束的角度
- 台灣繁體用語, 不用「视频/网站/哪儿」等對岸詞
- postingAngle 欄位要寫得具體詳細, 因為這會直接進 systemPrompt 影響後續 AI 產文品質`;

    const user = `方向:${direction || '(用戶未指定 — 由你判斷本品牌適合的角度)'}
本次要建議數量:${N} 個
類型(全部固定):${type} (${TYPE_HINT[type]})
${productHint}${avoidBlock}

請回傳 JSON:
{
  "topics": [
    {
      "name": "主題名(中文,≤ 15 字, 不能跟已有主題名重複)",
      "description": "這個主題在寫什麼、為誰寫、切入角度(50-100 字)",
      "postingAngle": "產文時的具體方向提示(100-200 字, 越具體 AI 產出質量越高。含: 開場 hook 常用手法/要出現的關鍵字/避開的用詞/常用的敘事結構)",
      "sampleHook": "典型第一句 hook 範例(讓用戶感受口吻)"
    }
  ]
}`;

    const result = await callJSON({
      system,
      user,
      maxTokens: 4000,
      temperature: 0.85,
      endpoint: 'topics-discover',
    });

    // 強制填入 suggestedType (保持相容 bulk-add)
    const topics = (result.topics || []).slice(0, N).map((t) => ({ ...t, suggestedType: type }));

    return NextResponse.json({
      topics,
      appliedCount: N,
      appliedType: type,
      excludedNames: existingNames,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
