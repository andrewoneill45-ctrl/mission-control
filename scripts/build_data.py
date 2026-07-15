#!/usr/bin/env python3
"""Build Mission Control data layer from Missions + Milburn (NEET Intelligence) sources."""
import json, os

ROOT = '/sessions/kind-laughing-tesla/mnt/DfE'
NEET = os.path.join(ROOT, 'Milburn/school-profile copy/public')
OUT = '/sessions/kind-laughing-tesla/mnt/outputs/mission-control'
os.makedirs(os.path.join(OUT, 'public/data'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'netlify/functions'), exist_ok=True)

nd = json.load(open(os.path.join(NEET, 'neet_dashboard.json')))
schools = json.load(open(os.path.join(NEET, 'schools.json')))
neet_schools = json.load(open(os.path.join(NEET, 'neet_schools.json')))

def r1(x):
    return None if x is None else round(float(x), 1)

def la_neet(name):
    la = next((x for x in nd['las'] if x['name'] == name), None)
    if not la: return None
    return {'name': name, 'neetnk': r1(la['neetnk']), 'neet': r1(la['neet']), 'nk': r1(la['nk']),
            'cohort': la.get('cohort'), 'annual_change': r1(la.get('annual_change')),
            'ts': [{'y': t['y'], 'v': r1(t['v'])} for t in la.get('ts', [])],
            'send': {k: r1(v) for k, v in (la.get('send') or {}).items()}}

def region_bench(name):
    rg = next((x for x in nd['regions'] if x['name'] == name), None)
    if not rg: return None
    return {'name': name, 'neetnk': r1(rg['neetnk']), 'neet': r1(rg['neet']), 'nk': r1(rg['nk']),
            'ks4': {k: r1(v) for k, v in (rg.get('ks4') or {}).items()},
            'drivers': {k: r1(v) for k, v in (rg.get('drivers') or {}).items()},
            'ts': [{'y': t['y'], 'v': r1(t['v'])} for t in rg.get('ts', [])]}

SCHOOL_FIELDS_SEC = ['urn','name','town','phase','type','trust','pupils','ofsted','edu_fsm_pct','attainment8','a8_disadv','a8_nondisadv','basics_94','basics_95','sen_all_pct']
SCHOOL_FIELDS_PRI = ['urn','name','town','phase','type','trust','pupils','ofsted','edu_fsm_pct','ks2_rwm_exp','ks2_read_exp','ks2_mat_exp','ks2_writ_exp','ks2_fsm_pct','sen_all_pct']

SCARB_TOWNS = {'scarborough','whitby','filey','saltburn-by-the-sea','hunmanby','snainton','cloughton','burniston','east ayton','west ayton','sleights','staithes','robin hood\'s bay','castleton','danby','egton','glaisdale','goathland','lythe','hawsker','fylingthorpe','ravenscar','scalby','seamer','cayton','wykeham','brompton','hackness'}
HASTINGS_TOWNS = {'hastings', 'st leonards-on-sea', 'st. leonards-on-sea'}

def pick_schools(pred):
    out = {'secondary': [], 'primary': []}
    for s in schools:
        if not pred(s): continue
        ph = (s.get('phase') or '').lower()
        dest = neet_schools.get(str(s['urn']))
        if 'secondary' in ph or 'all-through' in ph:
            row = {k: s.get(k) for k in SCHOOL_FIELDS_SEC}
            if dest:
                row['dest'] = {k: dest.get(k) for k in ('edu','app','work','ns','unk','cohort')}
            out['secondary'].append(row)
        elif 'primary' in ph:
            out['primary'].append({k: s.get(k) for k in SCHOOL_FIELDS_PRI})
    out['secondary'].sort(key=lambda x: (x.get('attainment8') is None, -(x.get('attainment8') or 0)))
    out['primary'].sort(key=lambda x: (x.get('ks2_rwm_exp') is None, -(x.get('ks2_rwm_exp') or 0)))
    return out

sund = pick_schools(lambda s: s.get('la') == 'Sunderland')
styn = pick_schools(lambda s: s.get('la') == 'South Tyneside')
scar = pick_schools(lambda s: s.get('la') == 'North Yorkshire' and (s.get('town') or '').lower() in SCARB_TOWNS)
hast = pick_schools(lambda s: s.get('la') == 'East Sussex' and (s.get('town') or '').lower() in HASTINGS_TOWNS)

