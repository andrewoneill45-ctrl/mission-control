// Metrics & KPI tracker: Strand 2 KPIs + the Mission Metrics framework, with editable RAG status.
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data.jsx';
import { PrintHeader, PrintButton, Stat } from '../components/ui.jsx';
import SharedBar from '../components/SharedBar.jsx';

const RAG = ['—', 'R', 'A', 'G'];
const RAG_COLORS = { R: 'var(--crimson)', A: 'var(--amber)', G: 'var(--green)', '—': 'var(--ink3)' };
const RKEY = 'mission-control-rag-v1';

function loadRag() {
  try { const raw = localStorage.getItem(RKEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  return {};
}

function RagButton({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} className="noprint-keep">
      {RAG.map((r) => (
        <button key={r} onClick={() => onChange(r)}
          style={{
            width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${value === r ? RAG_COLORS[r] : 'var(--line)'}`,
            background: value === r ? RAG_COLORS[r] : 'transparent',
            color: value === r ? (r === '—' ? '#fff' : '#fff') : 'var(--ink3)',
          }}>{r}</button>
      ))}
    </div>
  );
}

export default function Metrics() {
  const { data } = useData();
  const k = data.kpis;
  const [rag, setRag] = useState(() => loadRag());
  useEffect(() => { try { localStorage.setItem(RKEY, JSON.stringify(rag)); } catch { /* */ } }, [rag]);
  const setOne = (id, patch) => setRag((r) => ({ ...r, [id]: { ...(r[id] || {}), ...patch } }));

  const counts = useMemo(() => {
    const all = Object.values(rag).map((x) => x.rag).filter((x) => x && x !== '—');
    return { G: all.filter((x) => x === 'G').length, A: all.filter((x) => x === 'A').length, R: all.filter((x) => x === 'R').length };
  }, [rag]);

  if (!k) return <p>No KPI data — re-run the data builders.</p>;

  const framework = k.framework || [];
  const categories = [...new Set(framework.map((m) => m.category).filter(Boolean))];

  return (
    <div>
      <PrintHeader title="Metrics & KPI tracker" subtitle="Mission NE & Mission Coastal" />
      <div className="pagehead">
        <div className="kicker">Strategy · Metrics</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2>Metrics &amp; KPI Tracker</h2>
          <PrintButton label="Print scorecard / PDF" />
        </div>
        <p className="lede">
          The mission measurement framework in one place: outcome KPIs with Year 1 and Year 3 targets from the
          Strand 2 collective impact strategy, plus the full Mission Metrics framework. Set a RAG status and note
          against any line as data lands — your ratings save in this browser; publish to share the team scorecard.
        </p>
      </div>

      <div className="grid g4">
        <Stat value={counts.G} label="Green" color="green" />
        <Stat value={counts.A} label="Amber" color="amber" />
        <Stat value={counts.R} label="Red" color="crimson" />
        <Stat value={7 + 5 + 4 + framework.length - counts.G - counts.A - counts.R} label="Not yet rated" color="navy" />
      </div>

      <SharedBar blobKey="metrics-rag" label="scorecard" getLocal={() => rag} applyRemote={(d) => d && setRag(d)} />

      <h3 className="sect">Outcome KPIs — Strand 2 collective impact strategy</h3>
      <KpiTable
        rows={k.outcome} idPrefix="out"
        cols={[['kpi', 'KPI'], ['baseline', 'Baseline (2025/26)'], ['y1', 'Year 1 target'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne}
      />

      <h3 className="sect">Collective impact KPIs</h3>
      <KpiTable
        rows={k.collective} idPrefix="col"
        cols={[['kpi', 'KPI'], ['measurement', 'Measurement'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne}
      />

      <h3 className="sect">Sustainability &amp; legacy KPIs</h3>
      <KpiTable
        rows={k.sustainability} idPrefix="sus"
        cols={[['kpi', 'KPI'], ['measurement', 'Measurement'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne}
      />

      <h3 className="sect">Full metrics framework <span className="sub" style={{ fontWeight: 400 }}>({framework.length} metrics · Mission Metrics doc)</span></h3>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: '10px 0 6px', fontSize: 13 }}>{cat}</h4>
          <KpiTable
            rows={framework.filter((m) => m.category === cat)} idPrefix={`fw-${cat}`}
            cols={[['metric', 'Metric'], ['what', 'What it measures'], ['source', 'Source'], ['dimension', 'Dimension'], ['frequency', 'Frequency']]}
            rag={rag} setOne={setOne}
          />
        </div>
      ))}
      <p className="note">{k.note}</p>
    </div>
  );
}

function KpiTable({ rows, cols, idPrefix, rag, setOne }) {
  return (
    <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
      <table className="data">
        <thead>
          <tr>
            <th style={{ width: 110 }}>RAG</th>
            {cols.map(([key, label]) => <th key={key}>{label}</th>)}
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = `${idPrefix}-${i}`;
            const st = rag[id] || {};
            return (
              <tr key={id} style={st.rag === 'R' ? { background: '#d63a5508' } : st.rag === 'G' ? { background: '#1e9e4a08' } : undefined}>
                <td><RagButton value={st.rag || '—'} onChange={(r) => setOne(id, { rag: r })} /></td>
                {cols.map(([key]) => <td key={key} style={{ fontSize: 12.2 }}>{row[key]}</td>)}
                <td style={{ minWidth: 140 }}>
                  <input className="field" style={{ padding: '4px 8px', fontSize: 11.5 }} placeholder="Add note…"
                    value={st.note || ''} onChange={(e) => setOne(id, { note: e.target.value })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
