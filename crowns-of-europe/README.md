# Crowns of Europe

> Grand strategy in your pocket. Europe, 1444–1750.

A pay-once, offline grand strategy game for phones, played in portrait with one thumb. Pick a nation in 1444,
move armies region to region, crush smaller stacks, paint the map in your colour, and watch Europe band together
against you when you grow too fast. History happens to you through events and missions, but it can go another way:
Burgundy survives, Byzantium holds, Granada beats Castile.

Expo SDK 57 + React Native + TypeScript (Expo Router). No backend, no accounts, no ads, no purchases: everything is
bundled and works in airplane mode.

## What's in the game

- **The map:** 133 regions and 16 sea zones traced from Natural Earth (public domain) coastlines, with terrain,
  development (1–10), forts (0–3), faith, rivers and straits. Six map modes: political, terrain, development,
  faith, diplomatic and threat.
- **62 nations** at 11 November 1444: 14 majors and 8 harder picks are playable, each with a real ruler, a
  national trait, an AI personality and a mission tree. 40 AI minors fill in the Empire, Italy, the Balkans and
  the steppe.
- **Real time with pause:** day ticks at 1×, 2× or 4×, a monthly economy, and automatic pauses (all configurable)
  for wars declared on you, events and offers.
- **Armies:** regiments of 1,000 men (infantry, cavalry, artillery from 1500), merge and split, generals with
  Fire/Shock/Maneuver, the ruler leading in person, mercenaries, supply limits and winter attrition.
- **Battles** that run for days so reinforcements can join: each day 1d10 plus general and terrain, damage
  scaled by the front line (20 wide on plains, 10 in mountains), morale, retreat, cavalry pursuit, and the
  **stack wipe** when the winner has five times the loser's remaining men. River crossings cost the attacker.
- **Sieges** (15 days for open land; forts need 3 regiments per level and months, faster with artillery) and
  **zone of control**: enemy forts stop your march.
- **Navy, light:** galleys, transports and ships of the line; fleets carry armies, close straits, blockade
  coasts, and fight in one roll.
- **War and peace:** reasons for war (claims, holy war, rivals, independence, coalition), calls to arms, war
  score from battles, occupation, blockades and the war goal, and peace deals that spend it on regions, gold,
  vassals or freeing nations. Ten-year truces.
- **Threat and coalitions:** taking land alarms your neighbours; three or more frightened nations form a
  defensive coalition.
- **Diplomacy:** opinion from −200 to +200 with a breakdown, alliances, royal marriages (inheritance and personal
  unions), military access, rivals, vassalization and annexation, gifts and insults.
- **Realm:** gold, manpower and stability (no abstract point currencies), loans and bankruptcy, rulers who age
  and die, heirs, republican elections, four eras with paid adoption and new troops, one policy per era.
- **Faith and the Empire:** Catholic, Orthodox, Muslim and Protestant; conversion; the Reformation spreading
  from 1517; Papal Favor (claims and excommunications); the Holy Roman Emperor, electors and elections.
- **Story:** 218 events (104 historical, 69 generic, 45 era), 198 missions, 34 achievements, unrest and rebels.
- **AI** that recruits, invests, forms alliances, declares wars it can win, chases beatable stacks, besieges,
  retreats from bigger ones and negotiates peace.
- **Saves:** autosave every 1 January and on leaving the app, three manual slots, optional ironman.

## Getting started

Requires Node 22+.

```bash
cd crowns-of-europe
npm install
npx expo start          # press i / a for a simulator, or scan the QR with Expo Go
npx expo start --web    # play in a browser (mouse wheel zooms the map)
npm run check           # typecheck + lint + content validation + simulation tests
```

Everything the game uses is in Expo Go, so no development build is needed to try it on a phone.

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint, validate `src/content/`, run the Jest simulation tests. Run before every commit. |
| `npm run validate` | Content validator: references between files and the event/mission language. |
| `npm run map:build` | Regenerate `src/content/map.json` from region seeds (after editing `regions.json` or `seas.json`). |
| `npm run screens` | Build the web app and play it in a headless phone-size browser, saving screenshots to `screens/`. |
| `npm run soak -- 50 7` | Let the AI play everyone for 50 years (seed 7) and print who rose and fell. |
| `npm run icons` | Re-render the app icon, adaptive icon, splash mark and favicon. |

## Repository layout

| Path | What |
| --- | --- |
| `src/sim/` | The game: a deterministic, serializable simulation in plain TypeScript (no React). `tick.ts` advances a day; `commands.ts` is everything the player can do. |
| `src/content/` | Data: regions, seas, nations, the 1444 scenario, events, missions, achievements, traits, policies, units, and the generated `map.json`. |
| `src/app/` | Screens (Expo Router): title, nation picker, game. |
| `src/ui/` | Map view, sheets, menus, cards and components. |
| `src/state/` | The running game store (game loop, selection, toasts) and saves. |
| `scripts/` | Map builder, content validator, icon renderer, Playwright walkthroughs, AI soak and trace tools. |
| `tests/` | Jest: battles, movement, sieges, war and peace, the event language, determinism and a 25-year soak. |
| `docs/` | `content-guide.md` (how to write events and missions) and `design-notes.md` (decisions and status). |

## How the code fits together

The simulation owns the whole game as one `GameState` object. The UI never computes rules: it calls
`advanceDay(state)` from a timer (1.5, 3 or 6 days per second) and the commands in `src/sim/commands.ts`, then
re-renders from the store. The same state serializes straight to a save file, and a seed makes a game
reproducible (tests check both).

Content is data. Events, missions and achievements use a small condition/effect language
(`docs/content-guide.md`) checked by `npm run validate`.

The map is generated, not hand-drawn: `scripts/build-map.ts` projects Natural Earth land, splits each landmass
between region seed points through a fine Voronoi grid (organic borders, islands never claim the mainland),
simplifies shared borders once through a topology so neighbours never gap, and writes paths, labels and the
adjacency graph.

## Credits

Coastlines: [Natural Earth](https://www.naturalearthdata.com/) via `world-atlas` (public domain). History,
dates, nations and rulers are public domain; all game text is original. Flags are simplified heraldry drawn in
code.
