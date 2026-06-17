// /api/infuz/generate — 從 3 個 DB 選資料,組 prompt,KIE 生 1:1,上 Cloudinary
// mode: 'single' (1 產品) or 'combo' (上衣 + 下身)
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';
import { loadDb } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function findById(kind, id) {
  const db = await loadDb(kind);
  const found = (db.items || []).find((x) => x.id === id);
  if (!found) throw new Error(`${kind} id "${id}" not found`);
  return found;
}

/**
 * 替換情境 prompt 中的 {{product}} 為實際產品名稱字串
 */
function fillTemplate(template, productLabel) {
  if (!template) return '';
  return template
    .replace(/\{\{\s*product\s*\}\}/gi, productLabel)
    .replace(/\{\{\s*item\s*\}\}/gi, productLabel);
}

function buildModelBlock(model) {
  if (!model) return '';
  const parts = ['Featured model character:'];
  if (model.name) parts.push(`name "${model.name}" (id ${model.id}).`);
  if (model.style) parts.push(`Description: ${model.style.slice(0, 400)}`);
  if (model.skin_tone) parts.push(`Skin tone: ${model.skin_tone}.`);
  if (model.hairstyle) parts.push(`Hairstyle: ${model.hairstyle}.`);
  parts.push('Keep this person\'s face, skin tone, hairstyle, and overall appearance consistent with the reference image.');
  return parts.join(' ');
}

function buildProductBlock(product, role = 'item') {
  if (!product) return '';
  const parts = [];
  parts.push(`${role.toUpperCase()}: "${product.name || product.id}" (SKU ${product.id}).`);
  if (product.colors) parts.push(`Available colors: ${product.colors}.`);
  if (product.features) {
    parts.push(`Product details: ${product.features.replace(/\n+/g, ' ').slice(0, 300)}`);
  }
  return parts.join(' ');
}

const PACKAGING_RULES = [
  'CRITICAL PRODUCT FIDELITY: Preserve the EXACT original colors, shape, silhouette, fabric texture, prints, embroidery, hardware, stitching, and any visible logos or tags. Do NOT recolor, alter, or restyle the garment. Only the background / scene / lighting around it may change.',
  'ABSOLUTELY FORBIDDEN — HARD RULE: Under NO circumstances may you invent, redesign, replace, modify, or stylize the garment. The clothing in the output image MUST be pixel-faithful to the reference. Do NOT swap silhouettes. Do NOT redraw prints. Do NOT recolor. If you cannot keep the garment identical, output it as-is from the reference rather than imagining a new variant. This rule overrides any other creative direction.',
];

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    }
    const {
      mode = 'single',
      productId, topId, bottomId, modelId, scenarioId,
      extraPrompt = '',
    } = await req.json();

    if (!modelId) return NextResponse.json({ error: 'modelId required' }, { status: 400 });
    if (!scenarioId) return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });
    if (mode === 'single' && !productId) {
      return NextResponse.json({ error: 'productId required for mode=single' }, { status: 400 });
    }
    if (mode === 'combo' && (!topId || !bottomId)) {
      return NextResponse.json({ error: 'topId + bottomId required for mode=combo' }, { status: 400 });
    }

    // === Load DB rows ===
    const model = await findById('models', modelId);
    const scenario = await findById('scenarios', scenarioId);

    let products = [];
    let productLabel = '';
    if (mode === 'single') {
      const p = await findById('products', productId);
      products = [p];
      productLabel = p.name || p.id;
    } else {
      const top = await findById('products', topId);
      const bottom = await findById('products', bottomId);
      products = [top, bottom];
      productLabel = `the outfit (top: "${top.name || top.id}", bottom: "${bottom.name || bottom.id}")`;
    }

    // === Build prompt ===
    const promptParts = [];

    // 1. 情境模板（{{product}} → 產品名稱）
    promptParts.push(fillTemplate(scenario.prompt || '', productLabel));

    // 2. 產品細節
    if (mode === 'single') {
      promptParts.push(buildProductBlock(products[0], 'garment'));
    } else {
      promptParts.push(buildProductBlock(products[0], 'TOP'));
      promptParts.push(buildProductBlock(products[1], 'BOTTOM'));
      promptParts.push('Both pieces are worn together by the same model as a complete outfit. Show top and bottom clearly visible in the composition.');
    }

    // 3. 模特兒描述
    promptParts.push(buildModelBlock(model));

    // 4. 多參考圖角色說明
    // 順序: [產品圖 1..N, 模特參考圖]
    const refImages = [];
    for (const p of products) {
      if (p.image_front) refImages.push(p.image_front);
    }
    if (model.reference_image) refImages.push(model.reference_image);
    const refLabels = [];
    if (mode === 'single') {
      refLabels.push('[1] Garment appearance source');
      if (model.reference_image) refLabels.push(`[${refImages.length}] Model character reference`);
    } else {
      refLabels.push('[1] TOP appearance source');
      refLabels.push('[2] BOTTOM appearance source');
      if (model.reference_image) refLabels.push(`[${refImages.length}] Model character reference`);
    }
    promptParts.push(`Reference images (in order): ${refLabels.join(', ')}. Combine these references to compose ONE final image with the model wearing the garment(s) in the scene described above.`);

    // 5. 強制 fidelity
    promptParts.push(...PACKAGING_RULES);

    // 6. 整體品質
    promptParts.push('Photorealistic fashion photography, high quality, social media ready, natural lighting consistent with the scene, 1:1 square format.');

    // 7. 額外指示
    if (extraPrompt) promptParts.push(`Extra direction: ${extraPrompt}`);

    const fullPrompt = promptParts.filter(Boolean).join(' ');

    // === KIE 生圖 ===
    const t0 = Date.now();
    const taskId = await submitImageV2({
      prompt: fullPrompt,
      referenceImages: refImages.slice(0, 4), // KIE 最多 4 張
      aspect_ratio: '1:1',
    });
    const kieUrl = await pollImageV2(taskId);
    const buf = await downloadImage(kieUrl);
    const up = await uploadToCloudinary(buf, { folder: 'infuz/results' });

    return NextResponse.json({
      url: up.url,
      cloudinaryPublicId: up.publicId,
      kieTaskId: taskId,
      kieMs: Date.now() - t0,
      prompt: fullPrompt,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
