import { createContext, useContext, useEffect, useState } from 'react';

const DataCtx = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [connections, setConnections] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([
      fetch('/data/mission_data.json').then((r) => r.json()),
      fetch('/data/connections.json').then((r) => r.json()),
    ]).then(([d, c]) => { setData(d); setConnections(c); }).catch((e) => setError(String(e)));
  }, []);
  return <DataCtx.Provider value={{ data, connections, error }}>{children}</DataCtx.Provider>;
}

export function useData() {
  return useContext(DataCtx);
}

export async function askApi(payload) {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---- VMOST persistence (localStorage + JSON export/import) ----
const VKEY = 'mission-control-vmost-v1';
export function loadVmost(seed) {
  try {
    const raw = localStorage.getItem(VKEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return seed ? JSON.parse(JSON.stringify(seed)) : null;
}
export function saveVmost(plan) {
  try { localStorage.setItem(VKEY, JSON.stringify(plan)); } catch { /* ignore */ }
}

const CKEY = 'mission-control-connections-v1';
export function loadConnEdits() {
  try { const raw = localStorage.getItem(CKEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return null;
}
export function saveConnEdits(graph) {
  try { localStorage.setItem(CKEY, JSON.stringify(graph)); } catch { /* ignore */ }
}

// ---- Shared store (Netlify Blobs via /api/plans) ----
export function getAuthor() {
  let a = null;
  try { a = localStorage.getItem('mission-control-author'); } catch { /* */ }
  if (!a) {
    a = (window.prompt('Your name or initials (shown against shared edits):') || 'anon').trim() || 'anon';
    try { localStorage.setItem('mission-control-author', a); } catch { /* */ }
  }
  return a;
}
async function sharedFetch(url, opts) {
  const r = await fetch(url, opts);
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !ct.includes('json')) throw new Error('Shared store unavailable — it needs the site to run on Netlify (or `netlify dev` locally).');
  const j = await r.json();
  if (j && j.error) throw new Error(j.error === 'blobs_unavailable' || j.error === 'blobs_error'
    ? 'Netlify Blobs not available on this deploy — redeploy the site so the plans function is picked up.'
    : j.detail || j.error);
  return j;
}
export function sharedGet(key) {
  return sharedFetch(`/api/plans?key=${encodeURIComponent(key)}`);
}
export function sharedPut(key, data) {
  return sharedFetch(`/api/plans?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data, author: getAuthor() }),
  });
}

// ---- Simulator scenarios (localStorage) ----
const SCKEY = 'mission-control-scenarios-v1';
export function loadScenarios() {
  try { const raw = localStorage.getItem(SCKEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  return [];
}
export function saveScenarios(list) {
  try { localStorage.setItem(SCKEY, JSON.stringify(list)); } catch { /* */ }
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
export function download(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
