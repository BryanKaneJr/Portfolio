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
     an expedition (needs Ocean Navigation; 100 gold, 8 months; the AI odds rise from 1470) or 1500 arrives.
   - Colonists: Portugal's Navigators trait, being first to the New World (30 years), Castile's Council of the
     Indies, the Overseas Charters policy (needs Galleons) and big realms (30+ development) with an ocean coast
     once they know Galleons.
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
12. **Science instead of eras bought with gold.** The doc's four eras unlocked by date and cost gold. Now science
    builds up each month and buys 12 advances in three tracks of four (war, sea, statecraft; `advances.json`);
    the three later war advances (Pike and Shot, Musket and Volley, Flintlock and Bayonet) raise the troops' age
    that the eras used to, others unlock artillery, colonies and galleons, and every three advances open a policy
    slot. Learning differs by region (`learning` in
    advances.json), gold buys more (funding, universities), and costs are anchored to history: early costs more,
    late and next to neighbours who know it costs less. Science comes mostly from the prosperity of a crown's
    richest few regions, not from how much land it rules, and big realms pay up to 50% more per advance, so small,
    rich states (Venice, Genoa, Portugal, Denmark) keep pace with the great powers and poor ones fall behind. In AI games the first crown to master each advance does
    so within about 0-15 years of its historical date.
13. **Civilization-like complexity, grand-strategy looks (on request).** Fewer, chunkier decisions: three
    science tracks instead of a web of advances, one funding switch, automatic army pay and borrowing, five Realm
    tabs (rankings live in Diplomacy, settings behind the gear, Colonies only for crowns that can settle), the
    everyday diplomatic actions up front and the rest behind "More options", three numbers per region sheet, and
    Science in the top bar instead of Renown.
14. **The Ottoman threat, and Europe's science answer (on request).** The Ottomans are the great military power
    of the 15th and 16th centuries: Ghazi Spirit gives +15% morale, infantry and cavalry and +50% army limit
    and levies. Hungary opens the game in mourning (*The Dead of Varna*: −40% levies for four years, −15% morale
    unless it pays to rebuild), the truces after Varna hold Hungary and Poland off until 1448, and Poland and
    Hungary start unallied (their shared king died there). Two historical events then hold the Ottomans back,
    which is what lets Europe catch up: *Scribes Before Presses* (1483-1500, printing forbidden: −25% science for
    240 years) and *The Janissaries Grow Proud* (1566-1600: for 150 years war advances cost double, infantry −15%,
    army limit and levies −25%, and the Janissaries bonus is lost). The AI always takes the historical choice; a
    player can refuse, at a price. Their learning is 0.85. Europe then strikes back: *The Holy League* (from 1670,
    while the Ottomans hold Hungarian, Balkan or Austrian land) has Austria declare a holy war joined by Poland,
    Venice, the Papacy, Muscovy and the Empire's princes (Poland leads if Austria is gone), and *Prince Eugene
    Marches South* (1695-1740) does it again. General fixes that came out of this: a fleeing army whose next
    step took longer than the AI's re-think never arrived (the Ottoman and Byzantine armies sat together in
    Bulgaria for years); an army standing in a region now catches enemies marching out of it; an AI army facing
    a bigger enemy joins up with its other armies nearby before it thinks of running; the AI's strength
    estimate counts unit strength and morale, not just heads; past three to one, better odds no longer decide
    which war a crown picks (its aims do); the AI looks again at what its scholars study once a year,
    switching when another advance has become much better value; an army besieging its war goal no longer
    runs off to chase enemies (only a relief army close by), and none chases more than 40 days away; a battle
    at the walls pauses a siege instead of undoing it (relief attacks used to wipe out months of progress);
    a truce binds allies too (Hungary, under truce after Varna, can't join Byzantium's defence); and crowns
    that know Bombards in 1444 (France, Burgundy, the Ottomans) start with a siege train. Measured in AI games: the Ottomans took Constantinople in
    their opening war in 47 of 48 games (by 1450); in eight games to 1700 they held 9-22 regions in 1520 and
    peaked at 16-50; in 1600 they were still in the second troop age while Europe had the third, and in 1700 in
    the third while Europe had the fourth (all eight); Europe won land back from them after 1600 in five of the
    eight (Austria retook Hungary in three). The biggest empires still reach into central Europe now and then
    (Vienna or Bohemia in two of the three checked; none held Italian land) (`scripts/dev/opening.ts`,
    `scripts/dev/ottomans.ts`, `scripts/dev/powers.ts`).
