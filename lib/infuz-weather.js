// 中央氣象署 (CWA) 開放資料 API wrapper
// 只用 F-C0032-001「一般天氣預報-今明 36 小時天氣預報」— 22 縣市層級,不必挑鄉鎮
// docs: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
//
// 一筆 location 回三個時段:
//   T00 = 今晚(現在起 6-18h) / T01 = 明日白天(18-30h) / T02 = 明日晚上(30-36h)
// 每段有: Wx(天氣描述+代碼) / PoP(降雨機率%) / MinT / MaxT / CI(舒適度)
//
// 只需一顆 API key: CWA_API_KEY (免費申請 https://opendata.cwa.gov.tw/user/authkey)

const BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001';

export const CWA_LOCATIONS = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
  '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣',
  '澎湖縣', '金門縣', '連江縣',
];

export function isConfigured() {
  return Boolean(process.env.CWA_API_KEY);
}

/**
 * 抓某縣市的 36 小時預報,回三個時段的整合快照
 * @param {object} opts
 * @param {string} opts.location - 縣市名(例: '臺北市'),必填
 * @returns {Promise<{location, publishTime, periods:[{label,start,end,wx,wxCode,pop,minT,maxT,ci,ciDesc}]}>}
 */
export async function snapshot({ location } = {}) {
  if (!isConfigured()) throw new Error('CWA_API_KEY 未設定,無法抓氣象資料');
  if (!location) throw new Error('必須指定縣市 (location)');
  if (!CWA_LOCATIONS.includes(location)) {
    throw new Error(`不支援的縣市: ${location} (支援 22 個)`);
  }

  const url = `${BASE}?Authorization=${encodeURIComponent(process.env.CWA_API_KEY)}&locationName=${encodeURIComponent(location)}&format=JSON`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CWA API HTTP ${res.status}`);
  const data = await res.json();

  const loc = data?.records?.location?.[0];
  if (!loc) throw new Error(`CWA 回傳沒有 ${location} 的資料`);

  // 每個 element 有 3 個 time-slot,順序一致
  const byName = {};
  for (const el of loc.weatherElement || []) byName[el.elementName] = el.time || [];
  const slots = byName.Wx || [];

  const periods = slots.map((slot, idx) => {
    const start = slot.startTime;
    const end = slot.endTime;
    const wx = byName.Wx?.[idx]?.parameter;
    const pop = byName.PoP?.[idx]?.parameter;
    const minT = byName.MinT?.[idx]?.parameter;
    const maxT = byName.MaxT?.[idx]?.parameter;
    const ci = byName.CI?.[idx]?.parameter;
    return {
      label: labelForSlot(start, idx),
      start,
      end,
      wx: wx?.parameterName || '',
      wxCode: wx?.parameterValue || '',
      pop: pop?.parameterName != null ? Number(pop.parameterName) : null,
      minT: minT?.parameterName != null ? Number(minT.parameterName) : null,
      maxT: maxT?.parameterName != null ? Number(maxT.parameterName) : null,
      ci: ci?.parameterName || '',
    };
  });

  return {
    location,
    publishTime: data.records?.datasetDescription ? new Date().toISOString() : null,
    periods,
  };
}

// 把 T00/T01/T02 換成人看的標籤(視當下時間動態決定)
function labelForSlot(startTimeStr, idx) {
  try {
    const start = new Date(startTimeStr);
    const hour = start.getHours();
    // 06-18 = 白天,18-06 = 晚上
    const dayNight = hour >= 6 && hour < 18 ? '白天' : '晚上';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const daysDiff = Math.round((startDay - today) / 86400000);
    const dayLabel = daysDiff <= 0 ? '今' : daysDiff === 1 ? '明' : `後${daysDiff}`;
    return `${dayLabel}${dayNight}`;
  } catch {
    return `時段${idx + 1}`;
  }
}

/**
 * 把 snapshot 摘要成人看的文字,給 LLM 產文吃
 */
export function toPromptText(snap) {
  if (!snap?.periods?.length) return '(沒有氣象資料)';
  const lines = [`【${snap.location} 未來 36 小時預報】`];
  for (const p of snap.periods) {
    const bits = [];
    bits.push(`${p.label}: ${p.wx}`);
    if (p.pop != null) bits.push(`降雨機率 ${p.pop}%`);
    if (p.minT != null && p.maxT != null) bits.push(`氣溫 ${p.minT}–${p.maxT}°C`);
    if (p.ci) bits.push(p.ci);
    lines.push('・' + bits.join(' / '));
  }
  return lines.join('\n');
}

/**
 * 判斷是否符合觸發條件(用第 1 個時段 = 最近未來)
 * conditions: { minPoP, minMaxT, maxMinT }
 * 全部空 = 一定觸發; 有設就要滿足任一(OR)
 */
export function checkConditions(snap, conditions = {}) {
  const p = snap?.periods?.[0];
  if (!p) return { fire: false, reason: '沒有氣象資料' };

  const { minPoP, minMaxT, maxMinT } = conditions;
  const hasAnyCondition = [minPoP, minMaxT, maxMinT].some((v) => v != null && v !== '');
  if (!hasAnyCondition) return { fire: true, reason: '(未設條件,任何天氣都發)' };

  const hits = [];
  if (minPoP != null && minPoP !== '' && p.pop != null && p.pop >= Number(minPoP)) {
    hits.push(`降雨機率 ${p.pop}% ≥ ${minPoP}%`);
  }
  if (minMaxT != null && minMaxT !== '' && p.maxT != null && p.maxT >= Number(minMaxT)) {
    hits.push(`最高溫 ${p.maxT}°C ≥ ${minMaxT}°C`);
  }
  if (maxMinT != null && maxMinT !== '' && p.minT != null && p.minT <= Number(maxMinT)) {
    hits.push(`最低溫 ${p.minT}°C ≤ ${maxMinT}°C`);
  }

  if (hits.length) return { fire: true, reason: hits.join(' / ') };
  return {
    fire: false,
    reason: `未達觸發條件(當前 ${p.wx} / 降雨 ${p.pop ?? '-'}% / ${p.minT ?? '-'}–${p.maxT ?? '-'}°C)`,
  };
}
