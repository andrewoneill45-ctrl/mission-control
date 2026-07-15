import { useParams, Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { Stat, Bars, LineChart, Legend } from '../components/ui.jsx';

export default function Mission() {
  const { id } = useParams();
  const { data } = useData();
  return id === 'ne' ? <MissionNE data={data} /> : <MissionCoastal data={data} />;
}

function MissionNE({ data }) {
  const e = data.meta.england;
  const rg = data.regions['North East'];
  const su = data.areas['sunderland'], st = data.areas['south-tyneside'];
  return (
    <div>
      <div className="pagehead">
        <div className="kicker">Mission North East</div>
        <h2>Mission North East</h2>
        <p className="lede">
          The North East was selected as a region: the lowest Attainment 8 of any English region. Phase 1 starts with
          clusters in <b>Sunderland</b> and <b>South Tyneside</b> — both with sustained below-average KS4 attainment,
          among the region's highest disadvantaged underperformance, elevated persistent absence, high deprivation,
          and no existing targeted DfE support (genuine additionality). Phase 2 candidates: Darlington and
          potentially Middlesbrough (pending inspection outcome).
        </p>
      </div>

      <div className="grid g4">
        <Stat value={rg.ks4.att8?.toFixed(1) ?? '44.1'} label="NE Attainment 8" detail={`England ${e.a8.toFixed(1)} — lowest region`} color="amber" />
        <Stat value={`${rg.neetnk?.toFixed(1)}%`} label="NE 16-17 NEET or not known" detail="2025" color="crimson" />
        <Stat value={`${rg.drivers.pa?.toFixed(1)}%`} label="NE secondary persistent absence" detail={`England ${e.pa_secondary}%`} color="blue" />
        <Stat value="2" label="Phase 1 clusters" detail="Sunderland · South Tyneside" color="teal" />
      </div>

      <h3 className="sect">Why Sunderland and South Tyneside: the 12-LA ranking</h3>
      <div className="card">
        <div className="sub" style={{ marginBottom: 10 }}>
          Composite ranking across A8 (all pupils and disadvantaged, three years), absence and persistent absence.
          Higher score = weaker position. Sunderland and South Tyneside rank joint 2nd weakest; Middlesbrough (weakest) is already covered by other programmes.
        </div>
        <Bars unit="" data={[...data.neLAs].sort((a, b) => b.composite - a.composite).map((l) => {
          const isMission = ['Sunderland', 'South Tyneside'].includes(l.la);
          return {
            label: l.la, value: l.composite,
            color: isMission ? 'teal' : 'navy',
            highlight: isMission,
            to: isMission ? `/area/${l.la === 'Sunderland' ? 'sunderland' : 'south-tyneside'}` : undefined,
            title: isMission ? `Open the ${l.la} page` : `${l.la}: composite score ${l.composite} · A8 ${l.a8} · disadvantaged A8 ${l.a8_disadv}`,
          };
        })} />
      </div>

      <h3 className="sect">The two clusters, side by side</h3>
      <div className="grid g2">
        {[su, st].map((a) => (
          <div className="card" key={a.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ margin: 0 }}>{a.name}</h4>
              <Link className="btn sm" to={`/area/${a.name === 'Sunderland' ? 'sunderland' : 'south-tyneside'}`}>Full page →</Link>
            </div>
            <Bars unit="" max={50} data={[
              { label: 'A8 24/25', value: a.a8['2024/25'], color: 'teal', highlight: true },
              { label: 'A8 disadvantaged', value: a.a8_disadv['2024/25'], color: 'crimson' },
              { label: 'NE average', value: 44.1, color: 'navy' },
              { label: 'England', value: e.a8, color: 'navy' },
            ]} />
            <div className="grid g2" style={{ marginTop: 10, gap: 8 }}>
              <Stat value={`${a.pa.secondary}%`} label="Secondary PA" detail={`England ${e.pa_secondary}%`} color="amber" />
              <Stat value={`${a.neet.neetnk}%`} label="16-17 NEET / not known" detail={`England ${data.national.neet.neetnk}%`} color="crimson" />
            </div>
            <div className="sub" style={{ marginTop: 8 }}>IDACI: {a.idaci.rank}th most deprived LA nationally · {a.schools.secondary.length} secondary schools</div>
          </div>
        ))}
      </div>

      <h3 className="sect">16-17 NEET or not known — trend</h3>
      <div className="card">
        <LineChart unit="%" series={[
          { color: 'teal', points: su.neet.ts.map((t) => ({ x: t.y, y: t.v })) },
          { color: 'blue', points: st.neet.ts.map((t) => ({ x: t.y, y: t.v })) },
          { color: 'navy', dash: true, points: data.national.neet.ts.map((t) => ({ x: t.y, y: t.v })) },
        ]} />
        <Legend items={[{ color: 'teal', label: 'Sunderland' }, { color: 'blue', label: 'South Tyneside' }, { color: 'navy', label: 'England (dashed)' }]} />
      </div>

      <h3 className="sect">Location-specific TLG concepts</h3>
      <div className="grid g2">
        {data.tlg.filter((t) => /Sunderland|North East/.test(t.scope)).map((t) => (
          <div className="card" key={t.id}>
            <h4>{t.name}</h4>
            <span className="pill ne">{t.scope}</span>
            <div className="sub" style={{ marginTop: 8 }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionCoastal({ data }) {
  const e = data.meta.england;
  const sc = data.areas['scarborough'], ha = data.areas['hastings'];
  return (
    <div>
      <div className="pagehead">
        <div className="kicker coastal">Mission Coastal</div>
        <h2>Mission Coastal</h2>
        <p className="lede">
          Ministers chose <b>Scarborough</b> and <b>Hastings</b> as a north-south combination from a data-led
          shortlist of coastal LADs (three years of KS2 and A8 data, absence and IDACI 2025), in recognition that
          part of the mission is to build the evidence base for national approaches. Both areas have strengthened
          school-improvement capacity through strong trusts, but pupil engagement remains the central challenge —
          and KS2 is weak, particularly in Scarborough, so primary attainment is in scope alongside TLG projects
          beyond the school gates.
        </p>
      </div>

      <div className="grid g4">
        <Stat value="26.0" label="Hastings disadvantaged A8" detail="Lowest coastal LAD in England, 3 years running" color="crimson" />
        <Stat value="26.6" label="Scarborough disadvantaged A8" detail="Among the weakest nationally" color="amber" />
        <Stat value="57%" label="Scarborough KS2 RWM" detail="National ~61-62% · over half of primaries below average" color="blue" />
        <Stat value="14.7%" label="Hastings pupils out of / at risk of leaving provision" detail="928 of 6,327 secondary-age pupils" color="purple" />
      </div>

      <h3 className="sect">The two areas, side by side</h3>
      <div className="grid g2">
        {[sc, ha].map((a) => (
          <div className="card" key={a.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ margin: 0 }}>{a.name}</h4>
              <Link className="btn sm" to={`/area/${a.name.toLowerCase()}`}>Full page →</Link>
            </div>
            <Bars unit="" max={50} data={[
              { label: 'A8 24/25', value: a.a8['2024/25'], color: 'amber', highlight: true },
              { label: 'A8 disadvantaged', value: a.a8_disadv['2024/25'], color: 'crimson' },
              { label: 'England', value: e.a8, color: 'navy' },
            ]} />
            <div className="grid g2" style={{ marginTop: 10, gap: 8 }}>
              <Stat value={`${a.ks2_rwm['2024/25']}%`} label="KS2 RWM (24/25)" detail={`England ~${e.ks2_rwm}%`} color="blue" />
              <Stat value={`${a.ks2_rwm_disadv['2024/25']}%`} label="KS2 RWM disadvantaged" color="purple" />
            </div>
            <div className="sub" style={{ marginTop: 8 }}>{a.programmes}</div>
          </div>
        ))}
      </div>

      <h3 className="sect">Attainment 8 trend — the gap to England</h3>
      <div className="card">
        <LineChart unit="" series={[
          { color: 'amber', points: Object.entries(sc.a8).reverse().map(([y, v]) => ({ x: y.slice(0, 4), y: v })) },
          { color: 'crimson', points: Object.entries(ha.a8).reverse().map(([y, v]) => ({ x: y.slice(0, 4), y: v })) },
          { color: 'navy', dash: true, points: [{ x: '2022', y: 46.3 }, { x: '2023', y: 45.9 }, { x: '2024', y: 46.0 }] },
        ]} />
        <Legend items={[{ color: 'amber', label: 'Scarborough' }, { color: 'crimson', label: 'Hastings' }, { color: 'navy', label: 'England (dashed)' }]} />
        <div className="note">Hastings A8 improved sharply in 2024/25 (32.7 → 35.3) but remains ~10.7 points below England.</div>
      </div>

      <h3 className="sect">Location-specific TLG concepts</h3>
      <div className="grid g2">
        {data.tlg.filter((t) => /Hastings|Scarborough/.test(t.scope)).map((t) => (
          <div className="card" key={t.id}>
            <h4>{t.name}</h4>
            <span className="pill coastal">{t.scope}</span>
            <div className="sub" style={{ marginTop: 8 }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