15. **Europe's great powers hold together (on request).** France and Austria used to die in most AI games:
    France was carved up by England and Burgundy with half of Europe piling in, and Austria (three regions) was
    made a vassal and absorbed. Now France has the first standing army in Europe (Gendarmes: +30% army limit and
    levies, +20% artillery, +15% cavalry) and England no longer claims Anjou, Poitou and Paris (it only wants to
    hold Normandy and Gascony until about 1460 and Calais until about 1560). The Emperor cannot be made a
    vassal, the electors march to defend the Emperor against an outsider, the title gives +25% army limit and
    +20% levies, and electors keep the sitting Emperor's house far more often. Across all crowns: allies join
    an attack only from within three regions of the enemy and with a stake in it (land they want from it, or it
    is their rival); the capital of a realm of three or more regions costs double at the peace table (and a winning AI fights on for its war goal rather than settle for less); a great crown (not a minor) accepts no
    master by treaty, and a great crown in a personal union keeps its own laws and is never integrated; and only
    a claimant at least as large as the realm can inherit it in a succession crisis. In eight AI games to 1700 France survived in seven (England
    took it in the eighth) and Austria in all eight, and no crown grew past about 50 regions.

16. **A painted map, in three styles (on request).** The map takes its look from the map overhauls strategy
    players rate highest (and a reference screenshot the player picked), built from our own data. The known world
    lies on blank parchment and casts a soft shadow onto it: past the play window, the deep wastes (the Sahara,
    Kazan, the Caucasus, Arabia...), the waters no fleet sails, and a ragged band of open sea along the window's
    edges, so the known world ends in a hand-drawn shore rather than a ruled line (the edges of the unknown waters
    wobble instead of following the sea zones' straight lines, and the last stretch fades into the parchment).
    Before the New World is found it is parchment too, its coasts drawn in outline like the rest of the unknown;
    finding it lifts the parchment. On the known world the country colours are laid over the land's own colours,
    the way strategy maps blend the political colour with the terrain: NASA's Blue Marble (public domain), evened
    out to a middle brightness, shows through at about a third, so a country takes on its land's greens, tans and
    greys and the texture of its fields and hills; then crisp hill shading and sea depth (public-domain elevation
    data; all baked into images by `npm run relief:build`) and a fine painted grain. Close up, baked pictures would
    blur and smear, so the land's pictures are cut to the real coastline (crisp at any zoom), its colour switches to
    a smooth version, the grain and each region's terrain (crags, rolling hills, tree crowns, a patchwork of
    fields, reeds) are drawn as fine tiles the same size on screen at every zoom, borders and coasts are drawn as
    rounded curves (the game itself still reads the unrounded shapes), every baked picture stays under the size
    iPhones quietly halve, and the closest zoom stops where the map runs out of detail (5 points per map unit);
    a dark slate sea, quiet borders, and big pale names with a drop shadow that curve along each country in classical capitals
    (Cinzel), a short name on a long thin country spaced out to run its length; seas and wastes are in an old
    italic (IM Fell English; both bundled, SIL Open Font License). Nothing in the unknown can be tapped, entered or
    owned. The Red Sea is the one closed sea still drawn as water (`charted` in `seas.json`). Pulling past the edge of the known world, or past the zoom limits, meets growing resistance and slides
    back when let go. Atlas is the default; Parchment (an old hand-coloured map with water lines along the coasts)
    and Flat (clean colours, the lightest to draw) are in Settings and the map-mode menu. Each style redraws in two
    frames in the browser; anything that would mean stroking every coastline several times (water lines, shadows)
    is baked.

