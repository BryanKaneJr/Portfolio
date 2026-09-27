#!/bin/bash
# usage: get.sh URL name  -> saves text to pages/name.txt
W=/tmp/claude-0/-home-user-Portfolio/a4afda10-98d5-5523-937d-7d24e22d8dc1/scratchpad/drafts/arts.film_tv-ch8
curl -sSL --max-time 40 -A 'BrainScroll content review' "$1" | python3 -c "
import sys,re,html
t=sys.stdin.read()
t=re.sub(r'(?is)<(script|style|noscript).*?</\1>',' ',t)
t=re.sub(r'(?s)<[^>]+>','\n',t)
t=html.unescape(t)
t=re.sub(r'[ \t]+',' ',t)
t=re.sub(r'\n\s*\n+','\n',t)
print(t)
" > $W/pages/$2.txt
wc -c $W/pages/$2.txt
