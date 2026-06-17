// /api/infuz/generate — 從 3 個 DB + 選項組 prompt → KIE 1:1 → Cloudinary
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';
import { loadDb, appendItems } from '@/lib/infuz-db.js';

function genAssetId() {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MAT-${ts}-${r}`;
}

async function saveAsset({ mode, displayMode, products, model, scenario, imageUrl, cloudinaryPublicId, kieTaskId, kieMs, textMode, slogan, promoInfo, noFace, compositionRefUrl }) {
  try {
    const productSnapshots = products.map((p) => ({
      id: p.id,
      name: p.name || '',
      purchase_url: p.purchase_url || '',
      image_front: p.image_front || '',
      gender: p.gender || '',
      category: p.category || '',
      price: p.price || '',
      colors: p.colors || '',
    }));
    await appendItems('assets', {
      id: genAssetId(),
      mode,
      displayMode: displayMode || '',
      products: productSnapshots,
      modelId: model?.id || '',
      modelName: model?.name || '',
      scenarioId: scenario?.id || '',
      scenarioName: scenario?.name || '',
      scenarioType: scenario?.type || '',
      imageUrl,
      cloudinaryPublicId,
      kieTaskId,
      kieMs,
      textMode: textMode || 'none',
      slogan: slogan || '',
      promoInfo: promoInfo || '',
      noFace: !!noFace,
      hasCompositionRef: !!compositionRefUrl,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[saveAsset] failed (non-fatal):', e.message);
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;

async function findById(kind, id) {
  const db = await loadDb(kind);
  const found = (db.items || []).find((x) => x.id === id);
  if (!found) throw new Error(`${kind} id "${id}" not found`);
  return found;
}

function fillTemplate(t, label) {
  return (t || '').replace(/\{\{\s*(product|item)\s*\}\}/gi, label);
}

function buildModelBlock(model) {
  if (!model) return '';
  const parts = ['Featured model character:'];
  if (model.name) parts.push(`name "${model.name}" (id ${model.id}).`);
  if (model.gender) parts.push(`Gender: ${model.gender}.`);
  if (model.style) parts.push(`Description: ${model.style.slice(0, 400)}`);
  if (model.skin_tone) parts.push(`Skin tone: ${model.skin_tone}.`);
  if (model.hairstyle) parts.push(`Hairstyle: ${model.hairstyle}.`);
  parts.push('Keep this person\'s face, skin tone, hairstyle, and overall appearance consistent with the reference image.');
  return parts.join(' ');
}

function buildProductBlock(p, role = 'GARMENT') {
  if (!p) return '';
  const parts = [];
  parts.push(`${role}: "${p.name || p.id}" (SKU ${p.id}).`);
  if (p.colors) parts.push(`Colors: ${p.colors}.`);
  if (p.gender) parts.push(`Target gender: ${p.gender}.`);
  if (p.features) parts.push(`Details: ${p.features.replace(/\n+/g, ' ').slice(0, 300)}`);
  return parts.join(' ');
}

function buildTextOverlay({ textMode, promoInfo, slogan }) {
  if (textMode === 'promo' && promoInfo?.trim()) {
    return `TEXT TO RENDER: Render the promotional text "${promoInfo.trim()}" as a bold, eye-catching overlay integrated into the composition (banner / sticker / corner badge style). It MUST appear in the image. STRICTLY no other text, no extra captions, no watermarks, no hashtags.`;
  }
  if (textMode === 'slogan' && slogan?.trim()) {
    return `TEXT TO RENDER: Render the slogan "${slogan.trim()}" as a bold, typographically integrated overlay within the composition. It MUST appear in the image. STRICTLY no other text, no extra captions, no watermarks, no hashtags, no product names as separate text.`;
  }
  return 'TEXT RENDERING — STRICT: Do NOT render any visible text whatsoever in the image. No headlines, no labels, no watermarks, no signage, no hashtags. Pure visual composition only.';
}

const FIDELITY = [
  'CRITICAL PRODUCT FIDELITY: Preserve EXACT original colors, shape, silhouette, fabric texture, prints, embroidery, hardware, stitching, and any visible logos. Do NOT recolor, alter, or restyle the garment.',
  'ABSOLUTELY FORBIDDEN — HARD RULE: Under NO circumstances may you invent, redesign, replace, modify, or stylize the garment. The clothing in the output MUST be pixel-faithful to the reference. This rule overrides any other creative direction.',
];

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    }
    const {
      mode = 'single',
      productId, topId, bottomId,
      productIds = [],        // 組合模式: 多個 product id
      displayMode = 'display', // 組合模式: 'display' (純陳列) | 'model' (搭配模特兒)
      modelId, scenarioId,
      textMode = 'none',
      promoInfo = '',
      slogan = '',
      noFace = false,
      compositionRefUrl = '',
      compositionPrompt = '',
      extraPrompt = '',
    } = await req.json();

    if (!scenarioId) return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });
    if (mode === 'single' && !productId) {
      return NextResponse.json({ error: 'productId required for mode=single' }, { status: 400 });
    }
    if (mode === 'combo' && (!topId || !bottomId)) {
      return NextResponse.json({ error: 'topId + bottomId required for mode=combo' }, { status: 400 });
    }
    if (mode === 'composition' && (!Array.isArray(productIds) || productIds.length < 2)) {
      return NextResponse.json({ error: 'composition 模式至少要 2 件產品' }, { status: 400 });
    }
    // single + combo 一定要 model; composition 在 model 模式才要
    const needsModel = mode !== 'composition' || displayMode === 'model';
    if (needsModel && !modelId) {
      return NextResponse.json({ error: 'modelId required' }, { status: 400 });
    }

    const scenario = await findById('scenarios', scenarioId);
    const model = needsModel ? await findById('models', modelId) : null;

    let products = [];
    let productLabel = '';
    if (mode === 'single') {
      const p = await findById('products', productId);
      products = [p];
      productLabel = p.name || p.id;
    } else if (mode === 'combo') {
      const top = await findById('products', topId);
      const bottom = await findById('products', bottomId);
      products = [top, bottom];
      productLabel = `the outfit (top: "${top.name || top.id}", bottom: "${bottom.name || bottom.id}")`;
    } else if (mode === 'composition') {
      products = [];
      for (const id of productIds) {
        products.push(await findById('products', id));
      }
      productLabel = `the collection (${products.length} pieces: ${products.map((p) => `"${p.name || p.id}"`).join(', ')})`;
    }

    // === Build prompt ===
    const parts = [];

    // 1. 情境 (替換 {{product}})
    parts.push(fillTemplate(scenario.prompt || '', productLabel));

    // 2. 產品
    if (mode === 'single') {
      parts.push(buildProductBlock(products[0], 'GARMENT'));
    } else if (mode === 'combo') {
      parts.push(buildProductBlock(products[0], 'TOP'));
      parts.push(buildProductBlock(products[1], 'BOTTOM'));
      parts.push('Both pieces are worn together by the same model as a complete outfit. Show top and bottom clearly visible in the composition.');
    } else if (mode === 'composition') {
      products.forEach((p, i) => parts.push(buildProductBlock(p, `ITEM ${i + 1}`)));
      if (displayMode === 'display') {
        parts.push(`Composition style: FLAT-LAY / MERCHANDISE DISPLAY photography. Arrange all ${products.length} pieces neatly together on a clean background — show every piece clearly with consistent lighting. Top-down or eye-level overhead view. NO MODEL, NO PEOPLE, NO HANDS, NO HUMAN PRESENCE. Items can overlap slightly to suggest styling pairings but each must be identifiable.`);
      } else {
        parts.push(`Composition style: Model wearing or styling all ${products.length} pieces together in a coherent outfit / look. Show each item clearly. If pieces can't be worn simultaneously (e.g., 2 pairs of pants), show one being worn and the others styled in-hand or arranged in the scene.`);
      }
    }

    // 3. 模特 (composition + display 模式不需要)
    if (model) parts.push(buildModelBlock(model));

    // 4. 不要人臉
    if (noFace) {
      parts.push('FACE HIDDEN: Crop, angle, or pose so the model\'s face is NOT clearly visible. Use back view, side profile cut off, head out of frame, or focus the composition on the body and garment. The model\'s identity should not be readable.');
    }

    // 5. 模仿構圖 (vision 中文 prompt)
    if (compositionPrompt?.trim()) {
      parts.push(`Composition guidance (mirror this framing / angle / layout only, NOT specific content): ${compositionPrompt.trim()}`);
    }

    // 6. 多參考圖角色說明
    const refImages = [];
    const refLabels = [];
    let idx = 1;
    if (mode === 'single') {
      if (products[0].image_front) {
        refImages.push(products[0].image_front);
        refLabels.push(`[${idx}] Garment appearance`); idx += 1;
      }
    } else if (mode === 'combo') {
      if (products[0].image_front) { refImages.push(products[0].image_front); refLabels.push(`[${idx}] TOP appearance`); idx += 1; }
      if (products[1].image_front) { refImages.push(products[1].image_front); refLabels.push(`[${idx}] BOTTOM appearance`); idx += 1; }
    } else if (mode === 'composition') {
      for (const p of products) {
        if (p.image_front) {
          refImages.push(p.image_front);
          refLabels.push(`[${idx}] ITEM "${p.name || p.id}" (SKU ${p.id}) appearance`); idx += 1;
        }
      }
    }
    if (model?.reference_image) { refImages.push(model.reference_image); refLabels.push(`[${idx}] Model character reference`); idx += 1; }
    if (compositionRefUrl) { refImages.push(compositionRefUrl); refLabels.push(`[${idx}] Composition inspiration ONLY (do NOT copy its content / colors / specific garments)`); idx += 1; }
    if (refLabels.length > 0) {
      parts.push(`Reference images (in order): ${refLabels.join(', ')}. Combine references appropriately for ONE final composition.`);
    }

    // 7. 文字渲染指令
    parts.push(buildTextOverlay({ textMode, promoInfo, slogan }));

    // 8. Fidelity hard rules
    parts.push(...FIDELITY);

    // 9. 品質 + 比例
    parts.push('Photorealistic fashion photography, high quality, social media ready, natural lighting consistent with the scene, 1:1 square format.');

    // 10. 額外
    if (extraPrompt) parts.push(`Extra direction: ${extraPrompt}`);

    const fullPrompt = parts.filter(Boolean).join(' ');

    // === KIE === (V2 接受最多 16 張,我們最多 10 張安全)
    const t0 = Date.now();
    const taskId = await submitImageV2({
      prompt: fullPrompt,
      referenceImages: refImages.slice(0, 10),
      aspect_ratio: '1:1',
    });
    const kieUrl = await pollImageV2(taskId);
    const buf = await downloadImage(kieUrl);
    const up = await uploadToCloudinary(buf, { folder: 'infuz/results' });
    const kieMs = Date.now() - t0;

    // 存進素材資料庫 (失敗不致命)
    await saveAsset({
      mode, displayMode, products, model, scenario,
      imageUrl: up.url,
      cloudinaryPublicId: up.publicId,
      kieTaskId: taskId,
      kieMs,
      textMode, slogan, promoInfo, noFace, compositionRefUrl,
    });

    return NextResponse.json({
      url: up.url,
      cloudinaryPublicId: up.publicId,
      kieTaskId: taskId,
      kieMs,
      prompt: fullPrompt,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
