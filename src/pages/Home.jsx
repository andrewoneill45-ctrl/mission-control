import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { Stat, Bars, Donut, Legend } from '../components/ui.jsx';

export default function Home() {
  const { data } = useData();
  const e = data.meta.england;
  const areas = data.areas;
  const order = ['sunderland', 'south-tyneside', 'scarborough', 'hastings'];
  const budgetCols = ['teal', 'blue', 'purple', 'amber', 'crimson', 'green', 'navy', 'teal', 'blue', 'purple', 'navy'];

  return (
    <div>
      <div className="hero">
        <div className="kicker" style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          Mission North East · Mission Coastal
        </div>
        <h2>A place-based strategy for children, communities and opportunity</h2>
        <p>
          The most ambitious place-based education investment in a generation: a sustained, whole-government
          commitment to children inside the school gates and beyond them. Four areas, chosen by transparent data
          criteria — <b>Sunderland</b>, <b>South Tyneside</b>, <b>Scarborough</b> and <b>Hastings</b> — backed by a
          £4.2m annual DfE envelope and four integrated delivery strands.
        </p>
      </div>

      <div className="grid g4">
        <Stat value="17.7" label="White British FSM attainment gap (A8 points)" detail="30.9 disadvantaged vs 48.6 non-disadvantaged" color="crimson" />
        <Stat value="44.1" label="North East Attainment 8 — lowest of all regions" detail={`England: ${e.a8.toFixed(1)}`} color="amber" />
        <Stat value="26.0" label="Hastings disadvantaged A8" detail="Lowest coastal LAD in England, 3 years running" color="crimson" />
        <Stat value="£4.2m" label="Annual DfE envelope" detail="Both missions · philanthropic match in parallel" color="teal" />
      </div>

      <h3 className="sect">The four mission areas</h3>
      <div className="grid g2">
        {order.map((k) => {
          const a = areas[k];
          const ne = a.mission === 'ne';
          return (
            <Link key={k} to={`/area/${k}`} className="card area-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 15 }}>{a.name}</h4>
                <span className={`pill ${ne ? 'ne' : 'coastal'}`}>{ne ? 'Mission NE' : 'Mission Coastal'}</span>
              </div>
              <Bars unit="" max={50} data={[
                { label: 'Attainment 8', value: a.a8['2024/25'], color: ne ? 'teal' : 'amber', highlight: true },
                { label: 'A8 disadvantaged', value: a.a8_disadv['2024/25'], color: 'crimson' },
                { label: 'England A8', value: e.a8, color: 'navy' },
              ]} />
              <div className="sub" style={{ marginTop: 8 }}>{a.summary.slice(0, 130)}…</div>
            </Link>
          );
        })}
      </div>

      <h3 className="sect">The four strands</h3>
      <div className="grid g4">
        {data.strands.map((s) => (
          <div className="card" key={s.id}>
            <div style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', fontSize: 11, marginBottom: 6 }}>0{s.id}</div>
            <h4>{s.name}</h4>
            <div className="sub">{s.text}</div>
          </div>
        ))}
      </div>

      <h3 className="sect">£4.2m annual envelope</h3>
      <div className="grid g2">
        <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Donut size={190} data={data.budget.lines.map((l, i) => ({ value: l.amount, color: budgetCols[i] }))} />
          <div style={{ fontSize: 12 }}>
            {data.budget.lines.slice(0, 6).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', margin: '4px 0' }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${budgetCols[i] === 'teal' ? 'accent' : budgetCols[i]})`, display: 'inline-block' }} />
                <span style={{ color: 'var(--ink3)' }}>{l.item}</span>
                <b style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: 11.5 }}>£{(l.amount / 1000).toFixed(0)}k</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h4>The efficacy engine</h4>
          <div className="sub" style={{ fontSize: 12.8 }}>
            Teacher efficacy × pupil efficacy × parental efficacy, connected by shared culture, strong relationships
            and accountability. In school, beyond the gate, centred on place. One integrated model — four strands
            delivered together, not four separate programmes. Phased scaling: plan summer 2026, deliver from
            September 2026, a new cluster each term.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn sm" to="/vmost">Open VMOST planner →</Link>
            <Link className="btn sm" to="/simulator">Model the impact →</Link>
            <Link className="btn sm" to="/ask">Ask the data →</Link>
          </div>
        </div>
      </div>
      <p className="note">Data vintages: {data.meta.vintages}</p>
    </div>
  );
}
