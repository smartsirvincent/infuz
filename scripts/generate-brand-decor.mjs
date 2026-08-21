// 一次性: 產 3 張品牌氛圍圖裝飾網站
// 執行: cd infuz && node scripts/generate-brand-decor.mjs
// 完成後把 Cloudinary URLs print 出來, 直接 hardcode 進 hub 頁
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function submit(prompt, aspectRatio) {
  const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2-image-to-image',
      input: { prompt, input_urls: [], aspect_ratio: aspectRatio },
    }),
  });
  const d = await res.json();
  if (!d.data?.taskId) throw new Error(JSON.stringify(d));
  return d.data.taskId;
}

async function poll(taskId) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` },
    });
    const d = await res.json();
    if (d.data?.state === 'success') {
      const r = JSON.parse(d.data.resultJson || '{}');
      return r.resultUrls?.[0] || r.result_urls?.[0];
    }
    if (d.data?.state === 'fail') throw new Error(d.data.failMsg);
  }
  throw new Error('timeout');
}

async function uploadCloudinary(url, publicId) {
  const form = new FormData();
  form.append('file', url);
  form.append('folder', 'infuz/decor');
  form.append('public_id', publicId);
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp, folder: 'infuz/decor', public_id: publicId };
  const sortedString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const crypto = await import('crypto');
  const signature = crypto.createHash('sha1').update(sortedString + process.env.CLOUDINARY_API_SECRET).digest('hex');
  form.append('timestamp', String(timestamp));
  form.append('api_key', process.env.CLOUDINARY_API_KEY);
  form.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: form,
  });
  const data = await res.json();
  return data.secure_url;
}

const jobs = [
  {
    key: 'hero-01',
    aspect: '21:9',
    prompt: 'Editorial fashion photography atmosphere shot, soft diffused Japanese natural light through sheer curtain, minimal empty white-grey studio interior, subtle fabric drape hanging in composition edge, muted cool tones with pale blue-grey and warm off-white palette, film grain aesthetic, very shallow depth of field, no visible product or model, no text, minimalist negative space composition, atmospheric mood shot, luxury editorial magazine feel',
  },
  {
    key: 'divider-01',
    aspect: '21:9',
    prompt: 'Abstract macro texture of soft cotton twill fabric weave in cool grey-beige tone, extreme close-up showing subtle fiber detail, soft directional light, muted monochrome palette, film photography aesthetic, minimalist composition, no logos or text, editorial texture study',
  },
  {
    key: 'atmosphere-01',
    aspect: '4:5',
    prompt: 'Minimalist still life editorial composition, empty pale marble surface with soft morning light casting gentle shadow from unseen window frame, one delicate ceramic vessel in the corner (out of focus), muted palette of bone white, pale grey and soft taupe, film grain, calm meditative atmosphere, no product no text no model, Japanese-inspired wabi-sabi minimalism, luxury editorial magazine still life',
  },
];

console.log('產 3 張品牌氛圍圖 (無產品/無 model, 無需 fidelity 保護)...\n');
const out = {};
for (const j of jobs) {
  try {
    console.log(`[${j.key}] submit...`);
    const taskId = await submit(j.prompt, j.aspect);
    console.log(`[${j.key}] taskId=${taskId} polling...`);
    const kieUrl = await poll(taskId);
    console.log(`[${j.key}] KIE done, uploading Cloudinary...`);
    const cldUrl = await uploadCloudinary(kieUrl, j.key);
    console.log(`[${j.key}] ✓ ${cldUrl}\n`);
    out[j.key] = cldUrl;
  } catch (e) {
    console.error(`[${j.key}] FAIL: ${e.message}`);
  }
}
console.log('\n=== 完成 · 貼進 hub 頁 hero 用 ===');
console.log(JSON.stringify(out, null, 2));
