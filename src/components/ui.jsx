// Shared UI primitives: stat cards + plain-SVG charts (no chart libraries).

export function Stat({ value, label, detail, color = 'teal' }) {
  return (
    <div className={`stat ${color}`}>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

const PALETTE = {
  teal: '#46c6b4', blue: '#5b9cf5', crimson: '#ef5d73', amber: '#f0a544',
  green: '#57c974', purple: '#a78bfa', navy: '#7f96c9',
};
export const color = (c) => PALETTE[c] || PALETTE.teal;

// Horizontal bar list
export function Bars({ data, unit = '', max, colorFn, height = 22 }) {
  const m = max || Math.max(...data.map((d) => Math.abs(d.value ?? 0)), 0.001);
  return (
    <div>
      {data.map((d, i) => (
        <div className="bar-row" key={i} style={{ gridTemplateColumns: '150px 1fr 56px' }}>
          <div style={{ color: d.highlight ? '#e8edf7' : '#9fadc9', fontWeight: d.highlight ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>{d.label}</div>
          <div className="track" style={{ height }}>
            <div className="fill" style={{ width: `${Math.max(2, (Math.abs(d.value) / m) * 100)}%`, background: colorFn ? colorFn(d) : (d.color ? color(d.color) : PALETTE.blue), opacity: d.highlight === false ? 0.55 : 1 }} />
          </div>
          <div className="num">{d.value == null ? '—' : `${fmt(d.value)}${unit}`}</div>
        </div>
      ))}
    </div>
  );
}

function fmt(v) {
  if (typeof v !== 'number') return v;
  return Math.abs(v) >= 1000 ? v.toLocaleString('en-GB') : (Math.round(v * 10) / 10).toString();
}

// Simple line chart (SVG). series: [{name, color, points:[{x,y}]}]
export function LineChart({ series, width = 520, height = 190, unit = '', yMin = null, yMax = null }) {
  const pad = { l: 38, r: 12, t: 12, b: 24 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) return null;
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const ys = all.map((p) => p.y).filter((y) => y != null);
  let lo = yMin != null ? yMin : Math.min(...ys), hi = yMax != null ? yMax : Math.max(...ys);
  if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * 0.12; hi += span * 0.12;
  const X = (x) => pad.l + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * (width - pad.l - pad.r);
  const Y = (y) => pad.t + (1 - (y - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[...Array(ticks + 1)].map((_, i) => {
        const y = lo + ((hi - lo) * i) / ticks;
        return (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={Y(y)} y2={Y(y)} stroke="#ffffff10" />
            <text x={pad.l - 6} y={Y(y) + 3} fill="#66748f" fontSize="9" textAnchor="end" fontFamily="IBM Plex Mono">{fmt(y)}{unit}</text>
          </g>
        );
      })}
      {xs.map((x) => (
        <text key={x} x={X(x)} y={height - 8} fill="#66748f" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono">{String(x).replace('20', "'")}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.points.filter((p) => p.y != null);
        const dAttr = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' ');
        return (
          <g key={si}>
            <path d={dAttr} fill="none" stroke={color(s.color)} strokeWidth={s.width || 2.2} strokeDasharray={s.dash ? '5 4' : 'none'} strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="2.6" fill={color(s.color)} />)}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }) {
  return (
    <div className="conn-legend">
      {items.map((it, i) => (
        <span key={i}><i style={{ background: color(it.color) }} /> {it.label}</span>
      ))}
    </div>
  );
}

// Vertical grouped columns for e.g. trend comparison
export function Columns({ data, unit = '', width = 520, height = 190 }) {
  const pad = { l: 36, r: 8, t: 10, b: 40 };
  const max = Math.max(...data.map((d) => d.value ?? 0), 0.001) * 1.15;
  const bw = (width - pad.l - pad.r) / data.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={width - pad.r} y1={pad.t + (1 - f) * (height - pad.t - pad.b)} y2={pad.t + (1 - f) * (height - pad.t - pad.b)} stroke="#ffffff10" />
      ))}
      {data.map((d, i) => {
        const h = ((d.value ?? 0) / max) * (height - pad.t - pad.b);
        return (
          <g key={i}>
            <rect x={pad.l + i * bw + bw * 0.18} y={height - pad.b - h} width={bw * 0.64} height={h} rx="4" fill={d.color ? color(d.color) : '#5b9cf5'} opacity={d.dim ? 0.45 : 1} />
            <text x={pad.l + i * bw + bw / 2} y={height - pad.b - h - 5} fill="#9fadc9" fontSize="9.5" textAnchor="middle" fontFamily="IBM Plex Mono">{d.value == null ? '—' : fmt(d.value) + unit}</text>
            <text x={pad.l + i * bw + bw / 2} y={height - pad.b + 12} fill="#66748f" fontSize="9" textAnchor="middle">
              {String(d.label).split('\n').map((ln, j) => <tspan key={j} x={pad.l + i * bw + bw / 2} dy={j ? 10 : 0}>{ln}</tspan>)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut for budget etc.
export function Donut({ data, size = 200, total }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 14, sw = 26;
  const sum = total || data.reduce((a, d) => a + d.value, 0);
  let acc = 0;
  const cols = ['teal', 'blue', 'purple', 'amber', 'crimson', 'green', 'navy'];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {data.map((d, i) => {
        const a0 = (acc / sum) * Math.PI * 2 - Math.PI / 2;
        acc += d.value;
        const a1 = (acc / sum) * Math.PI * 2 - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
        return <path key={i} d={p} fill="none" stroke={color(d.color || cols[i % cols.length])} strokeWidth={sw} />;
      })}
    </svg>
  );
}
