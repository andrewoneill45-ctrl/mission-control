import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../data.jsx';
import { Stat, Bars, LineChart, Legend, Columns, PrintHeader, PrintButton } from '../components/ui.jsx';

export default function Area() {
  const { id } = useParams();
  const { data } = useData();
  const a = data.areas[id];
  if (!a) return <p>Unknown area.</p>;
  const e = data.meta.england;
  const ne = a.mission === 'ne';
  const years = ['2022/23', '2023/24', '2024/25'];

  return (
    <div>
      <PrintHeader title={`Area briefing — ${a.name}`} subtitle={ne ? 'Mission North East' : 'Mission Coastal'} />
      <div className="pagehead">
        <div className={`kicker ${ne ? '' : 'coastal'}`}>{ne ? 'Mission North East' : 'Mission Coastal'} · {a.laLevel !== a.name ? `within ${a.laLevel} LA` : 'local authority'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2>{a.name}</h2>
          <PrintButton label="Print briefing / PDF" />
        </div>
        <p className="lede">{a.summary}</p>
      </div>

      <div className="grid g4">
        <Stat value={a.a8['2024/25'].toFixed(1)} label="Attainment 8 (2024/25)" detail={`England ${e.a8.toFixed(1)}`} color={ne ? 'teal' : 'amber'} />
        <Stat value={a.a8_disadv['2024/25'].toFixed(1)} label="A8 disadvantaged" detail={`England disadvantaged ${e.a8_disadv.toFixed(1)}`} color="crimson" />
        <Stat value={`${a.ks2_rwm['2024/25']}%`} label="KS2 RWM expected standard" detail={`England ~${e.ks2_rwm}%`} color="blue" />
        {a.pa
          ? <Stat value={`${a.pa.secondary}%`} label="Secondary persistent absence" detail={`England ${e.pa_secondary}%`} color="purple" />
          : <Stat value="—" label="Persistent absence" detail="Not published at district level" color="navy" />}
      </div>

      <h3 className="sect">Performance trends</h3>
      <div className="grid g2">
        <div className="card">
          <h4>Attainment 8 — all vs disadvantaged</h4>
          <LineChart unit="" yMin={20} yMax={50} series={[
            { color: ne ? 'teal' : 'amber', points: years.map((y) => ({ x: y.slice(0, 4), y: a.a8[y] })) },
            { color: 'crimson', points: years.map((y) => ({ x: y.slice(0, 4), y: a.a8_disadv[y] })) },
            { color: 'navy', dash: true, points: [{ x: '2022', y: 46.3 }, { x: '2023', y: 45.9 }, { x: '2024', y: 46.0 }] },
          ]} />
          <Legend items={[{ color: ne ? 'teal' : 'amber', label: 'All pupils' }, { color: 'crimson', label: 'Disadvantaged' }, { color: 'navy', label: 'England all (dashed)' }]} />
        </div>
        <div className="card">
          <h4>KS2 reading, writing &amp; maths — expected standard</h4>
          <Columns unit="%" data={years.flatMap((y) => ([
            { label: `${y.slice(2, 4)}/${y.slice(5)}\nAll`, value: a.ks2_rwm[y], color: 'blue' },
            { label: `${y.slice(2, 4)}/${y.slice(5)}\nDisadv`, value: a.ks2_rwm_disadv[y], color: 'purple' },
          ]))} />
          <div className="note">England benchmark ~{e.ks2_rwm}% (all pupils).</div>
        </div>
      </div>

      <h3 className="sect">Destinations &amp; NEET</h3>
      <div className="grid g2">
        <div className="card">
          <h4>16-17 NEET or not known — trend {a.neetNote ? `(${a.neet.name} LA)` : ''}</h4>
          <LineChart unit="%" series={[
            { color: 'crimson', points: a.neet.ts.map((t) => ({ x: t.y, y: t.v })) },
            { color: 'navy', dash: true, points: (data.national.neet.ts || []).map((t) => ({ x: t.y, y: t.v })) },
          ]} />
          <Legend items={[{ color: 'crimson', label: a.neet.name }, { color: 'navy', label: 'England (dashed)' }]} />
          {a.neetNote && <div className="note">{a.neetNote}</div>}
        </div>
        <div className="card">
          <h4>Latest breakdown</h4>
          <div className="grid g2" style={{ gap: 8 }}>
            <Stat value={`${a.neet.neetnk}%`} label="NEET or not known" detail={`England ${data.national.neet.neetnk}%`} color="crimson" />
            <Stat value={`${a.neet.neet}%`} label="Confirmed NEET" detail={`England ${data.national.neet.neet}%`} color="amber" />
            <Stat value={`${a.neet.nk}%`} label="Activity not known" detail="A tracking gap, not measured disengagement" color="navy" />
            {a.neet.send && a.neet.send.ehcp != null
              ? <Stat value={`${a.neet.send.ehcp}%`} label="NEET/NK — EHCP pupils" detail={`vs ${a.neet.send.noSEN}% no SEN`} color="purple" />
              : <Stat value="—" label="SEND split" color="navy" />}
          </div>
          <h4 style={{ marginTop: 14 }}>School-leaver destinations (KS4 2022/23, area secondaries)</h4>
          <DestBars schools={a.schools.secondary} />
          <div className="note">Click a bar to jump to the school-level table.</div>
        </div>
      </div>

      <DriversSection area={a} england={e} />

      {a.name === 'Scarborough' && <ScarbKS2 data={data} />}
      {a.name === 'Hastings' && <HastingsCohort data={data} />}

      <h3 className="sect" id="secondary-schools">Secondary schools ({a.schools.secondary.length})</h3>
      <SchoolTable schools={a.schools.secondary} kind="secondary" england={e} />

      <h3 className="sect">Primary schools ({a.schools.primary.length})</h3>
      <SchoolTable schools={a.schools.primary} kind="primary" england={e} />

      <div style={{ marginTop: 22, display: 'flex', gap: 8 }}>
        <Link className="btn sm" to="/vmost">Plan objectives for {a.name} →</Link>
        <Link className="btn sm" to="/simulator">Simulate impact →</Link>
        <Link className="btn sm" to="/ask">Ask about {a.name} →</Link>
      </div>
    </div>
  );
}

function DestBars({ schools }) {
  const withDest = schools.filter((s) => s.dest && s.dest.cohort);
  if (!withDest.length) return <div className="note">No destination data joined for these schools.</div>;
  const tot = withDest.reduce((acc, s) => {
    const c = s.dest.cohort || 0;
    acc.cohort += c;
    ['edu', 'app', 'work', 'ns'].forEach((k) => { if (s.dest[k] != null) acc[k] += (s.dest[k] / 100) * c; });
    return acc;
  }, { cohort: 0, edu: 0, app: 0, work: 0, ns: 0 });
  const pct = (k) => (tot[k] / tot.cohort) * 100;
  const jump = () => document.getElementById('secondary-schools')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <Bars unit="%" max={100} data={[
      { label: 'Sustained education', value: pct('edu'), color: 'green', onClick: jump },
      { label: 'Apprenticeship', value: pct('app'), color: 'blue', onClick: jump },
      { label: 'Employment', value: pct('work'), color: 'navy', onClick: jump },
      { label: 'No sustained destination', value: pct('ns'), color: 'crimson', highlight: true, onClick: jump },
    ]} />
  );
}

