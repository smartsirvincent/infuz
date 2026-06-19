// 上傳一張靈感圖 → Claude vision 分析 → 產出完整情境指令 (含產品呈現方式 + 背景 + 道具 + 構圖)
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

const SYS = `你是專業時尚廣告情境設計師。看一張參考圖,輸出一段可以餵給 AI 生圖工具的「情境指令」描述。

**指令必須完整涵蓋 4 面向**:
1. **產品呈現方式** — 服飾如何被呈現? (例:模特身穿、平鋪展示、掛吊、手持、多件堆疊、鏡子反射、模特半坐半靠...)
2. **背景** — 場景類型 + 環境元素 (例:室內 / 戶外、咖啡廳 / 街角 / 攝影棚、牆面 / 家具 / 植物 / 天空 / 燈光...)
3. **道具** — 場景內的小物件 (例:手中咖啡杯、書、購物袋、家具上的小物、植物、配件...)
4. **構圖** — 鏡頭角度 / 視線高度 / 主體位置 / 留白方向 / 景深深淺 / 光源方向 / 色調氛圍

**輸出 JSON (繁體中文,不要 markdown)**:
{
  "scenario_prompt": "180-280 字繁體中文情境指令。**用 {{product}} 標示產品的位置** — 例如「模特身穿 {{product}} 站立於...」、「{{product}} 平鋪於原木桌面...」、「模特手持其中一件 {{product}} 對著鏡頭微笑...」。**不要描述參考圖中的具體服飾款式或顏色** — 只寫呈現方式 + 背景 + 道具 + 構圖,讓 AI 之後可以套上任何產品。",
  "suggested_name": "≤10 字情境名稱",
  "suggested_type": "情境 | 棚拍 | 創意 | 時尚 | 街頭潮流 | 組合 6 選 1"
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

const ALLOWED_TYPES = new Set(['情境', '棚拍', '創意', '時尚', '街頭潮流', '組合']);

export async function POST(req) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    const { data, media_type } = await fetchAsBase64(imageUrl);
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 2000,
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
    await trackAnthropicResp(resp, MODEL, 'analyze-scenario');
    const text = resp.content.map((b) => b.text || '').join('');
    const parsed = tolerantParse(text);
    const suggested_type = ALLOWED_TYPES.has(parsed.suggested_type) ? parsed.suggested_type : '情境';
    return NextResponse.json({
      scenario_prompt: parsed.scenario_prompt || '',
      suggested_name: parsed.suggested_name || '',
      suggested_type,
    });
  } catch (e) {
    console.error('[analyze-scenario]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
