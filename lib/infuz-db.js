// Infuz 3 個資料庫 (產品 / 模特 / 情境) 的 Cloudinary 儲存
// 同名覆蓋,單一 JSON file per DB。並發寫入靠樂觀鎖 (version 欄位) — 簡單版先不上鎖
import { v2 as cloudinary } from 'cloudinary';

function ensureConfig() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('CLOUDINARY_CLOUD_NAME not set');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const BASE_FOLDER = 'infuz/db';

function publicIdFor(kind) {
  return `${BASE_FOLDER}/${kind}`;
}

/**
 * 讀 JSON DB (products / models / scenarios)
 * 找不到時回 { items: [] }
 */
export async function loadDb(kind) {
  ensureConfig();
  const publicId = publicIdFor(kind);
  // 加 query 字串避開 Cloudinary CDN cache (新版本對舊的 ?_=X URL 不會命中)
  const bust = Date.now();
  const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.json?_=${bust}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
    if (res.status === 404) return { items: [] };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (e) {
    if (/HTTP 404|HTTP 401/.test(e.message)) return { items: [] };
    throw e;
  }
}

/**
 * 寫整個 DB (覆蓋舊版)
 */
export async function saveDb(kind, data) {
  ensureConfig();
  const publicId = publicIdFor(kind);
  const payload = {
    items: Array.isArray(data?.items) ? data.items : [],
    updatedAt: new Date().toISOString(),
  };
  const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: publicId,
        format: 'json',
        overwrite: true,
        invalidate: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          version: result.version,
          itemCount: payload.items.length,
        });
      },
    ).end(buf);
  });
}

/**
 * 新增 1 筆 (或一次多筆)
 */
export async function appendItems(kind, newItems) {
  const current = await loadDb(kind);
  const arr = Array.isArray(newItems) ? newItems : [newItems];
  const next = { items: [...(current.items || []), ...arr] };
  return saveDb(kind, next);
}

/**
 * 用 id 找一筆 update,沒有就 throw
 */
export async function updateItem(kind, id, patch) {
  const current = await loadDb(kind);
  const items = current.items || [];
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error(`${kind} id ${id} not found`);
  items[idx] = { ...items[idx], ...patch, id };
  return saveDb(kind, { items });
}

/**
 * 用 id 刪除
 */
export async function deleteItem(kind, id) {
  const current = await loadDb(kind);
  const items = (current.items || []).filter((x) => x.id !== id);
  return saveDb(kind, { items });
}