# Headline metrics extracted from Missions workbooks (NE_LAs_Rankedv2; Coastal Schools Data LAD v3)
areas = {
  'sunderland': {
    'name': 'Sunderland', 'mission': 'ne', 'laLevel': 'Sunderland',
    'summary': 'Phase 1 Mission NE cluster. Sustained below-average KS4 attainment, among the highest disadvantaged underperformance in the region, elevated persistent absence, high deprivation (53rd most deprived nationally on IDACI), and no existing targeted DfE support (RISE) — genuine additionality.',
    'a8': {'2024/25': 43.3, '2023/24': 43.0, '2022/23': 42.9}, 'a8_rank_ne': 9,
    'a8_disadv': {'2024/25': 33.1, '2023/24': 32.7, '2022/23': 33.1}, 'a8_disadv_rank_ne': 8,
    'ks2_rwm': {'2024/25': 66, '2023/24': 65, '2022/23': 62}, 'ks2_rwm_disadv': {'2024/25': 52, '2023/24': 51, '2022/23': 47},
    'absence': {'total': 7.46, 'secondary': 9.75, 'primary': 5.18},
    'pa': {'total': 20.9, 'secondary': 28.4}, 'pa_rank_ne': 11,
    'idaci': {'score': 0.437, 'rank': 53},
    'neet': la_neet('Sunderland'), 'neetNote': None,
    'composite_rank_ne': '2nd weakest of 12 NE LAs on the combined ranking (score 53)',
    'schools': sund,
  },
  'south-tyneside': {
    'name': 'South Tyneside', 'mission': 'ne', 'laLevel': 'South Tyneside',
    'summary': 'Phase 1 Mission NE cluster. A8 of 42.7 vs NE average 44.1 and national 46.0; disadvantaged A8 33.1, nearly two points below the national average; elevated persistent absence; 48th most deprived nationally on IDACI; not covered by RISE or other targeted programmes.',
    'a8': {'2024/25': 42.7, '2023/24': 42.0, '2022/23': 44.1}, 'a8_rank_ne': 10,
    'a8_disadv': {'2024/25': 33.1, '2023/24': 33.6, '2022/23': 34.1}, 'a8_disadv_rank_ne': 8,
    'ks2_rwm': {'2024/25': 62, '2023/24': 63, '2022/23': 63}, 'ks2_rwm_disadv': {'2024/25': 49, '2023/24': 50, '2022/23': 52},
    'absence': {'total': 7.51, 'secondary': 10.12, 'primary': 5.26},
    'pa': {'total': 20.4, 'secondary': 28.2}, 'pa_rank_ne': 10,
    'idaci': {'score': 0.447, 'rank': 48},
    'neet': la_neet('South Tyneside'), 'neetNote': None,
    'composite_rank_ne': 'Joint 2nd weakest of 12 NE LAs on the combined ranking (score 53)',
    'schools': styn,
  },
  'scarborough': {
    'name': 'Scarborough', 'mission': 'coastal', 'laLevel': 'North Yorkshire',
    'summary': 'Mission Coastal (north). Chosen by Ministers from a data-led shortlist of coastal LADs. Disadvantaged A8 of 26.6 is among the weakest nationally. KS2 is notably weak: over half of primaries below national average, so the mission includes a strong primary attainment focus. Strong trusts (e.g. Delta) have recently taken on weak secondaries but pupil engagement remains the core challenge. Former Opportunity Area and Priority Education Investment Area.',
    'a8': {'2024/25': 39.6, '2023/24': 40.2, '2022/23': 40.3},
    'a8_disadv': {'2024/25': 26.6, '2023/24': 27.2, '2022/23': 28.5},
    'ks2_rwm': {'2024/25': 57, '2023/24': 53, '2022/23': 49}, 'ks2_rwm_disadv': {'2024/25': 41, '2023/24': 36, '2022/23': 30},
    'absence': None, 'pa': None,
    'idaci': None, 'idaciNote': 'LAD-level IDACI not published on the same basis; district contains some of the most deprived coastal neighbourhoods in Yorkshire.',
    'neet': la_neet('North Yorkshire'), 'neetNote': '16-17 NEET is only published at LA level: figures shown are North Yorkshire, which will understate the Scarborough picture.',
    'schools': scar,
    'programmes': 'Opportunity Area (North Yorkshire coast), PEIA 2023-25, RISE at George Pindar and Graham schools.',
  },
  'hastings': {
    'name': 'Hastings', 'mission': 'coastal', 'laLevel': 'East Sussex',
    'summary': 'Mission Coastal (south). Disadvantaged A8 of 26.0 — the lowest of any coastal area in England for three years running. Defining challenge is churn: high pupil mobility driven by housing insecurity, plus a very large elective home education cohort (~10% of secondary-age pupils). Former Opportunity Area and PEIA.',
    'a8': {'2024/25': 35.3, '2023/24': 32.7, '2022/23': 32.9},
    'a8_disadv': {'2024/25': 26.0, '2023/24': 24.0, '2022/23': 23.0},
    'ks2_rwm': {'2024/25': 63, '2023/24': 59, '2022/23': 55}, 'ks2_rwm_disadv': {'2024/25': 56, '2023/24': 45, '2022/23': 43},
    'absence': {'total': 7.80, 'secondary': 10.07, 'primary': 6.03},
    'pa': {'total': 23.0, 'secondary': 31.9},
    'idaci': {'score': 0.500, 'rank': 26},
    'neet': la_neet('East Sussex'), 'neetNote': '16-17 NEET is only published at LA level: figures shown are East Sussex, which will understate the Hastings picture.',
    'schools': hast,
    'programmes': 'Opportunity Area, PEIA, RISE at 1 secondary.',
  },
}

