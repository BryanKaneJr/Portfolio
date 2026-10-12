# Crowns of Europe

> Grand strategy in your pocket. Europe and the New World, 1444–1750.

A pay-once, offline grand strategy game for phones, played in portrait with one thumb. Pick a nation in 1444,
move armies region to region, crush smaller stacks, paint the map in your colour, and watch Europe band together
against you when you grow too fast. Send ships west to find a New World, then race the other crowns to settle it.
History happens to you through events and missions, but it can go another way: Burgundy survives, Byzantium holds,
Granada beats Castile, the Aztecs outlast everyone.

Expo SDK 57 + React Native + TypeScript (Expo Router). No backend, no accounts, no ads, no purchases: everything is
bundled and works in airplane mode.

## What's in the game

- **The map:** a north-up map from the Pacific coast of Mexico to the Volga: 160 regions in Europe, North Africa,
  Egypt, the Levant, the Caucasus, Mesopotamia and West Africa (with an uncolonized Guinea coast), 46 coarse
  New World regions on the eastern side of the Americas, the Atlantic islands, the Great Lakes, 39 sea zones and
  off-map wilderness, traced from Natural Earth (public domain) coastlines, with terrain, prosperity (1–10),
  forts (0–3), faith, rivers and straits. Seven map modes: political, terrain, prosperity, faith, diplomatic,
  threat and exports. Painted in three styles: Atlas (the known world on blank parchment, casting a soft shadow;
  country colours over the land's own greens and tans and its hills; a slate sea; big pale names that curve along
  each country), Parchment and
  Flat. The rest of the world is sketched in outline on the parchment, and the map slides back when you pull past
  its edges.
- **The interface:** dark and gilded, built like a phone app: the map fills the screen and glass controls float
  over it (your arms and resources on top, time and the realm's pages in a dock at the bottom, an outliner and the
  map lenses at the side), sheets you drag up and down, and event windows with each choice's effects spelled out.
- **73 nations** at 11 November 1444: 14 majors and 8 harder picks are playable, each with a real ruler, a
  national trait, an AI personality and a mission tree. The Mamluk Sultanate and 46 AI minors fill in the Empire,
  Italy, the Balkans, the steppe, the Middle East and West Africa (Jolof, Mali, Songhai), and four New World peoples (Aztec Empire, Maya, K’iche’, Haudenosaunee) hold their homelands.
- **The New World:** uncharted until an expedition finds it (it needs Ocean Navigation) or 1500 arrives.
  Colonists (from Portugal's navigators, being first across, Castile's Council of the Indies, the Overseas Charters
  policy and Galleons) settle uncolonized land; a colony grows to 1,000 settlers while natives slow it and may attack it, and
  troops keep it safe. Every New World region has an export (silver, gold, sugar, tobacco, cocoa, dyes, furs,
  fish, grain) that pays its owner. One fleet of transports carries an army across the ocean; the open Atlantic
  takes weeks to cross.
- **Real time with pause:** day ticks at 1×, 2× or 4×, a monthly economy, and automatic pauses (all configurable)
  for wars declared on you, events and offers.
- **Armies:** regiments of 1,000 men (infantry, cavalry, artillery once you know Bombards), merge and split, generals of
  one to five stars (each star +10% to everything the army does: damage, steadiness, march and siege speed), the
  ruler leading in person, mercenaries, supply limits and winter attrition. On the map an army is a token with a
  pikeman on it, a fleet one with a ship, the count beneath; tap one, then tap where it should go.
- **Battles** that run for days so reinforcements can join: each day 1d10 less terrain for the attacker, days of
  volleys (the guns tell) and of charges (the horse tells), the general's stars, damage
  scaled by the front line (20 wide on plains, 10 in mountains), morale, retreat, cavalry pursuit, and the
  **stack wipe** when the winner has five times the loser's remaining men. River crossings cost the attacker.
- **Sieges** (15 days for open land; forts need 3 regiments per level and months, faster with artillery; a relief
  battle pauses a siege rather than undoing it) and
  **zone of control**: enemy forts stop your march.
- **Navy, light:** galleys, transports and ships of the line; fleets carry armies, close straits, blockade
  coasts, and fight in one roll.
- **War and peace:** reasons for war (claims, holy war, rivals, independence, coalition), calls to arms (allies join
  an attack only from nearby and with a stake in it), war score from battles, occupation, blockades and the war
  goal, and peace deals that spend it on regions (a capital costs double), gold, vassals or freeing nations.
  Ten-year truces that bind allies too.
- **Threat and coalitions:** taking land alarms your neighbours; three or more frightened nations form a
  defensive coalition.
