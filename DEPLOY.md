# Mission Control — run & deploy

A strategy hub for Mission North East (Sunderland, South Tyneside) and Mission Coastal (Scarborough, Hastings).

## Pages

- **Overview** — the case for the missions, the four areas, four strands, £4.2m envelope.
- **Mission NE / Mission Coastal** — mission-level rationale and cluster comparisons, with sub-pages per area (performance trends, NEET & destinations, school tables, area-specific deep-dives: Scarborough KS2, Hastings churn).
- **VMOST Planner** — Vision/Mission fixed; add collapsible Objectives → Strategies → Tactics. Claude can suggest objectives from the data, generate strategy/tactic trees per objective, and simulate the intended impact of the whole plan. Saved in your browser; export/import JSON to share.
- **Connections** — Supernotes-style linked cards (themes, strands, TLG concepts, partners, areas) seeded from the Missions documents. Click to read/edit, link cards, add your own. Export/import JSON.
- **Impact Simulator** — NEET-Intelligence-style levers with modelled trajectories to 2030 per area, plus an AI stress-test. Save named scenarios (e.g. "PST-heavy" vs "enrichment-heavy") and tick two or more to compare trajectories and 2030 outcomes side by side; the stress-test compares them when a comparison is active.
- **Ask** — natural-language Q&A over the whole dataset (optionally including your VMOST plan and notes), answered as mini-infographics.

## Shared team plans (Netlify Blobs)

VMOST, Connections and the scenario set each have a **"Team" bar**: *Publish mine* pushes your local version to a shared store; *Load shared* pulls the team version into your browser. One shared copy per document, stamped with author + time (you're asked for your name/initials once).

- Powered by Netlify Blobs via `netlify/functions/plans.mjs` — zero configuration on Netlify; it works as soon as the site deploys.
- Locally it works under `netlify dev` (sandboxed local store); under plain `npm run dev` the team bar reports the store as unavailable — everything else still works.
- Last write wins: publish overwrites the shared copy, so fetch before big edits.

## Print / PDF briefing mode

Area pages, mission pages, the VMOST planner and the Simulator have a **Print / PDF** button (or use ⌘P). Navigation, buttons and controls are stripped; a briefing header (title + date + OFFICIAL marking) is added; charts and cards paginate cleanly. Choose "Save as PDF" in the print dialog for a shareable briefing. On VMOST, click **Expand all** first if you want the full tree in the document.

## Run locally

```bash
cd mission-control
npm install
npm run dev          # UI only, at http://localhost:3000 (Ask/AI features need functions)
```

To run WITH the AI functions locally:

```bash
npm install -g netlify-cli   # first time only
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
netlify dev                  # serves UI + functions together
```

## Deploy to Netlify

1. Push this folder to a Git repo (or drag-and-drop wonʼt work here — functions need a build, so use Git or `netlify deploy`).
2. In Netlify: **Add new site → Import from Git**, pick the repo. Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`).
3. **Site configuration → Environment variables → Add**: `ANTHROPIC_API_KEY` = your key. Optional: `ASK_MODEL` to pin a model.
4. Deploy. Check the function is healthy at `https://<your-site>/api/ask` (GET returns `keyPresent: true`).

Or with the CLI from this folder:

```bash
netlify init      # link/create the site
netlify env:set ANTHROPIC_API_KEY sk-ant-...
netlify deploy --build --prod
```

## Data

- `public/data/mission_data.json` — curated area/mission dataset (KS4, KS2, absence, IDACI, NEET, schools, budget, strands, TLG, VMOST seed). Sources: NE_LAs_Rankedv2 workbook, Coastal Schools Data LAD v3, MCS KS2 analysis, Hastings cohort workbook, Missions strategy documents, and the NEET Intelligence datasets (neet_dashboard/schools/neet_schools).
- `public/data/connections.json` — seeded connections graph.
- `netlify/functions/mission-brief.json` — compact brief injected into every Claude call (the AI only ever answers from this).
- Regenerate all three by re-running `build_data.py` and `build_brief.py` (kept alongside the project) if source data updates.

## Notes

- VMOST plans and Connections edits persist in each browser (localStorage) — use Export/Import JSON to share between people.
- 16-17 NEET is published at LA level only: Scarborough shows North Yorkshire, Hastings shows East Sussex (flagged in the UI).
- Simulator coefficients are illustrative, for exploring direction and magnitude — not forecasts.
