"""Keep at most 4 Dr. Scroll asides per chapter, spread across it (run from brainscroll/ after a merge).

  python3 scripts/writing/thin_asides.py <skill>
"""
import json, sys

sk = sys.argv[1]
R = f'content/skills/{sk}/levels'
removed = 0
for c in range(10):
    withm = [n for n in range(c * 10 + 1, c * 10 + 11)
             if any('mascot' in k for k in json.load(open(f'{R}/{n:03d}.json'))['cards'])]
    if len(withm) <= 4:
        continue
    keep = set(withm[round(i * (len(withm) - 1) / 3)] for i in range(4))
    for n in withm:
        if n in keep:
            continue
        p = f'{R}/{n:03d}.json'
        d = json.load(open(p))
        for k in d['cards']:
            k.pop('mascot', None)
        with open(p, 'w') as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
            f.write('\n')
        removed += 1
print(sk, 'asides removed', removed)
