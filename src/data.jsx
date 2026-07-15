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
