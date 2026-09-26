# Writes docs/verification/spot-check/<skill>.md: two random claims per chapter per tree for
# the owner to check against their sources. Seeded per skill, so reruns give the same picks.
# Usage: python3 scripts/verification/spot_check.py
import json, glob, random, re, os
R=os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT=R+'/docs/verification/spot-check'
sources={s['id']:s for s in json.load(open(R+'/content/sources.json'))}
records=json.load(open(R+'/content/verification.json'))
PER_CHAPTER=2
index=[]
for sk_dir in sorted(glob.glob(R+'/content/skills/*')):
    skill=os.path.basename(sk_dir)
    meta=json.load(open(sk_dir+'/skill.json'))
    name=meta.get('name', skill)
    syl=json.load(open(sk_dir+'/syllabus.json'))
    chapters={c['number']:c['title'] for c in syl.get('chapters',[])}
    levels={}
    for p in glob.glob(sk_dir+'/levels/*.json'):
        l=json.load(open(p)); levels[l['number']]=l['title']
    facts={}
    for c in json.load(open(sk_dir+'/concepts.json')):
        for f in c['facts']: facts[f['id']]=f
    def first_level(f):
        ns=[int(m.group(1)) for cid in f['cardIds'] if (m:=re.search(r'\.(\d{3})\.c\d+$',cid))]
        return min(ns) if ns else None
    by_ch={}
    for r in records:
        f=facts.get(r['factId'])
        if not f or r['sourceId'] not in sources: continue
        n=first_level(f)
        if n is None: continue
        by_ch.setdefault((n-1)//10+1,[]).append((n,r,f))
    rng=random.Random('brainscroll-spot-check-'+skill)
    items=[]
    for ch in sorted(by_ch):
        pool=by_ch[ch][:]; rng.shuffle(pool); picked=[]
        for cand in pool:  # prefer different levels and sources
            if all(cand[0]!=p[0] and cand[1]['sourceId']!=p[1]['sourceId'] for p in picked): picked.append(cand)
            if len(picked)==PER_CHAPTER: break
        for cand in pool:
            if len(picked)==PER_CHAPTER: break
            if cand not in picked: picked.append(cand)
        items+= [(ch,)+x for x in sorted(picked,key=lambda x:x[0])]
    lines=[f'# Spot check: {name}','',
      f'{len(items)} claims from **{name}**, two picked at random from each chapter. For each one: open the source, check it says what the claim says, and tick a box. If it\'s wrong or the page doesn\'t say it, tick the second box and note what the source actually says. About a minute each.','',
      '**What happens next (proposal):** if every claim checks out, or one is wrong and gets fixed, the tree is approved to publish on its automated fact-checks. If two or more are wrong, I recheck the whole tree before asking again. The claims you tick are recorded as verified by you; the rest are recorded as approved by sample, not as individually verified.','',
      'Leave the `<!-- id -->` lines as they are: they tell me which record each answer belongs to.','']
    for i,(ch,n,r,f) in enumerate(items,1):
        s=sources[r['sourceId']]
        fc=r.get('factCheck') or {}
        lines+=[f'## {i}. Level {n}: {levels.get(n,"")}', f'<sub>Chapter {ch}: {chapters.get(ch,"")}</sub>','',
                f'> {f["text"]}','',
                f'**Source:** [{s["title"]}]({s["url"]}) ({s["publisher"]})']
        extra=[u for u in fc.get('urls',[]) if u!=s['url']]
        host=lambda u: re.sub(r'^https?://(www\.)?','',u).split('/')[0]
        if extra: lines.append('<sub>Also found on: '+', '.join('['+host(u)+']('+u+')' for u in extra[:3])+'</sub>')
        lines+=['','- [ ] The source supports this','- [ ] Wrong, or not on the page. The source says: ',f'<!-- {r["factId"]} | {r["sourceId"]} -->','']
    fname=f'{skill}.md'
    open(f'{OUT}/{fname}','w').write('\n'.join(lines))
    index.append((name,fname,len(items)))
readme=['# Source spot checks','',
 'One checklist per tree. Each samples two claims from every chapter so a small check says something about the whole tree (see `docs/specs/CURRENT_PRODUCT_DECISIONS.md` for how results are used once decided).','',
 '| Tree | Claims |','| --- | --- |']+[f'| [{n}]({f}) | {c} |' for n,f,c in index]+['',f'{sum(c for _,_,c in index)} claims in all.','']
open(f'{OUT}/README.md','w').write('\n'.join(readme))
print(index)
