// Supernotes-style connections graph: force-directed SVG, editable cards, localStorage.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, loadConnEdits, saveConnEdits, uid, download } from '../data.jsx';

const KIND_COLORS = {
  vmost: '#46c6b4', mission: '#5b9cf5', area: '#f0a544', strand: '#a78bfa',
  tlg: '#57c974', partner: '#7f96c9', theme: '#ef5d73', concept: '#46c6b4', delivery: '#9fadc9', note: '#e8edf7',
};
const KIND_LABELS = {
  vmost: 'VMOST', mission: 'Mission', area: 'Area', strand: 'Strand', tlg: 'TLG concept',
  partner: 'Partner', theme: 'Theme', concept: 'Concept', delivery: 'Delivery', note: 'Note',
};

function layout(nodes, edges, W, H, iterations = 260) {
  const pos = {};
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    pos[n.id] = { x: W / 2 + Math.cos(a) * (W / 3.1) * (0.55 + 0.45 * ((i * 37) % 10) / 10), y: H / 2 + Math.sin(a) * (H / 3.1) * (0.55 + 0.45 * ((i * 53) % 10) / 10) };
  });
  const deg = {};
  edges.forEach((e) => { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 1;
        const f = (5200 / d2) * t;
        dx *= f; dy *= f;
        a.x += dx; a.y += dy; b.x -= dx; b.y -= dy;
      }
    }
    // attraction along edges
    edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 120;
      const f = ((d - target) / d) * 0.05 * t * 2;
      a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
    });
    // gravity to centre, weighted by degree
    nodes.forEach((n) => {
      const p = pos[n.id];
      p.x += (W / 2 - p.x) * 0.012 * (1 + (deg[n.id] || 0) * 0.06) * t;
      p.y += (H / 2 - p.y) * 0.012 * (1 + (deg[n.id] || 0) * 0.06) * t;
      p.x = Math.max(30, Math.min(W - 30, p.x));
      p.y = Math.max(24, Math.min(H - 24, p.y));
    });
  }
  return pos;
}

