// 上傳圖片 → Claude vision 分析 → 中文構圖提示詞
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { trackAnthropicResp } from '@/lib/infuz-usage.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SYS = `你是專業的時尚廣告構圖分析師。看一張參考圖,輸出一段繁體中文構圖描述,給生圖 AI 模仿構圖用。

輸出 JSON 格式 (嚴格遵守,不要 markdown):
{
  "composition_prompt": "繁體中文構圖描述,80-150 字。涵蓋:鏡頭角度(俯/平/仰) / 視線高度 / 主體位置 / 留白方向 / 光源方向 / 景深(淺/深) / 排版佈局 / 視覺風格 / 色調氛圍。**只描述構圖元素,不描述具體物件或人物身分**(我們只模仿構圖,不抄產品)。",
  "has_person": true,
  "person_description": "若有人物 — 中文一句話描述人物 (性別 / 年齡感 / 穿著風格 / 姿勢 / 表情 / 與鏡頭關係,≤40 字);無人物則為空字串"
}`;

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  let mediaType = 'image/jpeg';
  if (/png/i.test(ct)) mediaType = 'image/png';
  else if (/webp/i.test(ct)) mediaType = 'image/webp';
  else if (/gif/i.test(ct)) mediaType = 'image/gif';
  else if (/\.png(\?|$)/i.test(url)) mediaType = 'image/png';
  else if (/\.webp(\?|$)/i.test(url)) mediaType = 'image/webp';
  return { data: buf.toString('base64'), media_type: mediaType };
}

function tolerantParse(text) {
  let s = (text || '').trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  try { return JSON.parse(s); } catch (_) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (_) {}
  }
  throw new Error('parse fail: ' + s.slice(0, 200));
}

export async function POST(req) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    const { data, media_type } = await fetchAsBase64(imageUrl);
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system: SYS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: '請分析這張參考圖,輸出 JSON (不要 markdown)。' },
        ],
      }],
    });
    await trackAnthropicResp(resp, MODEL, 'analyze-composition');
    const text = resp.content.map((b) => b.text || '').join('');
    const parsed = tolerantParse(text);
    return NextResponse.json({
      composition_prompt: parsed.composition_prompt || '',
      has_person: !!parsed.has_person,
      person_description: parsed.person_description || '',
    });
  } catch (e) {
    console.error('[analyze-composition]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
