// VMOST planner: collapsible Objectives → Strategies → Tactics with AI suggestions.
import { useEffect, useRef, useState } from 'react';
import { useData, askApi, loadVmost, saveVmost, uid, download } from '../data.jsx';
import AiAnswer, { extractJson } from '../components/AiAnswer.jsx';
import SharedBar from '../components/SharedBar.jsx';
import { PrintHeader, PrintButton, Bars, Stat } from '../components/ui.jsx';

export default function Vmost() {
  const { data } = useData();
  const [plan, setPlan] = useState(() => loadVmost(data.vmostSeed));
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // [{title, detail, evidence, area}]
  const [aiError, setAiError] = useState(null);
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { saveVmost(plan); }, [plan]);

  const update = (fn) => setPlan((p) => { const c = JSON.parse(JSON.stringify(p)); fn(c); return c; });

  // ----- CRUD -----
  const addObjective = (obj) => update((c) => c.objectives.push({
    id: uid(), title: obj?.title || 'New objective', detail: obj?.detail || '', evidence: obj?.evidence || '', strategies: [], open: true,
  }));
  const addStrategy = (oid, s) => update((c) => {
    const o = c.objectives.find((x) => x.id === oid);
    o.strategies.push({ id: uid(), title: s?.title || 'New strategy', detail: s?.detail || '', tactics: (s?.tactics || []).map((t) => ({ id: uid(), ...t })), open: true });
    o.open = true;
  });
  const addTactic = (oid, sid, t) => update((c) => {
    const s = c.objectives.find((x) => x.id === oid).strategies.find((x) => x.id === sid);
    s.tactics.push({ id: uid(), title: t?.title || 'New tactic', detail: t?.detail || '' });
    s.open = true;
  });
  const removeNode = (oid, sid, tid) => update((c) => {
    if (tid) { const s = c.objectives.find((x) => x.id === oid).strategies.find((x) => x.id === sid); s.tactics = s.tactics.filter((t) => t.id !== tid); }
    else if (sid) { const o = c.objectives.find((x) => x.id === oid); o.strategies = o.strategies.filter((s) => s.id !== sid); }
    else c.objectives = c.objectives.filter((o) => o.id !== oid);
  });
  const editNode = (oid, sid, tid, field, value) => update((c) => {
    const o = c.objectives.find((x) => x.id === oid);
    const target = tid ? o.strategies.find((x) => x.id === sid).tactics.find((x) => x.id === tid) : sid ? o.strategies.find((x) => x.id === sid) : o;
    target[field] = value;
  });
  const toggle = (oid, sid) => update((c) => {
    const o = c.objectives.find((x) => x.id === oid);
    const t = sid ? o.strategies.find((x) => x.id === sid) : o;
    t.open = !t.open;
  });
  const setAllOpen = (v) => update((c) => c.objectives.forEach((o) => { o.open = v; o.strategies.forEach((s) => { s.open = v; }); }));

  // ----- AI -----
  const suggestObjectives = async () => {
    setSuggesting(true); setAiError(null); setSuggestions(null);
    try {
      const existing = plan.objectives.map((o) => o.title).join('; ');
      const res = await askApi({ mode: 'objectives', question: `Suggest new objectives. Current objectives: ${existing}` });
      if (res.error) throw new Error(res.error === 'no_key' ? 'No ANTHROPIC_API_KEY set in Netlify environment variables.' : res.detail || res.error);
      const j = extractJson(res.answer);
      if (!j?.objectives) throw new Error('Could not parse suggestions.');
      setSuggestions(j.objectives);
    } catch (e) { setAiError(String(e.message || e)); }
    setSuggesting(false);
  };

  const suggestPlanFor = async (o) => {
    editNode(o.id, null, null, 'planning', true);
    try {
      const res = await askApi({ mode: 'plan', question: `Objective: ${o.title}. ${o.detail}` });
      if (res.error) throw new Error(res.error === 'no_key' ? 'No ANTHROPIC_API_KEY set in Netlify environment variables.' : res.detail || res.error);
      const j = extractJson(res.answer);
      if (!j?.strategies) throw new Error('Could not parse strategies.');
      j.strategies.forEach((s) => addStrategy(o.id, s));
    } catch (e) { setAiError(String(e.message || e)); }
    editNode(o.id, null, null, 'planning', false);
  };

  const simulateImpact = async () => {
    setImpactLoading(true); setImpact(null); setAiError(null);
    try {
      const summary = plan.objectives.map((o) => `OBJECTIVE: ${o.title} — ${o.detail}\n` +
        o.strategies.map((s) => `  STRATEGY: ${s.title} — ${s.detail}\n` + s.tactics.map((t) => `    TACTIC: ${t.title}`).join('\n')).join('\n')).join('\n');
      const res = await askApi({ mode: 'impact', question: 'Model the intended impact of this VMOST plan on the mission areas.', context: summary });
      if (res.error) throw new Error(res.error === 'no_key' ? 'No ANTHROPIC_API_KEY set in Netlify environment variables.' : res.detail || res.error);
      setImpact(res.answer);
    } catch (e) { setAiError(String(e.message || e)); }
    setImpactLoading(false);
  };

  const importJson = (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { setPlan(JSON.parse(r.result)); } catch { setAiError('Invalid JSON file.'); } };
    r.readAsText(f);
    ev.target.value = '';
  };

  return (
    <div>
      <PrintHeader title="VMOST Plan" subtitle="Mission North East & Mission Coastal" />
      <div className="pagehead">
        <div className="kicker">Strategy · VMOST</div>
        <h2>VMOST Planner</h2>
        <p className="lede">
          Vision and Mission are fixed; build the plan beneath them. Add Objectives, nest Strategies under each, and
          Tactics under each Strategy. Ask Claude to suggest data-grounded objectives, generate strategy/tactic
          trees, and simulate the intended impact. Your edits save in this browser; use the team bar below to
          publish to (or load from) the shared version everyone sees.
        </p>
      </div>

      <SharedBar blobKey="vmost" label="VMOST plan" getLocal={() => plan} applyRemote={(d) => setPlan(d)} />

      <div className="vm-vm"><b>VISION</b><p>{plan.vision}</p></div>
      <div className="vm-vm" style={{ borderColor: 'var(--blue)' }}><b style={{ color: 'var(--blue)' }}>MISSION</b><p>{plan.mission}</p></div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0' }}>
        <button className="btn primary" onClick={() => addObjective()}>+ Add Objective</button>
        <button className="btn" onClick={suggestObjectives} disabled={suggesting}>
          {suggesting ? <><span className="spinner" /> Thinking…</> : '✦ Suggest objectives from the data'}
        </button>
        <button className="btn" onClick={simulateImpact} disabled={impactLoading || !plan.objectives.length}>
          {impactLoading ? <><span className="spinner" /> Modelling…</> : '≋ Simulate intended impact'}
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={() => setAllOpen(true)}>Expand all</button>
        <button className="btn sm ghost" onClick={() => setAllOpen(false)}>Collapse all</button>
        <PrintButton />
        <button className="btn sm ghost" onClick={() => download('mission-vmost.json', plan)}>Export JSON</button>
        <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <button className="btn sm ghost danger" onClick={() => { if (confirm('Reset plan to the seed from the Missions Overview deck?')) setPlan(JSON.parse(JSON.stringify(data.vmostSeed))); }}>Reset to seed</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importJson} />
      </div>

      {aiError && <div className="error-box" style={{ marginBottom: 14 }}>{aiError}</div>}

      {suggestions && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#0f9d8a55' }}>
          <h4>✦ Suggested objectives <span className="sub">(grounded in the mission dataset — click to add)</span></h4>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 13 }}>{s.title}</b> {s.area && s.area !== 'all' && <span className="pill">{s.area}</span>}
                <div className="sub" style={{ fontSize: 12.4 }}>{s.detail}</div>
                {s.evidence && <div className="sub" style={{ fontSize: 11.4, color: 'var(--ink3)', marginTop: 3 }}>Evidence: {s.evidence}</div>}
              </div>
              <button className="btn sm" onClick={() => { addObjective(s); setSuggestions(suggestions.filter((_, j) => j !== i)); }}>+ Add</button>
            </div>
          ))}
          <button className="btn sm ghost" onClick={() => setSuggestions(null)} style={{ marginTop: 6 }}>Dismiss</button>
        </div>
      )}

      {plan.objectives.map((o) => (
        <ObjectiveNode key={o.id} o={o}
          onToggle={() => toggle(o.id)}
          onEdit={(f, v) => editNode(o.id, null, null, f, v)}
          onRemove={() => removeNode(o.id)}
          onAddStrategy={() => addStrategy(o.id)}
          onSuggestPlan={() => suggestPlanFor(o)}
          strategyHandlers={{
            toggle: (sid) => toggle(o.id, sid),
            edit: (sid, tid, f, v) => editNode(o.id, sid, tid, f, v),
            remove: (sid, tid) => removeNode(o.id, sid, tid),
            addTactic: (sid) => addTactic(o.id, sid),
          }}
        />
      ))}

      {impact && (
        <>
          <h3 className="sect">Simulated impact of the current plan</h3>
          <div className="card"><AiAnswer text={impact} /></div>
          <p className="note">Illustrative scenario generated by Claude from mission baselines — not a forecast.</p>
        </>
      )}

      <EvidenceLibrary data={data} />
    </div>
  );
}

