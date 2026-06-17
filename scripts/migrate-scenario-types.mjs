// 一次性: 把舊「漫畫」→「創意」, 舊「精緻時尚」→「時尚」
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { loadDb, saveDb } from '../lib/infuz-db.js';

const ALLOWED = new Set(['情境', '棚拍', '創意', '時尚', '街頭潮流', '組合']);
const MAP = {
  '漫畫': '創意',
  '精緻時尚': '時尚',
};

const db = await loadDb('scenarios');
const before = (db.items || []).map((s) => s.type);
const items = (db.items || []).map((s) => {
  const newType = MAP[s.type] || s.type;
  return { ...s, type: newType };
});
const after = items.map((s) => s.type);
const changedCount = before.filter((t, i) => t !== after[i]).length;

console.log('Before:', JSON.stringify([...new Set(before)]));
console.log('After: ', JSON.stringify([...new Set(after)]));
console.log(`Changed ${changedCount} item types.`);

const remaining = after.filter((t) => !ALLOWED.has(t));
if (remaining.length > 0) {
  console.log(`⚠ ${remaining.length} items still have non-allowed types: ${JSON.stringify([...new Set(remaining)])}`);
}

if (process.argv.includes('--yes')) {
  const r = await saveDb('scenarios', { items });
  console.log('Saved:', r.itemCount, 'items at', r.url);
} else {
  console.log('Dry-run only. Re-run with --yes to apply.');
}