function DriversSection({ area, england }) {
  const withD = area.schools.secondary.filter((s) => s.drivers && s.drivers.pa != null);
  if (!withD.length) return null;
  const gias = (s) => window.open(`https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${s.urn}`, '_blank', 'noopener');
  const ranked = [...withD].sort((x, y) => (y.drivers.pa || 0) - (x.drivers.pa || 0));
  return (
    <>
      <h3 className="sect">What's driving it — school-level engagement drivers (2024/25)</h3>
      <div className="grid g2">
        <div className="card">
          <h4>Persistent absence by secondary school <span className="sub" style={{ fontWeight: 400 }}>England secondary: {england.pa_secondary}%</span></h4>
          <Bars unit="%" data={ranked.map((s) => ({
            label: s.name, value: s.drivers.pa,
            color: s.drivers.pa >= england.pa_secondary * 1.3 ? 'crimson' : s.drivers.pa >= england.pa_secondary ? 'amber' : 'green',
            onClick: () => gias(s),
            title: `${s.name}: PA ${s.drivers.pa}% · absence ${s.drivers.abs ?? '—'}% · suspensions ${s.drivers.susp ?? '—'}/100 — open on GIAS`,
          }))} />
          <div className="note">Red = 30%+ above the England rate. Click a school to open it on GIAS.</div>
        </div>
        <div className="card">
          <h4>Suspension rate by secondary school <span className="sub" style={{ fontWeight: 400 }}>per 100 pupils · England ~11.9</span></h4>
          <Bars unit="" data={[...withD].sort((x, y) => (y.drivers.susp || 0) - (x.drivers.susp || 0)).map((s) => ({
            label: s.name, value: s.drivers.susp,
            color: (s.drivers.susp || 0) >= 24 ? 'crimson' : (s.drivers.susp || 0) >= 12 ? 'amber' : 'green',
            onClick: () => gias(s),
            title: `${s.name}: suspensions ${s.drivers.susp}/100 · permanent ${s.drivers.perm}/100 — open on GIAS`,
          }))} />
          <div className="note">Attendance and behaviour are the PSTs' first-term focus: these charts show where to start.</div>
        </div>
      </div>
    </>
  );
}

