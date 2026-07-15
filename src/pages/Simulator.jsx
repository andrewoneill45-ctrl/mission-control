// Impact simulator: NEET-Intelligence-style lever modelling over the four mission areas,
// with named scenario save & side-by-side comparison (shared via Netlify Blobs).
import { useEffect, useMemo, useState } from 'react';
import { useData, askApi, loadScenarios, saveScenarios, uid } from '../data.jsx';
import { Stat, LineChart, Legend, PrintHeader, PrintButton, color } from '../components/ui.jsx';
import AiAnswer from '../components/AiAnswer.jsx';
import SharedBar from '../components/SharedBar.jsx';

// Evidence-informed (illustrative) effect coefficients per unit of lever, per year at full intensity.
export const LEVERS = [
  { id: 'pst', name: 'PST deployment intensity', unit: 'days/wk per specialist', min: 0, max: 5, step: 0.5, default: 3,
    note: 'Performance Support Teams in clusters of 6-8 secondaries. Core plan ~3 days/week.',
    effects: { a8: 0.55, a8_disadv: 0.7, pa: -0.9, neet: -0.12 } },
  { id: 'attendance', name: 'Attendance & family liaison programme', unit: '% of cluster schools covered', min: 0, max: 100, step: 10, default: 60,
    note: 'Daily monitoring, family liaison, persistent-absence protocols.',
    effects: { pa: -0.045, a8: 0.012, a8_disadv: 0.016, neet: -0.004 } },
  { id: 'enrichment', name: 'Enrichment entitlement uptake', unit: '% of pupils participating', min: 0, max: 100, step: 10, default: 50,
    note: 'Guaranteed enrichment offer with anchor partners + DCMS £22.5m.',
    effects: { pa: -0.02, neet: -0.006, a8_disadv: 0.01 } },
  { id: 'ks2', name: 'Primary attainment programme (Coastal focus)', unit: '% of primaries in scope', min: 0, max: 100, step: 10, default: 40,
    note: 'Maths-first KS2 support using local proof points (Airy Hill, Thomas Hinderwell model).',
    effects: { ks2: 0.055, a8Lag: 0.01 } },
  { id: 'transition', name: 'Year 7 Bridge / early-warning system', unit: '% of Y6-7 cohort covered', min: 0, max: 100, step: 10, default: 30,
    note: 'TLG concepts: summer bridge, one-childhood-one-record, predictive flags with a human response.',
    effects: { pa: -0.015, neet: -0.008, a8_disadv: 0.008 } },
];

const YEARS = [2026, 2027, 2028, 2029, 2030];
const RAMP = [0, 0.35, 0.7, 0.9, 1.0]; // phased clusters; outcomes lag delivery
const cumRamp = (i) => RAMP.slice(0, i + 1).reduce((x, y) => x + y, 0);
const SCEN_COLORS = ['teal', 'crimson', 'blue', 'purple', 'amber', 'green'];

export function computeModel(levers, a) {
  const eff = { a8: 0, a8_disadv: 0, pa: 0, neet: 0, ks2: 0 };
  LEVERS.forEach((l) => {
    const v = levers[l.id] ?? 0;
    Object.entries(l.effects).forEach(([k, per]) => {
      if (k === 'a8Lag') { eff.a8 += per * v * 0.5; return; }
      if (eff[k] === undefined) return;
      eff[k] += per * v;
    });
  });
  const base = {
    a8: a.a8['2024/25'], a8_disadv: a.a8_disadv['2024/25'],
    pa: a.pa ? a.pa.secondary : 27.0, ks2: a.ks2_rwm['2024/25'],
    neet: a.neet.neetnk,
  };
  const capped = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const track = (key, lo, hi) => YEARS.map((y, i) => ({
    x: y, y: Math.round(capped(base[key] + eff[key] * cumRamp(i), lo, hi) * 10) / 10,
  }));
  return {
    base,
    a8: track('a8', 20, 60), a8_disadv: track('a8_disadv', 15, 50),
    pa: track('pa', 5, 45), neet: track('neet', 1, 25), ks2: track('ks2', 20, 90),
  };
}
const endOf = (m, k) => m[k][m[k].length - 1].y;
const deltaOf = (m, k) => Math.round((endOf(m, k) - m.base[k]) * 10) / 10;

