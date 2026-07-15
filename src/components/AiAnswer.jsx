// Renders Claude answers containing ```stats and ```chart fenced blocks as live infographics.
import { Bars, LineChart, Stat, color } from './ui.jsx';

function parseBlocks(text) {
  const parts = [];
  const re = /```(stats|chart|json)\n([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', body: text.slice(last, m.index) });
    parts.push({ type: m[1], body: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', body: text.slice(last) });
  return parts;
}

function Prose({ text }) {
  // minimal markdown: **bold**, bullets, paragraphs
  const lines = text.split('\n');
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(<ul key={out.length}>{list}</ul>); list = null; } };
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (!t) { flush(); return; }
    const html = t
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    if (/^[-•▸]\s/.test(t)) {
      list = list || [];
      list.push(<li key={i} dangerouslySetInnerHTML={{ __html: html.replace(/^[-•▸]\s*/, '') }} />);
    } else {
      flush();
      out.push(<p key={i} dangerouslySetInnerHTML={{ __html: html }} />);
    }
  });
  flush();
  return <>{out}</>;
}

function ChartBlock({ spec }) {
  let c;
  try { c = JSON.parse(spec); } catch { return null; }
  if (!c || !Array.isArray(c.data)) return null;
  return (
    <div className="ai-chart">
      {c.title && <h5>{c.title}</h5>}
      {c.type === 'line' ? (
        <LineChart unit={c.unit || ''} series={[{ color: 'blue', points: c.data.map((d) => ({ x: d.label, y: d.value })) }]} />
      ) : (
        <Bars unit={c.unit || ''} data={c.data.map((d, i) => ({ label: d.label, value: d.value, color: d.color || 'blue' }))} />
      )}
    </div>
  );
}

function StatsBlock({ spec }) {
  let s;
  try { s = JSON.parse(spec); } catch { return null; }
  if (!Array.isArray(s)) return null;
  return (
    <div className="ai-stats">
      {s.slice(0, 4).map((x, i) => <Stat key={i} value={x.value} label={x.label} color={x.color || 'teal'} />)}
    </div>
  );
}

export default function AiAnswer({ text }) {
  if (!text) return null;
  const parts = parseBlocks(text);
  return (
    <div className="ai-answer">
      {parts.map((p, i) => {
        if (p.type === 'stats') return <StatsBlock key={i} spec={p.body} />;
        if (p.type === 'chart') return <ChartBlock key={i} spec={p.body} />;
        if (p.type === 'json') return null; // structural payloads handled by callers
        return <Prose key={i} text={p.body} />;
      })}
    </div>
  );
}

export function extractJson(text) {
  const m = /```json\n([\s\S]*?)```/.exec(text || '');
  if (m) { try { return JSON.parse(m[1]); } catch { /* fallthrough */ } }
  try { return JSON.parse(text); } catch { return null; }
}
