# Builds the full claim-review work list: every claim in every tree, grouped by
# the source it cites (so a reviewer opens each page once), weakest evidence
# first, in batches. Each claim carries the card text the learner reads.
# Usage: python3 scripts/verification/full_pass_batches.py <out-dir> [batch-size]
import json, glob, os, re, sys
R = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
out = sys.argv[1]
size = int(sys.argv[2]) if len(sys.argv) > 2 else 40
sources = {s['id']: s for s in json.load(open(f'{R}/content/sources.json'))}
recs = {}
for r in json.load(open(f'{R}/content/verification.json')):
    recs.setdefault(r['factId'], []).append(r)

def card_text(c):
    parts = [c.get('headline'), c.get('body'), c.get('callout'), c.get('fact'), c.get('context'), c.get('caption')]
    parts += [f"{e.get('when')}: {e.get('label')}" for e in c.get('events', [])]
    parts += [f"{i.get('label')}: {'; '.join(i.get('points', []))}" for i in c.get('items', [])]
    return ' '.join(p for p in parts if p)[:900]

for d in sorted(glob.glob(f'{R}/content/skills/*')):
    skill = os.path.basename(d)
    cards = {}
    for p in glob.glob(f'{d}/levels/*.json'):
        lv = json.load(open(p))
        for c in lv['cards']:
            cards[c['id']] = (lv['number'], lv['title'], c)
    claims = []
    for concept in json.load(open(f'{d}/concepts.json')):
        for f in concept['facts']:
            rs = recs.get(f['id'], [])
            weak = any((r.get('factCheck') or {}).get('weak') for r in rs)
            fc_urls = [u for r in rs for u in (r.get('factCheck') or {}).get('urls', [])]
            claims.append({
                'factId': f['id'], 'text': f['text'], 'weak': weak,
                'sources': [{'id': s, 'title': sources[s]['title'], 'url': sources[s]['url']} for s in f['sourceIds'] if s in sources],
                'otherPages': list(dict.fromkeys(fc_urls))[:3],
                'shownOn': [{'card': cid, 'level': cards[cid][0], 'levelTitle': cards[cid][1], 'text': card_text(cards[cid][2])} for cid in f['cardIds'] if cid in cards],
            })
    # Weak first; then group by primary source so one page serves many claims.
    claims.sort(key=lambda c: (not c['weak'], c['sources'][0]['id'] if c['sources'] else '', c['factId']))
    os.makedirs(f'{out}/{skill}', exist_ok=True)
    for i in range(0, len(claims), size):
        json.dump(claims[i:i + size], open(f'{out}/{skill}/{i // size + 1:03d}.json', 'w'), indent=1, ensure_ascii=False)
    print(skill, len(claims), (len(claims) + size - 1) // size)
