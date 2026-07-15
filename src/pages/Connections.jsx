// Connections: Supernotes-style linked cards on a crisp HiDPI canvas.
// Pan (drag background), zoom (wheel / buttons), drag nodes, click to select.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, loadConnEdits, saveConnEdits, uid, download } from '../data.jsx';
import SharedBar from '../components/SharedBar.jsx';

const KIND_COLORS = {
  vmost: '#0f9d8a', mission: '#2f6fdb', area: '#d97a06', strand: '#7c5cd6',
  tlg: '#1e9e4a', partner: '#51648c', theme: '#d63a55', concept: '#0f9d8a', delivery: '#7a8aa6', note: '#334155',
};
const KIND_LABELS = {
  vmost: 'VMOST', mission: 'Mission', area: 'Area', strand: 'Strand', tlg: 'TLG concept',
  partner: 'Partner', theme: 'Theme', concept: 'Concept', delivery: 'Delivery', note: 'Note',
};

const W = 1600, H = 1100; // world coordinates

function forceLayout(nodes, edges, iterations = 320) {
  const pos = {};
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    pos[n.id] = {
      x: W / 2 + Math.cos(a) * (W / 3) * (0.5 + 0.5 * ((i * 37) % 10) / 10),
      y: H / 2 + Math.sin(a) * (H / 3) * (0.5 + 0.5 * ((i * 53) % 10) / 10),
    };
  });
  const deg = {};
  edges.forEach((e) => { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 1;
        const f = (26000 / d2) * t;
        dx *= f; dy *= f;
        a.x += dx; a.y += dy; b.x -= dx; b.y -= dy;
      }
    }
    edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - 210) / d) * 0.06 * t;
      a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
    });
    nodes.forEach((n) => {
      const p = pos[n.id];
      p.x += (W / 2 - p.x) * 0.012 * (1 + (deg[n.id] || 0) * 0.05) * t;
      p.y += (H / 2 - p.y) * 0.014 * (1 + (deg[n.id] || 0) * 0.05) * t;
      p.x = Math.max(90, Math.min(W - 90, p.x));
      p.y = Math.max(50, Math.min(H - 50, p.y));
    });
  }
  return pos;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

