# Content guide: events, missions and achievements

All game content is JSON in `src/content/`. Run `npm run validate` after every edit; it checks ids, references
and the condition/effect language below. The schema lives in `src/sim/dsl.ts` and the evaluator in
`src/sim/events.ts`; if you need a new condition or effect, add it to both and to this guide.

| File | What |
| --- | --- |
| `regions.json` | 184 land regions: id, name, 1444 owner (`null` = uncolonized), terrain, development (1-10), fort (0-3), faith, HRE, trade; New World regions also have `nw`, `natives` (thousands), `hostility` (0-3) and a trade `good` |
| `nations.json` | 66 nations: tag, name, colour, faith, capital, government, AI personality, national trait, ruler, heir; New World peoples have `native: true` and the `native` faith |
| `seas.json` | Sea zones (`ocean`, `nw`, `closed`, `days` to cross), straits, wildernesses, the Great Lakes, sea links and rivers (all map seeds) |
| `scenario1444.json` | Starting claims, alliances, subjects, rivals, truces, marriages, HRE emperor and electors |
| `events-historical.json` | Historical events (fire when conditions match, not on fixed dates) |
| `events-generic.json` | Generic events (any nation) and era flavour events |
| `events-newworld.json` | Discovery, colonies, natives and the colonial powers |
| `missions.json` | Mission trees per major nation, plus a `generic` set for everyone else |
| `achievements.json` | Local achievements checked for the player |
| `traits.json`, `policies.json`, `units.json` | National/ruler traits, era policies, unit stats per era |

## Writing rules

- **Original text only.** History, dates, people and places are public domain; other games' wording, names for
  mechanics and art are not. Don't use "mana", "monarch points", "aggressive expansion" or "casus belli" in
  player-facing text. Our words: Threat, Claim, Prestige, Policy, Era, Coalition, war score.
- **Plain English, short.** Event text is 2-4 sentences (max 420 characters). Titles max 42 characters. Choice
  buttons max 60 characters and start with a verb ("Pay the ransom", "Let them rot").
- **Every choice is a real choice.** If one option is strictly better, rewrite it. Typical trade-offs: gold vs
  stability, prestige vs Threat, short-term troops vs long-term development.
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
| `trigger` | a condition (below) for "this nation" |
| `choices` | 1-3 options. `ai` is a relative weight for AI picks (default 1) |

How the engine fires events: once a month, each living nation gets at most one event. An event is eligible when
it isn't hidden, the year is inside its window, the nation is in `nations` (if set), its trigger is true and
(for once-events) it hasn't fired. Each eligible event rolls 1/`mtth`. A nation gets a generic event at most once
every 8 months. The player sees a card with the effects listed under each choice; AI nations pick by weight.

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
| `{ "gov": "republic" }`, `{ "tier": "major" }`, `{ "hasPolicy": "standing_army" }` | misc |
| `{ "warsWonAtLeast": 1 }`, `{ "battlesWonAtLeast": 5 }`, `{ "stackWipesAtLeast": 1 }`, `{ "bestWinRatioAtLeast": 5 }`, `{ "regionsConqueredAtLeast": 10 }` | this nation's record |
| `{ "fleetsAtLeast": 1 }`, `{ "shipsAtLeast": 20 }`, `{ "coastal": true }` | navy |
| `{ "inCoalition": true }`, `{ "coalitionAgainst": true }` | member of a coalition / a coalition targets this nation |
| `{ "papalFavorAtLeast": 50 }` | Catholic Papal Favor (0-100) |
| `{ "discovered": true }` | the New World has (not) been found |
| `{ "coloniesAtLeast": 3 }` | owns at least N regions in the New World (founded colonies and conquests) |
| `{ "colonizingAtLeast": 1 }` | has at least N colonies being settled right now |
| `{ "ownsGood": "silver" }` | owns a region trading in that good (silver, gold, sugar, tobacco, cocoa, dyes, furs, fish, grain) |
| `{ "native": true }` | this nation is a New World people |
| `{ "chance": 0.5 }` | random each time it is checked (use rarely) |

## Effects

Applied to "this nation" unless the effect names another.

| Effect | Does |
| --- | --- |
| `{ "gold": 100 }` / `{ "gold": -50 }` | gold (can go negative; the treasury takes loans automatically) |
| `{ "goldPerDev": 2 }` | gold × total development (scales with nation size; negative allowed) |
| `{ "manpower": 5000 }` | men |
| `{ "stability": 1 }` | -3..+3 |
| `{ "prestige": 10 }` | 0..100 |
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
| `{ "modifier": { "id": "x", "name": "Shown name", "months": 60, "mods": { "taxIncome": 0.1 } } }` | timed modifier (months ≤ 0 = permanent). Keys: taxIncome, tradeIncome, manpower, morale, infantryPower, cavalryPower, artilleryPower, fortDefense, siegeSpeed, attrition, upkeep, mercCost, devCost, coreCost, fortCost, shipCost, navalPower, threatDecay, threatGain, opinion, diplomacy, holyWarMorale, unrest, techCost, movement, prestigeGain, stabilityCost, colonists (flat: +1 = one more colonist), settlerGrowth (fraction) |
| `{ "removeModifier": "x" }` | remove one |
| `{ "rebels": { "regiments": 6, "region": "bohemia" } }` | rebel army (region defaults to the capital) |
| `{ "addRegiments": { "inf": 4, "cav": 2, "region": "castile" } }` | free army at full strength (region defaults to capital) |
| `{ "hireGeneral": { "fire": 3, "shock": 4, "maneuver": 2, "name": "Gonzalo de Córdoba" } }` | free general (stats 1-5) |
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
| `{ "loans": 2 }` | take loans (+100 gold each, with interest) |
| `{ "emperor": true }` | this nation becomes Holy Roman Emperor |
| `{ "discoverNewWorld": true }` | this nation finds the New World (if no one has yet): prestige, a colonist for 30 years, and the nation flag `found_new_world` |
| `{ "settlers": 200 }` | settlers added to each of this nation's colonies being settled (negative removes; a colony is founded at 1,000) |

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

Each major nation has 6-10 missions in a short tree (at most 3 branches; `requires` lists missions of the same
nation). The `generic` set is used by every nation without its own. A mission is claimable once its requirements
are done and its goal is true; the player taps "Complete" to collect the reward.

## Achievements

```json
{ "id": "five_to_one", "title": "Overwhelming Force", "desc": "Win a battle with five times the enemy's strength.", "goal": { "bestWinRatioAtLeast": 5 } }
```

Checked for the player each month; `nations` limits one to specific starting nations.