17. **"Gilded glass" interface (on request: a mix of a phone app and the newest historical strategy games).** From
    the historical grand strategy side: a dark interface with gilt accents, every nation shown by its arms on a heraldic shield, a top bar
    of resources with icons (each tappable for why), an outliner of your armies, fleets, sieges and colonies, map
    lenses always at hand, section heads in classical capitals with a gilded rule, and event windows with a picture
    at the head, the story in a book face and each choice's effects under it. From the phone side: the map fills
    the screen and the controls float over it as translucent glass; capsule buttons; a dock with the time controls
    and the realm's pages as a tab bar; inset sheets with a grab handle that you drag to resize or dismiss; grouped
    lists; segmented controls; banners that drop in like notifications; one tint (gold) for what you can act on.
    Sheets rest above the dock rather than covering it, so time can be started and stopped with a sheet open.
18. **War, in our own terms (on request).** A general is no longer three numbers borrowed from the genre (fire,
    shock, maneuver): a general has one to five stars, and each adds 10% to everything the army does (damage in
    battle, steadiness, march and siege speed), which a player can weigh at a glance. Battle days alternate
    volleys and charges. Old saves convert each general to the average of their three numbers (`migrateSave`).
    Your wars show down the left of the map as the enemy's arms on fire (original flame art) with your leverage
    beneath; tapping one opens the war: both sides under their arms, the leverage as a tug of war with its four
    parts, how the fighting has gone (battles, men lost, land held, war exhaustion) and the peace table, with the
    deal and their answer always in reach at the bottom. Armies and fleets are tokens in their owner's colour with
    a pikeman or a ship drawn on them and the count beneath. Moving an army: its sheet opens low and the map glides
    so the army sits in the clear space above it, so the land around it can be tapped (a tall sheet used to cover
    it, which is why armies seemed impossible to move); while you give orders, a near miss on another of your
    units is a march order, and switching units takes a tap on its token.
19. **Say less; explain on request (on request).** Screens had grown sentences everywhere: under each general
    what their stars add, under the leverage what you could ask for, a rule under most sections. Now a screen
    says what things are and what you can do, in a few words; how a rule works sits behind a small gold "?" in a
    circle (on a sheet or page header, a section title or a line) that opens a short note in place, and numbers
    open their breakdowns when tapped. Long-form teaching is in How to play and the one-time hints (which now also
    show while a sheet is open, at the top, so the first army you select gets its tip).
20. **Emblems from game-icons.net (on request).** The hand-drawn line icons for resources and events read as
    generic app icons, and the hand-drawn fire behind an enemy's arms did not convince. The game's emblems now come
    from game-icons.net (CC BY 3.0, by Lorc and Delapouite; credited in the README and Settings > About): a stack of
    coins for gold, a helmet for levies, scales for order, a laurel crown for renown, a mailed fist for Threat, a
    pikeman and a galleon on the map's tokens, and a real fire, red at the base to yellow at the tips, that an
    enemy's shield stands in (your own side's shield stands in a gold glow). The plain controls stay simple line
    icons, as on a phone. `scripts/build-icons.ts` copies the chosen glyphs into the code as path data, so the game
    stays offline.
21. **Names and armies don't fight (on request).** Zoomed out, where the nation names curve across each realm, the
    map shows no armies, fleets, battles or sieges (only a unit you have selected, so you can still pick a far
    destination). From the zoom where region names replace them, each army stands just under its region's name
    rather than on it, the route line runs between those points, and siege bars hang under the tokens. Tokens are a
    little smaller where regions are close together, and the game opens (and "show on map" goes) at a zoom where a
    name with an army under it fits in a region.
