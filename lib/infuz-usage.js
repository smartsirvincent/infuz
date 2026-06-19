// 用量追蹤 + 費用估算 (寫進 Cloudinary infuz/db/usage.json)
import { loadDb, saveDb } from './infuz-db.js';

// 預設費率 (USD) — /settings 可調
export const DEFAULT_PRICING = {
  anthropic: {
    // Claude Sonnet 4.5 / 4.6 / 4.7 等 sonnet 級別
    'claude-sonnet-4-5': { input_per_million: 3.0, output_per_million: 15.0 },
    'claude-sonnet-4-6': { input_per_million: 3.0, output_per_million: 15.0 },
    'claude-sonnet': { input_per_million: 3.0, output_per_million: 15.0 },
    'claude-haiku-4-5': { input_per_million: 0.80, output_per_million: 4.0 },
    'claude-haiku': { input_per_million: 0.80, output_per_million: 4.0 },
    'claude-opus-4-7': { input_per_million: 15.0, output_per_million: 75.0 },
    'claude-opus': { input_per_million: 15.0, output_per_million: 75.0 },
    default: { input_per_million: 3.0, output_per_million: 15.0 },
  },
  kie: {
    'gpt-image-2': { per_image: 0.045 },
    default: { per_image: 0.045 },
  },
};

function priceFor(category, key, pricing) {
  const cat = (pricing || DEFAULT_PRICING)[category] || DEFAULT_PRICING[category];
  return cat[key] || cat.default || (DEFAULT_PRICING[category] && DEFAULT_PRICING[category].default);
}

export function calcCost(usage, pricing = DEFAULT_PRICING) {
  let total = 0;
  const breakdown = { anthropic: {}, kie: {} };

  for (const [model, m] of Object.entries(usage.anthropic || {})) {
    const p = priceFor('anthropic', model, pricing);
    const cost =
      ((m.input_tokens || 0) / 1_000_000) * (p.input_per_million || 0) +
      ((m.output_tokens || 0) / 1_000_000) * (p.output_per_million || 0);
    breakdown.anthropic[model] = {
      input_tokens: m.input_tokens || 0,
      output_tokens: m.output_tokens || 0,
      calls: m.calls || 0,
      cost,
    };
    total += cost;
  }

  for (const [name, m] of Object.entries(usage.kie || {})) {
    const p = priceFor('kie', name, pricing);
    const cost = (m.count || 0) * (p.per_image || 0);
    breakdown.kie[name] = { count: m.count || 0, ms_total: m.ms_total || 0, cost };
    total += cost;
  }

  return { total, breakdown };
}

export async function getUsage() {
  const db = await loadDb('usage');
  return (db.items || []).find((x) => x.id === 'main')
    || { id: 'main', anthropic: {}, kie: {}, by_endpoint: {}, lastUpdated: '' };
}

async function saveOne(kind, item) {
  const db = await loadDb(kind);
  const items = (db.items || []).filter((x) => x.id !== item.id);
  items.push(item);
  return saveDb(kind, { items });
}

/**
 * Anthropic API 用量
 */
export async function trackAnthropic({ model, input_tokens = 0, output_tokens = 0, endpoint }) {
  try {
    const cur = await getUsage();
    const m = cur.anthropic[model] || { input_tokens: 0, output_tokens: 0, calls: 0 };
    m.input_tokens += input_tokens;
    m.output_tokens += output_tokens;
    m.calls += 1;
    cur.anthropic[model] = m;
    cur.lastUpdated = new Date().toISOString();
    if (endpoint) {
      cur.by_endpoint = cur.by_endpoint || {};
      cur.by_endpoint[endpoint] = (cur.by_endpoint[endpoint] || 0) + 1;
    }
    await saveOne('usage', cur);
  } catch (e) {
    console.error('[trackAnthropic]', e.message);
  }
}

/**
 * KIE 用量 (一張圖 = 一次)
 */
export async function trackKie({ model = 'gpt-image-2', count = 1, ms = 0, endpoint }) {
  try {
    const cur = await getUsage();
    const m = cur.kie[model] || { count: 0, ms_total: 0 };
    m.count += count;
    m.ms_total += ms;
    cur.kie[model] = m;
    cur.lastUpdated = new Date().toISOString();
    if (endpoint) {
      cur.by_endpoint = cur.by_endpoint || {};
      cur.by_endpoint[endpoint] = (cur.by_endpoint[endpoint] || 0) + 1;
    }
    await saveOne('usage', cur);
  } catch (e) {
    console.error('[trackKie]', e.message);
  }
}

/**
 * 從 Anthropic resp 物件抓 usage 並追蹤 (要 await 才能保證寫入)
 */
export async function trackAnthropicResp(resp, model, endpoint) {
  if (resp?.usage) {
    await trackAnthropic({
      model,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      endpoint,
    }).catch((e) => { console.error('[trackAnthropicResp]', e.message); });
  }
}

/**
 * 整個 usage 歸零
 */
export async function resetUsage() {
  return saveOne('usage', { id: 'main', anthropic: {}, kie: {}, by_endpoint: {}, lastUpdated: new Date().toISOString() });
}
