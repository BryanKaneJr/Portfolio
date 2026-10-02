"""Merge chapter drafts written in private copies of content/ into the repo.

  python3 scripts/writing/merge_chapters.py <drafts-dir> <skill> <chapter> [<chapter> ...]
  CONTENT=/path/to/a/copy python3 ...   # trial-merge into a copy first

Each chapter lives in <drafts-dir>/<skill>-ch<N>/content (see docs/writing/README.md). Copies that
chapter's level files; adds new concepts, facts, sources and verification
records; unions cardIds on facts that already exist. Reports clashes (same
fact id with different text, or level files outside the chapter).
"""
import json, os, shutil, sys

REPO = os.environ.get('CONTENT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'content')
if len(sys.argv) < 4:
    sys.exit(__doc__)
SCR, skill, chapters = sys.argv[1], sys.argv[2], [int(c) for c in sys.argv[3:]]


def load(p):
    return json.load(open(p))


def save(p, data):
    with open(p, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


main_concepts = load(f'{REPO}/skills/{skill}/concepts.json')
main_sources = load(f'{REPO}/sources.json')
main_ver = load(f'{REPO}/verification.json')
problems = []

for n in chapters:
    W = f'{SCR}/{skill}-ch{n}/content'
    lo, hi = (n - 1) * 10 + 1, n * 10
    # levels
    for num in range(lo, hi + 1):
        src = f'{W}/skills/{skill}/levels/{num:03d}.json'
        if os.path.exists(src):
            shutil.copy(src, f'{REPO}/skills/{skill}/levels/{num:03d}.json')
        else:
            problems.append(f'ch{n}: missing level {num:03d}')
    # concepts and facts
    by_id = {c['id']: c for c in main_concepts}
    facts = {f['id']: (c, f) for c in main_concepts for f in c['facts']}
    for c in load(f'{W}/skills/{skill}/concepts.json'):
        if c['id'] not in by_id:
            main_concepts.append(c)
            by_id[c['id']] = c
            for f in c['facts']:
                if f['id'] in facts:
                    problems.append(f'ch{n}: fact {f["id"]} already exists under {facts[f["id"]][0]["id"]}')
                facts[f['id']] = (c, f)
            continue
        target = by_id[c['id']]
        for f in c['facts']:
            if f['id'] in facts:
                mine = facts[f['id']][1]
                if mine['text'] != f['text']:
                    problems.append(f'ch{n}: fact {f["id"]} text differs; kept the existing text')
                for cid in f['cardIds']:
                    if cid not in mine['cardIds']:
                        mine['cardIds'].append(cid)
                for sid in f['sourceIds']:
                    if sid not in mine['sourceIds']:
                        mine['sourceIds'].append(sid)
            else:
                target['facts'].append(f)
                facts[f['id']] = (target, f)
    # sources
    have = {s['id'] for s in main_sources}
    for s in load(f'{W}/sources.json'):
        if s['id'] not in have:
            main_sources.append(s)
            have.add(s['id'])
    # verification
    keys = {(v['factId'], v['sourceId']) for v in main_ver}
    for v in load(f'{W}/verification.json'):
        if (v['factId'], v['sourceId']) not in keys:
            main_ver.append(v)
            keys.add((v['factId'], v['sourceId']))

save(f'{REPO}/skills/{skill}/concepts.json', main_concepts)
save(f'{REPO}/sources.json', main_sources)
save(f'{REPO}/verification.json', main_ver)
for p in problems:
    print('!', p)
print(f'merged chapters {chapters}: {len(main_concepts)} concepts, {len(main_sources)} sources, {len(main_ver)} verification records')