22. **Drawn terrain instead of a stretched photograph (on request).** Close up, the baked hill shading (one picture
    for the whole map) was enlarged two or three times and looked smeared and muddy. Now the terrain is drawn, as on
    a hand-made map, by `scripts/build-terrain.ts`, with real data deciding where: clumps of trees where the land is
    forest from space (dark green in NASA's Blue Marble; conifers in the north and up high), dunes in the southern
    deserts and reeds in marsh regions, drawn as vector paths for the part of the map in view (sharp at any zoom);
    they fade in as you zoom in and the hill shading fades to a third of its strength under them.
23. **Mountains drawn by hand, troops as figures (on request).** The owner wanted ranges that look drawn (ridgelines,
    spurs, hatching and a wash, after a reference), far fewer marks, and no square icons for troops. Drawing ridges
    from the data (crests, spurs, faceted shading, then real watershed lines) never looked hand-made, so the ranges
    are now the owner's own ink drawings (`art/mountains`): the mountainous land (rugged ground, grown a little way
    over the rugged land joined to it, not across a plateau) is gathered into ranges, and drawings are laid over
    them widest stretch first, each picked to run the way the range runs there (mirrored for a range running the
    other way, until drawings that way are made), sized to its width and spaced so each group reads on its own
    (about 390 in all). They are baked so the ink darkens the land and the paper is a faint light: the country's
    colour shows through, so who holds the Alps stays plain. Armies and fleets are a pike block or a ship rendered
    from CC0 3D models (KayKit, Kenney) on a base in the owner's colour, the count on a badge beside it; forts are a
    tower or a castle by the region's name. (Later the armies became the owner's own soldier drawings under each
    realm's banner, and only the units the player would know about are shown: see the end of these notes.) Next, at the owner's choice: a painted map of the whole frame (and the
    margins seen past its edges) under the country colours; templates in the map's exact projection were made for
    it, and the coasts and borders will be refitted to the painting where they disagree.

24. **A painted world (on request).** The owner painted the whole map over a template in the map's exact projection,
    and it is now the default look ("Painted"): the realms' colours washed over it at about 40%, so the painting's
    seas, forests, deserts and snow show through every country; borders and names on top; past the map's edges, the
    painting goes on under a light veil instead of blank parchment. Its coasts were close but not exact (Corsica and
    Sardinia off, Italy and Greece wide), so `scripts/build-painting.ts` bends it to fit: land and sea are read from
    its colours, and the picture is moved smoothly (45 map units at most) until its coastlines lie on the game's, then
    what still disagrees within 20 units of a coast is refilled from the nearest painting of the right kind (painted
    lakes inland stay). The game's borders never move: they carry the neighbours, straits and rivers the game runs on.
    The painting is 2.25 px per map unit: sharp zoomed out, soft close up; a sharper painting of the game's frame
    would fix that and needs only a rebuild. The drawn mountains and trees stay in the other styles.

25. **An illustrated atlas from real data (prototype: central and eastern Europe).** Instead of one big picture, the
    ground is drawn offline from real data in the game's own projection: NOAA ETOPO 2022 elevation, ESA WorldCover
    land cover and Natural Earth rivers and lakes are warped onto the map's units (an exact affine of web Mercator,
    no estimated control points) and painted as a muted parchment atlas: relief shading, ink peaks at the real
    summits, trees in the real forests, marsh, grass, rivers, coastal ripples. The game's coastline is the authority;
    the terrain is painted to it and never moves a border. It ships as five levels of 512 px tiles (1-16 px per map
    unit; the finest covers the closest zoom on a 3x screen), each level drawn from data at its own resolution so
    zooming in shows more real detail, not a magnified picture. It is the default style ("Illustrated"); outside the
    region it is Atlas. Pipeline: `scripts/terrain/` (Python + GDAL). Audit, verification, screenshots and the plan
    for the whole map: `docs/terrain/`. Painted stays as an option.
    After the owner's first look:
    - Close up it was too busy. The two finest levels now draw about 35% fewer small features, and 40–47% fewer in
      mountain country. Peaks keep apart, and no tree is drawn inside a peak. Short minor rivers are left out unless
      they feed a lake.
    - Borders between realms are near-black with a faint light casing, so they hold against forest and mountain ink;
      they ease off a little when zoomed out. Province lines are a darker warm sepia.
    - The water is a deeper, bluer grey (#87a6ba), darker over deep water and never paler in the shallows (the same
      rule inside the tiles and out, so the region's edge doesn't show at sea). A soft darker band runs along every
      shore, so coasts stand apart from pale or teal coastal realms without going back to navy.
    - Rivers are drawn by importance (the Danube, Rhine and Po heavier, smoothed) and ease off far out. Lakes are
      filled as water over the realms' colours, including those Natural Earth lacks (taken from WorldCover).
    - On the web the moving map has its own compositor layer, so panning never repaints the map.

