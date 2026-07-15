// Netlify Function: Claude-powered brain for Mission Control.
// Modes: ask | objectives | plan | impact
// Requires env var ANTHROPIC_API_KEY (Netlify → Site configuration → Environment variables).
// Optional env var ASK_MODEL.
const brief = require('./mission-brief.json');

const DATA = `\n\nDATASET (Mission North East: Sunderland + South Tyneside; Mission Coastal: Scarborough + Hastings):\n` + JSON.stringify(brief);

const RULES = `
- Use ONLY the figures in the dataset. Never invent or estimate numbers that are not present. If something is not derivable from the data, say so.
- British English. No em dashes. Percentages to one decimal place unless the source is a whole number. Audience: senior policy officials; rigorous and neutral.
- "NEET or not known" combines confirmed NEET with "activity not known" (a tracking gap). "No sustained destination" is the school-level NEET proxy (KS4 destinations 2022/23). Scarborough NEET figures are North Yorkshire LA-level; Hastings NEET figures are East Sussex LA-level: both understate the town-level picture.
FORMATTING: tight, punchy prose; bold labels and short bullets; no markdown tables or "#" headings. Lead with the direct answer.`;

const VISUAL = `
VISUAL OUTPUT: you may embed fenced blocks the interface renders as graphics. Use them generously, but only with figures present in the dataset.
1) Stat strip:
\`\`\`stats
[{"value":"26.0","label":"Hastings disadvantaged A8","color":"crimson"},{"value":"17.7","label":"White British FSM gap (pts)","color":"amber"}]
\`\`\`
2 to 4 stats. "color": crimson, amber, blue, green, navy, purple.
2) Chart for any ranking, comparison or trend:
\`\`\`chart
{"type":"bar","title":"Attainment 8, 2024/25","unit":"","data":[{"label":"England","value":46.0},{"label":"South Tyneside","value":42.7}]}
\`\`\`
"type":"line" for a time trend (labels are years). Max 8 points per chart; multiple charts allowed. A great answer reads like a mini infographic. Never invent numbers.`;

const SYSTEM_ASK = `You are the analyst for Mission Control, the strategy hub for the Department for Education's place-based missions (Mission North East and Mission Coastal). Answer the user's question strictly from the dataset. The user may also paste VMOST plan context or connection-card context: treat that as part of the evidence.` + RULES + VISUAL + DATA;

const SYSTEM_OBJECTIVES = `You are a sharp strategy adviser for Mission Control. Suggest NEW, measurable VMOST objectives for the missions, grounded in the dataset (the current objectives are in vmost_current_frame: do not simply repeat them; sharpen, quantify or fill gaps, e.g. KS2 maths in Scarborough, EHE/churn in Hastings, secondary PA in Sunderland and South Tyneside, NEET destinations). Where the evidence_library, kpi_framework or policy_levers_with_modelled_impact support an objective, cite them in "evidence".
Return ONLY a JSON code fence:
\`\`\`json
{"objectives":[{"title":"...","detail":"one or two sentences: the measurable goal, the baseline figure from the data, and the target logic","evidence":"the key figures from the dataset that justify it","area":"all|sunderland|south-tyneside|scarborough|hastings"}]}
\`\`\`
Give 4 to 5 objectives, each anchored to at least one real figure from the dataset. Keep "detail" and "evidence" to one sentence each — you are running inside a strict 10-second window.` + RULES + DATA;

const SYSTEM_PLAN = `You are a delivery strategist for Mission Control. The user gives you a VMOST objective. Propose strategies and nested tactics for it, consistent with the mission design (four strands, PSTs, efficacy engine, TLG concepts, £4.2m envelope) and grounded in the dataset. Prefer tactics backed by the evidence_library and policy_levers_with_modelled_impact (cite the figure, e.g. "4+ employer contacts: 5x less likely NEET") and name specific schools from the drivers data where deployment should start.
Return ONLY a JSON code fence:
\`\`\`json
{"strategies":[{"title":"...","detail":"how resources are directed and why, citing dataset figures","tactics":[{"title":"...","detail":"concrete day-to-day action, who does it, in which schools/areas where the data points there"}]}]}
\`\`\`
Give 2 to 3 strategies with 2 to 3 tactics each. Reference specific schools, areas or figures from the dataset where relevant. Keep every "detail" to one sentence — you are running inside a strict 10-second window.` + RULES + DATA;

const SYSTEM_IMPACT = `You are the evaluation lead for Mission Control. The user gives you a VMOST plan (objectives, strategies, tactics) and possibly simulator settings. Model the intended impact honestly: direction of travel, plausible scale ranges based on the baselines in the dataset, key assumptions, and what would need to be true. Be candid about uncertainty; these are illustrative scenarios, not forecasts.
Open with a stat strip of the relevant baselines, then for each objective a bold title line and 2-3 lines of expected impact logic, with at most one chart overall. Close with the two biggest risks to delivery.
BE BRIEF: the whole answer must stay under 300 words of prose (plus blocks) — you are running inside a strict 10-second window.` + RULES + VISUAL + DATA;

exports.handler = async (event) => {
  const KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_KEY;
  const MODEL = process.env.ASK_MODEL || 'claude-sonnet-4-6';

  if (event.httpMethod === 'GET') {
    const src = process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : process.env.VITE_ANTHROPIC_KEY ? 'VITE_ANTHROPIC_KEY' : process.env.ANTHROPIC_KEY ? 'ANTHROPIC_KEY' : null;
    return json(200, { status: 'ok', keyPresent: !!src, keySource: src, model: MODEL, briefLoaded: !!(brief && brief.areas) });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let question = '', mode = 'ask', context = '';
  try {
    const b = JSON.parse(event.body || '{}');
    question = (b.question || '').toString().slice(0, 4000);
    context = (b.context || '').toString().slice(0, 8000);
    mode = ['objectives', 'plan', 'impact'].includes(b.mode) ? b.mode : 'ask';
  } catch { /* ignore */ }
  if (!question.trim() && mode !== 'objectives') return json(400, { error: 'no_question' });
  if (!KEY) return json(200, { answer: null, error: 'no_key' });

  const system = mode === 'objectives' ? SYSTEM_OBJECTIVES : mode === 'plan' ? SYSTEM_PLAN : mode === 'impact' ? SYSTEM_IMPACT : SYSTEM_ASK;
  // Netlify synchronous functions time out at ~10s, so keep responses tight.
  const maxTokens = mode === 'ask' ? 800 : mode === 'impact' ? 900 : 1200;
  const userMsg = (context ? `CONTEXT:\n${context}\n\n` : '') + (question || 'Suggest objectives.');

  const candidates = process.env.ASK_MODEL
    ? [process.env.ASK_MODEL]
    : ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'];
  let lastDetail = '';
  for (const m of candidates) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: m, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] }),
      });
      const text = await resp.text();
      if (resp.ok) {
        const data = JSON.parse(text);
        const answer = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        return json(200, { answer, model: m, mode });
      }
      let errType = '';
      try { errType = (JSON.parse(text).error || {}).type || ''; } catch { /* */ }
      lastDetail = `${m}: ${resp.status} ${errType}`;
      if (errType !== 'not_found_error') return json(200, { answer: null, error: 'api_error', detail: lastDetail });
    } catch (e) {
      lastDetail = String(e).slice(0, 160);
    }
  }
  return json(200, { answer: null, error: 'api_error', detail: lastDetail });
};

function json(status, body) {
  return { statusCode: status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(body) };
}
