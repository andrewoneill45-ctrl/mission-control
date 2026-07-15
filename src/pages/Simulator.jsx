// Impact simulator: NEET-Intelligence-style lever modelling over the four mission areas.
import { useMemo, useState } from 'react';
import { useData, askApi } from '../data.jsx';
import { Stat, LineChart, Legend, Bars } from '../components/ui.jsx';
import AiAnswer from '../components/AiAnswer.jsx';

// Evidence-informed (illustrative) effect coefficients per unit of lever, per year at full intensity.
const LEVERS = [
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
// Ramp: share of full effect realised per mission year (phased clusters, lagged outcomes)
const RAMP = [0, 0.35, 0.7, 0.9, 1.0];

export default function Simulator() {
  const { data } = useData();
  const areas = data.areas;
  const [areaKey, setAreaKey] = useState('sunderland');
  const [levers, setLevers] = useState(Object.fromEntries(LEVERS.map((l) => [l.id, l.default])));
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const a = areas[areaKey];
  const e = data.meta.england;

  const model = useMemo(() => {
    // annual full-intensity effect per outcome
    const eff = { a8: 0, a8_disadv: 0, pa: 0, neet: 0, ks2: 0 };
    LEVERS.forEach((l) => {
      const v = levers[l.id];
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
      eff,
    };
  }, [levers, areaKey, a]);

  function cumRamp(i) { return RAMP.slice(0, i + 1).reduce((x, y) => x + y, 0) / 1; }

  const end = (k) => model[k][model[k].length - 1].y;
  const delta = (k) => Math.round((end(k) - model.base[k]) * 10) / 10;

  const narrate = async () => {
    setLoading(true); setErr(null); setNarrative(null);
    try {
      const ctx = `SIMULATOR SETTINGS for ${a.name}:\n` +
        LEVERS.map((l) => `${l.name}: ${levers[l.id]} ${l.unit}`).join('\n') +
        `\nMODELLED 2030 OUTCOMES (illustrative): A8 ${end('a8')} (baseline ${model.base.a8}), disadvantaged A8 ${end('a8_disadv')} (baseline ${model.base.a8_disadv}), secondary PA ${end('pa')}% (baseline ${model.base.pa}%), KS2 RWM ${end('ks2')}% (baseline ${model.base.ks2}%), 16-17 NEET/not known ${end('neet')}% (baseline ${model.base.neet}%).`;
      const res = await askApi({ mode: 'impact', question: `Assess this simulated scenario for ${a.name}: is the scale of change plausible against the evidence, what must be true, and what are the biggest risks?`, context: ctx });
      if (res.error) throw new Error(res.error === 'no_key' ? 'No ANTHROPIC_API_KEY set in Netlify environment variables.' : res.detail || res.error);
      setNarrative(res.answer);
    } catch (ex) { setErr(String(ex.message || ex)); }
    setLoading(false);
  };

  return (
    <div>
      <div className="pagehead">
        <div className="kicker">Strategy · Modelling</div>
        <h2>Impact Simulator</h2>
        <p className="lede">
          Set the delivery levers and watch the modelled trajectory for each mission area to 2030. Effects are
          illustrative, evidence-informed coefficients with a phased ramp-up (new cluster each term; outcomes lag
          delivery) — a thinking tool, not a forecast. Use “Stress-test with Claude” for an honest AI read on plausibility.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(areas).map(([k, v]) => (
          <button key={k} className="btn" style={areaKey === k ? { borderColor: v.mission === 'ne' ? 'var(--accent)' : 'var(--coastal)', color: v.mission === 'ne' ? 'var(--accent)' : 'var(--coastal)', fontWeight: 700 } : {}} onClick={() => setAreaKey(k)}>
            {v.name}
          </button>
        ))}
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4>Delivery levers</h4>
          {LEVERS.map((l) => (
            <div className="sim-lever" key={l.id}>
              <label>{l.name}<span className="val">{levers[l.id]} {l.unit}</span></label>
              <input type="range" min={l.min} max={l.max} step={l.step} value={levers[l.id]}
                onChange={(ev) => setLevers({ ...levers, [l.id]: Number(ev.target.value) })} />
              <div className="note">{l.note}</div>
            </div>
          ))}
          <button className="btn primary" onClick={narrate} disabled={loading} style={{ marginTop: 6 }}>
            {loading ? <><span className="spinner" /> Stress-testing…</> : '✦ Stress-test with Claude'}
          </button>
        </div>

        <div>
          <div className="grid g2" style={{ gap: 10 }}>
            <Stat value={end('a8').toFixed(1)} label={`A8 by 2030 (baseline ${model.base.a8.toFixed(1)})`} detail={`${delta('a8') >= 0 ? '+' : ''}${delta('a8')} pts · England ${e.a8}`} color={delta('a8') > 0 ? 'green' : 'navy'} />
            <Stat value={end('a8_disadv').toFixed(1)} label={`Disadvantaged A8 (baseline ${model.base.a8_disadv.toFixed(1)})`} detail={`${delta('a8_disadv') >= 0 ? '+' : ''}${delta('a8_disadv')} pts`} color={delta('a8_disadv') > 0 ? 'green' : 'navy'} />
            <Stat value={`${end('pa').toFixed(1)}%`} label={`Secondary PA (baseline ${model.base.pa.toFixed(1)}%)`} detail={`${delta('pa')} pp · England ${e.pa_secondary}%`} color={delta('pa') < 0 ? 'green' : 'navy'} />
            <Stat value={`${end('neet').toFixed(1)}%`} label={`16-17 NEET/NK (baseline ${model.base.neet.toFixed(1)}%)`} detail={`${delta('neet')} pp`} color={delta('neet') < 0 ? 'green' : 'navy'} />
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

      {err && <div className="error-box" style={{ marginTop: 14 }}>{err}</div>}
      {narrative && (
        <>
          <h3 className="sect">Claude's read on this scenario</h3>
          <div className="card"><AiAnswer text={narrative} /></div>
        </>
      )}
      <p className="note">
        Coefficients are illustrative and deliberately conservative; they are for exploring direction and rough
        magnitude only. Ramp: 0% effect in 2026 (setup), then phased to full effect by 2030.
      </p>
    </div>
  );
}
