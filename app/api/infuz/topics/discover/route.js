// 主題發想 — Claude 依方向 + 產品/品牌 + 已存在主題 建議 N 個主題卡
// count: 1 / 3 / 5 / 7 (預設 5)
// existingNames: 從 topics DB 撈, 讓 Claude 避開已有名稱, 不建重複主題
// defaultType: 建議的全部照這個類型(text/long/image), 不再混
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb } from '@/lib/infuz-db.js';
import { ENGAGEMENT_ARCHETYPES } from '@/lib/infuz-engagement-archetypes.js';
import { stripMarkdown, NO_MARKDOWN_RULE } from '@/lib/infuz-sanitize.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TYPE_HINT = {
  text: '短文 100-200 字, 適合 Threads 快讀',
  long: '長文 300-600 字, 適合 FB 長貼文/深度觀點',
  image: '圖文並茂, 100-200 字 + AI 生一張搭配圖',
  engagement: 'Threads 高互動短文, 冷知識/生活觀察/反直覺洞見, 不與品牌綁定, 100-180 字',
  poll: 'Threads 投票文, 主題敘述 + 4 個選項, 可與品牌相關, 60-120 字前言',
};

export async function POST(req) {
  try {
    const { direction = '', defaultType = 'text', productIds = [], count = 5 } = await req.json();
    const N = [1, 3, 5, 7].includes(count) ? count : 5;
    const type = ['text', 'long', 'image', 'engagement', 'poll'].includes(defaultType) ? defaultType : 'text';

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

    // 高互動 type 走完全不同的 systemPrompt · 避開品牌相關題材
    const isEngagement = type === 'engagement';

    const archetypePalette = isEngagement
      ? `\n\n【7 個推薦 archetype (可從中挑, 或組合出更好的)】\n${ENGAGEMENT_ARCHETYPES.map((a, i) => `${i + 1}. ${a.name} — ${a.hint}`).join('\n')}`
      : '';

    const system = isEngagement
      ? `你是 Threads 高互動貼文的主編。 目標是為一個經營者建議 ${N} 個「純為了拉聲量」的貼文主題,主題本身跟品牌、產品完全無關。

任務:發想 ${N} 個能持續產出 20-30 則 Threads 高互動短文的主題方向。 每個主題是一組長期選題, 不是單篇貼文。

【核心原則】
- 主題完全不能涉及任何品牌/商品/購物/廣告元素
- 目標是引起路人留言、按讚、轉發, 不是賣東西
- 每個主題必須有明確 hook 手法 (問句/反差/爭議/清單/冷知識 五選一)
- 適合台灣 Threads 語境, 越像深夜傳 LINE 給朋友越好

【絕對禁止的題材 (Meta 降推 + 留言區品質崩壞)】
- 政黨、候選人、選舉、政策辯論
- 疫苗、藥品、療效、健康醫療爭議
- 戰男女、戰世代、戰種族、戰地域、戰南北
- 中國政治敏感詞
- 任何品牌/商品/購物/折扣${archetypePalette}

【主題「路要寬」原則 · 極重要】
- 不要用「XX 系列」這種太具體的角色/場景鎖死主題 (例如「神仙房東系列」只能寫房東太窄)
- 一個主題應該有 20-30 個不同「角度/場景/情境」可延伸 · 不是同一件事講 30 次
- 涵蓋範圍越廣越好 · 只要語感一致即可
- 溫馨故事類、冷知識類、生活觀察類、共鳴類、對比選擇類、反差類都可以混

【主題名格式建議】
- 可以帶「系列」但不強制 (如「當你以為的...」「原來我一直誤會了...」「今天才發現...」)
- 名字要能讓人一看就想到 20+ 種變化, 而不是 3-5 種就寫完
- 避免用特定角色 (房東/同事/店員) 或特定場景 (捷運/早餐店) 綁死

【舉例】
✓ 好主題:「原來大家都這樣系列」(可延伸食物、習慣、認知、關係、日常 各種面向)
✓ 好主題:「今天才發現的溫柔」(可延伸家人、陌生人、老一輩、自己 多重情境)
✓ 好主題:「一輩子只能選一個」(可延伸食物、地點、習慣、時代、記憶)
✓ 好主題:「原本以為 · 沒想到」(涵蓋所有反差型情境 · 從尷尬到溫馨都有)
✗ 爛主題:「神仙房東系列」(綁死房東 · 寫 5 篇就重複)
✗ 爛主題:「香菜好吃嗎」(只能寫 1 篇)
✗ 爛主題:「幫我開箱這雙鞋」(涉及商品)`
      : `你是 ${INFUZ_BRAND.brand} 的社群主編。
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

    const user = isEngagement
      ? `方向:${direction || '(用戶未指定 — 從 7 個 archetype 挑最能持續產文的)'}
本次要建議數量:${N} 個
類型(全部固定):engagement (Threads 高互動短文, 60-180 字, 跟品牌無關)
${avoidBlock}

請回傳 JSON:
{
  "topics": [
    {
      "name": "主題名 (中文, ≤ 15 字, 涵蓋範圍要廣 · 不用強制帶「系列」二字)",
      "description": "這個主題會寫什麼類型的貼文 · 切入角度 · 為什麼會引起討論 (50-100 字)",
      "postingAngle": "產文時的具體 hook 手法 + 適用場景 + 常用句型 (150-250 字, 越具體 AI 產出的每篇越像人寫的)",
      "sampleHook": "第一句 hook 範例 ≤ 25 字 (真的口語感 · 不要文青)"
    }
  ]
}`
      : `方向:${direction || '(用戶未指定 — 由你判斷本品牌適合的角度)'}
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

    // 強制填入 suggestedType (保持相容 bulk-add) · 順便 strip markdown 避免 sampleHook 出現 **
    const topics = (result.topics || []).slice(0, N).map((t) => ({
      ...t,
      name: stripMarkdown(t.name || ''),
      description: stripMarkdown(t.description || ''),
      postingAngle: stripMarkdown(t.postingAngle || ''),
      sampleHook: stripMarkdown(t.sampleHook || ''),
      suggestedType: type,
    }));

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
