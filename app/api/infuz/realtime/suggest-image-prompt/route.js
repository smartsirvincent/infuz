// AI 建議一版 English image prompt (給 KIE)
// 依縣市/產品池/模特兒性別/文案方向產一版起手範本,用戶再微調
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { INFUZ_BRAND } from '@/lib/infuz-brand.js';
import { loadDb } from '@/lib/infuz-db.js';
import { FIDELITY_INSTRUCTION_FOR_CLAUDE, enforceFidelityPrompt } from '@/lib/infuz-image-rules.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { locations = [], modelGender = 'female', productPool = 'female', prompt = '', aspectRatio = '4:5' } = await req.json();

    // 隨機挑一個產品當範例(避免 prompt 太抽象)
    const db = await loadDb('products');
    const clothing = (db.items || []).filter((p) => p.category !== '珠寶' && p.image_front);
    let filtered = clothing;
    if (productPool === 'female') filtered = clothing.filter((p) => p.gender === '女性' || !p.gender);
    if (productPool === 'male') filtered = clothing.filter((p) => p.gender === '男性');
    if (!filtered.length) filtered = clothing;
    const sample = filtered.length ? filtered[Math.floor(Math.random() * filtered.length)] : null;

    const system = `You are an expert prompt engineer for KIE GPT Image 2 (image-to-image).
Generate a concise, high-quality English prompt for editorial fashion photography.

Rules (must follow):
- Style: editorial fashion photo, Asian ${modelGender === 'male' ? 'male' : 'female'} model, soft natural light, film grain aesthetic, minimal composition
- Brand mood: "${INFUZ_BRAND.brand_persona.replace(/[\r\n]+/g, ' ')}"
- Compose to leave the top-left corner empty for a logo overlay (~1/3 width, ~1/5 height clean area)
- No text/numbers on the image
- No face close-up, no children, no watermark
- Scene should react to Taiwan weather (rain/heat/cold)
- Aspect ratio target: ${aspectRatio}
- 60-120 words, single paragraph, direct prompt (no numbering)

${FIDELITY_INSTRUCTION_FOR_CLAUDE}`;

    const user = `Locations context (weather-relevant scene inspiration): ${locations.join(', ') || 'Taipei'}
Copy angle (what the post is about): ${prompt || '(unspecified — general daily-life outfit tip)'}
${sample ? `Product to be worn/carried: ${sample.name} (category: ${sample.category}, features: ${sample.features || 'n/a'}). The product photo is used as image-to-image reference so the generated image must show this exact garment.` : ''}

Write the image prompt now.`;

    const result = await callJSON({
      system: system + '\n\nReply as JSON: {"imagePrompt": "..."}',
      user,
      maxTokens: 800,
      temperature: 0.7,
      endpoint: 'suggest-image-prompt',
    });

    // 保證回傳的 prompt 前綴帶 fidelity rule (即使 Claude 忘了)
    const safePrompt = enforceFidelityPrompt((result.imagePrompt || '').trim());
    return NextResponse.json({
      imagePrompt: safePrompt,
      sampleProduct: sample ? { id: sample.id, name: sample.name, image_front: sample.image_front } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
