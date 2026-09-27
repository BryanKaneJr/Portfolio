"""Save a chapter written in a private copy of content/ as a small delta that merge_chapters.py can merge.

  python3 scripts/writing/extract_chapter_delta.py <working-copy-content-dir> <skill> <chapter> <out-dir>

Writes <out-dir>/<skill>-ch<N>/content/ holding only what the chapter adds against the repo's
content/: its ten level files, concepts that are new or whose facts gained cards, sources and
verification records the repo lacks. merge_chapters.py adds by ID, so merging the delta gives the
same result as merging the full working copy:

  python3 scripts/writing/merge_chapters.py <out-dir> <skill> <chapter> [...]
"""
import json, os, shutil, sys

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'content')
if len(sys.argv) != 5:
    sys.exit(__doc__)
W, skill, n, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
D = f'{out}/{skill}-ch{n}/content'


def load(p):
    return json.load(open(p))


def save(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


lo = (n - 1) * 10 + 1
os.makedirs(f'{D}/skills/{skill}/levels', exist_ok=True)
copied = 0
for num in range(lo, lo + 10):
    src = f'{W}/skills/{skill}/levels/{num:03d}.json'
    if os.path.exists(src):
        shutil.copy(src, f'{D}/skills/{skill}/levels/{num:03d}.json')
        copied += 1

repo_facts = {f['id']: f for c in load(f'{REPO}/skills/{skill}/concepts.json') for f in c['facts']}
repo_concepts = {c['id'] for c in load(f'{REPO}/skills/{skill}/concepts.json')}
concepts = []
for c in load(f'{W}/skills/{skill}/concepts.json'):
    if c['id'] not in repo_concepts:
        concepts.append(c)
        continue
    changed = [f for f in c['facts'] if f['id'] not in repo_facts
               or set(f['cardIds']) - set(repo_facts[f['id']]['cardIds'])
               or set(f['sourceIds']) - set(repo_facts[f['id']]['sourceIds'])]
    if changed:
        concepts.append({**c, 'facts': changed})
save(f'{D}/skills/{skill}/concepts.json', concepts)

have = {s['id'] for s in load(f'{REPO}/sources.json')}
sources = [s for s in load(f'{W}/sources.json') if s['id'] not in have]
save(f'{D}/sources.json', sources)

keys = {(v['factId'], v['sourceId']) for v in load(f'{REPO}/verification.json')}
ver = [v for v in load(f'{W}/verification.json') if (v['factId'], v['sourceId']) not in keys]
save(f'{D}/verification.json', ver)

print(f'{skill} ch{n}: {copied} levels, {len(concepts)} concepts, {len(sources)} sources, {len(ver)} verification records')