- **Diplomacy:** opinion from −200 to +200 with a breakdown, alliances, royal marriages (inheritance and personal
  unions), military access, rivals, vassalization and annexation, gifts and insults.
- **Realm:** gold, manpower and stability (no abstract point currencies), loans and bankruptcy, rulers who age
  and die, heirs, republican elections, policies (a slot for every three advances). Army pay switches between
  peace and war on its own, and the treasury borrows by itself when it runs dry.
- **Science:** scholars earn science every month, mostly from the prosperity of their richest regions rather than
  from how much land they rule (so a small, rich state keeps up with an empire, which also pays more per advance),
  plus trade centres, universities and a funding switch, and much faster in Italy and the West than on the steppe
  or in West Africa. They spend it on
  three tracks of four advances: War (Bombards for artillery, then Pike and Shot, Musket and Volley and Flintlock
  and Bayonet for new ages of troops), Sea (Caravels and Ocean Navigation for colonies, Galleons for warships,
  Ships of the Line) and Statecraft (printing, banking, statecraft, bureaucracy). An advance costs more
  the earlier it is taken than its historical year and less once neighbours know it, so the most learned crowns
  reach each one near its real date (AI games land within about 15 years) and knowledge spreads outward.
- **Faith and the Empire:** Catholic, Orthodox, Muslim and Protestant; conversion; the Reformation spreading
  from 1517; Papal Favor (claims and excommunications); the Holy Roman Emperor, electors and elections.
- **Story:** 246 events (104 historical, 69 generic, 45 era, 28 New World), 231 missions, 42 achievements, unrest and rebels.
- **AI** that recruits, invests, forms alliances, declares wars it can win, chases beatable stacks, besieges,
  retreats from bigger ones and negotiates peace. Crowns follow their history loosely: France wants the English
  off the continent, Castile wants Granada, Muscovy wants the Russian lands. They forge claims on the land they
  want and fight for it, and old friendships and enmities colour their opinions (see "What they want" on a
  nation's sheet).
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
| `npm run screens` | Build the web app and play it in a headless phone-size browser, saving screenshots to `screens/` (also `node scripts/screens-war.mjs` and `node scripts/screens-newworld.mjs`). |
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
| `tests/` | Jest: battles, movement, sieges, war and peace, colonies and the New World, the event language, the map (lands beyond the edges, curved names, camera limits), determinism and a 25-year soak. |
| `docs/` | `content-guide.md` (how to write events and missions) and `design-notes.md` (decisions and status). |

## How the code fits together

The simulation owns the whole game as one `GameState` object. The UI never computes rules: it calls
`advanceDay(state)` from a timer (1.5, 3 or 6 days per second) and the commands in `src/sim/commands.ts`, then
re-renders from the store. The same state serializes straight to a save file, and a seed makes a game
reproducible (tests check both).

Content is data. Events, missions and achievements use a small condition/effect language
(`docs/content-guide.md`) checked by `npm run validate`.

The map is generated, not hand-drawn: `scripts/build-map.ts` projects Natural Earth land (Mercator), cuts out the
Great Lakes, splits each landmass between region seed points through a fine jittered grid (organic borders, islands
never claim the mainland) and hands the rest to wilderness seeds, simplifies shared borders once through a topology
so neighbours never gap, and writes paths, labels and the adjacency graph, plus the lands beyond the play window
(drawn in outline, never playable) and the unknown waters. `scripts/build-relief.ts` then bakes hill shading, sea
depths, the land's natural colour (NASA's Blue Marble), the water lines along the coasts and the known world's
shadow into images from public-domain elevation tiles and imagery, using the map's own coastline so nothing spills over a shore. `src/ui/map/styles.ts` says how each map style paints it all.

## Credits

Coastlines: [Natural Earth](https://www.naturalearthdata.com/) via `world-atlas` (public domain). Relief: the
[Terrain Tiles on AWS Open Data](https://registry.opendata.aws/terrain-tiles/) (ETOPO1, GMTED2010 and SRTM at
the zooms used; public domain). Land colours: NASA's
[Blue Marble Next Generation](https://visibleearth.nasa.gov/collection/1484/blue-marble) via
[GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api)
(public domain). Map lettering: [Cinzel](https://fonts.google.com/specimen/Cinzel) and
[IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) (SIL Open Font License). History,
dates, nations and rulers are public domain; all game text is original. Flags are simplified heraldry drawn in
code. Icons (coins, helmet, scales, laurels, crowns, the pikeman and galleon on the map tokens, the fire behind an
enemy's arms and the rest of the emblems) by [Lorc](https://lorcblog.blogspot.com/) and
[Delapouite](https://delapouite.com/) from [game-icons.net](https://game-icons.net/), under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); `npm run icons:build` copies them in
(`scripts/build-icons.ts` lists each one).