# Scarborough KS2 school analysis (from MCS_KS2_Analysis.docx)
scarb_ks2 = {
  'headline': [
    {'measure': 'Reading, writing & maths (combined)', 'mcs': 57, 'restNY': 62, 'gap': -5},
    {'measure': 'Reading', 'mcs': 74, 'restNY': 75, 'gap': -1},
    {'measure': 'Maths', 'mcs': 70, 'restNY': 74, 'gap': -4},
    {'measure': 'Writing', 'mcs': 71, 'restNY': 72, 'gap': -1},
    {'measure': 'RWM — boys', 'mcs': 56, 'restNY': 59, 'gap': -3},
    {'measure': 'RWM — girls', 'mcs': 58, 'restNY': 66, 'gap': -8},
    {'measure': 'RWM — disadvantaged', 'mcs': 44, 'restNY': 47, 'gap': -3},
  ],
  'patterns': [
    {'title': 'Deprivation does not explain MCS performance', 'text': 'Across the rest of North Yorkshire disadvantage strongly predicts results (correlation -0.43). Within MCS it is essentially zero (-0.05). Some of the most deprived schools are the best performers (Airy Hill 45% disadvantaged, 85% RWM; Thomas Hinderwell 50%, 77%). The problem is school-level, not demographic — fixable, with local proof points.'},
    {'title': 'The girls’ advantage has vanished', 'text': 'Elsewhere in the county girls outperform boys by 6-7pp on RWM. In MCS schools girls achieve 58% vs 66% for girls elsewhere (a 7.7pp gap, vs 2.9pp for boys). At Lindhead only 7% of girls reached the expected standard against 35% of boys.'},
    {'title': 'Reading is strong; maths blocks the combined measure', 'text': 'Several schools post strong reading but weak RWM (Fylingdales reads at 93% yet only 40% achieve RWM). Maths is the binding constraint in most cases, writing in a few.'},
  ],
}

# Hastings out-of-provision cohort (from Hastings Question xlsx)
hastings_cohort = {
  'note': 'Hastings postcode area, Years 7-11, mid-2026. Secondary-age children out of, or at risk of being out of, provision.',
  'total': 6327,
  'rows': [
    {'category': 'Elective Home Education (EHE)', 'n': 632, 'pct': 10.0},
    {'category': 'Children Missing Education (CME)', 'n': 110, 'pct': 1.7},
    {'category': 'In-Year Admissions (IYA)', 'n': 93, 'pct': 1.5},
    {'category': 'Interim Provision Service (IPS)', 'n': 47, 'pct': 0.7},
    {'category': 'Teaching & Learning Provision (TLP)', 'n': 46, 'pct': 0.7},
  ],
  'totalIdentified': {'n': 928, 'pct': 14.7},
  'byYear': [
    {'year': 'Y7', 'ehe': 66, 'cme': 2}, {'year': 'Y8', 'ehe': 127, 'cme': 13},
    {'year': 'Y9', 'ehe': 122, 'cme': 21}, {'year': 'Y10', 'ehe': 162, 'cme': 34},
    {'year': 'Y11', 'ehe': 155, 'cme': 40},
  ],
  'eheWhiteBritishPct': 80.9,
}

