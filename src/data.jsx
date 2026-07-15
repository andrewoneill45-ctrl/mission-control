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

export async function askApi(payload, attempt = 0) {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    // 502/504 = the function hit Netlify's ~10s limit before Claude finished. Retry once.
    if ((r.status === 504 || r.status === 502) && attempt < 1) return askApi(payload, attempt + 1);
    if (r.status === 504 || r.status === 502) {
      throw new Error('The answer took longer than the 10-second function window. Try again — it usually succeeds on a retry — or simplify the plan/scenario being assessed.');
    }
    throw new Error(`HTTP ${r.status}`);
  }
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

// ---- RAG scorecard store (shared between Metrics page and VMOST planner) ----
const RKEY = 'mission-control-rag-v1';
export function loadRag() {
  try { const raw = localStorage.getItem(RKEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  return {};
}
export function saveRag(rag) {
  try { localStorage.setItem(RKEY, JSON.stringify(rag)); } catch { /* */ }
}

// Flat catalog of every metric/KPI with the stable ids the Metrics page uses.
export function metricCatalog(data) {
  const k = data.kpis;
  if (!k) return [];
  const list = [];
  (k.outcome || []).forEach((r, i) => list.push({ id: `out-${i}`, label: r.kpi, group: 'Outcome KPI', target: r.y3, baseline: r.baseline }));
  (k.collective || []).forEach((r, i) => list.push({ id: `col-${i}`, label: r.kpi, group: 'Collective impact', target: r.y3 }));
  (k.sustainability || []).forEach((r, i) => list.push({ id: `sus-${i}`, label: r.kpi, group: 'Sustainability', target: r.y3 }));
  const cats = [...new Set((k.framework || []).map((m) => m.category).filter(Boolean))];
  cats.forEach((cat) => {
    (k.framework || []).filter((m) => m.category === cat).forEach((m, i) => {
      list.push({ id: `fw-${cat}-${i}`, label: m.metric, group: cat, source: m.source });
    });
  });
  return list;
}

// Deterministic keyword matcher: suggests metrics for an objective's text.
const METRIC_KEYS = [
  { keys: ['gap', 'disadvantag', 'white british', 'fsm', 'working class'], match: ['disadvantag', 'gap', 'fsm'] },
  { keys: ['attain', 'a8', 'attainment 8', 'results', 'gcse', 'standards'], match: ['attainment', 'progress 8', 'basics', 'a-level'] },
  { keys: ['ks2', 'primary', 'maths', 'reading', 'phonics'], match: ['ks2', 'phonics'] },
  { keys: ['absence', 'attendance'], match: ['absence', 'attendance'] },
  { keys: ['behaviour', 'exclusion', 'suspension'], match: ['exclusion', 'suspension'] },
  { keys: ['enrich', 'belonging', 'sport', 'arts', 'mentor'], match: ['enrichment', 'belonging', 'wellbeing'] },
  { keys: ['parent', 'famil', 'engagement'], match: ['parental', 'engagement', 'famil'] },
  { keys: ['neet', 'destination', 'post-16', 'progression', 'apprentice'], match: ['neet', 'destination', 'higher education', 'apprentice'] },
  { keys: ['transition', 'year 7', 'y6', 'y7'], match: ['transition'] },
  { keys: ['send', 'inclusion', 'ehcp'], match: ['ehcp', 'sen', 'alternative provision'] },
  { keys: ['teacher', 'workforce', 'leader', 'recruit', 'retention'], match: ['teacher', 'itt', 'headteacher', 'retention', 'vacancy'] },
  { keys: ['partner', 'collective', 'philanthrop', 'sustain'], match: ['partner', 'philanthropic', 'sustainability', 'case resolution'] },
];
export function suggestMetrics(text, catalog) {
  const t = (text || '').toLowerCase();
  const wanted = new Set();
  METRIC_KEYS.forEach((rule) => {
    if (rule.keys.some((kw) => t.includes(kw))) rule.match.forEach((m) => wanted.add(m));
  });
  return catalog.filter((m) => [...wanted].some((w) => m.label.toLowerCase().includes(w))).map((m) => m.id);
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
