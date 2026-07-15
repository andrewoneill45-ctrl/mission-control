#!/usr/bin/env python3
"""Build connections.json (Supernotes-style seed graph) + mission-brief.json (AI context)."""
import json, os
OUT = '/sessions/kind-laughing-tesla/mnt/outputs/mission-control'
md = json.load(open(os.path.join(OUT, 'public/data/mission_data.json')))

# ---------- Connections graph ----------
N = []  # nodes
E = []  # edges
def node(id, label, kind, text=''):
    N.append({'id': id, 'label': label, 'kind': kind, 'text': text})
def edge(a, b, label=''):
    E.append({'from': a, 'to': b, 'label': label})

node('vision', 'Vision: Every child achieving & thriving', 'vmost', md['vmostSeed']['vision'])
node('mission-ne', 'Mission North East', 'mission', 'Region-wide mission; phase 1 clusters in Sunderland and South Tyneside; phase 2 candidates Darlington and Middlesbrough.')
node('mission-coastal', 'Mission Coastal', 'mission', 'Coastal mission; areas chosen by Ministers from a data-led shortlist: Scarborough (north) and Hastings (south).')
for a in ['sunderland', 'south-tyneside', 'scarborough', 'hastings']:
    node(a, md['areas'][a]['name'], 'area', md['areas'][a]['summary'])
edge('vision', 'mission-ne'); edge('vision', 'mission-coastal')
edge('mission-ne', 'sunderland'); edge('mission-ne', 'south-tyneside')
edge('mission-coastal', 'scarborough'); edge('mission-coastal', 'hastings')

for s in md['strands']:
    sid = f"strand-{s['id']}"
    node(sid, f"Strand {s['id']}: {s['name']}", 'strand', s['text'])
    edge('mission-ne', sid); edge('mission-coastal', sid)

node('efficacy', 'The Efficacy Engine', 'concept', 'Teacher × pupil × parental efficacy, connected by shared culture, strong relationships and accountability. In school, beyond the gate, centred on place.')
edge('efficacy', 'strand-1'); edge('efficacy', 'strand-2'); edge('efficacy', 'strand-4')

node('wwc-gap', 'White working-class attainment gap', 'theme', 'Disadvantaged White British pupils average A8 30.9 vs 48.6 for non-disadvantaged peers: a 17.7-point gap within the same ethnic group. The generational injustice at the centre of the missions.')
for a in ['sunderland', 'south-tyneside', 'scarborough', 'hastings']:
    edge('wwc-gap', a)

node('psts', 'Performance Support Teams', 'delivery', '~25 specialists @ £800/day, ~120 days/yr, clusters of 6-8 secondaries. £2.4m/yr: the largest investment.')
edge('psts', 'strand-1')
node('enrichment-framework', 'Enrichment Framework + DCMS £22.5m', 'delivery', 'National Enrichment Framework rollout in mission areas, complemented by DCMS enrichment funding.')
edge('enrichment-framework', 'strand-2')
node('dashboard', 'Real-time data dashboard', 'delivery', '£150k/yr for dashboard, impact evaluation and research partnership.')
edge('dashboard', 'strand-1'); edge('dashboard', 'strand-3')

for p in [('right-to-succeed', 'Right to Succeed'), ('allchild', 'AllChild'), ('impetus', 'Impetus'),
          ('mission-44', 'Mission 44'), ('dcms', 'DCMS'), ('shine', 'SHINE'),
          ('whatworked', 'WhatWorked Education'), ('neca', 'NECA'), ('cabinet-office', 'Cabinet Office TLG team')]:
    node(p[0], p[1], 'partner', 'Anchor / funding partner.')
edge('right-to-succeed', 'strand-2'); edge('allchild', 'strand-2'); edge('impetus', 'strand-2')
edge('dcms', 'enrichment-framework'); edge('mission-44', 'mission-ne', 'Youth Advisory Board')
edge('shine', 'mission-ne'); edge('neca', 'mission-ne'); edge('whatworked', 'strand-3')
edge('cabinet-office', 'strand-3')

for t in md['tlg']:
    tid = f"tlg-{t['id']}"
    node(tid, t['name'], 'tlg', f"[{t['scope']}] {t['text']}")
    edge(tid, 'strand-3')
edge('tlg-ks3-microtrials', 'sunderland'); edge('tlg-ks3-microtrials', 'south-tyneside')
edge('tlg-ne-pathways', 'mission-ne'); edge('tlg-every-mover', 'hastings'); edge('tlg-year-round-coast', 'scarborough')
edge('tlg-ks3-microtrials', 'whatworked')