strands = [
  {'id': 1, 'name': 'Intensive School Improvement', 'short': 'PSTs',
   'text': 'Performance Support Teams of experienced leaders and specialists from high-performing trusts deployed into clusters of 6-8 secondary schools, working alongside local staff on attendance, behaviour, reading and KS3 catch-up. Practitioner-led, not consultancy.'},
  {'id': 2, 'name': 'Pupil Engagement & Enrichment', 'short': 'Beyond the Gate',
   'text': 'A structured enrichment and mentoring offer for every child in the mission areas, coordinated with the national Enrichment Framework and the DCMS £22.5m investment: sport, arts, careers, mentoring, work experience, delivered with anchor partners Right to Succeed, AllChild and Impetus.'},
  {'id': 3, 'name': 'Test, Learn & Grow', 'short': 'TLG',
   'text': 'Place-based TLG projects, micro-RCTs and multi-agency pilots, scoped bottom-up with local partners and supported by a Cabinet Office-funded satellite team. The missions as the R&D arm of the English school system.'},
  {'id': 4, 'name': 'Leadership Capacity', 'short': 'Leadership',
   'text': 'Building the capacity and development of school leaders: place-led, focused on disadvantaged communities, with a long-term pipeline (Leadership Programmes North East plus philanthropic match).'},
]

budget = {
  'totalPerYear': 4200000,
  'lines': [
    {'item': 'Performance Support Teams', 'amount': 2400000, 'note': '~25 specialists @ £800/day, ~120 days each, clusters of 8-12 schools'},
    {'item': 'Educationalist / Operational Leads (x2)', 'amount': 250000, 'note': 'One experienced educationalist per mission on secondment'},
    {'item': 'Secretariat & programme management', 'amount': 200000, 'note': 'PM, two programme officers, admin, board secretariat'},
    {'item': 'LA / cluster grant funding', 'amount': 500000, 'note': '£250k per mission: backfill, TLG project leads, innovation pots'},
    {'item': 'Engagement & enrichment delivery', 'amount': 200000, 'note': 'Top-up to Pupil Engagement Framework and Enrichment Framework rollout'},
    {'item': 'Evaluation, data & dashboard', 'amount': 150000, 'note': 'Real-time dashboard, impact evaluation, research partnership'},
    {'item': 'Leadership capacity', 'amount': 100000, 'note': 'Leadership Programmes North East + philanthropic match'},
    {'item': 'Governance', 'amount': 50000, 'note': 'Partnership Board + two Operational Boards'},
    {'item': 'Stakeholder engagement & comms', 'amount': 50000, 'note': 'Roundtables, visits, launches'},
    {'item': 'Youth Advisory Board (Mission NE)', 'amount': 25000, 'note': 'Honoraria, travel, safeguarding, facilitation'},
    {'item': 'Contingency', 'amount': 275000, 'note': '~6.5%'},
  ],
}

