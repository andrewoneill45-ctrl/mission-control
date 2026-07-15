// Metrics & KPI tracker: driven by the VMOST plan — objectives first, framework beneath.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, loadRag, saveRag, loadVmost, metricCatalog } from '../data.jsx';
import { PrintHeader, PrintButton, Stat } from '../components/ui.jsx';
import SharedBar from '../components/SharedBar.jsx';

const RAG = ['—', 'R', 'A', 'G'];
const RAG_COLORS = { R: 'var(--crimson)', A: 'var(--amber)', G: 'var(--green)', '—': 'var(--ink3)' };

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
  useEffect(() => { saveRag(rag); }, [rag]);
  const setOne = (id, patch) => setRag((r) => ({ ...r, [id]: { ...(r[id] || {}), ...patch } }));

  const plan = useMemo(() => loadVmost(data.vmostSeed), [data]);
  const catalog = useMemo(() => metricCatalog(data), [data]);
  const byId = useMemo(() => Object.fromEntries(catalog.map((m) => [m.id, m])), [catalog]);
  // which objectives claim each metric (for badges in the framework tables)
  const linkedBy = useMemo(() => {
    const map = {};
    (plan?.objectives || []).forEach((o) => (o.metrics || []).forEach((id) => { (map[id] = map[id] || []).push(o.title); }));
    return map;
  }, [plan]);

  const counts = useMemo(() => {
    const all = Object.values(rag).map((x) => x.rag).filter((x) => x && x !== '—');
    return { G: all.filter((x) => x === 'G').length, A: all.filter((x) => x === 'A').length, R: all.filter((x) => x === 'R').length };
  }, [rag]);

  if (!k) return <p>No KPI data — re-run the data builders.</p>;

  const framework = k.framework || [];
  const categories = [...new Set(framework.map((m) => m.category).filter(Boolean))];
  const worst = (ids) => {
    const vals = ids.map((id) => rag[id]?.rag).filter((x) => x && x !== '—');
    if (!vals.length) return null;
    return vals.includes('R') ? 'R' : vals.includes('A') ? 'A' : 'G';
  };

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
          Driven by the VMOST plan: each objective is tracked through the metrics linked to it in the planner, so
          this page reads as “is the plan working?”. The full Strand 2 KPI set and Mission Metrics framework sit
          beneath. RAG ratings and notes save in this browser — publish to share the team scorecard.
        </p>
      </div>

      <div className="grid g4">
        <Stat value={counts.G} label="Green" color="green" />
        <Stat value={counts.A} label="Amber" color="amber" />
        <Stat value={counts.R} label="Red" color="crimson" />
        <Stat value={7 + 5 + 4 + framework.length - counts.G - counts.A - counts.R} label="Not yet rated" color="navy" />
      </div>

      <SharedBar blobKey="metrics-rag" label="scorecard" getLocal={() => rag} applyRemote={(d) => d && setRag(d)} />

      <h3 className="sect">The plan, measured — objectives from the VMOST planner</h3>
      {!(plan?.objectives || []).some((o) => (o.metrics || []).length) && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <div className="sub">
            No metrics are linked to objectives yet. Open the <Link to="/vmost" style={{ color: 'var(--accent)', fontWeight: 600 }}>VMOST planner</Link> and
            use <b>⚑ Metrics</b> on each objective (auto-suggest will propose sensible links). Objectives then appear here with their own scorecard.
          </div>
        </div>
      )}
      {(plan?.objectives || []).map((o) => {
        const ids = (o.metrics || []).filter((id) => byId[id]);
        if (!ids.length) return null;
        const health = worst(ids);
        return (
          <div className="card" key={o.id} style={{ marginBottom: 12, borderLeft: `4px solid ${health ? RAG_COLORS[health] : 'var(--line)'}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span className="vm-tag O">OBJ</span>
              <h4 style={{ margin: 0 }}>{o.title}</h4>
              <span className="pill" style={health ? { color: RAG_COLORS[health], borderColor: RAG_COLORS[health] } : {}}>
                {health ? { R: 'Off track', A: 'At risk', G: 'On track' }[health] : 'Not yet rated'}
              </span>
              <span className="sub" style={{ fontSize: 11 }}>{ids.length} linked metrics</span>
            </div>
            {o.detail && <div className="sub" style={{ fontSize: 12, marginBottom: 8 }}>{o.detail}</div>}
            <table className="data">
              <tbody>
                {ids.map((id) => {
                  const m = byId[id];
                  const st = rag[id] || {};
                  return (
                    <tr key={id}>
                      <td style={{ width: 110 }}><RagButton value={st.rag || '—'} onChange={(r) => setOne(id, { rag: r })} /></td>
                      <td style={{ fontSize: 12.2 }}>{m.label} <span className="pill" style={{ fontSize: 9.5, padding: '1px 7px' }}>{m.group}</span></td>
                      <td style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{m.target || m.baseline || ''}</td>
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
      })}

      <h3 className="sect">Outcome KPIs — Strand 2 collective impact strategy</h3>
      <KpiTable
        rows={k.outcome} idPrefix="out"
        cols={[['kpi', 'KPI'], ['baseline', 'Baseline (2025/26)'], ['y1', 'Year 1 target'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne} linkedBy={linkedBy}
      />

      <h3 className="sect">Collective impact KPIs</h3>
      <KpiTable
        rows={k.collective} idPrefix="col"
        cols={[['kpi', 'KPI'], ['measurement', 'Measurement'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne} linkedBy={linkedBy}
      />

      <h3 className="sect">Sustainability &amp; legacy KPIs</h3>
      <KpiTable
        rows={k.sustainability} idPrefix="sus"
        cols={[['kpi', 'KPI'], ['measurement', 'Measurement'], ['y3', 'Year 3 target']]}
        rag={rag} setOne={setOne} linkedBy={linkedBy}
      />

      <h3 className="sect">Full metrics framework <span className="sub" style={{ fontWeight: 400 }}>({framework.length} metrics · Mission Metrics doc · ⚑ = linked to an objective)</span></h3>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: '10px 0 6px', fontSize: 13 }}>{cat}</h4>
          <KpiTable
            rows={framework.filter((m) => m.category === cat)} idPrefix={`fw-${cat}`}
            cols={[['metric', 'Metric'], ['what', 'What it measures'], ['source', 'Source'], ['dimension', 'Dimension'], ['frequency', 'Frequency']]}
            rag={rag} setOne={setOne} linkedBy={linkedBy}
          />
        </div>
      ))}
      <p className="note">{k.note}</p>
    </div>
  );
}

function KpiTable({ rows, cols, idPrefix, rag, setOne, linkedBy = {} }) {
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
            const links = linkedBy[id];
            return (
              <tr key={id} style={st.rag === 'R' ? { background: '#d63a5508' } : st.rag === 'G' ? { background: '#1e9e4a08' } : undefined}>
                <td><RagButton value={st.rag || '—'} onChange={(r) => setOne(id, { rag: r })} /></td>
                {cols.map(([key], ci) => (
                  <td key={key} style={{ fontSize: 12.2 }}>
                    {row[key]}
                    {ci === 0 && links && <span className="pill" title={`Linked to: ${links.join(' · ')}`} style={{ marginLeft: 6, fontSize: 9.5, padding: '1px 7px', color: 'var(--accent)', borderColor: '#0f9d8a44' }}>⚑ {links.length > 1 ? `${links.length} objectives` : links[0].slice(0, 24)}</span>}
                  </td>
                ))}
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