export default function Connections() {
  const { connections } = useData();
  const [graph, setGraph] = useState(() => loadConnEdits() || connections);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [linkFrom, setLinkFrom] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { if (graph) saveConnEdits(graph); }, [graph]);
  useEffect(() => { if (!graph && connections) setGraph(connections); }, [connections]);
  if (!graph) return null;

  const W = 880, H = 640;
  const visible = filter === 'all' ? graph.nodes : graph.nodes.filter((n) => n.kind === filter || n.id === selected);
  const visIds = new Set(visible.map((n) => n.id));
  const visEdges = graph.edges.filter((e) => visIds.has(e.from) && visIds.has(e.to));
  const pos = useMemo(() => layout(visible, visEdges, W, H), [graph, filter]);

  const sel = graph.nodes.find((n) => n.id === selected);
  const neighbours = sel ? graph.edges.filter((e) => e.from === sel.id || e.to === sel.id)
    .map((e) => graph.nodes.find((n) => n.id === (e.from === sel.id ? e.to : e.from))).filter(Boolean) : [];

  const addNode = (node) => setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
  const removeNode = (id) => setGraph((g) => ({ nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.from !== id && e.to !== id) }));
  const addEdge = (from, to) => setGraph((g) => g.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)) ? g : ({ ...g, edges: [...g.edges, { from, to }] }));
  const removeEdge = (from, to) => setGraph((g) => ({ ...g, edges: g.edges.filter((e) => !((e.from === from && e.to === to) || (e.from === to && e.to === from))) }));
  const editNode = (id, field, value) => setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => n.id === id ? { ...n, [field]: value } : n) }));

  const clickNode = (n) => {
    if (linkFrom && linkFrom !== n.id) { addEdge(linkFrom, n.id); setLinkFrom(null); return; }
    setSelected(n.id === selected ? null : n.id);
  };

  return (
    <div>
      <div className="pagehead">
        <div className="kicker">Strategy · Connections</div>
        <h2>Connections</h2>
        <p className="lede">
          A linked map of the themes, ideas, partners and delivery components across both missions — seeded from the
          Missions documents. Click a node to read its card; add your own notes and links as thinking develops.
          Edits save in this browser; export JSON to share.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select className="field" style={{ width: 190 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All kinds ({graph.nodes.length})</option>
          {Object.keys(KIND_LABELS).map((k) => {
            const c = graph.nodes.filter((n) => n.kind === k).length;
            return c ? <option key={k} value={k}>{KIND_LABELS[k]} ({c})</option> : null;
          })}
        </select>
        <button className="btn" onClick={() => setAdding(true)}>+ Add card</button>
        <span style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={() => download('mission-connections.json', graph)}>Export JSON</button>
        <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <button className="btn sm ghost danger" onClick={() => { if (confirm('Reset to the seeded graph from the Missions documents?')) setGraph(connections); }}>Reset to seed</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
          onChange={(ev) => { const f = ev.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { setGraph(JSON.parse(r.result)); } catch { /* */ } }; r.readAsText(f); ev.target.value = ''; }} />
      </div>

      <div className="conn-legend">
        {Object.entries(KIND_LABELS).map(([k, l]) => graph.nodes.some((n) => n.kind === k) ? <span key={k}><i style={{ background: KIND_COLORS[k] }} /> {l}</span> : null)}
      </div>

      {linkFrom && <div className="error-box" style={{ marginBottom: 10, borderColor: '#46c6b455', background: '#46c6b415', color: '#bfe8e1' }}>
        Linking from <b>{graph.nodes.find((n) => n.id === linkFrom)?.label}</b> — click another node to connect, or <button className="btn sm" onClick={() => setLinkFrom(null)}>cancel</button>
      </div>}

      <div className="conn-wrap">
        <svg className="conn-svg" viewBox={`0 0 ${W} ${H}`}>
          {visEdges.map((e, i) => {
            const a = pos[e.from], b = pos[e.to];
            if (!a || !b) return null;
            const active = selected && (e.from === selected || e.to === selected);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? '#46c6b4' : '#ffffff18'} strokeWidth={active ? 1.8 : 1} />;
          })}
          {visible.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const r = n.kind === 'mission' || n.kind === 'vmost' ? 11 : n.kind === 'area' || n.kind === 'strand' ? 9 : 6.5;
            const dim = selected && n.id !== selected && !neighbours.some((x) => x.id === n.id);
            return (
              <g key={n.id} className="conn-node" opacity={dim ? 0.3 : 1} onClick={() => clickNode(n)}>
                <circle cx={p.x} cy={p.y} r={r} fill={KIND_COLORS[n.kind] || '#9fadc9'} stroke={n.id === selected ? '#fff' : '#0b1220'} strokeWidth={n.id === selected ? 2 : 1.2} />
                <text x={p.x} y={p.y - r - 5} textAnchor="middle" fontSize="9.5" fill={dim ? '#66748f' : '#c9d4e8'} style={{ pointerEvents: 'none' }}>
                  {n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div>
          {!sel && <div className="card"><h4>Select a node</h4><div className="sub">Click any node to see its card, its connections, and editing options. Use the filter to focus on one kind of card.</div></div>}
          {sel && (
            <div className="card" style={{ borderColor: KIND_COLORS[sel.kind] + '66' }}>
              <span className="pill" style={{ color: KIND_COLORS[sel.kind], borderColor: KIND_COLORS[sel.kind] + '55' }}>{KIND_LABELS[sel.kind] || sel.kind}</span>
              <h4 style={{ margin: '10px 0 6px', fontSize: 15 }}>{sel.label}</h4>
              <div className="sub" style={{ fontSize: 12.6, whiteSpace: 'pre-wrap' }}>{sel.text || 'No notes yet.'}</div>
              <textarea className="field" rows={3} style={{ marginTop: 10, fontSize: 12.4 }} placeholder="Edit notes…" value={sel.text || ''} onChange={(e) => editNode(sel.id, 'text', e.target.value)} />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setLinkFrom(sel.id)}>⤿ Link to…</button>
                <button className="btn sm danger" onClick={() => { if (confirm('Delete this card and its links?')) { removeNode(sel.id); setSelected(null); } }}>Delete</button>
              </div>
              <h4 style={{ marginTop: 14 }}>Connections ({neighbours.length})</h4>
              {neighbours.map((n) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', fontSize: 12.4 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: KIND_COLORS[n.kind], flexShrink: 0 }} />
                  <a style={{ cursor: 'pointer', color: '#c9d4e8', flex: 1 }} onClick={() => setSelected(n.id)}>{n.label}</a>
                  <button className="btn sm ghost danger" onClick={() => removeEdge(sel.id, n.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {adding && <AddCard onCancel={() => setAdding(false)} onAdd={(n) => { addNode(n); setAdding(false); setSelected(n.id); }} />}
    </div>
  );
}

function AddCard({ onAdd, onCancel }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('note');
  const [text, setText] = useState('');
  return (
    <div className="card" style={{ marginTop: 14, maxWidth: 560 }}>
      <h4>New card</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input className="field" placeholder="Title" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="field" style={{ width: 150 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <textarea className="field" rows={3} placeholder="Notes" value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn primary" disabled={!label.trim()} onClick={() => onAdd({ id: uid(), label: label.trim(), kind, text })}>Add card</button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
