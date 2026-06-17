// 一次性匯入: 讀 xlsx -> Cloudinary 3 個 DB
// 用法: node scripts/import-from-xlsx.mjs "C:/Users/.../Infuz_AI自動發文系統 (2).xlsx"
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // also load .env
import { saveDb } from '../lib/infuz-db.js';

const XLSX = process.argv[2];
if (!XLSX) {
  console.error('用法: node scripts/import-from-xlsx.mjs <xlsx path>');
  process.exit(1);
}

function valOf(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.hyperlink);
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.result !== undefined) return String(v.result);
  }
  return String(v);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX);

// ===== 產品 =====
function importProducts() {
  const ws = wb.getWorksheet('產品資料庫');
  if (!ws) throw new Error('no 產品資料庫 sheet');
  const items = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return; // header
    const r = row.values.slice(1).map(valOf);
    const sku = r[0]?.trim();
    if (!sku) return;
    items.push({
      id: sku,
      sku,
      name: r[1] || '',
      features: r[2] || '',
      colors: r[3] || '',
      image_front: r[4] || '',
      image_back: r[5] || '',
      image_detail: r[6] || '',
      purchase_url: r[7] || '',
      price: r[8] ? Number(r[8]) || r[8] : '',
      category: r[9] || '', // 上衣 / 下身
      createdAt: r[10] || new Date().toISOString(),
    });
  });
  return items;
}

// ===== 模特兒 =====
function importModels() {
  const ws = wb.getWorksheet('模特兒資料庫');
  if (!ws) throw new Error('no 模特兒資料庫 sheet');
  const items = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const r = row.values.slice(1).map(valOf);
    const id = r[0]?.trim();
    if (!id || (!r[1] && !r[3])) return; // 空列 skip
    items.push({
      id,
      name: r[1] || '',
      style: r[2] || '',
      reference_image: r[3] || '',
      skin_tone: r[4] || '',
      hairstyle: r[5] || '',
      notes: r[6] || '',
    });
  });
  return items;
}

// ===== 情境 =====
function importScenarios() {
  const ws = wb.getWorksheet('情境資料庫');
  if (!ws) throw new Error('no 情境資料庫 sheet');
  const items = [];
  let autoIdCounter = 1;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const r = row.values.slice(1).map(valOf);
    let id = r[0]?.trim();
    const type = r[1] || '';
    const name = r[2] || '';
    const prompt = r[3] || '';
    if (!name && !prompt) return; // 完全空 skip
    if (!id) id = `SC${String(autoIdCounter).padStart(3, '0')}_auto`;
    autoIdCounter += 1;
    items.push({ id, type, name, prompt });
  });
  return items;
}

const products = importProducts();
const models = importModels();
const scenarios = importScenarios();

console.log(`Parsed: products=${products.length}, models=${models.length}, scenarios=${scenarios.length}`);

const ANSWER_OK = process.argv.includes('--yes') || process.env.YES === '1';
if (!ANSWER_OK) {
  console.log('\nDry-run only. Re-run with --yes to actually upload.\n');
  console.log('Sample product:', JSON.stringify(products[0], null, 2).slice(0, 500));
  console.log('Sample model:', JSON.stringify(models[0], null, 2));
  console.log('Sample scenario:', JSON.stringify(scenarios[0], null, 2));
  process.exit(0);
}

console.log('Uploading to Cloudinary...');
const r1 = await saveDb('products', { items: products });
console.log('products ->', r1.url);
const r2 = await saveDb('models', { items: models });
console.log('models ->', r2.url);
const r3 = await saveDb('scenarios', { items: scenarios });
console.log('scenarios ->', r3.url);
console.log('Done.');
