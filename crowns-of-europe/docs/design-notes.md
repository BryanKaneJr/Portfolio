# Design notes: decisions, numbers and status

The original design document ("Crowns of Europe — Game Design Doc") is the source of truth except where noted
here.

## Decisions that differ from the design doc

1. **Expo + React Native + TypeScript instead of Godot 4.** It matches the other apps in this repository
   (same SDK, CI and EAS pipeline), runs in Expo Go and in a browser, and lets the whole simulation be tested
   headlessly with Jest and the UI with Playwright. The simulation is plain TypeScript with no UI imports and
   all content is JSON, as the doc asks, so a port stays possible.
2. **133 regions instead of ~75.** The doc's own roster (14 majors, 8 harder picks, ~25 minors) needs about
   100+ regions for majors to have room and minors to have one each. Germany and Italy are the dense parts; the
   map shows nation names when zoomed out and region names from about 1.2× zoom. Merging regions is a data
   change (`regions.json`, then `npm run map:build`).
3. **Egypt and the Levant are off-map** ("Mamluk Sultanate", shaded like the Sahara, Lapland and the Caucasus).
   The doc scopes the map to Europe, Anatolia and the North African coast.
4. **Sea movement:** armies cross a sea zone only where you have transports with enough capacity and no
   stronger enemy fleet. Straits (Dover, Øresund, Bosphorus, Dardanelles, Messina, Gibraltar, Kerch, Bonifacio,
   North Channel) are crossable by land unless an enemy fleet outguns yours there.
5. **Recruiting takes 30 days** (the doc doesn't say); mercenaries arrive at once for three times the gold.
6. **Rulers can lead armies** as generals; if one falls in battle the heir succeeds.
7. **Tutorial:** short first-time hints ("your chancellor advises") and a How to Play page instead of a scripted
   20-minute tutorial. Portugal and Castile are marked "recommended for your first campaign".
8. **Audio is not in yet** (no assets). Haptics fire on selections and orders.

## Key numbers (all in `src/sim/`)

| Thing | Value |
| --- | --- |
| Speeds | 1.5 / 3 / 6 days per second |
| Tax | 0.3 gold per development per month × (1 + 5%/stability + ruler skill − 3 × 5% + modifiers); half for non-cores |
| Trade centres | 1.2 + 0.12 × development per month |
| Manpower | 3,000 + 400 per development (half for non-cores); recovers 1/60 of the maximum per month |
| Force limit | 6 + development / 2.5 regiments; upkeep rises above it |
| Upkeep | infantry 0.18, cavalry 0.36, artillery 0.42 gold/month (half in peacetime pay) |
| Battle | daily d10 + general pip difference; attacker −1 in rough terrain (−2 mountains, −1 river); damage = roll × front-line power; casualties = damage × 6; morale loss = damage × 0.069 / regiments |
| Front width | plains 20, forest and hills 14, marsh 12, mountains 10 |
| Stack wipe | winner's men ≥ 5 × loser's remaining men |
| Sieges | 15 days without a fort; 75 days per fort level, +10% speed per artillery regiment (max +150%) |
| Supply | 10/7/7/5/5 by terrain + 0.8 × development (+3 in friendly land), × 0.6 in northern/eastern winters |
| Threat | +2.5 × development per region taken (× 0.6 if claimed); decays 0.12 + prestige/500 per month; coalitions form at 40 felt Threat with 3+ members |
| Peace cost | 3% per development per region (× 0.7 if claimed), 2% per development to vassalize, 1% per 10 gold |
| Development cost | 20 + 8 × (dev + 1)^1.5 gold, +5% per level already bought |
| Era adoption | 250 / 500 / 800 gold × (0.6 + development / 80) |

## Status

Verified: `npm run check` (typecheck, lint, content validation, 20 simulation tests including a 25-year AI soak
and save/load determinism) and two Playwright walkthroughs of the web build at iPhone size (title, nation
picker, map, every sheet and menu tab, war declaration, marching through a strait, sieges, events, offers,
peace screen, map modes) with no runtime errors. The simulation runs at about 2 ms per day on a laptop.

Not yet done:

- **Run it on a physical phone.** Gestures (pinch around the fingers, pan, tap) and SVG performance have only
  been checked in a browser. Test on a small phone (iPhone SE size) early, as the design doc asks.
- Audio (period music, battle and UI sounds).
- Balance passes over full 300-year campaigns: AI expansion pace, coalition frequency, late-game income.
- Store assets, bundle identifier (`com.crownsofeurope.app` is a placeholder) and EAS configuration.
