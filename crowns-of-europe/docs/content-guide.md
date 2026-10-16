# Content guide: events, missions and achievements

All game content is JSON in `src/content/`. Run `npm run validate` after every edit; it checks ids, references
and the condition/effect language below. The schema lives in `src/sim/dsl.ts` and the evaluator in
`src/sim/events.ts`; if you need a new condition or effect, add it to both and to this guide.

| File | What |
| --- | --- |
| `regions.json` | 246 land regions: id, name, 1444 owner (`null` = uncolonized), terrain, development (1-10), fort (0-3), faith, HRE, trade; New World regions have `nw` (uncharted until discovery); uncolonized and New World regions have `natives` (thousands), `hostility` (0-3) and an export `good` (the African coast is uncolonized but not `nw`, so it is open from 1444) |
| `nations.json` | 76 nations: tag, name, colour, faith, capital, government, AI personality, national trait, ruler, heir; New World peoples have `native: true` and the `native` faith |
| `seas.json` | Sea zones (`ocean`, `nw`, `closed`, `charted` for a closed sea still drawn as water, `days` to cross), straits, wildernesses, the Great Lakes, sea links and rivers (all map seeds) |
| `scenario1444.json` | Starting claims (each with its historical reason and the year it lapses), alliances, subjects, rivals, truces, marriages, HRE emperor and electors |
| `events-historical.json` | Historical events (fire when conditions match, not on fixed dates) |
| `events-generic.json` | Generic events (any nation) and era flavour events |
| `events-newworld.json` | Discovery, colonies, natives and the colonial powers |
| `missions.json` | Mission trees per major nation, plus a `generic` set for everyone else |
| `achievements.json` | Local achievements checked for the player |
| `traits.json`, `policies.json`, `units.json` | National/ruler traits, policies, unit stats per troops' age |
| `advances.json` | The 12 advances of science (three tracks of four), each nation's learning speed and the advances known in 1444 |

## Writing rules

