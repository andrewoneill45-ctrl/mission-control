// Ask: natural-language Q&A over the whole mission dataset + optional VMOST/connections context.
import { useRef, useState } from 'react';
import { askApi, loadVmost, loadConnEdits, useData } from '../data.jsx';
import AiAnswer from '../components/AiAnswer.jsx';

const SUGGESTIONS = [
  'Which of the four areas has the weakest disadvantaged attainment, and how big is the gap to England?',
  'Compare persistent absence across Sunderland, South Tyneside and Hastings.',
  'Which secondary schools in Sunderland have the highest share of leavers with no sustained destination?',
  'Why was South Tyneside chosen ahead of Middlesbrough?',
  'What does the KS2 picture in Scarborough tell us about where PSTs should focus?',
  'Summarise the Hastings churn problem and which TLG concept addresses it.',
  'Where should the £4.2m flex if we add a third coastal area?',
];

export default function Ask() {
  const { data } = useData();
  const [thread, setThread] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [includePlan, setIncludePlan] = useState(true);
  const endRef = useRef(null);

  const send = async (text) => {
    const question = (text || q).trim();
    if (!question || busy) return;
    setQ('');
    setThread((t) => [...t, { role: 'user', text: question }]);
    setBusy(true);
    try {
      let context = '';
      if (includePlan) {
        const plan = loadVmost(data.vmostSeed);
        if (plan?.objectives?.length) {
          context += 'CURRENT VMOST PLAN:\n' + plan.objectives.map((o) => `OBJECTIVE: ${o.title} — ${o.detail}\n` +
            o.strategies.map((s) => `  STRATEGY: ${s.title}\n` + s.tactics.map((tc) => `    TACTIC: ${tc.title}`).join('\n')).join('\n')).join('\n') + '\n\n';
        }
        const conn = loadConnEdits();
        const userCards = conn?.nodes?.filter((n) => n.kind === 'note');
        if (userCards?.length) {
          context += 'USER CONNECTION NOTES:\n' + userCards.map((c) => `${c.label}: ${c.text || ''}`).join('\n');
        }
      }
      const res = await askApi({ mode: 'ask', question, context });
      if (res.error === 'no_key') {
        setThread((t) => [...t, { role: 'ai', text: '**No API key configured.** Add `ANTHROPIC_API_KEY` in Netlify → Site configuration → Environment variables, then redeploy. (Running locally? Use `netlify dev` with a `.env` file.)' }]);
      } else if (res.error) {
        setThread((t) => [...t, { role: 'ai', text: `**Something went wrong:** ${res.detail || res.error}` }]);
      } else {
        setThread((t) => [...t, { role: 'ai', text: res.answer }]);
      }
    } catch (e) {
      setThread((t) => [...t, { role: 'ai', text: `**Request failed:** ${String(e.message || e)}. If you are running the static build without Netlify functions, the Ask endpoint is not available.` }]);
    }
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  return (
    <div>
      <div className="pagehead">
        <div className="kicker">Strategy · Ask</div>
        <h2>Ask the data</h2>
        <p className="lede">
          Natural-language questions over everything in the sandbox: area performance, NEET and destinations,
          school-level data, the mission design, budget, TLG concepts — plus your own VMOST plan and connection
          notes. Answers come back as mini-infographics, strictly grounded in the dataset.
        </p>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.6, color: 'var(--ink3)', marginBottom: 10 }}>
        <input type="checkbox" checked={includePlan} onChange={(e) => setIncludePlan(e.target.checked)} />
        Include my VMOST plan and connection notes as context
      </label>

      {!thread.length && (
        <div className="suggestions">
          {SUGGESTIONS.map((s, i) => <button key={i} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      <div className="chat-thread">
        {thread.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'user' ? m.text : <AiAnswer text={m.text} />}
          </div>
        ))}
        {busy && <div className="msg ai"><span className="spinner" /> <span style={{ color: 'var(--ink3)', fontSize: 13 }}>Interrogating the data…</span></div>}
        <div ref={endRef} />
      </div>

      <div className="askbar">
        <input placeholder="Ask anything about the missions, the areas, or the data…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="btn primary" onClick={() => send()} disabled={busy || !q.trim()}>Ask</button>
      </div>
    </div>
  );
}