export default function Connections() {
  const { connections } = useData();
  const [graph, setGraph] = useState(() => loadConnEdits() || connections);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [linkFrom, setLinkFrom] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.62 }); // pan/zoom
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const drag = useRef(null); // {type:'pan'|'node', ...}
  const posRef = useRef({});
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => { if (graph) saveConnEdits(graph); }, [graph]);

  const visible = useMemo(() => {
    if (!graph) return [];
    if (filter === 'all') return graph.nodes;
    const keep = new Set(graph.nodes.filter((n) => n.kind === filter).map((n) => n.id));
    // include direct neighbours for context
    graph.edges.forEach((e) => { if (keep.has(e.from)) keep.add(e.to); if (keep.has(e.to)) keep.add(e.from); });
    return graph.nodes.filter((n) => keep.has(n.id));
  }, [graph, filter]);
  const visIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const visEdges = useMemo(() => (graph ? graph.edges.filter((e) => visIds.has(e.from) && visIds.has(e.to)) : []), [graph, visIds]);

  // layout once per graph/filter; preserve manual drags for unchanged nodes
  useMemo(() => {
    const fresh = forceLayout(visible, visEdges);
    const merged = {};
    visible.forEach((n) => { merged[n.id] = posRef.current[n.id] || fresh[n.id]; });
    // if more than half are new, take the fresh layout wholesale
    const newCount = visible.filter((n) => !posRef.current[n.id]).length;
    posRef.current = newCount > visible.length / 2 ? fresh : merged;
  }, [visible, visEdges]);

  const sel = graph?.nodes.find((n) => n.id === selected);
  const neighbourIds = useMemo(() => {
    if (!sel || !graph) return new Set();
    const s = new Set();
    graph.edges.forEach((e) => { if (e.from === sel.id) s.add(e.to); if (e.to === sel.id) s.add(e.from); });
    return s;
  }, [sel, graph]);

  // ---------- canvas drawing ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const parent = wrapRef.current;
    const cw = parent.clientWidth, ch = Math.max(480, Math.round(cw * 0.66));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    canvas.style.height = ch + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // e.g. test environments without canvas support
    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
      };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);

    const pos = posRef.current;
    // edges
    visEdges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const active = selected && (e.from === selected || e.to === selected);
      ctx.beginPath();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 18;
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = active ? '#0f9d8a' : '#17202f1c';
      ctx.lineWidth = active ? 2 / view.k : 1.1 / view.k;
      ctx.stroke();
    });
    // nodes as rounded pills
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    visible.forEach((n) => {
      const p = pos[n.id];
      if (!p) return;
      const major = n.kind === 'mission' || n.kind === 'vmost' || n.kind === 'area' || n.kind === 'strand';
      const fs = major ? 15 : 12.5;
      ctx.font = `${major ? 700 : 600} ${fs}px Inter, sans-serif`;
      const label = truncate(n.label, major ? 34 : 26);
      const tw = ctx.measureText(label).width;
      const pw = tw + 30, ph = fs + 16, r = ph / 2;
      const isSel = n.id === selected;
      const isNb = neighbourIds.has(n.id);
      const dim = selected && !isSel && !isNb;
      const col = KIND_COLORS[n.kind] || '#51648c';

      ctx.globalAlpha = dim ? 0.22 : 1;
      // pill
      ctx.beginPath();
      ctx.roundRect(p.x - pw / 2, p.y - ph / 2, pw, ph, r);
      ctx.fillStyle = isSel ? col : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = (isSel ? 2.4 : 1.5) / Math.sqrt(view.k);
      ctx.stroke();
      // dot
      ctx.beginPath();
      ctx.arc(p.x - pw / 2 + r * 0.85, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#ffffff' : col;
      ctx.fill();
      // label
      ctx.fillStyle = isSel ? '#ffffff' : '#1e293b';
      ctx.fillText(label, p.x + 7, p.y + 0.5);
      ctx.globalAlpha = 1;
      n._hit = { x: p.x - pw / 2, y: p.y - ph / 2, w: pw, h: ph };
    });
    ctx.restore();
  }, [graph, visible, visEdges, view, selected, neighbourIds]);

  // resize redraw
  useEffect(() => {
    const onR = () => setView((v) => ({ ...v }));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // ---------- interactions ----------
  const toWorld = (ev) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  };
  const hitNode = (w) => {
    for (let i = visible.length - 1; i >= 0; i--) {
      const n = visible[i], h = n._hit;
      if (h && w.x >= h.x && w.x <= h.x + h.w && w.y >= h.y && w.y <= h.y + h.h) return n;
    }
    return null;
  };

  const onPointerDown = (ev) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const w = toWorld(ev);
    const n = hitNode(w);
    if (n) drag.current = { type: 'node', id: n.id, moved: false, ox: w.x - posRef.current[n.id].x, oy: w.y - posRef.current[n.id].y };
    else { drag.current = { type: 'pan', moved: false, sx: ev.clientX - view.x, sy: ev.clientY - view.y }; setGrabbing(true); }
  };
  const onPointerMove = (ev) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    if (d.type === 'pan') setView((v) => ({ ...v, x: ev.clientX - d.sx, y: ev.clientY - d.sy }));
    else {
      const w = toWorld(ev);
      posRef.current[d.id] = { x: w.x - d.ox, y: w.y - d.oy };
      setView((v) => ({ ...v })); // trigger redraw
    }
  };
  const onPointerUp = (ev) => {
    const d = drag.current;
    drag.current = null;
    setGrabbing(false);
    if (!d) return;
    if (!d.moved) {
      const n = hitNode(toWorld(ev));
      if (n) {
        if (linkFrom && linkFrom !== n.id) { addEdge(linkFrom, n.id); setLinkFrom(null); return; }
        setSelected(n.id === selected ? null : n.id);
      } else setSelected(null);
    }
  };
  const onWheel = (ev) => {
    ev.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
    setView((v) => {
      const k = Math.max(0.25, Math.min(2.6, v.k * (ev.deltaY < 0 ? 1.12 : 0.9)));
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  };
  const zoom = (f) => setView((v) => {
    const cw = wrapRef.current.clientWidth / 2, chh = 300;
    const k = Math.max(0.25, Math.min(2.6, v.k * f));
    return { k, x: cw - ((cw - v.x) / v.k) * k, y: chh - ((chh - v.y) / v.k) * k };
  });
  const fit = () => { posRef.current = {}; setFilter((f) => f); setView({ x: 0, y: 0, k: 0.62 }); setGraph((g) => ({ ...g })); };

  // ---------- graph edits ----------
  const addNode = (node) => {
    posRef.current[node.id] = { x: W / 2, y: H / 2 };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
  };
  const removeNode = (id) => setGraph((g) => ({ nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.from !== id && e.to !== id) }));
  const addEdge = (from, to) => setGraph((g) => g.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)) ? g : ({ ...g, edges: [...g.edges, { from, to }] }));
  const removeEdge = (from, to) => setGraph((g) => ({ ...g, edges: g.edges.filter((e) => !((e.from === from && e.to === to) || (e.from === to && e.to === from))) }));
  const editNode = (id, field, value) => setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => n.id === id ? { ...n, [field]: value } : n) }));

  if (!graph) return null;
  const neighbours = sel ? [...neighbourIds].map((id) => graph.nodes.find((n) => n.id === id)).filter(Boolean) : [];

  return (
    <div>
      <div className="pagehead">
        <div className="kicker">Strategy · Connections</div>
        <h2>Connections</h2>
        <p className="lede">
          A linked canvas of the themes, ideas, partners and delivery components across both missions — seeded from
          the Missions documents. Drag to pan, scroll to zoom, drag cards to arrange, click a card to read and edit
          it. Edits save in this browser; publish to the team store or export JSON to share.
        </p>
      </div>

      <SharedBar blobKey="connections" label="connections map" getLocal={() => graph} applyRemote={(d) => { posRef.current = {}; setGraph(d); }} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select className="field" style={{ width: 200 }} value={filter} onChange={(e) => { setFilter(e.target.value); setSelected(null); }}>
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
        <button className="btn sm ghost danger" onClick={() => { if (confirm('Reset to the seeded graph from the Missions documents?')) { posRef.current = {}; setGraph(connections); } }}>Reset to seed</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
          onChange={(ev) => { const f = ev.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { posRef.current = {}; setGraph(JSON.parse(r.result)); } catch { /* */ } }; r.readAsText(f); ev.target.value = ''; }} />
      </div>

      <div className="conn-legend">
        {Object.entries(KIND_LABELS).map(([k, l]) => graph.nodes.some((n) => n.kind === k) ? <span key={k}><i style={{ background: KIND_COLORS[k] }} /> {l}</span> : null)}
      </div>

      {linkFrom && (
        <div className="error-box" style={{ marginBottom: 10, borderColor: '#0f9d8a55', background: '#0f9d8a10', color: '#0b6e61' }}>
          Linking from <b>{graph.nodes.find((n) => n.id === linkFrom)?.label}</b> — click another card to connect, or <button className="btn sm" onClick={() => setLinkFrom(null)}>cancel</button>
        </div>
      )}

      <div className="conn-wrap">
        <div className="conn-stage" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className={`conn-canvas ${grabbing ? 'grabbing' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          />
          <div className="conn-toolbar">
            <button className="btn sm" onClick={() => zoom(1.25)}>＋</button>
            <button className="btn sm" onClick={() => zoom(0.8)}>－</button>
            <button className="btn sm" onClick={fit}>Re-layout</button>
          </div>
        </div>

        <div>
          {!sel && <div className="card"><h4>Select a card</h4><div className="sub">Click any card on the canvas to read it, edit its notes, link it to other cards, or remove it. Use the filter to focus on one kind — direct neighbours stay visible for context.</div></div>}
          {sel && (
            <div className="card" style={{ borderColor: (KIND_COLORS[sel.kind] || '#51648c') + '66' }}>
              <span className="pill" style={{ color: KIND_COLORS[sel.kind], borderColor: (KIND_COLORS[sel.kind] || '#51648c') + '44' }}>{KIND_LABELS[sel.kind] || sel.kind}</span>
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
                  <a style={{ cursor: 'pointer', color: 'var(--ink)', flex: 1 }} onClick={() => setSelected(n.id)}>{n.label}</a>
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