- **Original text only.** History, dates, people and places are public domain; other games' wording, names for
  mechanics and art are not. Player-facing text uses our own words (table below); `npm run validate` runs
  `scripts/check-terms.ts`, which fails on the borrowed ones in UI strings, log messages and content prose.
  DSL keys and state fields keep their old names (`stability`, `prestigeAtLeast`, `devRegion`...): only what a
  player reads changes.

  | Internal name (DSL key, state field) | The player reads |
  | --- | --- |
  | development, `dev`, `devRegion`, `devAtLeast` | **prosperity** ("raise prosperity", "prosperity 7") |
  | manpower | **levies** |
  | stability | **order** (−3 to +3, written "order +2") |
  | prestige | **renown** |
  | war score | **leverage** |
  | force limit | **army limit** |
  | core, `addCore`, `coreCost` | **integrated** / **integrate** |
  | trade good, `good` | **export** |
  | stack wipe | annihilated |
  | a general's fire, shock and maneuver | none: a general has **1-5 stars** (`stars`), each +10% to all the army does |
  | fire and shock phases of a battle | **volleys** (the guns tell) and **charges** (the horse tells) |
  | assault (taking a fort by force) | **Storm the walls** |
  | humiliate (a peace term) | **Humble them** |
  | war reparations (a peace term) | **Reparations** (a tenth of the loser's income for 10 years) |
  | harsh treatment | **Crack down** |
  | seize land | **Seize estates** |
  | monument | **landmark** |
  | national focus | **Endowment** / **endow** (one field of learning) |
  | Threat, Claim, Era, Papal Favor, coalition, colonists, war exhaustion, policy, mission, golden age, abdicate | unchanged |

- **Plain English, short.** Event text is 2-4 sentences (max 420 characters). Titles max 42 characters. Choice
  buttons max 60 characters and start with a verb ("Pay the ransom", "Let them rot").
- **Every choice is a real choice.** If one option is strictly better, rewrite it. Typical trade-offs: gold vs
  order, renown vs Threat, short-term troops vs long-term prosperity.
- **Alt-history allowed.** Historical events check conditions, not dates. "Fall of Constantinople" needs the
  Ottomans at war with Byzantium near the city, so in some games it never happens.
- Address the player as "you" / "your" and write in the present tense.

### Balance yardsticks

| Thing | Typical size |
| --- | --- |
| Monthly income | small nation 3-6 gold, mid 8-15, great power 20-40 |
| One-off gold in an event | 25-150, or `goldPerDev` 1-4 (scales with the nation) |
| Stability | -3..+3; events move it by 1, rarely 2 |
| Prestige | 0..100; events give/take 5-25 |
| Threat | how alarming you are; +10-30 is a lot |
| Manpower | 1,000 men = one regiment; events give 2,000-10,000 |
| Timed modifiers | 12-120 months, each value within about ±0.25 (opinion/diplomacy are flat numbers) |

## Events

```json
{
  "id": "fall_of_constantinople",
  "pool": "historical",
  "title": "The Queen of Cities Falls",
  "text": "Our guns have broken the Theodosian walls...",
  "image": "siege",
  "nations": ["TUR"],
  "window": [1450, 1520],
  "mtth": 1,
  "once": true,
  "news": "Constantinople has fallen to the Ottomans.",
  "trigger": { "all": [{ "owns": "constantinople" }, { "not": { "flag": "constantinople_fell" } }] },
  "choices": [
    { "text": "Make it our capital", "effects": [{ "prestige": 25 }, { "setFlag": "constantinople_fell" }], "ai": 3 },
    { "text": "Sack the city", "effects": [{ "goldPerDev": 3 }, { "devRegion": { "region": "constantinople", "amount": -2 } }] }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | snake_case, unique across both event files |
| `pool` | `historical`, `generic` or `era` |
| `image` | one of: crown, swords, siege, ship, church, plague, harvest, scroll, coins, castle, cannon, treaty, book, rebels, marriage, death, horse, map |
| `nations` | optional: only these tags can get it |
| `window` | optional `[fromYear, toYear]`, inclusive |
| `mtth` | mean months until it fires once eligible (default 36). 1 = next month. |
| `once` | fires at most once per game. Defaults to true for historical/era, false for generic |
| `news` | optional: shown to the player as a news line when an AI nation gets the event |
| `hidden` | only fires through `triggerEvent` (chains). Its trigger is still checked when it comes due |
| `onPeace` | optional: also checked on the day any peace is signed (no roll), so a conquest's follow-up ("The Fall of Granada") comes the day the land changes hands, not at the next month |
| `trigger` | a condition (below) for "this nation" |
| `choices` | 1-3 options. `ai` is a relative weight for AI picks (default 1) |

How the engine fires events: once a month, each living nation gets at most one event. An event is eligible when
it isn't hidden, the year is inside its window, the nation is in `nations` (if set), its trigger is true and
(for once-events) it hasn't fired. Each eligible event rolls 1/`mtth`. A nation gets a generic event at most once
every 14 months, and the same generic card at most once in 10 years. The player sees a card with the effects listed under each choice; AI nations pick by weight.

Chains: a choice can `triggerEvent` a hidden event some months later. Use flags (`setFlag` /
`setNationFlag`) to remember what happened.

## Conditions

Every condition is an object with exactly one key. Evaluated for "this nation" (the one getting the event or
owning the mission).

| Condition | True when |
| --- | --- |
| `{ "all": [c, ...] }` / `{ "any": [...] }` / `{ "not": c }` | logic |
| `{ "year": [1500] }` / `{ "year": [1500, 1550] }` | current year ≥ min (and ≤ max) |
| `{ "isNation": "FRA" }` / `{ "isNation": ["FRA", "ENG"] }` | this nation is one of these |
| `{ "isPlayer": true }` | this nation is (not) the player |
| `{ "owns": "granada" }` / `{ "owns": ["a", "b"] }` | owns all listed regions |
| `{ "ownsAny": ["a", "b"] }` | owns at least one |
| `{ "controls": "rome" }` | holds the region right now (owns it and it isn't occupied, or occupies it) |
| `{ "nationOwns": { "nation": "BYZ", "region": "constantinople" } }` | another nation owns a region |
| `{ "exists": "BYZ" }` | that nation still exists |
| `{ "atWar": true }` | at war with anyone |
| `{ "atWarWith": "BYZ" }` | on opposite sides of a war with that nation |
| `{ "truceWith": "TUR" }` | has a truce with that nation |
| `{ "faith": "catholic" }` | this nation's faith (catholic, orthodox, muslim, protestant, native) |
| `{ "nationFaith": { "nation": "ENG", "faith": "protestant" } }` | another nation's faith |
| `{ "stability": [1] }` / `{ "stability": [-3, -1] }` | stability in range |
| `{ "goldAtLeast": 100 }`, `{ "prestigeAtLeast": 50 }`, `{ "threatAtLeast": 40 }` | resources |
| `{ "regionsAtLeast": 10 }` | owns at least N regions |
| `{ "regimentsAtLeast": 40 }` | has at least N regiments in its armies |
| `{ "devAtLeast": 60 }` | total development of owned regions |
| `{ "capitalDevAtLeast": 9 }` | development of the capital |
| `{ "allied": "HUN" }`, `{ "alliesAtLeast": 2 }` | alliances |
| `{ "borders": "FRA" }` | shares a land border (or strait) with that nation |
| `{ "rulerSkill": [4] }`, `{ "rulerAgeAtLeast": 60 }`, `{ "hasHeir": false }` | ruler |
| `{ "eraAtLeast": 2 }` | has adopted that era (1 Late Medieval, 2 Renaissance, 3 Wars of Religion, 4 Absolutism) |
| `{ "flag": "reformation" }` | a global flag is set |
| `{ "nationFlag": "embraced_reform" }` | this nation has set a flag |
| `{ "loansAtLeast": 3 }` | debt |
| `{ "isEmperor": true }`, `{ "isElector": true }`, `{ "hreMember": true }` | Holy Roman Empire (member = capital in the Empire) |
| `{ "subjectOf": "DAN" }` / `{ "subjectOf": true }` | is a vassal or junior union partner (of that nation / of anyone) |
| `{ "overlordOf": "SWE" }` / `{ "overlordOf": true }`, `{ "vassalsAtLeast": 2 }` | has subjects |
| `{ "regionFaith": { "region": "saxony", "faith": "protestant" } }` | a region's faith |
| `{ "faithRegionsAtLeast": { "faith": "protestant", "count": 10 } }` | regions of that faith on the whole map |
| `{ "gov": "republic" }`, `{ "tier": "major" }`, `{ "hasPolicy": "standing_army" }`, `{ "hasAdvance": "bombards" }` | misc |
| `{ "warsWonAtLeast": 1 }`, `{ "battlesWonAtLeast": 5 }`, `{ "stackWipesAtLeast": 1 }`, `{ "bestWinRatioAtLeast": 5 }`, `{ "regionsConqueredAtLeast": 10 }` | this nation's record |
| `{ "fleetsAtLeast": 1 }`, `{ "shipsAtLeast": 20 }`, `{ "coastal": true }` | navy |
| `{ "inCoalition": true }`, `{ "coalitionAgainst": true }` | member of a coalition / a coalition targets this nation |
| `{ "papalFavorAtLeast": 50 }` | Catholic Papal Favor (0-100) |
| `{ "discovered": true }` | the New World has (not) been found |
| `{ "coloniesAtLeast": 3 }` | owns at least N regions in the New World (founded colonies and conquests) |
| `{ "colonizingAtLeast": 1 }` | has at least N colonies being settled right now |
| `{ "ownsGood": "silver" }` | owns a region trading in that good (silver, gold, ivory, sugar, tobacco, cocoa, dyes, furs, fish, grain) |
| `{ "native": true }` | this nation is a New World people |
| `{ "chance": 0.5 }` | random each time it is checked (use rarely) |

## Effects

Applied to "this nation" unless the effect names another.

| Effect | Does |
| --- | --- |
| `{ "gold": 100 }` / `{ "gold": -50 }` | gold (can go negative; the treasury takes loans automatically) |
| `{ "goldPerDev": 2 }` | gold × total development (scales with nation size; negative allowed). Cards show the coins, worked out for the realm now ("Pay 84 gold"), never the formula (`effectDelta` in events.ts) |
| `{ "manpower": 5000 }` | men |
| `{ "stability": 1 }` | -3..+3 |
| `{ "prestige": 10 }` | 0..100 |
| `{ "science": 200 }` | science added toward the next advance |
| `{ "threat": -10 }` | Threat (never below 0) |
| `{ "papalFavor": 10 }` | Catholics only, 0..100 |
| `{ "warExhaustion": 2 }` | 0..20 |
| `{ "addClaim": "granada" }` / list | permanent claim (lets you declare war) |
| `{ "addCore": "granada" }` / list | core (full value from an owned region; a claim that never expires otherwise) |
| `{ "devRegion": { "region": "flanders", "amount": 1 } }` | development (1..10) of any region |
| `{ "devCapital": 1 }` | development of this nation's capital |
| `{ "fortRegion": { "region": "rhodes", "amount": 1 } }` | fort level (0..3) |
| `{ "unrestAll": 2 }` | +unrest in all own regions for 24 months (negative calms) |
| `{ "unrestRegion": { "region": "bohemia", "amount": 3 } }` | +unrest in one region for 24 months |
| `{ "convertRegion": { "region": "saxony", "faith": "protestant" } }` | change a region's faith |
| `{ "changeFaith": "protestant" }` | this nation's faith |
| `{ "setFlag": "x" }`, `{ "clearFlag": "x" }`, `{ "setNationFlag": "x" }` | flags |
| `{ "modifier": { "id": "x", "name": "Shown name", "months": 60, "mods": { "taxIncome": 0.1 } } }` | timed modifier (months ≤ 0 = permanent). Keys: taxIncome, tradeIncome, manpower, morale, infantryPower, cavalryPower, artilleryPower, fortDefense, siegeSpeed, attrition, upkeep, mercCost, devCost, coreCost, fortCost, shipCost, navalPower, threatDecay, threatGain, opinion, diplomacy, holyWarMorale, unrest, techCost, movement, prestigeGain, stabilityCost, colonists (flat: +1 = one more colonist), settlerGrowth, science, forceLimit (army limit), warTechCost (cost of war advances) (fractions) |
| `{ "removeModifier": "x" }` | remove one |
| `{ "rebels": { "regiments": 6, "region": "bohemia" } }` | rebel army (region defaults to the capital) |
| `{ "addRegiments": { "inf": 4, "cav": 2, "region": "castile" } }` | free army at full strength (region defaults to capital) |
| `{ "hireGeneral": { "stars": 4, "name": "Gonzalo de Córdoba" } }` | free general with 1-5 stars (each +10% to everything the army they lead does); the famous few get 5 |
| `{ "opinion": { "nation": "HUN", "amount": 25 } }` | how that nation feels about this one (decays over time) |
| `{ "ally": "HUN" }`, `{ "breakAlliance": "HUN" }` | alliances |
| `{ "personalUnion": "LIT" }` | that nation becomes this nation's junior partner |
| `{ "inherit": "LIT" }` | this nation absorbs that nation entirely |
| `{ "independence": true }` | this nation breaks free of its overlord |
| `{ "releaseSubject": "SWE" }` | a subject of this nation becomes independent |
| `{ "transferRegion": { "region": "calais", "to": "FRA" } }` | change a region's owner |
| `{ "newRuler": { "name": "Mehmed II", "skill": 5, "traits": ["ambitious"], "age": 19 } }` | replace the ruler |
| `{ "rulerSkill": 1 }`, `{ "rulerTrait": "warrior" }`, `{ "killRuler": true }` | ruler (killRuler: the heir succeeds) |
| `{ "newHeir": { "name": "Charles", "skill": 3 } }` | set the heir |
| `{ "triggerEvent": { "id": "next_step", "months": 6 } }` | schedule an event for this nation (or `"nation": "TAG"`) |
| `{ "reformation": 4 }` | up to N Catholic regions in the Empire, Scandinavia, Britain, Bohemia and the Baltic turn Protestant |
| `{ "declareWar": { "target": "BYZ", "cb": "claim", "region": "constantinople" } }` | this nation declares war |
| `{ "declareWar": { "target": "TUR", "cb": "holy", "with": ["POL", "VEN"] } }` | ...and leads a league: the listed crowns join if they are independent, at peace with the target's side, not allied to it and have no truce with it |
| `{ "loans": 2 }` | take loans (+100 gold each, with interest) |
| `{ "emperor": true }` | this nation becomes Holy Roman Emperor |
| `{ "discoverNewWorld": true }` | this nation finds the New World (if no one has yet): prestige, a colonist for 30 years, and the nation flag `found_new_world` |
| `{ "settlers": 200 }` | settlers added to each of this nation's colonies being settled (negative removes; a colony is founded at 1,000). For something empire-wide, like a royal charter |
| `{ "settlersOne": -150 }` | settlers added to one of this nation's colonies being settled, picked at random (negative removes; the player is told which). For something that happens in one place: a hurricane, a fever, a good harvest, a raid |

Ruler traits: warrior, administrator, diplomat, pious, spendthrift, cruel, just, craven, scholar, ambitious,
feeble, shrewd, builder, merchant.

## Missions

```json
{
  "id": "cas_fall_of_granada",
  "nation": "CAS",
  "title": "The Fall of Granada",
  "desc": "Take the last Muslim kingdom in Iberia.",
  "requires": ["cas_unite_the_crowns"],
  "goal": { "owns": "granada" },
  "reward": [{ "prestige": 15 }, { "addClaim": ["fez", "tlemcen"] }]
}
```

Each major nation, and the Middle Eastern and West African minors (Aq Qoyunlu, Qara Qoyunlu, Georgia, Jolof,
Mali, Songhai), has 6-10 missions in a short tree (at most 3 branches; `requires` lists missions of the same
nation). The `generic` set is used by every nation without its own. Mission titles are at most 36 characters. A mission is claimable once its requirements
are done and its goal is true; the player taps "Complete" to collect the reward.

Missions also steer the AI: the regions named in an open mission's goal
(`owns`, `ownsAny`, `controls`) are land that nation wants (see aims below), so write goals for the land a crown
historically went after.

## Science (`advances.json`)

```json
{ "id": "bombards", "name": "Bombards", "field": "war", "year": 1450, "cost": 700, "requires": [], "desc": "...", "unlock": "artillery" }
```

Each advance has a `field` (war, sea, state: each field is a track of four, shown in order of `year`), the
`year` the most learned crowns had it, a base `cost` in science, `requires` (the previous advance in its track), and what it gives: `mods`, an `unlock` (artillery, warships,
coastColonies, oceanColonies; exactly one advance each) and/or `armyEra` (the troops' age, 2-4). `learning`
sets each nation's speed (default 1) and `start` the advances crowns know in 1444. Policies can name an advance
in `requires`, and ships in units.json an `advance`. After changing costs, check the timing with an AI game:
the first crown to learn each advance should do so near its `year`. Use `hasAdvance` in conditions and
`science` in effects.

## Claims of 1444 (`scenario1444.json`)

```json
"claims": { "CAS": [{ "region": "granada", "until": 1500, "why": "The Reconquista" }] }
```

A **starting claim** gives a crown a reason for war on whoever holds the region from the first day until 1 January
of `until`: the year its quarrel was settled in history, or by which it had to be pressed. The war screen shows
`why` and the year under the claim, and the realm menu and the region sheet show it too. A claim forged in play
lasts 25 years and has no story, and a claim of 1444 granted again by an event or the Pope (for ever) loses its
story. Keep the list short: the AI presses every claim it can win, so each one is a likely war. Only quarrels
fought over within a generation of 1444, at most four a crown, never on the claimant's own land, `until` after
1444 and at most 1700, `why` at most 48 characters (all checked by `npm run validate`).

## Historical aims and bonds (`aims.json`)

```json
{ "id": "fra_english_out", "nation": "FRA", "title": "Drive the English out of France", "regions": ["normandy", "gascony", "calais"], "until": 1700 }
{ "a": "FRA", "b": "SCO", "kind": "friends", "label": "The Auld Alliance", "until": 1560 }
```

An **aim** is land an AI crown wants while the years fit (`from` inclusive, `until` exclusive, both optional) and
it lacks some of the regions. The player's nation ignores aims (it has missions). Wanted land, from aims (weight 2)
and from open missions (weight 1), makes the AI forge claims on it when it borders it, prefer wars against whoever
holds it (higher score, 15% less strength needed), demand it first in peace deals, and think less of the holder
(−12 −8 per region held, at most −40, aims only). A **bond** gives both crowns +25 (friends) or −25 (foes) opinion
while its years fit, which also steers rivalries, and counts again in alliance talks (+25 friends, −50 foes). The
nation sheet shows a crown's aims and bonds under "What they want". Titles at most 48 characters, labels at most 40.

## Achievements

```json
{ "id": "five_to_one", "title": "Overwhelming Force", "desc": "Win a battle with five times the enemy's strength.", "goal": { "bestWinRatioAtLeast": 5 } }
```

Checked for the player each month; `nations` limits one to specific starting nations.

## Greater crowns (`formables.json`)

```json
{ "id": "SIC", "name": "Two Sicilies", "adj": "Sicilian", "color": "#4fa799", "inherits": "NAP",
  "flag": { "pattern": "quarterly", "colors": ["#2a4c9c", "#e8c547"], "charge": "lis", "charge2": "eagle", "stylised": true },
  "regions": ["naples", "abruzzo", "apulia", "calabria", "sicily", "messina"], "key": ["naples", "sicily"], "need": 5, "formers": ["NAP"],
  "claims": ["sardinia", "romagna"], "mods": { "tradeIncome": 0.15 },
  "bonus": "grain, silk and the Strait of Messina pay the crown.", "blurb": "…", "history": "…" }
```

- `id`: three capitals, never a nation tag. `name` drops a leading "the" (log lines start with it); `crowns.ts`
  `THE` lists the crowns that read with "the" mid-sentence.
- `color` (optional): its map colour; leave it out to keep the proclaimer's own. `inherits` (optional): the realm
  whose colour it takes after; the crown's colour shows only if that realm proclaimed it or is gone. A crown colour
  must be at least 0.045 (OKLab) from every realm's but its `inherits` (`tests/map.test.ts`).
- `flag`: as a nation's (any pattern in `charges.ts`, including `tiercedPale`, three upright bands).
- `regions`: its lands; `key`: those it cannot be proclaimed without; `need`: how many lands (at least the keys).
- `formers`: who may proclaim it: nation tags, or smaller crowns (fewer lands) that lead on to it.
- `from` (optional): the first year. `playerOnly` (optional): never proclaimed by the computer.
- `claims` (optional): extra 25-year claims on proclaiming, beyond its own lands.
- `mods`: one lasting bonus (modifier keys as in effects). `bonus`: the line shown after it, lower case.
  `blurb`: what it is, in a sentence. `history`: the real story, in small print.
- Achievements see a proclaimed crown as the nation flag `crown_<ID>` (`{ "nationFlag": "crown_SIC" }`).
- The validator checks that lands, keys and claims exist, `need` is in range, formers are realms or smaller
  crowns, the arms exist, and no crown without `from` can be proclaimed by a former on the first day.

## Landmarks (`landmarks.json`)

```json
{ "id": "st_peters", "region": "rome", "name": "St Peter's", "mods": { "opinion": 10 },
  "text": "Pilgrims from every Christian land come to the Apostle's tomb." }
```

- A famous place that gives its one bonus to whoever holds the region (not while it is occupied). Nothing to build
  or pay. At most one landmark per region.
- `mods`: exactly one modifier key (as in effects), about the size of one policy's bonus.
- Its picture is the owner's painting `art/landmarks/<id>.png` (named by the landmark's `id`): the building alone on a
  transparent ground, in the same warm gold and sepia as the others, any size (they are 1024 x 1024). Run
  `npm run landmarks:build`: it cuts it to what is painted, makes it 192 px on its longer side into
  `assets/landmarks/<id>.png` and lists it in `src/ui/map/landmarkArt.ts` (generated; never edit it). The map sizes
  it by its own proportions, so a tall tower or a wide temple both work; there is no path data to draw.
- `text`: one line of real history, at most 90 characters; the region sheet adds "It goes to whoever holds the
  region."
- The validator checks the region, one landmark per region, one known modifier, a baked picture for its id, a name
  and the text's length. `tests/landmarks.test.ts` checks that every picture stands inside its own region on the map,
  clear of its name, its army and the other landmarks, by its own town rather than a neighbour's, at every zoom, at
  its own proportions. A new landmark in a crowded corner may need its region's spot checked in the app.

