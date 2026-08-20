// 主題產文 — 依 topic + count 產出 N 篇 draft (不 save,回 UI 讓用戶改)
// 輪流從 topic.productIds 挑產品; type=image 順便產 imagePrompt + 生圖
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb } from '@/lib/infuz-db.js';
import { submitAndPollV2WithRetry } from '@/lib/kie-image.js';
import { uploadToCloudinary } from '@/lib/cloudinary.js';
import { FIDELITY_INSTRUCTION_FOR_CLAUDE, enforceFidelityPrompt, productReferenceUrls } from '@/lib/infuz-image-rules.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const { topicId, count = 3, generateImages = null } = await req.json();
    if (!topicId) return NextResponse.json({ error: '缺 topicId' }, { status: 400 });

    const topicsDb = await loadDb('topics');
    const topic = (topicsDb.items || []).find((t) => t.id === topicId);
    if (!topic) return NextResponse.json({ error: 'topic 不存在' }, { status: 404 });

    const productsDb = await loadDb('products');
    const boundProducts = (topic.productIds || []).map((id) => (productsDb.items || []).find((p) => p.id === id)).filter(Boolean);

    const wantImages = generateImages !== null ? generateImages : (topic.type === 'image');
    const wantLong = topic.type === 'long';

    // 產 count 篇 draft — 一次跑 concurrently (Claude 快, KIE 慢, 各自跑)
    const jobs = Array.from({ length: count }, (_, i) => produceOne({
      topic, boundProducts, index: i, wantImages, wantLong,
    }));
    const results = await Promise.all(jobs);

    return NextResponse.json({
      posts: results,
      topicIncludePurchaseUrl: Boolean(topic.includePurchaseUrl),
    });
  } catch (e) {
    console.error('[produce] 錯誤:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function produceOne({ topic, boundProducts, index, wantImages, wantLong }) {
  const picked = boundProducts.length ? boundProducts[index % boundProducts.length] : null;
  const brand = INFUZ_BRAND;

  const productHint = picked
    ? `\n\n【本篇要帶的產品】
- 名稱: ${picked.name}
- 分類: ${picked.category || '?'} ${picked.gender ? `(${picked.gender})` : ''}
- 顏色: ${Array.isArray(picked.colors) ? picked.colors.join('、') : (picked.colors || '見圖')}
- 特色: ${picked.features || '(無)'}
- 產品照: ${picked.image_front || ''}
文案裡自然帶到這件單品(不要生硬)。`
    : '\n\n(本篇不綁定產品 · 只依品牌人格發文)';

  const length = wantLong ? '300-600 字' : '100-200 字';
  const system = `你是 ${brand.brand} 的社群小編。
品牌介紹:${brand.brand_summary}
受眾:${brand.audience}
品牌人格:${brand.brand_persona}

【當前主題】${topic.name}
${topic.description || ''}
${topic.systemPrompt ? `\n寫作方向: ${topic.systemPrompt}` : ''}

必須遵守:
- 用繁體中文寫作
- 台灣用語(不用「视频」「网站」等對岸詞)
- 不用 emoji 開頭
- 換行多、短句、有空氣感
- 這是第 ${index + 1} 篇, 要跟同主題其他篇的 hook 有差異

${wantImages ? FIDELITY_INSTRUCTION_FOR_CLAUDE : ''}`;

  const user = `【文案要求】
長度: ${length}${productHint}

${wantImages ? `【配圖】
需要生一張圖。imagePrompt (英文) 要描述: 一位 ${brand.brand} 女性模特兒穿著上面提到的產品${picked ? ` (${picked.name})` : ''}, 場景要呼應主題「${topic.name}」的氛圍。日系冷光、柔和、有空氣感、film grain aesthetic。左上角留白給 logo。不要露臉特寫、不要小孩、不要浮水印。文字/數字絕對不能出現在圖上。
${topic.imagePrompt ? `參考風格: ${topic.imagePrompt}` : ''}
` : ''}
請回傳 JSON:
{
  "text": "貼文文字(繁體中文,${length},含換行)",
  ${wantImages ? '"imagePrompt": "英文 image-to-image prompt (見上方指示)",' : ''}
  "hashtags": "3-6 個相關 hashtag (#開頭,空白分隔)"
}`;

  const draft = await callJSON({
    system,
    user,
    maxTokens: wantLong ? 3000 : 2000,
    temperature: 0.85,
    endpoint: 'topic-produce',
  });

  let imageUrl = null;
  let imageError = null;
  if (wantImages && draft.imagePrompt) {
    try {
      // 多角度參考照 (front + back + detail) — 讓 KIE 更能識別「就是這一件」
      const refs = productReferenceUrls(picked);
      // 強制加 fidelity prefix — 即使 Claude 產的 prompt 沒帶,也 append 上去
      const finalPrompt = enforceFidelityPrompt(draft.imagePrompt);
      const kieResult = await submitAndPollV2WithRetry(
        {
          prompt: finalPrompt,
          referenceImages: refs,
          aspect_ratio: topic.aspectRatio || '4:5',
        },
        { maxRetries: 1 },
      );
      const uploaded = await uploadToCloudinary(kieResult.kieUrl, { folder: 'infuz/topics' });
      imageUrl = uploaded.url;
    } catch (e) {
      imageError = e.message;
      console.error('[produce] KIE 生圖失敗:', e.message);
    }
  }

  return {
    _localId: `draft_${Date.now()}_${index}`,
    topicId: topic.id,
    text: (draft.text || '').trim(),
    hashtags: draft.hashtags || '',
    imagePrompt: draft.imagePrompt || '',
    imageUrl,
    imageError,
    pickedProductId: picked?.id || null,
    pickedProductName: picked?.name || null,
    pickedProductImage: picked?.image_front || null,
    pickedProductPurchaseUrl: picked?.purchase_url || null,
    // 若 topic 有設 includePurchaseUrl,draft 預設帶連結
    includePurchaseUrl: Boolean(topic.includePurchaseUrl && picked?.purchase_url),
  };
}
