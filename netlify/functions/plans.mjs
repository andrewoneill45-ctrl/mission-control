// Netlify Function (v2): shared plan storage via Netlify Blobs.
// GET  /api/plans?key=vmost            → { data, author, updatedAt } | null
// POST /api/plans?key=vmost {data, author} → { ok, updatedAt }
// Keys: vmost | connections | scenarios (alphanumeric + dashes only).
import { getStore } from '@netlify/blobs';

const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

export default async (req) => {
  let store;
  try {
    store = getStore('mission-control-plans');
  } catch (e) {
    return new Response(JSON.stringify({ error: 'blobs_unavailable', detail: String(e).slice(0, 160) }), { status: 200, headers });
  }
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  if (!key) return new Response(JSON.stringify({ error: 'no_key' }), { status: 400, headers });

  try {
    if (req.method === 'GET') {
      const doc = await store.get(key, { type: 'json' });
      return new Response(JSON.stringify(doc || null), { status: 200, headers });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json();
      if (body == null || body.data === undefined) return new Response(JSON.stringify({ error: 'no_data' }), { status: 400, headers });
      const doc = {
        data: body.data,
        author: String(body.author || 'unknown').slice(0, 60),
        updatedAt: new Date().toISOString(),
      };
      await store.setJSON(key, doc);
      return new Response(JSON.stringify({ ok: true, updatedAt: doc.updatedAt, author: doc.author }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'blobs_error', detail: String(e).slice(0, 200) }), { status: 200, headers });
  }
};