tlg = [
  {'id': 'rapid-evidence', 'name': 'National Rapid Evidence Network', 'scope': 'cross-cutting', 'text': 'Micro-trial infrastructure in mission schools growing into an opt-in rapid evidence network any school in England can join.'},
  {'id': 'early-warning', 'name': 'Child Engagement Early Warning System', 'scope': 'cross-cutting', 'text': 'Join DfE attendance with NHS, social care and youth service signals into a single safeguarding-grade view per child, with predictive flags tested at the Y6-7 transition and a tested human response paired to every flag.'},
  {'id': 'family-guarantee', 'name': 'Family Engagement Guarantee', 'scope': 'cross-cutting', 'text': 'Trials of structured parental engagement: text-nudges, community parent mentors, family learning, reverse parents’ evenings — targeting white working-class families reporting the lowest trust in schools.'},
  {'id': 'enrichment-passport', 'name': 'Enrichment Passport & outcome-linked commissioning', 'scope': 'cross-cutting', 'text': 'A digital enrichment passport for every mission pupil; providers paid partly on verified participation of disadvantaged pupils.'},
  {'id': 'year7-bridge', 'name': 'The Year 7 Bridge', 'scope': 'cross-cutting', 'text': 'The Y6-7 transition as a designed experience: summer bridge on secondary sites, one childhood one record, KS3 engagement curricula, transition mentors from Y9-10.'},
  {'id': 'inclusion-labs', 'name': 'Inclusion Labs', 'scope': 'cross-cutting', 'text': 'Volunteer mission schools test inclusive mainstream models the SEND reform programme needs evidence for.'},
  {'id': 'ks3-microtrials', 'name': 'KS3 Micro-Trial Partnership', 'scope': 'Sunderland & South Tyneside', 'text': 'Deepen the WhatWorked Education partnership into the country’s first secondary classroom-practice trial unit embedded in PST cluster schools; every PST intervention becomes a trial arm.'},
  {'id': 'ne-pathways', 'name': '“Made in the North East” industry pathways', 'scope': 'North East', 'text': 'Employer-embedded enrichment at scale using advanced manufacturing, electrification, offshore energy and Crown Works Studios: workplace encounters from Y7, employer-sponsored KS3 projects, technical tasters.'},
  {'id': 'every-mover', 'name': '“Every Mover Known”', 'scope': 'Hastings', 'text': 'Rapid-integration protocol for mid-year movers (48-hour records transfer, automatic enrichment and mentoring enrolment, named integration lead) plus a coastal workforce premium trial.'},
  {'id': 'year-round-coast', 'name': '“The Year-Round Coast”', 'scope': 'Scarborough', 'text': 'Year-round opportunity model for a seasonal economy: holiday enrichment, paid summer roles with tourism/offshore wind/marine sectors, a coastal curriculum, school-year scheduling flexibilities.'},
]

vmost_seed = {
  'vision': 'Every child achieving and thriving — a country where the place a child grows up, from the North East to the coast, no longer sets a ceiling on how far they go.',
  'mission': 'Place-based missions in the North East and coastal towns: a whole-government commitment to children, inside the school gates and beyond them — practitioner-led, starting where need is greatest. Focus areas: South Tyneside, Sunderland, Hastings, Scarborough.',
  'objectives': [
    {'id': 'obj-gap', 'title': 'Narrow the gap', 'detail': 'Narrow the 17.7-point White British FSM attainment gap against pre-mission baselines.',
     'strategies': [{'id': 's1', 'title': 'Efficacy engine', 'detail': 'Teacher × pupil × parental efficacy connected by culture, relationships and accountability.',
       'tactics': [{'id': 't1', 'title': 'PSTs deployed to clusters of 6-8 secondaries', 'detail': 'Specialists from high-performing trusts working on attendance, behaviour, reading, KS3 catch-up.'}]}]},
    {'id': 'obj-attain', 'title': 'Raise attainment', 'detail': 'Lift Attainment 8 towards the England average (46.0). NE 44.1; Hastings disadvantaged 26.0.',
     'strategies': [{'id': 's2', 'title': 'One integrated model', 'detail': 'Four strands delivered together, centred on place.',
       'tactics': [{'id': 't2', 'title': 'Shared reading-fluency app + KS3 early intervention', 'detail': 'Across the cohort in cluster schools.'}]}]},
    {'id': 'obj-absence', 'title': 'Cut absence', 'detail': 'Reduce overall and persistent absence, tracked termly.',
     'strategies': [{'id': 's3', 'title': 'Engagement beyond the gate', 'detail': 'Attendance is a symptom; engagement of pupil, parent and community is the driver.',
       'tactics': [{'id': 't3', 'title': 'Daily attendance monitoring + family liaison', 'detail': 'Persistent-absence protocols in every cluster school.'}]}]},
    {'id': 'obj-enrich', 'title': 'Enrich', 'detail': 'Guaranteed enrichment participation for every pupil as a mission metric.',
     'strategies': [{'id': 's4', 'title': 'Collective impact partnership', 'detail': 'Anchor partners Right to Succeed, AllChild, Impetus + DCMS £22.5m.',
       'tactics': [{'id': 't4', 'title': 'Enrichment entitlement aligned with DCMS investment', 'detail': 'Sport, arts, careers, mentoring, work experience.'}]}]},
    {'id': 'obj-dest', 'title': 'Destinations', 'detail': 'Fewer NEETs, stronger post-16 progression.',
     'strategies': [{'id': 's5', 'title': 'Phased scaling', 'detail': 'Plan summer 2026, deliver from Sept 2026, a new cluster each term: refine before we scale.',
       'tactics': [{'id': 't5', 'title': 'Micro-RCTs and multi-agency TLG pilots', 'detail': 'Scoped bottom-up with local partners.'}]}]},
  ],
}