for th in [
    ('attendance', 'Attendance & persistent absence', 'Secondary PA: South Tyneside 28.2%, Sunderland 28.4%, Hastings 31.9% vs England 23.4%. Daily monitoring, family liaison and PA protocols are core tactics.'),
    ('neet-dest', 'NEET & destinations', '16-17 NEET-or-not-known: Sunderland 6.7%, South Tyneside 5.6% vs England 5.6%. Fewer NEETs and stronger post-16 progression is a mission objective.'),
    ('ks2-weakness', 'Primary attainment (KS2)', 'Scarborough RWM 57% vs national ~61-62%; over half of MCS primaries below national average. Maths is the binding constraint; the girls’ advantage has vanished.'),
    ('churn', 'Pupil mobility & churn', 'Hastings: ~10% of secondary-age pupils in elective home education, 928 (14.7%) out of or at risk of being out of provision. Housing insecurity drives mid-year moves.'),
    ('seasonal', 'Seasonal coastal economy', 'Scarborough: disadvantage concentrates in winter, disengagement in summer. Biggest employer Anglo American; rest mostly tourism and hospitality.'),
    ('parental', 'Parental engagement', 'White working-class families report the lowest trust in schools: the single biggest evidence gap named in the missions’ TLG remit.'),
    ('transition', 'Y6-7 transition', 'Risk concentrates at the Year 6 to 7 transition where data fractures across systems.'),
]:
    node(th[0], th[1], 'theme', th[2])
edge('attendance', 'strand-1'); edge('attendance', 'strand-2')
edge('neet-dest', 'strand-2'); edge('neet-dest', 'tlg-early-warning')
edge('ks2-weakness', 'scarborough'); edge('churn', 'hastings'); edge('churn', 'tlg-every-mover')
edge('seasonal', 'scarborough'); edge('seasonal', 'tlg-year-round-coast')
edge('parental', 'tlg-family-guarantee'); edge('parental', 'efficacy')
edge('transition', 'tlg-year7-bridge'); edge('transition', 'tlg-early-warning')
edge('attendance', 'sunderland'); edge('attendance', 'south-tyneside'); edge('attendance', 'hastings')

node('governance', 'Governance: Partnership Board + Operational Boards', 'delivery', 'Governance board chaired by the Minister; local operational boards for each mission underneath. Youth Advisory Board for Mission NE.')
edge('governance', 'mission-ne'); edge('governance', 'mission-coastal')
node('budget', '£4.2m annual DfE envelope', 'delivery', 'Covers both missions; philanthropic and partner contributions handled in a parallel workstream.')
edge('budget', 'mission-ne'); edge('budget', 'mission-coastal'); edge('budget', 'psts')

json.dump({'nodes': N, 'edges': E}, open(os.path.join(OUT, 'public/data/connections.json'), 'w'), indent=1)
print('connections:', len(N), 'nodes', len(E), 'edges')

# ---------- AI brief (compact) ----------
brief = {
  'meta': {
    'purpose': 'Mission Control: data brief for Mission North East (Sunderland, South Tyneside) and Mission Coastal (Scarborough, Hastings). Use ONLY these figures; never invent numbers.',
    'vintages': md['meta']['vintages'],
    'definitions': 'A8 = Attainment 8. Disadv = disadvantaged (FSM ever-6). RWM = KS2 reading/writing/maths expected standard. PA = persistent absence (10%+ sessions missed), secondary unless stated. NEET-or-not-known combines confirmed 16-17 NEET with activity-not-known (a tracking gap). "No sustained destination" (ns) is the school-level NEET proxy from KS4 destinations 2022/23.',
  },
  'england': md['meta']['england'],
  'national_neet': md['national'],
  'regions': md['regions'],
  'areas': {},
  'ne_la_ranking': md['neLAs'],
  'strands': md['strands'],
  'budget': md['budget'],
  'tlg_concepts': md['tlg'],
  'vmost_current_frame': md['vmostSeed'],
  'scarborough_ks2_analysis': md['scarboroughKS2'],
  'hastings_out_of_provision': md['hastingsCohort'],
}
for k, a in md['areas'].items():
    brief['areas'][k] = {kk: vv for kk, vv in a.items() if kk != 'schools'}
    secs = a['schools']['secondary']
    brief['areas'][k]['secondary_schools'] = [
        {'name': s['name'], 'trust': s.get('trust'), 'pupils': s.get('pupils'), 'ofsted': s.get('ofsted'),
         'fsm_pct': s.get('edu_fsm_pct'), 'a8': s.get('attainment8'), 'a8_disadv': s.get('a8_disadv'),
         'no_sustained_dest_pct': (s.get('dest') or {}).get('ns')} for s in secs]
    pris = a['schools']['primary']
    brief['areas'][k]['primary_summary'] = {
        'count': len(pris),
        'weakest_rwm': [{'name': p['name'], 'rwm': p.get('ks2_rwm_exp')} for p in pris[-6:] if p.get('ks2_rwm_exp') is not None],
        'strongest_rwm': [{'name': p['name'], 'rwm': p.get('ks2_rwm_exp')} for p in pris[:4]],
    }
path = os.path.join(OUT, 'netlify/functions/mission-brief.json')
json.dump(brief, open(path, 'w'), separators=(',', ':'))
print('brief bytes:', os.path.getsize(path))
