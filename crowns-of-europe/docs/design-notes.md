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
3. **Egypt, the Levant, the Caucasus, Mesopotamia and West Africa are in (added on request).** The doc scopes the
   map to Europe, Anatolia and the North African coast; 27 more regions add the Mamluk Sultanate (an AI-only
   major), the Aq Qoyunlu and Qara Qoyunlu, Georgia, Jolof, Mali and Songhai, and an uncolonized Guinea coast
   (Arguin to the Gold Coast) that anyone with a free colonist can settle from 1444, as Portugal did. Arabia,
   the Sahara and the African interior stay off-map wilderness; Persia lies past the map's east edge (the map
   builder treats land running off the edge as land, so Tabriz and Baghdad get no false coast).
4. **The New World is in (added after the first build, on request).** Only the eastern side of the Americas,
   in 46 coarse regions (a whole captaincy or colony each), plus the Atlantic islands and Iceland. The west of
   the continents is off-map wilderness (Inca Empire, Purépecha, Great Plains, Amazonia...). To fit both worlds
   the map switched from a Lambert projection centred on Europe to Mercator: north is up everywhere and shapes
   stay true, at the cost of a bigger Scandinavia. Colonization is a core system, not a side screen:
   - Discovery: the Americas are uncharted (no movement, fog on the map) until a crown with an ocean coast funds
     an expedition (from 1470, 100 gold, 8 months; the AI odds rise through the 1480s) or 1500 arrives.
   - Colonists: Portugal's Navigators trait, being first to the New World (30 years), Castile's Council of the
     Indies, the Overseas Charters policy (era 3) and, from era 3, big realms (30+ development) with an ocean coast.
     Few colonists in the 1500s keep the race Iberian at first; England, France and the Netherlands join later.
   - Colonies: 30 gold, then 1 gold a month; 9 settlers a month (+3 next to your land, policy +20%), slowed by
     natives (−7% per thousand, at most half), by being inland (−45%) and by every New World region you already
     own (−6% each, at most 60%: settlers spread thin); founded at 1,000 settlers (about 8–15 years). Natives with hostility attack
     (chance per month = natives × hostility × 0.25%, killing 50 + 25 × natives settlers); any regiment of yours in
     the region stops it. On founding the natives join the colony (+1 development per 3,000).
   - Trade goods pay value × (0.5 + 0.1 × development) a month (silver 2.0 … grain 0.4); colonies grow +1
     development every ~15 years up to 5. New World land counts half for the force limit.
   - Native nations can't make treaties, fight at half strength and 80% morale, never declare wars, and are holy
     war targets; land taken from them causes 30% of the usual Threat.
   - Armies board where your transports are and the fleet sails along with them (one fleet can carry an army across
     the ocean); open-ocean zones take 5–12 days each instead of 4.
5. **Sea movement:** an army boards in a sea zone where your idle transports have room for it and no stronger
   enemy fleet waits; the fleet then sails along with the army through further zones (unless a stronger enemy
   fleet bars one) and stays where it lands. Straits (Dover, Øresund, Bosphorus, Dardanelles, Messina, Gibraltar, Kerch, Bonifacio,
   North Channel) are crossable by land unless an enemy fleet outguns yours there.
6. **Recruiting takes 30 days** (the doc doesn't say); mercenaries arrive at once for three times the gold.
7. **Rulers can lead armies** as generals; if one falls in battle the heir succeeds.
8. **Tutorial:** short first-time hints ("your chancellor advises") and a How to Play page instead of a scripted
   20-minute tutorial. Portugal and Castile are marked "recommended for your first campaign".
9. **Audio is not in yet** (no assets). Haptics fire on selections and orders.
10. **Our own words for the numbers.** The doc borrowed the genre's usual names; the game says prosperity,
    levies, order, renown, leverage, army limit, integrated and exports instead (coalition, colonists, war
    exhaustion, policies and missions keep their names), explained in a "Words used in this game" list on the How to Play page. The
    code and the tables below keep the old names (see the glossary in `content-guide.md`).
11. **AI crowns follow history, loosely.** Each AI crown wants land: from its historical aims (`aims.json`,
    e.g. France wants Normandy, Gascony and Calais back; the Ottomans want Constantinople, then the Balkans, then
    the islands) and from the goals of its open missions. It forges claims on wanted land next to its own, likes
    wars against the holder better, asks for that land first at the peace table and dislikes the holder. Old
    friendships and enmities (the Auld Alliance, Poland and the Order) add ±25 opinion. Nothing is scripted: a
    weak France still loses, and a strong England may keep Normandy. The nation sheet shows what a crown wants.

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
| Expedition west | 100 gold, 8 months, from 1470; everyone knows the way by 1500 |
| Colony | 30 gold + 1 gold/month; 1,000 settlers at 9/month (+3 next to your land), −7% per thousand natives, −45% inland, −6% per New World region owned |
| Trade goods | value × (0.5 + 0.1 × development): silver 2.0, gold 1.8, sugar 1.1, tobacco/cocoa 0.9, dyes 0.8, furs 0.7, fish 0.6, grain 0.4 |

## Status

Verified: `npm run check` (typecheck, lint, content validation, 28 simulation tests including colonies, ocean
convoys, native battles, a 25-year AI soak and save/load determinism) and three Playwright walkthroughs of the web
build at iPhone size (title, nation picker, map, every sheet and menu tab, war declaration, marching through a
strait, sieges, events, offers, peace screen, map modes; the uncharted Atlantic, an expedition, discovery, a colony,
the Colonies tab, trade goods and an army crossing to Brazil) with no runtime errors. The simulation runs at about
2.8 ms per day on a laptop (the bigger map and ocean routes cost about 0.8 ms more than before).

Not yet done:

- **Run it on a physical phone.** Gestures (pinch around the fingers, pan, tap) and SVG performance have only
  been checked in a browser. Test on a small phone (iPhone SE size) early, as the design doc asks.
- Audio (period music, battle and UI sounds).
- Balance passes over full 300-year campaigns: AI expansion pace, coalition frequency, late-game income, and the
  colonial race (in AI-only games the coasts are mostly settled by about 1600–1650, faster than history).
- AI navies: the AI rarely builds transports, so overseas wars are mostly fought by troops raised in the colonies.
- Store assets, bundle identifier (`com.crownsofeurope.app` is a placeholder) and EAS configuration.