26. **Units the owner drew, under banners; only what you would know; realms that never share a colour (on
    request).** Armies are the owner's soldier drawings (`art/troops`): a lone soldier below 4 regiments, four men
    from 4, five from 10; fleets their ship drawings (`art/ships`): a lone ship up to 4 ships, several from 5
    (`npm run units:build`). Each stands in a shadow baked from its own silhouette (soft at its feet, cast behind it
    to the right), not on a coloured base, and flies its realm's flag on a pole as a small waving banner; the count
    is on a badge beside it, gold-rimmed for your own. Units, battles and sieges are shown, and listed in sheets, only
    if they are yours, a friend's (ally, overlord, subject), an enemy's in a war, or in land you own or hold
    (`seesUnit`); rebels when they rise against you or a friend. Past play zoom, names, forts and tokens grow partway
    with the zoom (`grow`: (k / 1.7)^0.45, about 1.6x at the closest). Every realm's map colour is now unlike every
    other's and far from its neighbours', picked by `scripts/dev/nation-colors.ts` (the iconic ones kept: French
    blue, English red, Castilian gold, Aragonese orange, Portuguese green, Ottoman teal, Austrian white...;
    `tests/map.test.ts` checks the distances). Every flag was redrawn from the realm's arms or banner around 1444
    (England's quartering of France and England, Castile and León, Portugal's quinas in a red bordure, the chains of
    Navarre, St Mark's lion, the keys of St Peter, the Palaiologoi's cross and firesteels...; stylised where no flag or
    arms of the realm survive, and said so behind its sheet's "?" (`flag.stylised`)), no two alike and neighbours
    told apart at banner size, with figures drawn for the game as bold silhouettes
    (`ui/components/charges.ts`); `npm run validate` rejects an unknown pattern or figure, or two identical flags.

27. **Armies, wars and peace without holes (on request).** An audit of how armies move and fight and how wars end
    found armies vanishing, slipping past each other and left stranded, and an AI that seldom used generals, misjudged
    attacks and stopped making war after about 1470. Fixed:
    - Nothing vanishes without a word. A beaten army retreats by land or on its own transports; if it has no way
      out it scatters, its men counted as losses and the report saying so. A retreat whose road closes stands down;
      every next step of a march is checked again (a strait closed, transports gone, access ended) and stops with a
      message. Recruits finishing in land the enemy holds muster in another region, or the money comes back.
    - Enemies marching past each other on one road meet and fight. The army that marched in attacks with the
      terrain and any river against it; when both sides were already standing there (a war declared, rebels rising)
      the battle is pitched and nobody suffers that.
    - At peace, armies in land they may no longer enter march home, access ignored on the way out
      (`sendHomeAfterPeace`); once a month any other stray does the same (`monthlyStrays`).
    - The AI puts generals in the field (`aiGenerals`), and asks a battle forecast (`forecast.ts`: battle.ts's own
      rules at the average roll, in days each side would hold out) before it moves: it attacks only where it would
      hold out 1.5 times longer; joins up or falls back from an enemy stack that would outlast it twice over; and a
      stack the nearest enemy would outlast three times over gathers with a bigger army instead of walking out
      alone. It counts only allies that would answer and could reach the fight, and lets go after a year of a war
      neither side can carry to the other. A lesser crown with nothing it wants next door forges a claim on a
      clearly weaker neighbour; a great crown follows its aims, missions, rivals and faith.
    - Wars that stay in proportion. A crown counts its allies for no more than its own might when it weighs a war
      (Scotland, on France's back, was taking England's heartland a region a war, and England died in 10 of 16 AI
      games). An AI war for one border region is a limited war: won by its attackers, it takes that region and gold,
      nothing more. Only a loser's last region, not its capital, may be taken from afar. A crown rests three years
      (four or five if it is a trader or defensive) after declaring a war or making peace in one it led; past the
      Threat at which coalitions form, each 10 Threat asks a tenth more might; and a great crown without a reason
      for war needs 2.5 times the might (others 1.8).
    - Measured over 16 AI-only games to 1700, against the same seeds before: armies of 10+ regiments with a general
      0% → 92–96%; attackers losing 30% → 20% of battles; wars declared per decade after 1470 4.8 → 5.2; realms alive
      in 1700 25.5 → 26.1; France independent in 15 of 16 (median 22 regions, colonies included, from 16), Austria in
      12 (median 8, from 6), England in 12 (from 15), the Ottomans in 15 (median 26.5, from 28.5).
    - Losing a war: at 99% leverage the enemy leader stops proposing and sends an ultimatum (`ULTIMATUM_SCORE`),
      never asking more than its leverage buys (`fitTerms`). You have a month (`ULTIMATUM_DAYS`) to make peace or
      push its leverage below 99%; otherwise its terms are imposed. At any time you may offer your own peace instead:
      any of your regions or gold. Land the enemy claims, wants, holds or borders (or the war goal) is worth its full
      price to them, far-off land half (`concessionValue`); they accept when the offer covers their leverage, and
      an offer that gives everything their ultimatum asks always does.

## Key numbers (all in `src/sim/`)

| Thing | Value |
| --- | --- |
| Speeds | 1.5 / 3 / 6 days per second |
| Tax | 0.3 gold per development per month × (1 + 5%/stability + ruler skill − 3 × 5% + modifiers); half for non-cores |
| Trade centres | 1.2 + 0.12 × development per month |
| Manpower | 3,000 + 400 per development (half for non-cores); recovers 1/60 of the maximum per month |
| Force limit | (6 + development / 2.5) × (1 + modifiers) regiments; upkeep rises above it |
| Upkeep | infantry 0.18, cavalry 0.36, artillery 0.42 gold/month (half in peacetime pay) |
| Battle | daily d10; attacker (the army that marched in) −1 in rough terrain (−2 mountains, −1 river; none in a pitched battle); damage = roll × front-line power × (1 + 0.1 × the best general's stars); casualties = damage × 6; morale loss = damage × 0.069 / regiments / (1 + 0.1 × the losing side's general's stars) |
| Generals | 1-5 stars (hired: 25/35/25/12/3%; a ruler: skill × 0.7, +1 for a warrior); each star +10% to battle damage, steadiness, march speed (days ÷ 1.1 per star) and siege speed |
| Front width | plains 20, forest and hills 14, marsh 12, mountains 10 |
| Stack wipe | winner's men ≥ 5 × loser's remaining men |
| Sieges | 15 days without a fort; 75 days per fort level, +10% speed per artillery regiment (max +150%); a battle at the walls pauses the siege |
| Supply | 10/7/7/5/5 by terrain + 0.8 × development (+3 in friendly land), × 0.6 in northern/eastern winters |
| Threat | +2.5 × development per region taken (× 0.6 if claimed); decays 0.12 + prestige/500 per month; coalitions form at 40 felt Threat with 3+ members |
| Peace cost | 3% per development per region (× 0.7 if claimed, × 2 for the capital of a realm of 3+ regions), 2% per development to vassalize, 1% per 10 gold |
| Development cost | 20 + 8 × (dev + 1)^1.5 gold, +5% per level already bought |
| Science a month | (1 + 0.6 × average prosperity of your 5 richest regions (all of them if fewer) + 0.15 × √total prosperity + 0.4 per trade centre (5 max) + 0.5 per university) × learning (0.6 West Africa … 1.35 Florence) × 1.25 if funding scholars (10% of income) × (1 + 5% per order) × (1 + modifiers) |
| Advance cost | base (600 … 7,500) × (1 + 5% per year before its historical year, or −1.2% per year after, to 60%) × (1 + 1% per region beyond 10, +50% max) × (1 − 10% per neighbour who knows it, 3 max) × (1 + modifiers) |
| University | 150 gold, +100 for each one you have; prosperity 5+ |
| Expedition west | 100 gold, 8 months, needs Ocean Navigation; everyone knows the New World by 1500 |
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
