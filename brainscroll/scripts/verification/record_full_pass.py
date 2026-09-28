# Records the full claim review (docs/verification/full-pass/<skill>.jsonl) on
# every verification record of each claim, as `review`: verdict, method (page or
# knowledge), the page and a line of evidence. Never marks anything verified.
# Then run `npm run verify:flag-weak` so page-confirmed claims drop their weak tag.
# Usage: python3 scripts/verification/record_full_pass.py [reviewedAt] [file glob]
# e.g. the 2026-09-28 review of the ten new trees: ... 2026-09-28 '*.[ab].jsonl'
import json, glob, os, sys
R = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
when = sys.argv[1] if len(sys.argv) > 1 else '2026-09-26'
pattern = sys.argv[2] if len(sys.argv) > 2 else '*.jsonl'
results = {}
for f in glob.glob(f'{R}/docs/verification/full-pass/{pattern}'):
    for line in open(f, encoding='utf-8'):
        if line.strip():
            r = json.loads(line)
            results[r['factId']] = r
path = f'{R}/content/verification.json'
raw = open(path, encoding='utf-8').read()
ledger = json.loads(raw)
n = 0
for rec in ledger:
    r = results.get(rec['factId'])
    if not r:
        continue
    review = {'verdict': r['verdict'].lower(), 'method': r.get('method', 'knowledge'), 'reviewedAt': when}
    url = (r.get('url') or '').split(' ')[0]
    if url.startswith('http'):
        review['url'] = url
    if r.get('evidence'):
        review['evidence'] = r['evidence'][:400]
    rec['review'] = review
    n += 1
open(path, 'w', encoding='utf-8').write(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n')
print(f'recorded a review on {n} records ({len(results)} claims)')
