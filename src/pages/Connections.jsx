// Connections: a full-page infinite canvas of linked cards (Supernotes-style).
// Pan (drag background), zoom (wheel/buttons), drag cards, click to inspect,
// double-click empty space to add a card there. Edits save locally; publish to the team store.
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
const MAJOR = new Set(['vmost', 'mission', 'area', 'strand']);
const W = 1700, H = 1200; // world size for the initial layout

// Semantic zoom (the Supernotes trick): when zooming out, the map compresses
// but cards shrink far more slowly, so they stay readable at any zoom.
// Returns the card scale factor in world units for a given view zoom k.
const cardScale = (k) => Math.min(2, Math.max(1, Math.pow(1 / k, 0.55)));

// ---------- layout ----------
function forceLayout(nodes, edges, iterations = 340) {
  const pos = {};
  const kinds = [...new Set(nodes.map((n) => n.kind))];
  nodes.forEach((n, i) => {
    // seed clustered by kind so related cards start near each other
    const ka = (kinds.indexOf(n.kind) / Math.max(1, kinds.length)) * Math.PI * 2;
    const jx = ((i * 37) % 17) / 17 - 0.5, jy = ((i * 53) % 13) / 13 - 0.5;
    pos[n.id] = { x: W / 2 + Math.cos(ka) * W / 4.5 + jx * 380, y: H / 2 + Math.sin(ka) * H / 4.5 + jy * 300 };
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
        const f = (30000 / d2) * t;
        dx *= f; dy *= f;
        a.x += dx; a.y += dy; b.x -= dx; b.y -= dy;
      }
    }
    edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - 235) / d) * 0.055 * t;
      a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
    });
    nodes.forEach((n) => {
      const p = pos[n.id];
      p.x += (W / 2 - p.x) * 0.01 * (1 + (deg[n.id] || 0) * 0.05) * t;
      p.y += (H / 2 - p.y) * 0.013 * (1 + (deg[n.id] || 0) * 0.05) * t;
    });
  }
  // resolve card overlaps (approximate card footprint)
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        const minX = 218, minY = 92;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
          moved = true;
          if (Math.abs(dx) / minX > Math.abs(dy) / minY) {
            const push = (minX - Math.abs(dx)) / 2 * Math.sign(dx || 1);
            a.x -= push; b.x += push;
          } else {
            const push = (minY - Math.abs(dy)) / 2 * Math.sign(dy || 1);
            a.y -= push; b.y += push;
          }
        }
      }
    }
    if (!moved) break;
  }
  return pos;
}

function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (ctx.measureText(trial).width <= maxW || !line) line = trial;
    else { lines.push(line); line = w; if (lines.length === maxLines) break; }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length > 2) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

