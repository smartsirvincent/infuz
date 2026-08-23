// 主題產文 — 依 topic + count 產出 N 篇 draft (不 save,回 UI 讓用戶改)
// 輪流從 topic.productIds 挑產品; type=image 順便產 imagePrompt + 生圖
// 支援本次覆寫 overrides + imageSource 選項 (product_photo 直接用產品照, 不呼 KIE)
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb, saveDb } from '@/lib/infuz-db.js';
import { submitAndPollV2WithRetry } from '@/lib/kie-image.js';
import { uploadToCloudinary } from '@/lib/cloudinary.js';
import { FIDELITY_INSTRUCTION_FOR_CLAUDE, enforceFidelityPrompt, productReferenceUrls } from '@/lib/infuz-image-rules.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const { topicId, count = 3, overrides = {}, saveBack = false, startIndex = 0 } = await req.json();
    if (!topicId) return NextResponse.json({ error: '缺 topicId' }, { status: 400 });

    const topicsDb = await loadDb('topics');
    const topic = (topicsDb.items || []).find((t) => t.id === topicId);
    if (!topic) return NextResponse.json({ error: 'topic 不存在' }, { status: 404 });

    // 有效值 = topic + overrides
    const effective = {
      ...topic,
      systemPrompt: overrides.systemPrompt !== undefined ? overrides.systemPrompt : topic.systemPrompt,
      imagePrompt: overrides.imagePrompt !== undefined ? overrides.imagePrompt : topic.imagePrompt,
      productIds: overrides.productIds !== undefined ? overrides.productIds : topic.productIds,
      imageSource: overrides.imageSource !== undefined ? overrides.imageSource : (topic.imageSource || 'ai_generated'),
      noFace: overrides.noFace !== undefined ? overrides.noFace : Boolean(topic.noFace),
      removeHead: overrides.removeHead !== undefined ? overrides.removeHead : Boolean(topic.removeHead),
      promoInfo: overrides.promoInfo !== undefined ? overrides.promoInfo : (topic.promoInfo || ''),
    };

    const productsDb = await loadDb('products');
    // 過濾暫停產品
    const boundProducts = (effective.productIds || [])
      .map((id) => (productsDb.items || []).find((p) => p.id === id))
      .filter((p) => p && !p.paused);

    const wantImages = topic.type === 'image';
    const wantLong = topic.type === 'long';
    const useProductPhoto = wantImages && effective.imageSource === 'product_photo';

    // 產 count 篇 draft
    // 新流程: 前端一篇一篇呼(count=1), 每篇獨立 300s 不會撞 timeout, index 從 startIndex 起
    // 舊流程(count>1): 保留分批處理相容, 文字每批 20/圖片每批 5
    const CHUNK = wantImages && !useProductPhoto ? 5 : 20;
    const results = [];
    for (let i = 0; i < count; i += CHUNK) {
      const chunkSize = Math.min(CHUNK, count - i);
      const chunk = Array.from({ length: chunkSize }, (_, k) => produceOne({
        topic: effective, boundProducts, index: startIndex + i + k, wantImages, wantLong, useProductPhoto,
      }));
      const chunkResults = await Promise.all(chunk);
      results.push(...chunkResults);
    }

    // 若 saveBack, 更新 topic 為 overrides 值
    if (saveBack && Object.keys(overrides).length) {
      const items = (topicsDb.items || []).map((t) =>
        t.id === topicId ? { ...t, ...overrides, updatedAt: new Date().toISOString() } : t
      );
      await saveDb('topics', { items });
    }

    return NextResponse.json({
      posts: results,
      topicIncludePurchaseUrl: Boolean(topic.includePurchaseUrl),
    });
  } catch (e) {
    console.error('[produce] 錯誤:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function produceOne({ topic, boundProducts, index, wantImages, wantLong, useProductPhoto }) {
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
  // useProductPhoto 時不需要 imagePrompt (直接用產品照)
  const needAiImagePrompt = wantImages && !useProductPhoto;

  const system = `你是 ${brand.brand} 的社群小編。
品牌介紹:${brand.brand_summary}
受眾:${brand.audience}
品牌人格:${brand.brand_persona}

【當前主題】${topic.name}
${topic.description || ''}
${topic.systemPrompt ? `\n寫作方向: ${topic.systemPrompt}` : ''}
${topic.promoInfo ? `\n【本次促銷訊息 (必須自然帶入文案)】\n${topic.promoInfo}\n(語氣不要像廣告 slogan, 要融入敘事)` : ''}

必須遵守:
- 用繁體中文寫作
- 台灣用語(不用「视频」「网站」等對岸詞)
- 不用 emoji 開頭
- 換行多、短句、有空氣感
- 這是第 ${index + 1} 篇, 要跟同主題其他篇的 hook 有差異

${needAiImagePrompt ? FIDELITY_INSTRUCTION_FOR_CLAUDE : ''}`;

  const user = `【文案要求】
長度: ${length}${productHint}

${needAiImagePrompt ? `【配圖】
需要生一張 AI 圖。imagePrompt (英文) 要描述: 一位 ${brand.brand} 女性模特兒穿著上面提到的產品${picked ? ` (${picked.name})` : ''}, 場景要呼應主題「${topic.name}」的氛圍。日系冷光、柔和、有空氣感、film grain aesthetic。左上角留白給 logo。不要小孩、不要浮水印。文字/數字絕對不能出現在圖上。
${topic.removeHead ? '⚠ 本次要求「去除頭部」: imagePrompt 必須明確寫 "composition from neck down only, entire head cropped out of frame, torso and body focus, no head visible, no hair visible" — 整個頭部不出現於畫面,構圖從頸部以下開始。' : (topic.noFace ? '⚠ 本次要求不露臉(但保留頭部輪廓): imagePrompt 必須明確寫 "no face visible / face cropped out / back view / side profile with hair covering face / face turned away from camera",不能出現正面臉部或臉部特寫。' : '')}
${topic.imagePrompt ? `參考風格: ${topic.imagePrompt}` : ''}
` : useProductPhoto ? '\n【配圖】會直接用產品原圖, 不用你產 imagePrompt\n' : ''}
請回傳 JSON:
{
  "text": "貼文文字(繁體中文,${length},含換行)",
  ${needAiImagePrompt ? '"imagePrompt": "英文 image-to-image prompt (見上方指示)",' : ''}
  "hashtags": "3-6 個相關 hashtag (#開頭,空白分隔)"
}`;

  const draft = await callJSON({
    system,
    user,
    maxTokens: wantLong ? 3000 : 2000,
    temperature: 0.85,
    endpoint: 'topic-produce',
    // 長文用 haiku 省 3x cost, 短文/圖片保持 sonnet 保質感
    model: wantLong ? 'claude-haiku-4-5' : undefined,
  });

  let imageUrl = null;
  let imageError = null;
  let usedImageSource = null;

  if (wantImages) {
    if (useProductPhoto && picked?.image_front) {
      // 直接用產品原圖 — 100% 保真, 免費, 秒回
      imageUrl = picked.image_front;
      usedImageSource = 'product_photo';
    } else if (draft.imagePrompt && picked) {
      try {
        const refs = productReferenceUrls(picked);
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
        usedImageSource = 'ai_generated';
      } catch (e) {
        imageError = e.message;
        console.error('[produce] KIE 生圖失敗:', e.message);
      }
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
    imageSource: usedImageSource,
    pickedProductId: picked?.id || null,
    pickedProductName: picked?.name || null,
    pickedProductImage: picked?.image_front || null,
    pickedProductPurchaseUrl: picked?.purchase_url || null,
    includePurchaseUrl: Boolean(topic.includePurchaseUrl && picked?.purchase_url),
  };
}
