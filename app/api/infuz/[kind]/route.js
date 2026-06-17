// 通用 CRUD endpoint for 3 個 DB
// GET    /api/infuz/products  → { items: [...] }
// PUT    /api/infuz/products  → 整批覆寫 { items: [...] }
// POST   /api/infuz/products  → append 1 筆 (body 是 item)
// PATCH  /api/infuz/products?id=X → update 1 筆
// DELETE /api/infuz/products?id=X → 刪 1 筆
import { NextResponse } from 'next/server';
import { loadDb, saveDb, appendItems, updateItem, deleteItem } from '@/lib/infuz-db.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_KINDS = new Set(['products', 'models', 'scenarios', 'assets']);

function validate(kind) {
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
  }
  return null;
}

export async function GET(req, { params }) {
  const kind = params.kind;
  const err = validate(kind);
  if (err) return err;
  try {
    const data = await loadDb(kind);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const kind = params.kind;
  const err = validate(kind);
  if (err) return err;
  try {
    const body = await req.json();
    if (!Array.isArray(body?.items)) {
      return NextResponse.json({ error: 'body.items must be array' }, { status: 400 });
    }
    const result = await saveDb(kind, body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const kind = params.kind;
  const err = validate(kind);
  if (err) return err;
  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ error: 'item.id required' }, { status: 400 });
    }
    const result = await appendItems(kind, body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const kind = params.kind;
  const err = validate(kind);
  if (err) return err;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const patch = await req.json();
    const result = await updateItem(kind, id, patch);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const kind = params.kind;
  const err = validate(kind);
  if (err) return err;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const result = await deleteItem(kind, id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