function EvidenceLibrary({ data }) {
  const [open, setOpen] = useState(false);
  const ev = data.evidence;
  const levers = data.levers || [];
  if (!ev) return null;
  const rf = (ev.riskFactors?.['17-19'] || []).slice(0, 8);
  const stats = (ev.phaseCards || []).flatMap((p) => p.cards.map((c) => ({ ...c, phase: p.phase }))).slice(0, 8);
  return (
    <>
      <h3 className="sect" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        Evidence library {open ? '▾' : '▸'} <span className="sub" style={{ fontWeight: 400 }}>what the tactics should be built on</span>
      </h3>
      {open && (
        <>
          <div className="grid g2">
            <div className="card">
              <h4>Strongest NEET risk factors at 17-19 <span className="sub" style={{ fontWeight: 400 }}>(+percentage points)</span></h4>
              <Bars unit="ppt" data={rf.map((r) => ({ label: r.f, value: r.ppt, color: r.ppt >= 10 ? 'crimson' : 'amber' }))} />
              <div className="sub" style={{ marginTop: 6 }}>{ev.source}</div>
            </div>
            <div className="card">
              <h4>Costed levers with modelled impact <span className="sub" style={{ fontWeight: 400 }}>(national, Ready to Work)</span></h4>
              <table className="data">
                <thead><tr><th>Lever</th><th className="num">Max NEET ↓</th><th className="num">£m/yr</th></tr></thead>
                <tbody>
                  {levers.map((l) => (
                    <tr key={l.id} title={l.evidence}>
                      <td style={{ fontSize: 12 }}>{l.name}</td>
                      <td className="num good">−{l.modelled_max_reduction_pct}%</td>
                      <td className="num">{l.indicative_cost_m_yr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="note">Hover a row for the evidence line. Try them live in the Simulator.</div>
            </div>
          </div>
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div className="card">
              <h4>Key evidence stats</h4>
              {stats.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <b style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', minWidth: 52, fontSize: 14 }}>{s.stat}</b>
                  <span className="sub" style={{ fontSize: 12 }}>{s.label} <i style={{ color: 'var(--ink3)' }}>({s.source})</i></span>
                </div>
              ))}
            </div>
            <div className="card">
              <h4>White Working Class Inquiry ({ev.wwc?.year}) — recommendations</h4>
              {Object.entries(ev.wwc?.recommendations || {}).map(([k, recs]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <b style={{ fontSize: 12 }}>{k}</b>
                  <div className="sub" style={{ fontSize: 11.8 }}>{recs.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Editable({ value, onChange, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return <span className={className} onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Double-click to edit">{value || <i style={{ color: 'var(--ink3)' }}>{placeholder}</i>}</span>;
  }
  return (
    <input autoFocus className="field" style={{ padding: '4px 8px', fontSize: 13 }} value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); onChange(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onChange(v); } }} />
  );
}

function ObjectiveNode({ o, onToggle, onEdit, onRemove, onAddStrategy, onSuggestPlan, strategyHandlers }) {
  return (
    <div className="vm-node">
      <div className="vm-head" onClick={onToggle}>
        <span className={`chev ${o.open ? 'open' : ''}`}>▶</span>
        <span className="vm-tag O">OBJ</span>
        <span className="vm-title"><Editable value={o.title} onChange={(v) => onEdit('title', v)} placeholder="Objective title" /></span>
        <span className="sub" style={{ fontSize: 11 }}>{o.strategies.length} strategies</span>
        <span className="vm-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn sm" onClick={onAddStrategy}>+ Strategy</button>
          <button className="btn sm" onClick={onSuggestPlan} disabled={o.planning}>{o.planning ? '…' : '✦ Suggest S+T'}</button>
          <button className="btn sm danger" onClick={onRemove}>✕</button>
        </span>
      </div>
      {o.open && (
        <>
          <div className="vm-detail"><Editable value={o.detail} onChange={(v) => onEdit('detail', v)} placeholder="Add detail…" /></div>
          <div className="vm-children">
            {o.strategies.map((s) => <StrategyNode key={s.id} s={s} h={strategyHandlers} />)}
            {!o.strategies.length && <div className="sub" style={{ fontSize: 12 }}>No strategies yet — add one, or let Claude suggest strategies and tactics.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function StrategyNode({ s, h }) {
  return (
    <div className="vm-node" style={{ background: 'var(--bg2)' }}>
      <div className="vm-head" onClick={() => h.toggle(s.id)}>
        <span className={`chev ${s.open ? 'open' : ''}`}>▶</span>
        <span className="vm-tag S">STR</span>
        <span className="vm-title"><Editable value={s.title} onChange={(v) => h.edit(s.id, null, 'title', v)} placeholder="Strategy title" /></span>
        <span className="sub" style={{ fontSize: 11 }}>{s.tactics.length} tactics</span>
        <span className="vm-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn sm" onClick={() => h.addTactic(s.id)}>+ Tactic</button>
          <button className="btn sm danger" onClick={() => h.remove(s.id)}>✕</button>
        </span>
      </div>
      {s.open && (
        <>
          <div className="vm-detail"><Editable value={s.detail} onChange={(v) => h.edit(s.id, null, 'detail', v)} placeholder="Add detail…" /></div>
          <div className="vm-children">
            {s.tactics.map((t) => (
              <div className="vm-node" key={t.id} style={{ background: 'var(--panel2)' }}>
                <div className="vm-head" style={{ cursor: 'default' }}>
                  <span className="vm-tag T">TAC</span>
                  <span className="vm-title"><Editable value={t.title} onChange={(v) => h.edit(s.id, t.id, 'title', v)} placeholder="Tactic" /></span>
                  <span className="vm-actions"><button className="btn sm danger" onClick={() => h.remove(s.id, t.id)}>✕</button></span>
                </div>
                {t.detail && <div className="vm-detail" style={{ paddingLeft: 14 }}><Editable value={t.detail} onChange={(v) => h.edit(s.id, t.id, 'detail', v)} /></div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