# National / regional benchmarks
data = {
  'meta': {
    'title': 'Mission Control',
    'built': '2026-07-15',
    'vintages': 'KS4 attainment 2024/25 (LAD workbooks); KS2 2024/25 revised; absence 2024/25; 16-17 NEET 2025 (Dec 2024-Feb 2025 avg); KS4 destinations 2022/23 cohort; IDACI 2025.',
    'england': {'a8': 46.0, 'a8_disadv': 34.9, 'ks2_rwm': 61.5, 'pa_secondary': 23.4, 'absence_secondary': 8.4,
                'whiteBritishFSM_a8': 30.9, 'whiteBritishNonFSM_a8': 48.6, 'gap': 17.7},
  },
  'national': {'neet': {'neetnk': r1(nd['national']['latest']['neetnk']), 'neet': r1(nd['national']['latest']['neet']),
               'nk': r1(nd['national']['latest']['nk']),
               'ts': [{'y': t['y'], 'v': r1(t['v'])} for t in nd['national']['ts']]},
               'ks4': {k: r1(v) for k, v in nd['national']['ks4'].items()},
               'drivers': {k: r1(v) for k, v in nd['national']['drivers'].items()}},
  'regions': {'North East': region_bench('North East'),
              'Yorkshire and The Humber': region_bench('Yorkshire and The Humber'),
              'South East': region_bench('South East')},
  'areas': areas,
  'scarboroughKS2': scarb_ks2,
  'hastingsCohort': hastings_cohort,
  'strands': strands,
  'budget': budget,
  'tlg': tlg,
  'vmostSeed': vmost_seed,
  'neLAs': [
    {'la': 'Gateshead', 'a8': 47.0, 'a8_disadv': 33.9, 'composite': 17}, {'la': 'North Tyneside', 'a8': 46.0, 'a8_disadv': 33.6, 'composite': 17},
    {'la': 'County Durham', 'a8': 44.1, 'a8_disadv': 35.6, 'composite': 23}, {'la': 'Stockton-on-Tees', 'a8': 45.0, 'a8_disadv': 35.5, 'composite': 27},
    {'la': 'Redcar and Cleveland', 'a8': 44.5, 'a8_disadv': 33.0, 'composite': 32}, {'la': 'Darlington', 'a8': 44.3, 'a8_disadv': 31.3, 'composite': 36},
    {'la': 'Northumberland', 'a8': 44.0, 'a8_disadv': 30.9, 'composite': 42}, {'la': 'Hartlepool', 'a8': 42.4, 'a8_disadv': 35.2, 'composite': 50},
    {'la': 'Newcastle upon Tyne', 'a8': 43.9, 'a8_disadv': 33.3, 'composite': 52}, {'la': 'South Tyneside', 'a8': 42.7, 'a8_disadv': 33.1, 'composite': 53},
    {'la': 'Sunderland', 'a8': 43.3, 'a8_disadv': 33.1, 'composite': 53}, {'la': 'Middlesbrough', 'a8': 41.0, 'a8_disadv': 33.7, 'composite': 65},
  ],
}

json.dump(data, open(os.path.join(OUT, 'public/data/mission_data.json'), 'w'), indent=1)
print('mission_data.json', os.path.getsize(os.path.join(OUT, 'public/data/mission_data.json')))
for a, v in areas.items():
    print(a, 'sec:', len(v['schools']['secondary']), 'pri:', len(v['schools']['primary']))