export default function Connections() {
  const { connections } = useData();
  const [graph, setGraph] = useState(() => loadConnEdits() || connections);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(null); // {x, y} world coords or true
  const [linkFrom, setLinkFrom] = useState(null);
  const [view, setView] = useState(null); // {x, y, k}; null = fit on first draw
  const [panelOpen, setPanelOpen] = useState(true);
  const [topOffset, setTopOffset] = useState(58);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const drag = useRef(null);
  const posRef = useRef({});
  const hover = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => { if (graph) saveConnEdits(graph); }, [graph]);
  useEffect(() => {
    const measure = () => setTopOffset(document.querySelector('.topbar')?.offsetHeight || 58);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setLinkFrom(null); setSelected(null); setAdding(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(() => {
    if (!graph) return [];
    if (filter === 'all') return graph.nodes;
    const keep = new Set(graph.nodes.filter((n) => n.kind === filter).map((n) => n.id));
    graph.edges.forEach((e) => { if (keep.has(e.from)) keep.add(e.to); if (keep.has(e.to)) keep.add(e.from); });
    return graph.nodes.filter((n) => keep.has(n.id));
  }, [graph, filter]);
  const visIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const visEdges = useMemo(() => (graph ? graph.edges.filter((e) => visIds.has(e.from) && visIds.has(e.to)) : []), [graph, visIds]);

  useMemo(() => {
    const fresh = forceLayout(visible, visEdges);
    const merged = {};
    visible.forEach((n) => { merged[n.id] = posRef.current[n.id] || fresh[n.id]; });
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

  const fitView = (cw, ch) => {
    const pts = visible.map((n) => posRef.current[n.id]).filter(Boolean);
    if (!pts.length) return { x: 0, y: 0, k: 1 };
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    // two passes: card footprints grow when zoomed out (semantic zoom), so
    // estimate k first, then refit with the margin cards will actually need.
    const solve = (margin) => {
      const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin;
      const minY = Math.min(...ys) - margin * 0.62, maxY = Math.max(...ys) + margin * 0.62;
      const k = Math.max(0.12, Math.min(1.2, Math.min(cw / (maxX - minX), ch / (maxY - minY))));
      return { k, x: (cw - (minX + maxX) * k) / 2, y: (ch - (minY + maxY) * k) / 2 };
    };
    const first = solve(140);
    return solve(130 * cardScale(first.k));
  };

  // ---------- drawing ----------
  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage || !graph) return;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    if (!cw || !ch) return;
    let v = view;
    if (!v) { v = fitView(cw, ch); setView(v); return; }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
        this.closePath();
      };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // board background + dot grid
    ctx.fillStyle = '#f6f8fc';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.scale(v.k, v.k);
    let step = 34;
    while (step * v.k < 24) step *= 2; // keep the dot grid airy at any zoom
    const x0 = Math.floor((-v.x / v.k) / step) * step, x1 = (-v.x + cw) / v.k;
    const y0 = Math.floor((-v.y / v.k) / step) * step, y1 = (-v.y + ch) / v.k;
    ctx.fillStyle = '#17202f18';
    const dotR = Math.min(1.4, 1.1 / v.k);
    for (let gx = x0; gx <= x1; gx += step) {
      for (let gy = y0; gy <= y1; gy += step) {
        ctx.beginPath(); ctx.arc(gx, gy, dotR, 0, Math.PI * 2); ctx.fill();
      }
    }

    const pos = posRef.current;
    // edges
    visEdges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const active = selected && (e.from === selected || e.to === selected);
      ctx.beginPath();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 22;
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = active ? '#0f9d8a' : '#51648c33';
      ctx.lineWidth = (active ? 2.2 : 1.3) / v.k;
      ctx.stroke();
    });

    // cards — semantic zoom: sizes scale by `s` so cards stay readable zoomed out
    const s = cardScale(v.k);
    ctx.textBaseline = 'middle';
    visible.forEach((n) => {
      const p = pos[n.id];
      if (!p) return;
      const major = MAJOR.has(n.kind);
      const col = KIND_COLORS[n.kind] || '#51648c';
      const fs = (major ? 13.5 : 12.5) * s;
      ctx.font = `${major ? 700 : 600} ${fs}px Inter, sans-serif`;
      const maxTextW = (major ? 190 : 160) * s;
      const lines = wrapLines(ctx, n.label, maxTextW, 2);
      const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 56 * s);
      const pw = textW + 34 * s, lh = fs + 4 * s;
      const ph = 12 * s + lines.length * lh + 14 * s;
      const x = p.x - pw / 2, y = p.y - ph / 2;
      const r = 9 * s;
      const isSel = n.id === selected;
      const dim = selected && !isSel && !neighbourIds.has(n.id);

      ctx.globalAlpha = dim ? 0.22 : 1;
      // shadow + body
      ctx.save();
      ctx.shadowColor = 'rgba(23,32,47,0.13)';
      ctx.shadowBlur = 10 / v.k;
      ctx.shadowOffsetY = 2 / v.k;
      ctx.beginPath(); ctx.roundRect(x, y, pw, ph, r);
      ctx.fillStyle = major ? col : '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.roundRect(x, y, pw, ph, r);
      ctx.strokeStyle = isSel ? col : major ? 'rgba(255,255,255,0.25)' : '#dbe3ef';
      ctx.lineWidth = (isSel ? 2.6 : 1.2) / Math.sqrt(v.k);
      ctx.stroke();
      if (!major) { // kind accent strip, clipped to the card's rounded corners
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, pw, ph, r); ctx.clip();
        ctx.fillStyle = col; ctx.fillRect(x, y, 4.5 * s, ph);
        ctx.restore();
      }
      // title
      ctx.font = `${major ? 700 : 600} ${fs}px Inter, sans-serif`;
      ctx.fillStyle = major ? '#ffffff' : '#1e293b';
      ctx.textAlign = 'left';
      lines.forEach((l, i) => ctx.fillText(l, x + 15 * s, y + 12 * s + lh * i + lh / 2 - 1));
      // kind caption
      ctx.font = `600 ${8.5 * s}px Inter, sans-serif`;
      ctx.fillStyle = major ? 'rgba(255,255,255,0.75)' : col;
      ctx.fillText((KIND_LABELS[n.kind] || n.kind).toUpperCase(), x + 15 * s, y + ph - 9 * s);
      ctx.globalAlpha = 1;
      n._hit = { x, y, w: pw, h: ph };
    });
    // link-mode hint line to cursor is drawn on pointermove via hover
    ctx.restore();
  }, [graph, visible, visEdges, view, selected, neighbourIds, topOffset, panelOpen]);

  useEffect(() => {
    const onR = () => setView((v) => (v ? { ...v } : v));
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // ---------- interactions ----------
  const toWorld = (ev) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
    const v = view || { x: 0, y: 0, k: 1 };
    return { x: (sx - v.x) / v.k, y: (sy - v.y) / v.k, sx, sy };
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
    else { drag.current = { type: 'pan', moved: false, sx: ev.clientX - (view?.x || 0), sy: ev.clientY - (view?.y || 0) }; setGrabbing(true); }
  };
  const onPointerMove = (ev) => {
    const d = drag.current;
    if (!d) {
      const n = hitNode(toWorld(ev));
      if (hover.current !== n) { hover.current = n; canvasRef.current.style.cursor = n ? 'pointer' : 'grab'; }
      return;
    }
    if (Math.abs(ev.movementX) + Math.abs(ev.movementY) > 1) d.moved = true;
    if (d.type === 'pan') setView((v) => ({ ...v, x: ev.clientX - d.sx, y: ev.clientY - d.sy }));
    else {
      const w = toWorld(ev);
      posRef.current[d.id] = { x: w.x - d.ox, y: w.y - d.oy };
      setView((v) => ({ ...v }));
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
      } else if (!linkFrom) setSelected(null);
    }
  };
  const onDoubleClick = (ev) => {
    const w = toWorld(ev);
    if (!hitNode(w)) setAdding({ x: w.x, y: w.y });
  };
  const onWheel = (ev) => {
    ev.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
    setView((v) => {
      if (!v) return v;
      const k = Math.max(0.15, Math.min(2.8, v.k * (ev.deltaY < 0 ? 1.12 : 0.9)));
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  };
  const zoom = (f) => setView((v) => {
    if (!v) return v;
    const cw = stageRef.current.clientWidth / 2, chh = stageRef.current.clientHeight / 2;
    const k = Math.max(0.15, Math.min(2.8, v.k * f));
    return { k, x: cw - ((cw - v.x) / v.k) * k, y: chh - ((chh - v.y) / v.k) * k };
  });
  const fit = () => setView(fitView(stageRef.current.clientWidth, stageRef.current.clientHeight));
  const relayout = () => { posRef.current = {}; setGraph((g) => ({ ...g })); setView(null); };

  // ---------- graph edits ----------
  const addNode = (node, at) => {
    posRef.current[node.id] = at || { x: (stageRef.current.clientWidth / 2 - (view?.x || 0)) / (view?.k || 1), y: (stageRef.current.clientHeight / 2 - (view?.y || 0)) / (view?.k || 1) };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
  };
  const removeNode = (id) => setGraph((g) => ({ nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.from !== id && e.to !== id) }));
  const addEdge = (from, to) => setGraph((g) => g.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)) ? g : ({ ...g, edges: [...g.edges, { from, to }] }));
  const removeEdge = (from, to) => setGraph((g) => ({ ...g, edges: g.edges.filter((e) => !((e.from === from && e.to === to) || (e.from === to && e.to === from))) }));
  const editNode = (id, field, value) => setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => n.id === id ? { ...n, [field]: value } : n) }));

  if (!graph) return null;
  const neighbours = sel ? [...neighbourIds].map((id) => graph.nodes.find((n) => n.id === id)).filter(Boolean) : [];

  return (
    <div className="conn-full" style={{ top: topOffset }}>
      <div className="conn-stage-full" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className={`conn-canvas-full ${grabbing ? 'grabbing' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        />

        {/* left tool panel */}
        <div className={`conn-panel left ${panelOpen ? '' : 'closed'}`}>
          <div className="conn-panel-head" onClick={() => setPanelOpen(!panelOpen)}>
            <b>Connections</b>
            <span className="sub" style={{ fontSize: 11 }}>{graph.nodes.length} cards · {graph.edges.length} links</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink3)', fontSize: 11 }}>{panelOpen ? '▾' : '▸'}</span>
          </div>
          {panelOpen && (
            <>
              <select className="field" value={filter} onChange={(e) => { setFilter(e.target.value); setSelected(null); setView(null); }}>
                <option value="all">All kinds</option>
                {Object.keys(KIND_LABELS).map((k) => {
                  const c = graph.nodes.filter((n) => n.kind === k).length;
                  return c ? <option key={k} value={k}>{KIND_LABELS[k]} ({c})</option> : null;
                })}
              </select>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn sm primary" onClick={() => setAdding(true)}>＋ Add card</button>
                <button className="btn sm ghost" onClick={() => download('mission-connections.json', graph)}>Export</button>
                <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Import</button>
                <button className="btn sm ghost danger" onClick={() => { if (confirm('Reset to the seeded graph from the Missions documents?')) { posRef.current = {}; setGraph(connections); setView(null); } }}>Reset</button>
              </div>
              <SharedBar blobKey="connections" label="map" getLocal={() => graph} applyRemote={(d) => { posRef.current = {}; setGraph(d); setView(null); }} />
              <div className="conn-legend" style={{ margin: 0 }}>
                {Object.entries(KIND_LABELS).map(([k, l]) => graph.nodes.some((n) => n.kind === k) ? <span key={k}><i style={{ background: KIND_COLORS[k] }} /> {l}</span> : null)}
              </div>
              <div className="sub" style={{ fontSize: 10.8 }}>Drag the board to pan · scroll to zoom · drag cards to arrange · double-click empty space for a new card · Esc to deselect</div>
            </>
          )}
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={(ev) => { const f = ev.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { posRef.current = {}; setGraph(JSON.parse(r.result)); setView(null); } catch { /* */ } }; r.readAsText(f); ev.target.value = ''; }} />
        </div>

        {/* zoom controls */}
        <div className="conn-zoom">
          <button className="btn sm" onClick={() => zoom(1.25)} title="Zoom in">＋</button>
          <button className="btn sm" onClick={() => zoom(0.8)} title="Zoom out">－</button>
          <button className="btn sm" onClick={fit} title="Fit everything in view">⤢</button>
          <button className="btn sm" onClick={relayout} title="Re-run the automatic layout">↻</button>
        </div>

        {/* link mode banner */}
        {linkFrom && (
          <div className="conn-banner">
            Linking from <b>{graph.nodes.find((n) => n.id === linkFrom)?.label}</b> — click another card to connect · <a onClick={() => setLinkFrom(null)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>cancel</a>
          </div>
        )}

        {/* inspector */}
        {sel && (
          <div className="conn-inspector" style={{ borderTop: `3px solid ${KIND_COLORS[sel.kind] || '#51648c'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pill" style={{ color: KIND_COLORS[sel.kind], borderColor: (KIND_COLORS[sel.kind] || '#51648c') + '44' }}>{KIND_LABELS[sel.kind] || sel.kind}</span>
              <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <input className="field" style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }} value={sel.label} onChange={(e) => editNode(sel.id, 'label', e.target.value)} />
            <textarea className="field" rows={5} style={{ marginTop: 8, fontSize: 12.4 }} placeholder="Notes…" value={sel.text || ''} onChange={(e) => editNode(sel.id, 'text', e.target.value)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => setLinkFrom(sel.id)}>⤿ Link to…</button>
              <select className="field" style={{ width: 'auto', padding: '4px 8px', fontSize: 11.5 }} value={sel.kind} onChange={(e) => editNode(sel.id, 'kind', e.target.value)}>
                {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn sm danger" onClick={() => { if (confirm('Delete this card and its links?')) { removeNode(sel.id); setSelected(null); } }}>Delete</button>
            </div>
            <h4 style={{ margin: '14px 0 6px', fontSize: 12.5 }}>Connections ({neighbours.length})</h4>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {neighbours.map((n) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', fontSize: 12.3 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: KIND_COLORS[n.kind], flexShrink: 0 }} />
                  <a style={{ cursor: 'pointer', color: 'var(--ink)', flex: 1 }} onClick={() => setSelected(n.id)}>{n.label}</a>
                  <button className="btn sm ghost danger" onClick={() => removeEdge(sel.id, n.id)}>✕</button>
                </div>
              ))}
              {!neighbours.length && <div className="sub" style={{ fontSize: 11.5 }}>No links yet — use “Link to…” then click another card.</div>}
            </div>
          </div>
        )}

        {/* add card modal */}
        {adding && (
          <AddCard
            onCancel={() => setAdding(null)}
            onAdd={(n) => { addNode(n, typeof adding === 'object' ? adding : null); setAdding(null); setSelected(n.id); }}
          />
        )}
      </div>
    </div>
  );
}

function AddCard({ onAdd, onCancel }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('note');
  const [text, setText] = useState('');
  return (
    <div className="conn-modal">
      <div className="card" style={{ width: 420, maxWidth: '92vw' }}>
        <h4>New card</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input autoFocus className="field" placeholder="Title" value={label} onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && label.trim()) onAdd({ id: uid(), label: label.trim(), kind, text }); }} />
          <select className="field" style={{ width: 140 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <textarea className="field" rows={3} placeholder="Notes" value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn primary" disabled={!label.trim()} onClick={() => onAdd({ id: uid(), label: label.trim(), kind, text })}>Add card</button>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