const OFSTED_GRADE = { 1: 'Outstanding', 2: 'Good', 3: 'Requires improvement', 4: 'Inadequate' };

function OfstedCell({ s }) {
  const oe = s.ofsted_sub?.oe;
  const label = oe ? OFSTED_GRADE[oe] : (s.ofsted && s.ofsted !== 'Not inspected' ? s.ofsted : '—');
  const cls = /Outstanding/.test(label) ? 'good' : /Good/.test(label) ? 'good' : /Requires/.test(label) ? 'mid' : /Inadequate|Serious/.test(label) ? 'bad' : '';
  return (
    <td style={{ fontSize: 11.5 }} className={cls} title={s.ofsted_date ? `Last inspection ${s.ofsted_date}` : undefined}>
      {label}
    </td>
  );
}

function SchoolTable({ schools, kind, england }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? schools : schools.slice(0, 12);
  const sec = kind === 'secondary';
  return (
    <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
      <table className="data">
        <thead>
          <tr>
            <th>School</th><th>Trust</th><th className="num">Pupils</th><th className="num">FSM %</th>
            {sec ? (<>
              <th className="num">A8</th><th className="num">A8 disadv</th><th className="num">Basics 4+</th><th className="num">No sust. dest %</th><th className="num">PA %</th><th className="num">Susp /100</th>
            </>) : (<>
              <th className="num">KS2 RWM %</th><th className="num">Reading %</th><th className="num">Maths %</th><th className="num">Writing %</th><th className="num">PA %</th>
            </>)}
            <th>Ofsted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.urn} className="rowlink" title={`Open ${s.name} on Get Information About Schools`}
              onClick={() => window.open(`https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${s.urn}`, '_blank', 'noopener')}>
              <td>{s.name} <span style={{ color: 'var(--ink3)', fontSize: 10 }}>↗</span></td>
              <td style={{ color: 'var(--ink3)', fontSize: 11.5 }}>{s.trust || '—'}</td>
              <td className="num">{s.pupils ?? '—'}</td>
              <td className="num">{s.edu_fsm_pct ?? s.ks2_fsm_pct ?? '—'}</td>
              {sec ? (<>
                <Num v={s.attainment8} benchmark={england.a8} />
                <Num v={s.a8_disadv} benchmark={england.a8_disadv} />
                <Num v={s.basics_94} benchmark={63.1} />
                <Num v={s.dest?.ns} benchmark={5} invert />
                <Num v={s.drivers?.pa} benchmark={england.pa_secondary} invert />
                <Num v={s.drivers?.susp} benchmark={11.9} invert />
              </>) : (<>
                <Num v={s.ks2_rwm_exp != null ? Math.round(s.ks2_rwm_exp) : null} benchmark={61} />
                <Num v={s.ks2_read_exp != null ? Math.round(s.ks2_read_exp) : null} benchmark={75} />
                <Num v={s.ks2_mat_exp != null ? Math.round(s.ks2_mat_exp) : null} benchmark={74} />
                <Num v={s.ks2_writ_exp != null ? Math.round(s.ks2_writ_exp) : null} benchmark={72} />
                <Num v={s.drivers?.pa} benchmark={14.5} invert />
              </>)}
              <OfstedCell s={s} />
            </tr>
          ))}
        </tbody>
      </table>
      {schools.length > 12 && (
        <button className="btn sm ghost" style={{ margin: 8 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${schools.length}`}
        </button>
      )}
    </div>
  );
}

function Num({ v, benchmark, invert }) {
  if (v == null) return <td className="num" style={{ color: 'var(--ink3)' }}>—</td>;
  const good = invert ? v < benchmark : v >= benchmark;
  const cls = good ? 'good' : (invert ? v > benchmark * 1.6 : v < benchmark * 0.85) ? 'bad' : 'mid';
  return <td className={`num ${cls}`}>{v}</td>;
}

function ScarbKS2({ data }) {
  const k = data.scarboroughKS2;
  return (
    <>
      <h3 className="sect">KS2 deep-dive: MCS schools vs rest of North Yorkshire</h3>
      <div className="grid g2">
        <div className="card">
          <h4>Gap to the rest of the county (pp)</h4>
          <Bars unit="pp" data={k.headline.map((h) => ({ label: h.measure.replace('Reading, writing & maths (combined)', 'RWM combined'), value: h.gap, color: h.gap <= -4 ? 'crimson' : 'amber' }))} />
          <div className="note">Negative = MCS schools behind the rest of North Yorkshire. National RWM benchmark ~61-62%.</div>
        </div>
        <div className="card">
          <h4>Three patterns that matter</h4>
          {k.patterns.map((p, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <b style={{ fontSize: 12.8 }}>{p.title}</b>
              <div className="sub" style={{ fontSize: 12 }}>{p.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function HastingsCohort({ data }) {
  const h = data.hastingsCohort;
  return (
    <>
      <h3 className="sect">Out of provision: the churn picture</h3>
      <div className="grid g2">
        <div className="card">
          <h4>Children out of / at risk of being out of provision</h4>
          <Bars unit="" data={h.rows.map((r) => ({ label: r.category.replace(/\s*\(.*\)/, ''), value: r.n, color: r.n > 200 ? 'crimson' : 'amber' }))} />
          <div className="note">{h.note} Total identified: {h.totalIdentified.n} ({h.totalIdentified.pct}% of the {h.total.toLocaleString()} cohort). {h.eheWhiteBritishPct}% of EHE pupils are White British.</div>
        </div>
        <div className="card">
          <h4>EHE and CME by year group — risk grows through KS3/4</h4>
          <Columns data={h.byYear.flatMap((r) => ([
            { label: `${r.year}\nEHE`, value: r.ehe, color: 'crimson' },
            { label: `${r.year}\nCME`, value: r.cme, color: 'amber' },
          ]))} />
        </div>
      </div>
    </>
  );
}