export default function Simulator() {
  const { data } = useData();
  const areas = data.areas;
  const [areaKey, setAreaKey] = useState('sunderland');
  const [levers, setLevers] = useState(Object.fromEntries(LEVERS.map((l) => [l.id, l.default])));
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [scenarios, setScenarios] = useState(() => loadScenarios());
  const [compare, setCompare] = useState([]); // scenario ids
  const [scenName, setScenName] = useState('');

  useEffect(() => { saveScenarios(scenarios); }, [scenarios]);

  const a = areas[areaKey];
  const e = data.meta.england;
  const model = useMemo(() => computeModel(levers, a), [levers, a]);

  const saveScenario = () => {
    const name = scenName.trim() || `Scenario ${scenarios.length + 1}`;
    setScenarios((s) => [...s, { id: uid(), name, areaKey, levers: { ...levers } }]);
    setScenName('');
  };
  const removeScenario = (id) => {
    setScenarios((s) => s.filter((x) => x.id !== id));
    setCompare((c) => c.filter((x) => x !== id));
  };
  const toggleCompare = (id) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4));
  const loadIntoLevers = (sc) => { setAreaKey(sc.areaKey); setLevers({ ...sc.levers }); };

  const compared = compare
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((sc) => sc && areas[sc.areaKey])
    .map((sc, i) => ({ ...sc, color: SCEN_COLORS[i % SCEN_COLORS.length], model: computeModel(sc.levers, areas[sc.areaKey]) }));

  const narrate = async () => {
    setLoading(true); setErr(null); setNarrative(null);
    try {
      let ctx = `SIMULATOR SETTINGS for ${a.name}:\n` +
        LEVERS.map((l) => `${l.name}: ${levers[l.id]} ${l.unit}`).join('\n') +
        `\nMODELLED 2030 OUTCOMES (illustrative): A8 ${endOf(model, 'a8')} (baseline ${model.base.a8}), disadvantaged A8 ${endOf(model, 'a8_disadv')} (baseline ${model.base.a8_disadv}), secondary PA ${endOf(model, 'pa')}% (baseline ${model.base.pa}%), KS2 RWM ${endOf(model, 'ks2')}% (baseline ${model.base.ks2}%), 16-17 NEET/not known ${endOf(model, 'neet')}% (baseline ${model.base.neet}%).`;
      if (compared.length) {
        ctx += '\n\nCOMPARISON SCENARIOS:\n' + compared.map((sc) =>
          `${sc.name} (${areas[sc.areaKey].name}): ` + LEVERS.map((l) => `${l.id}=${sc.levers[l.id]}`).join(', ') +
          ` → 2030 disadvantaged A8 ${endOf(sc.model, 'a8_disadv')}, PA ${endOf(sc.model, 'pa')}%, NEET/NK ${endOf(sc.model, 'neet')}%`).join('\n');
      }
      const q = compared.length
        ? 'Compare these simulated scenarios: which allocation of effort looks strongest per pound against the evidence, and what are the risks of each?'
        : `Assess this simulated scenario for ${a.name}: is the scale of change plausible against the evidence, what must be true, and what are the biggest risks?`;
      const res = await askApi({ mode: 'impact', question: q, context: ctx });
      if (res.error) throw new Error(res.error === 'no_key' ? 'No ANTHROPIC_API_KEY set in Netlify environment variables.' : res.detail || res.error);
      setNarrative(res.answer);
    } catch (ex) { setErr(String(ex.message || ex)); }
    setLoading(false);
  };

  return (
    <div>
      <PrintHeader title="Impact scenarios" subtitle={a.name} />
      <div className="pagehead">
        <div className="kicker">Strategy · Modelling</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2>Impact Simulator</h2>
          <PrintButton />
        </div>
        <p className="lede">
          Set the delivery levers and watch the modelled trajectory for each mission area to 2030. Effects are
          illustrative, evidence-informed coefficients with a phased ramp-up (new cluster each term; outcomes lag
          delivery) — a thinking tool, not a forecast. Save named scenarios (e.g. “PST-heavy” vs “enrichment-heavy”)
          and compare them side by side.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }} className="noprint">
        {Object.entries(areas).map(([k, v]) => (
          <button key={k} className="btn" style={areaKey === k ? { borderColor: v.mission === 'ne' ? 'var(--accent)' : 'var(--coastal)', color: v.mission === 'ne' ? 'var(--accent)' : 'var(--coastal)', fontWeight: 700 } : {}} onClick={() => setAreaKey(k)}>
            {v.name}
          </button>
        ))}
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4>Delivery levers — {a.name}</h4>
          {LEVERS.map((l) => (
            <div className="sim-lever" key={l.id}>
              <label>{l.name}<span className="val">{levers[l.id]} {l.unit}</span></label>
              <input type="range" min={l.min} max={l.max} step={l.step} value={levers[l.id]}
                onChange={(ev) => setLevers({ ...levers, [l.id]: Number(ev.target.value) })} />
              <div className="note">{l.note}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }} className="noprint">
            <input className="field" style={{ flex: 1, minWidth: 150 }} placeholder="Name this scenario (e.g. PST-heavy)…"
              value={scenName} onChange={(ev) => setScenName(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') saveScenario(); }} />
            <button className="btn" onClick={saveScenario}>＋ Save scenario</button>
            <button className="btn primary" onClick={narrate} disabled={loading}>
              {loading ? <><span className="spinner" /> Stress-testing…</> : '✦ Stress-test with Claude'}
            </button>
          </div>
        </div>

        <div>
          <div className="grid g2" style={{ gap: 10 }}>
            <Stat value={endOf(model, 'a8').toFixed(1)} label={`A8 by 2030 (baseline ${model.base.a8.toFixed(1)})`} detail={`${deltaOf(model, 'a8') >= 0 ? '+' : ''}${deltaOf(model, 'a8')} pts · England ${e.a8}`} color={deltaOf(model, 'a8') > 0 ? 'green' : 'navy'} />
            <Stat value={endOf(model, 'a8_disadv').toFixed(1)} label={`Disadvantaged A8 (baseline ${model.base.a8_disadv.toFixed(1)})`} detail={`${deltaOf(model, 'a8_disadv') >= 0 ? '+' : ''}${deltaOf(model, 'a8_disadv')} pts`} color={deltaOf(model, 'a8_disadv') > 0 ? 'green' : 'navy'} />
            <Stat value={`${endOf(model, 'pa').toFixed(1)}%`} label={`Secondary PA (baseline ${model.base.pa.toFixed(1)}%)`} detail={`${deltaOf(model, 'pa')} pp · England ${e.pa_secondary}%`} color={deltaOf(model, 'pa') < 0 ? 'green' : 'navy'} />
            <Stat value={`${endOf(model, 'neet').toFixed(1)}%`} label={`16-17 NEET/NK (baseline ${model.base.neet.toFixed(1)}%)`} detail={`${deltaOf(model, 'neet')} pp`} color={deltaOf(model, 'neet') < 0 ? 'green' : 'navy'} />
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h4>Attainment 8 trajectory — {a.name}</h4>
            <LineChart unit="" series={[
              { color: a.mission === 'ne' ? 'teal' : 'amber', points: model.a8 },
              { color: 'crimson', points: model.a8_disadv },
              { color: 'navy', dash: true, points: YEARS.map((y) => ({ x: y, y: e.a8 })) },
            ]} />
            <Legend items={[{ color: a.mission === 'ne' ? 'teal' : 'amber', label: 'All pupils (modelled)' }, { color: 'crimson', label: 'Disadvantaged (modelled)' }, { color: 'navy', label: 'England today (dashed)' }]} />
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h4>Persistent absence &amp; NEET trajectories</h4>
            <LineChart unit="%" series={[
              { color: 'purple', points: model.pa },
              { color: 'crimson', points: model.neet },
            ]} />
            <Legend items={[{ color: 'purple', label: 'Secondary persistent absence' }, { color: 'crimson', label: '16-17 NEET or not known' }]} />
            {!a.pa && <div className="note">PA baseline for {a.name} uses an indicative value — district-level data not published.</div>}
          </div>
        </div>
      </div>

      <h3 className="sect">Saved scenarios {scenarios.length ? `(${scenarios.length})` : ''}</h3>
      <SharedBar blobKey="scenarios" label="scenario set" getLocal={() => scenarios} applyRemote={(d) => Array.isArray(d) && setScenarios(d)} />
      {!scenarios.length && <p className="note">No scenarios saved yet. Set the levers, name the scenario and click “Save scenario”. Tick two or more to compare them side by side.</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {scenarios.map((sc) => {
          const on = compare.includes(sc.id);
          const ci = compare.indexOf(sc.id);
          return (
            <span key={sc.id} className={`scenario-chip ${on ? 'on' : ''}`} onClick={() => toggleCompare(sc.id)} title="Click to include in the comparison">
              <span className="dot" style={{ background: on ? color(SCEN_COLORS[ci % SCEN_COLORS.length]) : 'var(--ink3)' }} />
              <b>{sc.name}</b>
              <span style={{ color: 'var(--ink3)' }}>{areas[sc.areaKey]?.name}</span>
              <button className="del noprint" title="Load into the levers" onClick={(ev) => { ev.stopPropagation(); loadIntoLevers(sc); }}>⇪</button>
              <button className="del noprint" title="Delete scenario" onClick={(ev) => { ev.stopPropagation(); removeScenario(sc.id); }}>✕</button>
            </span>
          );
        })}
      </div>

      {compared.length >= 2 && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h4>Disadvantaged Attainment 8 to 2030 — scenario comparison</h4>
            <LineChart unit="" series={compared.map((sc) => ({ color: sc.color, points: sc.model.a8_disadv }))} />
            <Legend items={compared.map((sc) => ({ color: sc.color, label: `${sc.name} (${areas[sc.areaKey].name})` }))} />
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <h4>2030 outcomes by scenario (change vs baseline)</h4>
            <table className="data">
              <thead>
                <tr><th>Scenario</th><th>Area</th><th className="num">A8</th><th className="num">A8 disadv</th><th className="num">PA %</th><th className="num">NEET/NK %</th><th className="num">KS2 RWM %</th></tr>
              </thead>
              <tbody>
                {compared.map((sc) => (
                  <tr key={sc.id}>
                    <td><span className="dot" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: color(sc.color), marginRight: 6 }} /><b>{sc.name}</b></td>
                    <td>{areas[sc.areaKey].name}</td>
                    {['a8', 'a8_disadv', 'pa', 'neet', 'ks2'].map((k) => {
                      const d = deltaOf(sc.model, k);
                      const good = (k === 'pa' || k === 'neet') ? d < 0 : d > 0;
                      return <td key={k} className={`num ${good ? 'good' : 'mid'}`}>{endOf(sc.model, k)} <span style={{ color: 'var(--ink3)', fontSize: 10.5 }}>({d >= 0 ? '+' : ''}{d})</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="note">Same illustrative model for every scenario, so differences are driven purely by the lever settings (and the area baselines).</div>
          </div>
        </div>
      )}

      {err && <div className="error-box" style={{ marginTop: 14 }}>{err}</div>}
      {narrative && (
        <>
          <h3 className="sect">Claude's read {compared.length >= 2 ? 'on the comparison' : 'on this scenario'}</h3>
          <div className="card"><AiAnswer text={narrative} /></div>
        </>
      )}
      <p className="note">
        Coefficients are illustrative and deliberately conservative; for exploring direction and rough magnitude
        only. Ramp: 0% effect in 2026 (setup), then phased to full effect by 2030.
      </p>
    </div>
  );
}
