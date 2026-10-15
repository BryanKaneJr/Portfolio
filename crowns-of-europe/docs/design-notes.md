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
9. **Audio is not in yet** (no assets). Haptics (phones only, not the web) on selections and on every successful order.
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
    a pikeman or a ship drawn on them and the count beneath. Moving an army: its sheet opens low, so the land
    around it can be tapped (a tall sheet used to cover it, which is why armies seemed impossible to move); while
    you give orders, a near miss on another of your units is a march order, and switching units takes a tap on its
    token. Selecting something never moves the map (the owner disliked the map gliding to whatever was tapped):
    only a drag, a pinch, "Show on map" or an outliner entry does.
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
    tower or a castle by the region's name (later towns at their real places: 28). (Later the armies became the owner's own soldier drawings under each
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
    (`seesUnit`); rebels when they rise against you or a friend. Past play zoom, names, forts (now towns: 28) and tokens grow partway
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
    found armies vanishing, slipping past each other and left stranded, and an AI that seldom used generals and
    misjudged attacks. Fixed:
    - Nothing vanishes without a word. A beaten army retreats by land or on its own transports; if it has no way
      out it scatters, its men counted as losses and the report saying so. A retreat whose road closes stands down;
      every next step of a march is checked again (a strait closed, transports gone, access ended) and stops with a
      message. Recruits finishing in land the enemy holds muster in another region, or the money comes back.
    - Enemies marching past each other on one road meet and fight. The army that marched in attacks with the
      terrain and any river against it; when both sides were already standing there (a war declared, rebels rising)
      the battle is pitched and nobody suffers that.
    - At peace, armies in land they may no longer enter march home, access ignored on the way out
      (`sendHomeAfterPeace`); once a month any other stray does the same (`monthlyStrays`).
    - The AI puts generals in the field (`aiGenerals`; a skilled ruler with an heir leads its largest army of 8+
      in person, and a new ruler takes the old one's place), and asks a battle forecast (`forecast.ts`: battle.ts's own
      rules at the average roll, in days each side would hold out) before it moves: it attacks only where it would
      hold out 1.5 times longer; joins up or falls back from an enemy stack that would outlast it twice over; and a
      stack the nearest enemy would outlast three times over gathers with a bigger army instead of walking out
      alone. It counts only allies that would answer and could reach the fight, and lets go after a year of a war
      neither side can carry to the other. A lesser crown with nothing it wants next door forges a claim on a
      clearly weaker neighbour; a great crown follows its aims, missions, rivals and faith.
    - Wars that stay in proportion. A crown counts its allies for no more than its own might when it weighs a war
      (Scotland, on France's back, was taking England's heartland a region a war, and England died in 10 of 16 AI
      games). An AI war for one border region is a limited war: won by its attackers, it takes that region and gold,
      nothing more. Only a loser's last region, not its capital, may be taken from afar. A crown rests after
      declaring a war or making peace in one (note 32): a year and a half with no war, then appetite returning by
      3/3/4/5 years (expansionist, opportunist, trader, defensive); past the
      Threat at which coalitions form, each 10 Threat asks a tenth more might; and a great crown without a reason
      for war needs 2.5 times the might (others 1.8).
    - The AI never marches down a road through an enemy stack it would not clearly beat, its forecast counts the
      enemy armies marching out of a region as well as those standing in it (a battle there catches both), and
      recruits never muster beside an enemy army (they go to the nearest region with none, or come back as gold).
    - Measured over 16 AI-only games to 1700, against the same seeds before: armies of 10+ regiments with a general
      0% → 90–100%; the attackers in battles an AI army marched into on purpose lose 12–17%; wars declared per decade
      after 1470 unchanged at 4.8; realms alive in 1700 25.5 → 27.3; England independent in 14 of 16 (from 15), Austria 11
      (from 12), France 11 (from 14: four of the others in a personal union, keeping 14–19 regions), Burgundy 15
      (from 12), the Ottomans in all 16 (median 20 regions, from 28.5).
    - Losing a war: at 99% leverage the enemy leader stops proposing and sends an ultimatum (`ULTIMATUM_SCORE`),
      never asking more than its leverage buys (`fitTerms`). You have a month (`ULTIMATUM_DAYS`) to make peace or
      push its leverage below 99%; otherwise its terms are imposed. Its terms are shown, signed and imposed as they
      stand that day (land still theirs to take, no more gold than you have). At any time you may offer your own peace instead:
      any of your regions or gold. Land the enemy claims, wants, holds or borders (or the war goal) is worth its full
      price to them, far-off land half (`concessionValue`); they accept when the offer covers their leverage, and
      an offer that gives everything their ultimatum asks always does.

28. **Towns at their real places instead of forts beside the names (on request).** The towers and castles drawn just
    before each region's name moved whenever the name grew with the zoom. Now every region has its chief town of
    1444–1750 in `regions.json` (`town`: its period name and real [lon, lat]: Paris, Bursa, Adrianople, Edinburgh,
    Candia...; in the New World and uncolonized Africa the main native or later colonial town), projected like the
    rest of the map by `build-map` and nudged a few units inside the region where a coarse coast leaves a port in the
    sea (it lists every move). The town is drawn there, fixed, once someone owns the region: a village, a town or a
    city by prosperity (below 4, below 6, then cities: about 30/40/30% in 1444), inside walls where the region has a
    fort, so the fort still shows. Rendered from the same CC0 KayKit pack as the forts were (houses, a church, a
    keep, walls and corner towers), in the same inked 3/4 view. They lie under the region and nation names and the
    units, show from the zoom where the region names do and grow with the zoom like them, and are not tap targets.
    At first they showed only in regions whose name was written, a rule left over from the forts beside the names, so
    12 small regions lost their town at play zoom: Constantinople, Genoa, Cyprus and Candia until zoomed in further,
    and the Azores, Madeira, Cape Verde and the Lesser Antilles never (they needed more than the closest zoom). Now
    every owned region shows its town, capped in a small one to about the region's own size (2.2 times its label
    radius on screen, at least 10 points), so an island gets a small mark that leaves the land showing.

29. **Colonization reworked (on request).** An audit found one land rush that ended around 1600 and left colonists
    idle for 150 years, England and France shut out until about 1550 (the only base colonist needed Galleons and 30
    prosperity at home), natives as a chore with a cliff (unguarded colonies wiped out; one parked regiment made them
    perfectly safe), colonies being settled that no war could touch while founded ones fell in 15 days for little
    leverage, and no list of where to settle. Now:
    - Every Christian crown with an ocean coast gets a colonist with Ocean Navigation; Galleons and a great realm
      give a second. Policies, being first to the New World, events and missions add more.
    - Starting a colony where natives live is a choice: trade with them (settlers lose 15% of their pace; no attacks
      unless they are fierce, then half as often; at founding they join, +1 prosperity per 2,000 of them, without
      resentment) or take the land (slower the more of them there are, attacks unless guarded, they dwindle and the
      few left resent it). A trading colony may take the land later, never the reverse.
    - Paid guards (0.5 gold a month) keep a colony safe from natives without parking an army there.
    - The Colonies tab lists where to settle: each site's settlers a month (the quicker way), years to found, export
      and its gold at founding, and a mark where even trading settlers would be attacked.
    - With no land left, a colonist grows one of your New World colonies: +1 prosperity per 500 settlers up to 8. The
      newest is called back if you lose colonists (a charter ends). An AI with colonists leaves its colonies below 8
      to them instead of buying their prosperity.
    - Colonial wars: an enemy army standing in a colony being settled kills 20 settlers a month per regiment (200 at
      most) unless troops of the founder's or a friend's are there; AI armies raid colonies on their own shore, and
      the AI never settles beside hostile troops nor, for five years, where raiders wiped out a colony of its. A
      founded colony holds out 60 days. At war, the AI raises a couple of regiments where they can march to a
      threatened colony (never past its army limit, nor when its troops there already match the enemy), and armies
      across the ocean with enemies on that shore stay to fight; at peace, troops stranded overseas keep a small
      garrison and the rest sail home or disband.
    - Settler events (a hurricane, fever, a harvest) hit one colony, not all of them.
    - Measured over 8 AI-only games to 1750 against the same seeds before: England's and France's first colonies
      1555 → 1493 (Portugal and Castile about 1493 as before); the free land gone by 1575 (from about 1600);
      colonists busy (settling, then growing) until about 1620, where before they idled from 1600; a median of 5
      colonies a game lost to raids, almost none to natives; exports in 1700 about 22% of Portugal's income, 6–18% of
      England's and France's (as before).

30. **Time stops only for what matters; real sums; disbanding asks first (on request).** The owner, playing on a
    phone, found every little thing pausing the game. As in the genre's best-known games, the clock now stops by
    default only for events (they need a choice), a war declared on you, an ally attacked and calling you to arms,
    an ultimatum, and the end. Peace proposals and other offers, battles, sieges and arrivals arrive as a notice
    (tap to open) and wait under the bell, each with the day it lapses (a lapsed call to arms counts as a refusal,
    and says so); every kind can be set to pause in Settings, and old saves have offer pausing switched off once.
    Only waiting events hold up time. Event and mission choices show what they will do in your realm, worked out
    by applying their effects in order on a copy of the game ('Pay 31 gold', not '1.5 × your prosperity'). Disband
    takes a second tap, and says what comes back (levies, the general) and what is lost (mercenaries).

31. **The claims of 1444, with their stories and end dates; a calmer opening (on request).** The owner asked for
    crowns to start with the reasons for war they really had, against the realms they had them on, each lapsing,
    without the AI warring left and right. The 44 old starting claims of 22 crowns lasted for ever, and several were
    never fought over (Provence, Naples, Bohemia, Finland...). There are now 22 for 15 crowns, each a quarrel of the
    day that lapses on 1 January of the year it was settled or had to be pressed: France on Normandy, Gascony and
    Calais (the Hundred Years' War, 1475); Castile on Granada (the Reconquista, 1500); the Ottomans on Constantinople
    and the Morea (1470), Bosnia (1470) and Albania (1480); Poland on Danzig and Prussia (1466); Milan and Venice on
    each other (the wars in Lombardy, 1454); the Habsburgs on the Swiss Aargau (1474) and the crown of Hungary
    (1491); Moscow on Novgorod (1480); Burgundy on Lorraine (1477); Scotland on Berwick (Yorkshire, 1482); Portugal on
    Fez (1480); Hungary on Serbia (1460); Byzantium on Thessalonica (1460); Karaman on Ankara (1470); Songhai on
    Timbuktu (1475). The war screen shows a claim's story and the year it lapses, and so do the realm menu, the region
    sheet ("Your claim to 1500", "Claimed by Castile") and a crown's sheet ("Their claims on you"). In old saves the
    claims of 1444 still on the list are cut to the same years, once, unless an event has since granted the same
    claim again; the dropped ones stay as they were.
    - So that the AI doesn't press them all in the first spring, every crown starts as if it made peace at some time
      in the last three years (Arras, Tours and Szeged were all recent), and its first war waits for its rest to run
      out.
    - With claims lapsing, the great crowns fell back on wars without any reason: France on Lorraine, Genoa and the
      Pope, the Ottomans on the Qara Qoyunlu every ten years. The AI no longer declares such wars: a crown that would
      have forges a claim first (a year and 40 gold, on the land it wants there or the richest region on the border)
      and fights for that region a year later if the odds still hold.

32. **War chance: a monthly roll on a day of its own (on request).** The AI used to weigh war on the 1st of each
    month (none in March) with a flat 0.3/0.2/0.1 chance by its bent, once a fixed rest of 3/3/4/5 years was over.
    The owner asked for a percentage a year, divided by 12, with no set schedule. Which neighbour a crown picks, the
    might it needs for it (with the Threat brake), and the hard gates (order below 0, war exhaustion above 5, more
    than 3 loans) are unchanged; only when it declares changes.
    - The schedule: each AI crown draws a day of the next calendar month (`ai.warRoll`, `randomDayOfNextMonth`) and
      on that day weighs a war (`dailyWarRolls`, after the monthly systems): every month, March included, a day that
      differs between crowns and from month to month. One draw for the day, and one decision draw only past every
      gate.
    - The formula (`warOdds` in ai.ts, shown on a crown's sheet as "War chance"): % a year = base by bent
      (expansionist 40, opportunist 25, trader 12, defensive 8) × size (great 1, middle rank 0.85, minor 0.7: small
      expansionists are tamed) × rest (0 at 1.5 years after its last war or peace, rising to 1 at 3/3/4/5) ×
      treasury (0.5 + 0.5 × gold / reserve, 0.5–1.5; the reserve is 40 + 4 months' income, before the first
      month's books the income that month will record) × debts (1 − 0.15 a loan) × order (1 + 0.1 × (order − 1)) ×
      war exhaustion (1 − exhaustion / 10) × levies (0.4 + 0.8 × levies / maximum, 0.4–1.2) × ruler (warrior or
      ambitious 1.25, craven 0.6, a regency 0.6) × a coalition against it 0.5, then times the target's factors:
      might (0.5 at exactly the might it needs, +1 per 1× more, 2 at most), reason (claim, lost land, independence
      1; coalition 0.8; rival 0.7; faith 0.6; none 0.5, which only forges a claim), land it wants (1 + 0.25 per
      point of desire, 2 at most) and the Emperor's peace (two members of the Empire: 0.6 for a claim or lost land,
      0.3 otherwise). The month's chance is that ÷ 1200, at most 15% (86% within a year).
    - A declaration rests the crown that declares it (any declaration: AI, coalition, event, independence); every
      peace, separate peace or war ending without one rests everyone in it, a crown made a vassal in it too. Wars
      record who started them (`War.origin`).
    - Truces: 5 years after a white peace or leaving a war, a year more for every 5% of leverage the deal is worth,
      at most 15 (`truceYears`); the peace screens show it. A lesser crown no longer forges claims on a fellow
      member of the Empire or a crown it has a truce with.
    - A crown that holds a claim on a neighbour whose truce with it ends within two years (`TRUCE_WAIT`) waits for
      that war (the war on the land's overlord, a neighbour it is not allied to, and a claim that outlives the
      truce): no other war, no claim forged elsewhere; its sheet says "Waiting until 1448". Without it, France
      spent the last years of the truce of Tours forging and fighting over Brittany, was resting when the truce ran
      out, and found England allied to Burgundy: England kept Normandy in 5 of 8 games.
    - The price of a war without a reason (owner's request: steep enough to stop a player spamming wars) is 1 order,
      10 renown and 20 Threat, 10 more for each other such war in the last 10 years (`unjustThreat`), every crown
      thinks 25 worse of the attacker (fading 0.5 a month), and land taken in it adds 1.5 times the usual Threat:
      two in ten years bring a coalition near (40); the extra Threat for land is the aggressor's alone (a victim
      that wins pays the usual). Breaking a truce costs 3 order, 30 renown and 30 Threat, every crown thinks 40
      worse, and no ally answers the call (subjects still follow; the war screen lists none); a war an event starts
      is exempt. The war screen shows the exact cost, the crown's own Threat modifiers included. The AI does
      neither: it never picks a neighbour under truce, a subject never rises in a truce with its overlord, and with
      no reason the AI forges a claim.
    - `npx tsx scripts/dev/warchance.ts [year] [seed] [--opening]` prints each crown's chance and what makes it up;
      `--opening` models the first years' wars and the Ottoman opening in under a second.
    - England and Burgundy are old enemies from Arras and the siege of Calais until 1455, past the last of the
      Hundred Years' War (a new bond; it ends then so England's mission for the Burgundian alliance stays open), and
      a bond now counts in alliance talks (+25 old friends, −50 old enemies): England had allied with Burgundy by
      1447 in AI games, and France, waiting out the truce of Tours, found the English lands out of its reach.
    - Measured over 8 AI-only games to 1560 against the same seeds with the code before the claims of 1444 changed
      (`scripts/dev/aiwars.ts 116 1 2 3 4 5 6 7 8`, `scripts/dev/opening.ts 1 48 1450`): wars declared 95.5 → 75 a
      game; in the first two years 13 → 2, in the 1440s 17.5 → 5.5; holy wars 25 (as before); wars between members
      of the Empire 4 → 0; realms alive in 1560 33.5 → 39; Constantinople Ottoman by 1446-1448 (median 1446.5; 1445
      before) and by 1450 in 47 of 48 games (the other by 1453); France holds Normandy in 5 of 8 and Gascony in 5 (7 and 4
      before); France 25 regions (18), England 13 (12), Castile 22.5 (22.5), the Ottomans 23.5 (21.5); the Ottomans
      start 17.5 wars to 1560 (17.5), France 11.5 (12.5), the Habsburgs 0 (3.5). The Habsburgs and Hungary stay
      small (3 and 0 regions; 6.5 and 2.5 before). Carried on to 1700 (8 games, just before the review's last
      fixes): 28.5 realms alive, and England, France and Austria alive in all eight (England in 14 and France in 11
      of 16 before).

33. **Everything between you and the others, in one place (on request).** The owner asked for the Diplomacy tab to
    say what claims they hold and other ties with other crowns. Under Wars it now has, each section hidden when
    empty and every crown or region a tap away: Danger (a coalition against you; neighbours whose war chance is
    aimed at you, with their reason in words, such as "Claims on you" or "Holy war", not a percentage, which is
    on their sheet; one waiting out a truce with a claim on you, or resting with one, and until when), Claims (yours, with who holds the land, its 1444 story and the year it lapses; the one your clerks
    are forging and when it is ready; claims on your land and your subjects', and by whom), and Ties (overlord,
    allies, subjects, royal marriages, who lets your armies through and whom you let through and until when,
    truces and their end, rivals both ways, old friends and old foes with the bond's name, the coalition you are
    in). The figures come from one pure function, `diplomaticTies` (src/sim/ties.ts), tested on the 1444 start.

## Greater crowns (`formables.json`, `sim/crowns.ts`)

The owner's favourite thing in this kind of game: Naples becomes the Two Sicilies, then Italy, then, with luck, the
Roman Empire. There are 28 greater crowns, by region (Spain for the Iberians, Russia for the Rus', Romania for
Wallachia and Moldavia, Mexico for the Aztecs and their neighbours, and so on), so every realm but the Haudenosaunee
has one to aim at.

- **Who may proclaim:** each crown lists its formers: nation tags, or smaller crowns that lead on to it. Before any
  crown, a realm uses its own tag; after one, only its crown counts. So a crown leads on only to a bigger crown that
  names it (Naples → Two Sicilies → Italy → Roman Empire), and the Ottomans can never proclaim Greece.
- **When:** at peace, no one's subject, order 0 or better, the year at least the crown's `from`, holding every key
  region and `need` of its lands. Lands held by junior partners in a shared crown count (never the player's lands for
  a computer realm). Each crown is proclaimed once a game.
- **What it does:** the realm takes the crown's name, adjective and arms, and usually its colour (a crown with
  `inherits: X` shows its own colour only when X proclaimed it or is gone, so two living realms never share one). It
  gains a permanent modifier (a chain's bonuses stack), +20 renown, and 25-year claims on the crown's lands it still
  lacks that border it (or a subject) plus the crown's extra `claims` (the Two Sicilies: Sardinia and the Romagna;
  Italy: Constantinople). Junior partners keep their own crowns. Ruler, treasury and capital stay. Nothing else
  changes: the tag, its missions, aims and events are the realm's own.
- **Tuned after measuring the whole batch** (8 AI games to 1560 against the code before it): proclaiming used to
  absorb junior partners and claim every land of the crown, and Denmark's Scandinavia took Sweden in 7 games of 8,
  Poland's Commonwealth Lithuania in all, Castile's Spain Aragon; realms alive in 1500 fell from 53.5 to 47.5 and
  claim wars rose by a quarter. Partners now stay, and claims reach only bordering lands.
- **The computer** proclaims every January, realms in id order, the first crown in file order it may: no randomness,
  at most one a year. The Roman Empire and Francia are for players only. The player is told once, as important news,
  when a crown comes within reach, and proclaims it from Realm → Greater crowns.
- **Measured for the whole batch** (8 AI-only games to 1560, seeds 1-8, against the code just before it; crowns,
  the 108 history cards, the bug fixes and the tuning above together; `scripts/dev/aiwars.ts`, `scripts/dev/crowns.ts`,
  `scripts/dev/opening.ts 1 48 1450`): wars declared 75 → 78.5 a game (2 in the first two years, as before); realms
  alive in 1500 53.5 → 47 and in 1560 39 → 38.5 (the extra early deaths are mostly history's: Provence, Navarre, Tver,
  Cyprus, the Knights); Constantinople Ottoman by 1450 in 46 of 48 games (47 before); England 12 regions in 1560 (13; 2
  in one game of 8), Sweden 3.5 (2), France 26.5 (25), the Ottomans 24.5 (23.5). The computer proclaims 4-7 crowns a
  game: Burgundy's kingdom 1465 (4 games of 8), Scandinavia 1500 (7), Persia 1500 (5), the Commonwealth 1550 (8),
  Spain 1476-1540 (3), Russia 1479-1557 (3), Ghana (3), the Netherlands 1560 (3), and once each the Two Sicilies,
  the Abbasid Caliphate, the Golden Horde, Ireland's high kingdom and Mexico. Of the 108 history cards, 40-45 fire by
  1475 and 55-63 by 1560. The Great Horde still falls early (1450, 1462) in 2 games of 8.
- **Shown** through the display layer (`displayIn`/`nationName`/`nationAdj`/`nationFlag` in `content.ts`), so log
  lines, war names, map labels, colours and arms all follow the crown; nothing stores the old name.

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
| Sieges | 15 days without a fort (60 for a founded New World colony of a crown its owner still holds: the settlers hold out); 75 days per fort level, +10% speed per artillery regiment (max +150%); a battle at the walls pauses the siege |
| Supply | 10/7/7/5/5 by terrain + 0.8 × development (+3 in friendly land), × 0.6 in northern/eastern winters |
| Threat | +2.5 × development per region taken (× 0.6 if claimed); decays 0.12 + prestige/500 per month; coalitions form at 40 felt Threat with 3+ members |
| Claims | Forged: a year and 40 gold, lasting 25 years. Of 1444: 22, each until 1 January of its year (1454-1500). With no reason for war the AI forges one instead of marching |
| War chance | Bases 40/25/12/8% a year (expansionist, opportunist, trader, defensive) × the crown's and its target's factors, ÷ 12 a month, at most 15% a month; none for 1.5 years after a war or peace, full again by 3/3/4/5 years (the first rest begun 0-3 years before the start) |
| Truces | 5 years + 1 per 5% of the deal's value, up to 15; leaving a war 5. A crown with a claim on the other side waits out the last 2 years for that war |
| Unjust war | 1 order, 10 renown, 20 Threat (+10 per other one in 10 years), every crown −25 opinion; land taken in it ×1.5 Threat |
| Broken truce | 3 order, 30 renown, 30 Threat, every crown −40 opinion, no ally joins (not for an event's war) |
| Peace cost | 3% per development per region (× 0.7 if claimed, × 2 for the capital of a realm of 3+ regions), 2% per development to vassalize, 1% per 10 gold |
| Development cost | 20 + 8 × (dev + 1)^1.5 gold, +5% per level already bought |
| Science a month | (1 + 0.6 × average prosperity of your 5 richest regions (all of them if fewer) + 0.15 × √total prosperity + 0.4 per trade centre (5 max) + 0.5 per university) × learning (0.6 West Africa … 1.35 Florence) × 1.25 if funding scholars (10% of income) × (1 + 5% per order) × (1 + modifiers) |
| Advance cost | base (600 … 7,500) × (1 + 5% per year before its historical year, or −1.2% per year after, to 60%) × (1 + 1% per region beyond 10, +50% max) × (1 − 10% per neighbour who knows it, 3 max) × (1 + modifiers) |
| University | 150 gold, +100 for each one you have; prosperity 5+ |
| Expedition west | 100 gold, 8 months, needs Ocean Navigation; everyone knows the New World by 1500 |
| Colonists | 1 for a Christian crown with an ocean coast and Ocean Navigation; a 2nd with Galleons and 30+ prosperity at home; +1 each from Overseas Charters, being first to the New World (30 years), Navigators, events and missions. Each settles one colony or grows one region at a time |
| Colony | 30 gold + 1 gold/month; 1,000 settlers at 9/month (+3 next to your land, + modifiers), −45% inland, −6% per New World region owned (60% at most); natives: by force −7% per thousand (50% at most), trading −15% |
| Natives | By force: attack chance a month = natives × hostility × 0.25% (20% at most), killing 50 + 25 × natives settlers; they dwindle 0.02k a month (and 0.5k at 5% a month with a guard); at founding +1 prosperity per 3k, their faith stays at 3k+, +2 unrest for 5 years at 2k+. Trading: no attacks (half the chance if fierce), no dwindling, at founding +1 prosperity per 2k there at the start, no unrest (their faith stays at 3k+ too). A trading colony may turn to force, never back |
| Guards | Your troops in the region (free) or paid guards (0.5 gold/month): no native attacks |
| Raids | An enemy army in a colony being settled, with none of the founder's or a friend's there: 20 settlers per regiment a month (200 at most); at 0 the colony is lost |
| Growing a colony | A free colonist in a founded New World region of yours: 1 gold/month, settlers as a colony (no natives, no neighbour bonus), +1 prosperity per 500 up to 8; ends if the region is lost or occupied, or if the nation has fewer colonists (the newest first). An AI with colonists leaves its colonies below 8 to them rather than buy prosperity there. Unaided, colonies grow +1 every ~15 years up to 5 |
| Trade goods | value × (0.5 + 0.1 × development): silver 2.0, gold 1.8, sugar 1.1, tobacco/cocoa 0.9, dyes 0.8, furs 0.7, fish 0.6, grain 0.4 |

## Status

Verified: `npm run check` (typecheck, lint, content validation, 28 simulation tests including colonies, ocean
convoys, native battles, a 25-year AI soak and save/load determinism) and three Playwright walkthroughs of the web
build at iPhone size (title, nation picker, map, every sheet and menu tab, war declaration, marching through a
strait, sieges, events, offers, peace screen, map modes; the uncharted Atlantic, an expedition, discovery, colonies
taken by force and by trade, guards, a colony grown, a raid in the outliner, the Colonies tab with where to settle,
trade goods and an army crossing to Brazil) with no runtime errors. The simulation runs at about
2.8 ms per day on a laptop (the bigger map and ocean routes cost about 0.8 ms more than before).

Not yet done:

- **Run it on a physical phone.** Gestures (pinch around the fingers, pan, tap) and SVG performance have only
  been checked in a browser. Test on a small phone (iPhone SE size) early, as the design doc asks.
- Audio (period music, battle and UI sounds).
- Balance passes over full 300-year campaigns: AI expansion pace, coalition frequency, late-game income, and the
  colonial race (in AI-only games the coasts are mostly settled by about 1600–1650, faster than history).
- AI navies: the AI rarely builds transports, so overseas wars are mostly fought by troops raised in the colonies.
- Store assets, bundle identifier (`com.crownsofeurope.app` is a placeholder) and EAS configuration.

## Fun batch 1: bug fixes

- **Armies march unless the sea is clearly faster.** Routes are ranked with a day at sea counted double and 6 days
  added for taking ship; the days shown are still the real ones. Islands and lands with no road still sail.
- **Generals' names** come from houses of the realm's own people that were around in 1444 (or a title where
  surnames were not used): `names.json` `generals`, one list per name group, `{first}` for the first name.
- **Regnal numbers** follow each featured crown's real list (`names.json` `regnal`, with `aliases` for the
  English spellings of the starting rulers): France's next Charles is VIII. No random skips, no cap.
- **A rising with no region named** breaks out in the realm's most restless region away from the capital with
  none of its armies in it, not on top of the capital's army. Beating rebels counts as a win but sets no record
  for the achievements (best ratio, armies annihilated).
- **A generic card does not come back** to the same realm for 10 years.
- **An autosave per campaign**, the 3 newest kept. The store gives a new game its campaign id; old saves keep
  the one old slot.
- **Conquest follow-ups (`onPeace`)** fire on the day the peace is signed instead of at the next month.
- **Old friends never become rivals** (a `friends` bond refuses it, for the player and the AI).
- **At most four royal marriages per house** for new matches (those of 1444 stand); each one a house already has
  makes another less welcome.
- **Science never sits idle:** after an advance, your scholars go on down the same track, else to what an adviser
  would pick, and the log says so.
- **Mercenaries** can't be hired where an enemy army stands.
- **Army tokens stand on their own land:** under the region's name, else with the banner beside it, above the name,
  at the town, or on the name (`ui/map/anchors.ts`).

## Every nation playable

All 73 nations can be picked. Each has a `difficulty` and an `area` in `nations.json` (the validator requires both,
from a fixed list of areas). `playable` now only means "featured": those 22 sit in the picker's Suggested starts strip,
and below it every nation is listed by area, easiest first. A dot on each card gives its difficulty. The detail
panel says when a nation starts as someone's vassal or junior partner, or as a New World people, and which greater
crowns it can proclaim (read from `formables.json`, following a crown on to the crowns it leads to).

- **The player keeps their crown.** A `personalUnion` or `inherit` effect aimed at the player does nothing; the
  log says "<Nation> claims your crown; your lords refuse." Spectated games (`__spectate`) are unchanged. The one
  exception is a shared crown the player chose on a card (Brittany's heiress, Portugal's heir, Krujë to Venice):
  that choice sets the nation flag `accepts_union_<who>`, and that realm's union then goes through. A union never
  takes a realm that is already someone else's subject (the claim lapses; the log tells the player if it was theirs).
- **New World peoples** (Aztecs, Maya, K'iche', Haudenosaunee) see their own lands from the start: the map, the
  region and sea sheets and the picker's small map draw the Americas instead of parchment. They study nothing
  (`availableAdvances` is empty; the Science tab says "Your people follow their own ways"), colonizing does not
  concern them (`colonialCrown` is false), European-flavoured era cards and `gen_university`/`gen_tournament` pass
  them by (`"native": false`), and the discovery brings them "Strangers from the Sea" instead of "A New World".
  Their generic missions leave out those that need allies or colonies, and "A Name Abroad" is no longer locked
  behind "Friends Abroad".
- **Checks.** `tests/playable.test.ts` starts every nation and plays 60 days with a passive player: no crash, no
  game over and no union with the player; each New World people can order a one-step march (the Maya, hemmed in,
  after declaring war). `npx tsx scripts/dev/playall.ts [years] [ids...]` does the same for longer and prints one
  line per nation. Over 3 years (seed 1) a passive Genoa, Bosnia or Granada is annexed; that is balance, not a
  fault.

## Moments, goals, speed, odds

The first, simple pass at "the fun stuff".

- **Moments** (`log.ts moment()`, kept to the last 20 in `s.moments`). The great turns of a game:
  - **Card or banner.** A moment is a card when the player caused it or is a principal in it. Everything else is a
    banner that never stops the clock.
  - **Cards:** a peace the player signed as a war leader, or one where land of theirs changed hands; a mission
    claimed; an achievement; another crown joining theirs in a personal union; a crown proclaimed (pushed by
    `crowns.ts`).
  - **Banners:** a peace they only fought in; a new ruler; their capital lost; a fortress or capital taken by or
    from them; rebels rising against them; an enemy army crossing into their land (once a month for each enemy);
    and the headlines: Constantinople changing hands, a great crown joining a union or ceasing to exist, a new
    Emperor, the New World found, a coalition forming against the player.
  - **Showing them.** Every card that comes in one tick or command opens as one `MomentCard`: the weightiest in full
    (crown, peace, union, mission, achievement), the rest one line each under "Also". A card that comes while one is
    up joins it. Cards wait behind an offer, report or event card. A card stops the clock, and lets it run on when
    closed if it was running. A banner is a notice: tap it to show the place on the map, or to open it as a card.
  - **Determinism.** A moment never draws on `rand()` and never takes an id from `s.seq`: army and battle ids steer
    some choices, so taking one would change the game. Its id is the day and its place that day (`m3650.2`).
- **Next goals** (`sim/goals.ts nextGoals`, `GoalStrip.tsx`). Up to three one-line chips under the top bar:
  - **Order:** a mission (or crown) ready to claim; a claim to press now, or the next truce to run out; the mission
    nearest done; a claim being forged; a colony's settlers; the next advance (or "Pick an advance"); the nearest
    greater crown.
  - A ready chip is gold. Tapping one opens Missions, Learning or the Realm, or shows the region.
  - The strip is hidden while a sheet or card is open, and recomputed each day and after each command.
- **8× for quiet years.** Speeds are 1×, 2×, 4× and 8× (`state/speed.ts`). 8× is refused while the player is at
  war (the clock stays at the speed it had), and drops to 4× when a war starts.
- **Odds before an attack** (`forecast.ts attackOdds`). These cover the first fight on an army's road, where enemies
  it can see stand. Every army of the owner bound for that place is counted with it.
  - **Verdict:** favoured (the forecast's hold-out ratio is 1.25 or more), outmatched (0.8 or less), or even.
  - **Reasons:** at most two of these: the ground, a river, the generals, worn men, a 1.5× gap in men, and the troops'
    age.
  - **Where it shows:** the march order's notice ("Battle at Auvergne: outmatched."), and a line on the army sheet
    that opens the numbers. The wording is odds, never a promise.
- **A battle's why.** A battle keeps how the sides stood on its first day (`Battle.opening`). Its report keeps that
  with the ground (`BattleReport.why`). `describe.ts battleWhy` turns it into at most three lines from the player's
  side, under the report. Older reports show nothing.

## Fun batch 2 (P): Endowment

The crown endows one field of learning; one tap in the Science tab, nothing to keep up. The rule is in
`sim/endowment.ts` (one factor in `science.ts advanceCost`), the row in `ui/game/Endowment.tsx`. It is not called
Patronage: that is already the policy "Patronage of the Arts".

| What | Number |
|---|---|
| The endowed field's advances | ×0.8 ("Endowed: Sea" in the cost's why) |
| The other two fields | ×1.1 ("Endowed elsewhere") |
| First choice | free, any time |
| Changing it | once 25 years have passed since the last choice ("Change again in 1490"); never to the same field |
| Who | every crown that studies (not New World peoples) |

- **UI.** Science tab, under Fund your scholars: "Endow" with War · Sea · Statecraft (the tab's own labels and
  icons). Tapping a field arms its button at once ("Tap to endow Sea", in gilt), so it takes two taps; the button
  says how long it is locked. While locked, the other fields are dim and the row says when it can change.
- **AI** (`aiEndowment`, monthly, never changes it): Portugal, Castile and England endow Sea; otherwise
  expansionist and opportunist crowns War, defensive ones Statecraft, traders Sea if coastal, else Statecraft.
  `researchScore` divides by cost, so the AI's (and the player's scholars') next pick leans to the endowed field
  with no other change.
- **Measured** (AI-only, seeds 1–3 to 1500, against the branch point). 69 crowns endow: about 25 War, 9 Sea,
  35 Statecraft. Ocean Navigation comes 0–2 years earlier for Portugal (1477–78 vs 1479), England and Castile;
  speed is unchanged (2.7–3.4 ms a day either way). The War crowns take Pike and Shot before 1500: the Ottomans in
  1492–94 in every seed (on the branch point they took Ocean Navigation about 1480 and no Pike and Shot by 1500),
  Hungary and Poland too. With the Ottomans endowing Statecraft instead (the §5 safeguard, tried on the same seeds)
  their advances match the branch point (Ocean Navigation 1479–84, Banking 1493–98, no Pike and Shot by 1500).
  The safeguard's trigger (Musket or Bayonet more than 5 years early) needs `ottomans.ts 260` after the merge; if
  it fires, one line in `aiEndowment` sends TUR to `state`.

## Fun batch 2 (L): Landmarks
Fifteen famous places, each with one fixed bonus for whoever holds its region. The idea is borrowed (great
buildings that reward the realm holding them); the rule, names, wording and pictures are our own. No building, no
upkeep, no upgrades, and nothing to manage: take the region and the bonus is yours.
- **Data.** `content/landmarks.json`: `{ id, region, name, mods, text }` (a `kind` naming its pictogram until the
  owner's paintings came, below), loaded as `LANDMARKS` and
  `LANDMARK_AT` (region → landmark) in `content.ts`. Each has exactly one modifier key, sized like a policy's single
  line, and a history line of at most 90 characters. `npm run validate` checks the region, one landmark per region,
  one known key, a picture for it and the text's length (`landmarkErrors` in `sim/landmarks.ts`), and
  `check-terms.ts` reads the file.
- **Rule** (`sim/landmarks.ts`). `landmarksHeld(s, n)`: the landmarks whose region `n` owns and controls. An occupied
  landmark gives nothing to anyone until it is free. `modifierSources` (queries.ts) lists each one under its name,
  so it shows in the Realm tab's modifier list with no more work. `territory.ts` refreshes the cached modifiers when
  a landmark's region changes owner (`transferRegion`, annexation, release) or controller (`setController`), and the
  player gets a banner (a `headline` moment): "Hagia Sophia is ours" or "Hagia Sophia is lost".
- **The fifteen and their bonuses** (starting holders in brackets; only the Mamluks hold two, neither for war):

  | Landmark | Region | Bonus |
  |---|---|---|
  | Hagia Sophia | Constantinople (BYZ) | −1 unrest |
  | St Peter's | Rome (PAP) | +10 opinion of you |
  | The Duomo | Tuscany (FLO) | +10% science |
  | Dome of the Rock | Palestine (MAM) | +15% trade income |
  | Notre-Dame | Île-de-France (FRA) | −20% cost to raise order |
  | St Stephen's | Austria (HAB) | +1 diplomatic skill |
  | Westminster | London (ENG) | +10% tax income |
  | The Alhambra | Granada (GRA) | −15% cost to invest |
  | The Kremlin | Moscow (MOS) | +20% fort defense |
  | The Arsenal | Veneto (VEN) | −25% ship cost |
  | The Pyramids | Cairo (MAM) | +25% renown gained |
  | Templo Mayor | Anáhuac (AZT) | +15% levies |
  | Djinguereber | Timbuktu (MAL) | +10% science |
  | Charles Bridge | Bohemia (BOH) | +10% movement speed |
  | The Giralda | Andalusia (CAS) | +20% settler growth |
- **AI.** No change: a landmark is not a war aim, so the AI's wars do not move. It gains the bonus like anyone by
  holding the region.
- **Pictures** (superseded: the owner's paintings replaced them, see "The owner's landmark paintings" below;
  `ui/components/landmarkArt.ts` is gone). Fifteen gold silhouettes, one per landmark (its
  `kind` is its id), in a 24 × 24 box standing on y = 21, each the outline a player knows the place by: Hagia Sophia's
  broad block with half-domes stepping down either side of its shallow dome, and four minarets, St Peter's ribbed dome over its columned front, the Duomo's pointed dome beside Giotto's
  tower, the Dome of the Rock's round dome on its octagon, Notre-Dame's twin flat towers and rose, St Stephen's zigzag
  roof and tall spire, Westminster's Gothic gable between pinnacled turrets, the Alhambra's walls and Comares tower on
  their hill, the Kremlin's tent-roofed gate tower and onion domes, the Arsenal's twin-towered water gate, the three
  pyramids, Templo Mayor's twin shrines and stairs, Djinguereber's earthen tower and timbers, Charles Bridge's arches
  and gate tower, the Giralda's slim tower over cathedral roofs. Nothing after 1750 (no Big Ben, no 1859 Notre-Dame
  spire). 3–7 pieces each, parts kept to about 1.2 box units or more and holes and gaps to about 1.4 (or the pieces
  touch), so they hold at map size;
  each piece is filled and edged dark on its own, so overlapping pieces keep a thin edge (dome ribs, pyramid faces).
- **On the map** (the sizes below were the pictograms'; the placement still works this way, now with each painting's
  own width and height: see below) (`ui/map/landmarks.tsx`, one call in MapView after the towns, from `REGION_NAMES_K`; the place in
  `landmarkSpot.ts`, `markPlace`). 20 points at play zoom (13 read as a speck), growing like the towns, never under 12
  and capped at 2.2 × the region's label radius on screen, on a soft dark halo so the gold lifts off the painting. It
  tries the eight spots round the town first (upper right, upper left, right above, the three below, level either
  side; lifted above or dropped below the region's name where they would cover it), then a grid round the town a third
  of the mark apart, out to 4 × the mark's (or town's) size, nearest first. A spot must have its middle and foot in its
  own region and stay off the region's own name and town; it scores the share of its lower part in the region (below
  nine-tenths costing three times over), less a whole picture for standing where the region's own army stands
  (`armyBox`/`armyParts` in `anchors.ts`: the figure, the banner and the count badge; more the more of it they hide),
  a neighbour's name (more the more of it the letters cover), a neighbour's town, a landmark placed before it (within
  its own size) and, a little, a neighbour's army, and a little for each step farther from the town. The best spot
  wins; where none is clear of the army and the names with nine-tenths in, the mark is tried at 0.8 × and then at
  12 points. Tests check, at every zoom from `REGION_NAMES_K` to `K_MAX` in steps of 0.1 and with no towns, the
  smallest and the largest town pictures: the middle and foot in the region and never under 12 points; never on the
  region's army (Hagia Sophia excepted below 2.2: Constantinople is smaller than its army there, so the mark stands
  where the troops hide least of it, at play zoom just below the figure, beside the badge); never on its own name and
  at most a fifth of the mark under a neighbour's (Notre-Dame excepted below 1.5: Champagne's name runs into tiny
  Île-de-France). Placing all fifteen takes 2–4 ms on a laptop when the zoom changes (about 1 ms before; cached after). Not a tap
  target; hidden with the uncharted New World. The region sheet's tile shows it at 32 points.
- **Region sheet** (`ui/game/LandmarkLine.tsx`, under the pills, `testID="landmark"`): the pictogram on a raised
  tile, the name in Cinzel, the bonus in words (`modsText`), "Lost while occupied" when it is, and the history plus
  "It goes to whoever holds the region." behind its "?". How to play has a Landmarks topic and the glossary a
  Landmark entry.
- **Measured** (AI-only soak to 1500, seeds 1 and 2, against the branch point). Nothing in the AI's choices changed,
  so the games only drift apart as any small change makes them: wars started 53 and 55 (56 and 52 before), realms
  alive 45 and 46 (46 and 54), the New World found 1491 and 1477 (1487 and 1477). Time per day 2.57 and 2.62 ms
  (2.54 and 2.91): `landmarksHeld` is fifteen lookups per uncached `nationMods`, too small to see. Seed 3 (review):
  wars 53 (49 before), realms alive 43 (49), New World 1477 (1475), 3.54 ms per day (3.58); there Denmark took
  Scandinavia, a different history rather than a landmark at work. Realms alive came out lower on all three seeds
  (−1, −8, −6), so the lead's §6 soak runs on the merged batch should watch that number.

## Fun batch 2 (R): Crack down, Seize estates, Abdicate, Golden age

Four one-tap acts for the realm, each with its price shown before the tap and nothing to manage afterwards. The
rules are in `sim/realm.ts` (abdication in `sim/rulers.ts`), the buttons in `ui/game/RealmActions.tsx`.

| Act | Where | Price | Effect | Limit |
|---|---|---|---|---|
| Crack down | Region sheet, Invest (while unrest ≥ 1) | 500 levies a point of prosperity, at least 1,000 | −3 unrest there for 5 years ("Crackdown" in the breakdown) | one at a time per region; your own, unoccupied land |
| Seize estates | Realm → Order and renown | order −1; +2 unrest in every region for 5 years ("Estates seized") | 12 × today's taxes (`regionTax`; trade and exports not included) | order −1 or better; once in 10 years (`cooldowns["X>X:seize"]`) |
| Abdicate | Realm, under the heir (monarchies only) | order −1, renown −10 (no further −5 from succession) | the heir is crowned today; a ruler-general leaves his army | heir 16 or older, no regency, 10 years on the throne or the ruler 50 or older |
| Golden age | Realm, after the greater crowns | — | 50 years of +10% tax income, −10% cost to invest, +10% levies, −1 unrest (a timed modifier); a card for the player, a banner for news; a gilt sun on your arms in the top bar; a "Golden age" pill on nation sheets | renown 40, order +1, at peace, 4 advances; once a game; not New World peoples |

- **Timed unrest has a name.** `Region.unrestMods[].why` is the breakdown's label ("Crackdown", "Estates seized",
  "Rebels appeased"); without one it reads "Recent events". Lines with the same name add up into one.
- **Crowning day.** `Ruler.crowned` is set wherever a ruler is made (elections, theocracies, heirs, unions, crises,
  the `newRuler` effect, abdication). The rulers of 1444 and older saves have none: read as day 0.
- **The end of a golden age** is told once (`monthlyGolden`, `golden.over`); the modifier runs out by itself.
- **AI (`aiRealm`, monthly after `aiEconomy`).** Crack down in its most restless region when unrest is above 6 and
  its levies are over half full (one a month). At 3 loans or more with order 0 or better, seize the estates when a
  year of taxes is worth at least one loan (100 gold), and pay loans off with it at once. The worst ruler (skill 1),
  50 or older, steps down for a grown heir of skill 4 or more, with order 0 or better. Proclaim a golden age as
  soon as it may. `COUNTS` (dev only) counts each.
- **A fix on the way.** A crown that lost its last region to rebels restoring a fallen crown stayed alive with no
  land. Seen on soak seed 11 once the acts changed the dice. Since the merge `releaseNation` itself ends the crown it
  takes from, or moves its capital if only the capital went, so a peace that frees a nation does the same.

Measured to 1500, AI only, seeds 1–3. "First rules" are the spec's AI rules as first built; "final" are the rules
above.

| Measure | Main | First rules | Final |
|---|---|---|---|
| Golden ages | — | 3, 5, 0 | 3, 2, 2 (BUR 1456, FRA 1485, TUR 1489; CAS 1478, TUR 1481; BUR 1465, TUR 1481) |
| Abdications | — | 10, 8, 8 | 0, 1, 2 |
| Crackdowns | — | 9, 1, 2 | 2, 2, 1 |
| Seizures | — | 14, 16, 22 | 1, 0, 0 |
| Bankruptcies | 3, 3, 3 | 3, 4, 3 | 2, 1, 3 |
| Realms alive in 1500 | 45, 45, 48 | 46, 46, 52 | 46, 51, 44 |
| Rebellions | 49, 41, 49 | 55, 46, 51 | 52, 46, 41 |
| Loans held in 1500 (all crowns) | 13, 19, 52 | 22, 30, 34 | 6, 39, 23 |
| Mean unrest in 1500 | 0.07, 0.06, 0.32 | 0.63, 0.44, 0.33 | 0.49, 0.18, 0.20 |
| ms per day | 2.64, 2.42, 2.46 | 2.78, 2.41, 2.37 | 2.75, 2.48, 2.29 |

- **Why the first seizure rule was dropped.** The crowns that reach 3 loans are small (Serbia, Moldavia, Byzantium,
  Brunswick, Pomerania). A year of their taxes is 12–35 gold, a third of one loan at best, while the order −1 and +2
  unrest everywhere cost them taxes and rebels; a year on, none had fewer loans. Now the AI seizes only when it pays off a loan.
  Few crowns in debt are that rich, so the AI rarely seizes, and bankruptcies are as on main: seizing cannot save
  the small crowns that go bankrupt, so the spec's "a third fewer bankruptcies" is out of reach for this act.
- **Abdications.** The spec's rule (skill 2 or less, an heir 2 better) gave about 9 by 1500, several of them in 1454,
  the day a 1444 ruler reached ten years on the throne. With only old, skill-1 rulers stepping down for a skill-4
  heir, it is 0–2 by 1500, about the spec's 2–6 a game.
- **The rest is noise.** Golden ages come as the spec measured (2–3 by 1500, the first 1456–1478, all great
  powers). Realms alive, rebellions, loans, mean unrest (a snapshot of one day) and speed move both ways from seed
  to seed, within what one war more or less makes.

## Fun batch 2 (W): Storm the walls, Humble them, Reparations

Three war ideas, each one button or one checkbox with its price shown before the tap.

- **Storm the walls** (`siege.ts stormOdds`, `storm`, `aiStorms`; `commands.ts stormWalls`; `ui/game/StormButton.tsx`
  on the army sheet just under its stats, in sight when the sheet opens compact, and on the region sheet under
  "Besieged by", for the siege's leader only). It reads "55% chance · about 2,250 men".
  - **Odds:** 5%, plus 70% of the siege's progress, 5% a gun (+25% at most), 2% a regiment over the minimum (+10% at
    most), 3% a star of the best general there; 5% to 85%. The "?" beside the button lists the parts. The odds shown
    are the odds rolled (one `chance()`).
  - **Not yet:** no fort; short of regiments; a siege under 30 days old; stormed in the last 30 days; a battle there.
  - **Price, win or lose:** 750 men per fort level, from the besieging armies by their men (and within an army across
    its troops), with a lost battle's war exhaustion (`men / 1000 × 0.1`); counted in the player's men lost.
  - **Won:** the fort falls at once (`completeSiege`). **Thrown back:** the siege loses 10% of its progress.
  - **AI:** monthly, on each fort it besieges, when the odds reach 80% (`AI_STORM_CHANCE`; 75% at first, see "Fun
    batch 2: measured"). With no guns that needs spare regiments and a general and a siege nearly done; with five guns
    a little over half done. Not when the siege would
    end within 10 days anyway (`AI_STORM_DAYS_LEFT`): about a third of AI storms came 2–6 days from the fall.
- **Humble them** (`war.ts HUMBLE_COST` 15%, `HUMBLE_RENOWN` 15, +5 against a rival). A checkbox at the peace table
  (demand only). The winner gains it times `1 + prestigeGain` (`humbleGain`, the figure the table and the offer card
  show), the loser loses it, on top of a won war's +10/−10.
- **Reparations** (`war.ts reparationsCost`, `economy.ts REPARATIONS_SHARE`, `reparationsOf`). A checkbox at the peace
  table, demanded or offered ("Pay reparations"), hidden while "Make them your vassal" is ticked (a vassal pays
  tribute). The loser pays a tenth of its taxes, trade and exports to the winner for 10 years (`Nation.reparations`):
  an expense line for the payer, an income line for the receiver. Its price is the gold rule on what it pays
  (1.2% per gold of monthly income), 2% to 25% (`REPARATIONS_MIN`: a 5% floor made them dearer than plain gold from a
  small realm). One at a time: a new one replaces the old. It ends on its day, when
  either crown is gone, when the payer becomes anyone's subject, or in a war between the two (checked monthly, and
  by the ledger; the player is told when theirs end early). A subject pays none, nor a crown still fighting the
  winner in another war (`canPayReparations`): it is not priced, offered, asked or set, since it would end at once.
- **An ally's storm.** The siege's leader decides; men fall from every besieging army, so when an ally's storm costs
  the player men, the log says how many. The player's own toast counts the men who actually fell.
- **AI peace terms** (`buildDemands`): vassals are decided first, as before. Then, with leverage left after land and
  gold, reparations (loser's income 5 a month or more, `AI_REPARATIONS_INCOME`; under 50 gold asked), then
  humbling a rival. **Never in a limited war**
  won by its attackers: Help promises the player such a war takes "only that region (and gold)". An ultimatum
  (`fitTerms`) carries land and gold only. AI against AI, terms refused with the extras are signed without them
  (`ai.ts acceptedTerms`), so the extras never keep a war going. An AI's offer of concessions to the player may carry
  reparations, never humbling.
- **Truces.** The extras count in the deal's leverage, so a peace with them brings a longer truce (`truceYears`).
- **Measured** (AI-only, seeds 1–3 to 1500, `scripts/dev/sieges.ts 56`, `aiwars.ts 56`; before → after):

  | | before | after |
  |---|---|---|
  | fort 1: mean days to fall | 53 / 48 / 48 | 49 / 44 / 43 |
  | fort 2: mean days to fall | 74 / 83 / 83 | 69 / 71 / 103 (8 sieges) |
  | fort 3 (1–2 sieges a seed) | 197 / 109 / 117 | 137 / 99 / 109 |
  | forts taken by storm | 0 | 11 of 49, 14 of 47, 14 of 41 |
  | AI storms won | — | 69%, 78%, 82% |
  | AI wars ended (seeds 1, 2) | 50, 48 | 53, 43 |
  | Constantinople Ottoman from | 1447, 1448 | 1447, 1447 |
  | realms alive in 1500 | 45, 45 | 44, 46 |
  | AI peaces (not white) humbling / with reparations | — | 6–15% / about 2% |

  Reparations are rare among the AI: most AI wars are limited, and a full war's leverage goes on land first.

## Fun batch 2: the merge

The four tracks were merged in the order P, L, R, W. The only conflicts were the end of this file (each track
appended its section) and two imports in `RegionSheet.tsx`; both sides were kept. Then the loose ends the reviews
left between tracks:
- **Freed landmarks, the same day.** A peace (`makePeace`), a crown leaving a war (`leaveWar`) and rebels whose crown
  is gone handed occupied regions back by writing the controller; they now go through `setController`, so a freed
  landmark gives its bonus again that day (as annexation already did).
- **Releasing a realm** (`releaseNation`) ends the crown it takes from if that was all its land, else gives it a new
  capital; before, a peace that freed a nation could leave the loser alive with no land.
- **A new game reads its modifiers afresh** once the AI crowns have their starting policies (`newGame` calls
  `invalidateMods`), as a loaded game always did, so a fresh game and one saved and loaded on its first day play the
  same.
- **Still to watch** (from the track reviews): realms alive in 1500 came out lower on Track L's three seeds (−1, −8,
  −6) and mixed on R's and W's; AI reparations are rare (about 2% of AI peaces); the Ottomans endowing War take Pike
  and Shot about 1492–94 (the §5 safeguard, one line in `aiEndowment`, waits on `ottomans.ts 260`).

## Fun batch 2: after the review

- **Reparations already void** are no longer sold: a loser still at war with the winner in another war (drawn in by
  an alliance or the Emperor) pays none, so they are not priced, offered or set (`canPayReparations(s, loser,
  winner)`, decided in `makePeace` before the war ends). When the player's reparations, paid or received, end early,
  the log says why.
- **Reparations' floor** is 2%, not 5%, so from a small realm they cost no more leverage than the gold they bring
  (Granada's 22 gold was 5%, the same as 50 gold now). The AI asks them only of a loser with 5 gold a month or more.
- **The AI storms** only a siege with 10 or more days still to run. Seeds 1–3 to 1480 (`sieges.ts 36`): storms
  tried 5 / 8 / 3 (were 7 / 14 / 8), men lost 6,750 / 12,750 / 4,500 (were 8,250 / 15,000 / 9,750); fort-1 sieges
  took a median 44 / 56 / 52 days, within the seeds' noise.
- **Landmarks stay in their region** at every zoom (`landmarkSpot.ts`): at play zoom Hagia Sophia stood in the
  Black Sea, the Duomo in Romagna, St Stephen's in Upper Hungary and the Alhambra on Castile's side of the border.
- **Buttons.** An armed confirm keeps its caller's layout (Storm the walls no longer pushes its "?" off the sheet);
  the golden age and Endow arm in gilt, not the red of Disband. Storm the walls says "chance" and sits under the
  army's stats. Endow takes two taps (the field arms its button). A foreign landmark's bonus says whose it is.
- **Old saves:** a ruler with no crowning day (a save from before this batch) counts as crowned the day it loads,
  so abdication still waits out the reign; a new game's rulers are crowned on day 0.
- **Content:** the Dome of the Rock's line no longer calls it golden (lead from the Middle Ages until 1959–64); the
  golden-age card reads its bonuses from `GOLDEN_MODS`.

## Fun batch 2: measured

AI-only games to 1560, seeds 1-24, the code just before the batch (`05ebf498`) against the batch as shipped; the
Ottomans to 1704 (`scripts/dev/ottomans.ts 260 1 2`); the opening in 48 games (`scripts/dev/opening.ts 1 48 1450`).
`scripts/dev/batch2.ts` prints the batch's own counters per game.

- **As first merged** (seeds 1-8): wars declared 78.5 → 91.5 a game (+17%, past the spec's 15%), realms alive
  unchanged. No one feature did it: switching each off in turn took off about 6 (AI storms), 4-4.5 (endowment, the
  peace extras, crackdowns), 1.5 (landmarks) and 0.5 (golden age); all off gave back the old games exactly. Shorter
  wars mean more of them: a crown's next war waits on its rest after the last (note 32), and the yearly appetite
  itself hardly matters (halving every crown's bent took the wars to 1480 from 39 to 32).
- **The Ottomans endow statecraft** (`endowment.ts STATESMEN`). Endowing war, their troops reached the musket's age
  about 1590 instead of about 1635, closing the gap with Europe the science opens by 1600 (notes 21, 24). Now: the
  second age by 1520 and still in it in 1620, as before. (The commit says this took the wars from 91.5 to 85.5: that
  figure mixed in another run; it was 88.8 over seeds 1-8.)
- **The AI storms at 80%, not 75%** (`AI_STORM_CHANCE`). At 75% it stormed 16 times a game, and France, storming the
  English forts and then London, left England 9.9 regions in 1560 (12.2 before the batch) and France 28.8 (25.4);
  at 80%, over the same 16 games, England 12.8 and France 27.2. Storming at 30 days left instead (`AI_STORM_DAYS_LEFT`)
  gave England 10.8 and cut storms to 5 a game. The player's own storm button is unchanged.
- **The batch as shipped** (24 games, before → after):

  | | before | after |
  |---|---|---|
  | wars declared to 1560 (mean) | 82.3 | 83.0 |
  | in the first two years | 2.8 | 2.9 |
  | realms alive in 1500 / 1560 | 47.0 / 34.9 | 46.5 / 34.4 |
  | Constantinople Ottoman by 1450 (of 48) | 46 | 48 |
  | England / France / Castile / Ottomans, regions in 1560 | 12.7 / 25.2 / 24.6 / 24.0 | 12.3 / 26.5 / 24.7 / 23.2 |
  | England under 5 regions | 2 games | 2 games |
  | days to take a fort (median): level 1 / 2 / 3 | 45 / 93 / 144 | 46 / 86 / 120 |
  | forts taken by storm a game | 0 | 9.4 (12 storms, 79% won, 18,000 men) |
  | golden ages a game | — | 4.9 (3-8), the first about 1475; France in 23 games, the Ottomans 20, Castile 15 |
  | crackdowns / estates seized / abdications a game | — | 12.8 / 0.2 / 0.8 |
  | AI peaces humbling / with reparations | — | 6.7 / 1.5 of 77 |
  | bankruptcies a game | 11.1 | 11.2 |
  | first Pike and Shot / Ocean Navigation / Galleons / Humanism | 1492 / 1472 / 1542 / 1549 | 1483 / 1469 / 1536 / 1557 |

  The landmarks mostly stay with their builders (Hagia Sophia Ottoman in all 24, Notre-Dame French, the Alhambra
  and the Giralda Castilian; Westminster French in 5 games, the Duomo in 8). The crowns that endow war reach Pike and
  Shot about 9 years sooner; the Ottomans, endowing statecraft, 10 years later (1514).
- **`npm run soak` cannot compare builds past a century or so:** its spectated Hungary falls between about 1550 and
  1590, and the game stops with it, so "alive at the end" is counted on different days.

## The owner's landmark paintings
The owner painted all fifteen landmarks (warm gold and sepia, each building alone on a transparent ground, 1024 px
square), and they replace the gold pictograms everywhere, shown as painted: no tint, no halo, no frame. They are
handled like the owner's troop and ship drawings.
- **Source and bake.** `art/landmarks/<id>.png`, byte for byte as sent (`djingvereber.png` saved as
  `djinguereber.png`). `scripts/build-landmarks.ts` (`npm run landmarks:build`, pngjs, deterministic) cuts each to
  what is painted, ignoring the faint speckle the paintings carry round them (rows and columns with at least 4 pixels
  over alpha 32: the Alhambra's drawn box is 784 x 608, not the 860 x 777 a bare alpha > 8 gives), area-averages it in
  premultiplied colour to 192 px on its longer side, and writes a 256-colour palette PNG with transparency (median
  cut, six rounds of refining, no dithering): 294 KB for all fifteen, 8-27 KB each (full colour would have been about
  1.3 MB; side by side at 2x the two can hardly be told apart, the paint's grain hiding the steps). 192 px is 3x the
  largest they are shown: the sheet's 64-point well and the Giralda at the closest zoom (64 points tall). The
  generated `ui/map/landmarkArt.ts` lists each picture's `src`, `w`, `h` and `ground` (where its walls meet the
  ground, a share of its height). `kind` is gone from `landmarks.json`: each landmark uses its own picture, and
  `validate-content` checks that each has one (painted, baked, listed at its baked size).
- **Size on the map** (`landmarkSpot.ts`, `markSize`). By its real proportions at equal area: the side of a square of
  the same area is `MARK_PT` = 19 points at play zoom, about a village's picture (19-22), growing with the zoom like the
  towns (`grow`, about 1.6x at the closest). It was 28 at first, a city's size, and the owner found the landmarks
  bigger than the cities: a landmark stands beside its town and never outweighs it (a test holds every one under a
  city's 28 points). A tall one is held to 1.3 x 19 = 25 points high (`MARK_TALL`: the Giralda, 6 x 25, a slim tower),
  a wide one to 1.25 x 19 = 24 wide (`MARK_WIDE`: the Pyramids, 23 x 16, low beside Cairo). Most come out 17-21
  points either way; Westminster 16 x 23. In a small region the longer side is capped at 2.2 x the region's label
  radius on screen, never under 12 points (`MARK_MIN`). Where no spot is clear at full size it shrinks in steps (0.9,
  0.8, 0.7, 0.6, then the least), so it shrinks only as far as it must.
- **Placement** keeps every rule it had, on each picture's own box: its middle (0.6 of its height) and foot (0.9) in
  its region, off its own name and town, off its army, light on the neighbours' names, apart from the landmarks
  before it. The share in the region is now sampled down to the painting's foot (0.97 of its height; a pictogram
  stood at 0.875). The two spots tried first are beside the town on the same ground, right then left, so a painting
  stands with its town like a second building; then the six above and below as before.
- **By its own town, not a neighbour's.** The bigger paintings first stood where only a cheap distance cost
  (`FAR_COST`) held them, and at play zoom two read as a neighbour's: the Giralda 70 points from Seville but 34 above
  Granada's town (the Alhambra, placed first, takes the spot beside Seville), St Stephen's 89 points from Vienna on
  the Styria border. Now, unless a picture stands right beside its town (within `BESIDE` = 20 points of its point), a
  foot not clearly nearer its own town than any neighbour's (by `ASTRAY_MARGIN`, about 1.14 times the distance)
  costs `ASTRAY_COST`, and one nearer the neighbour's is not a good spot at all, so the picture shrinks rather than
  stand there. At play zoom the Giralda (shrunk to 7 x 27) stands just above Seville, 21 points from it, and St
  Stephen's (18 x 22) just below Vienna. A picture never stands on another landmark's picture (a hard rule; the
  margin of its own size round it stays a cost) nor with less than half of it in its region (`LEAST_FIT`: Hagia
  Sophia once jumped to a speck of islet off Constantinople), and a smaller size must do better by `SHRINK_GAIN` to
  win over a bigger one, so ties don't shrink it. Being on its own army costs 1.5 (was 1), so the new costs never make
  a spot on the troops win.
- **In front of the troops where the region is too small for both.** At play zoom Constantinople is smaller than the
  Byzantine army standing in it, and the painting, drawn under the units, was mostly hidden behind the count badge in
  the opening view of every Byzantine game (the 12-point pictogram had stood at the troops' feet). Now a picture that
  stands on its own army's box (`markInFront`: only Hagia Sophia, below 2.2) is drawn in the units' layer, in front
  of them; it never covers their banner or count (a hard rule), costs twice the share of the figure it covers (so it
  stands at their feet, its foot below theirs, where being in front reads right), and twice as much on a neighbour's
  name (which it is then drawn over). At play zoom it stands whole at the troops' feet left of the count; where names
  first show, in front of their legs.
- **Tests.** The proportions at every zoom, the sizes (22-40 points high at play zoom, at most 28 x 28 points of
  area, never stretched past 2% at the closest zoom on a 3x screen), four-fifths of the lower half in the region from
  play zoom on (three-fifths where names first show and in Constantinople and Île-de-France), and now at every zoom
  checked (0.1 apart from where names show to the closest, and play zoom) and with every town size (19-30 points, and
  a mix): no two paintings overlapping (a sweep 0.004 apart found none), each beside its town or nearer it than any
  other region's town (Hagia Sophia below 2.5 excepted), and one on its own army drawn in front, off the banner and
  count.
- **At play zoom** (390 x 844 screenshots, each as the landmark's owner with an army in the region): ten stand at
  full size; St Peter's, Notre-Dame and Hagia Sophia are 16 points, the Alhambra 19 x 15, the Pyramids 24 x 16, St
  Stephen's 18 x 22 and the Giralda 7 x 27, their regions being small or crowded by the army, the neighbours' names
  and towns.
- **No baked shadow.** Most paintings carry their own painted ground (a soft wash at the foot: Hagia Sophia, the
  Pyramids, Charles Bridge, St Stephen's), and on the map they sit on the land well enough without one; a cast shadow
  like the units' would widen each picture's footprint in regions that are already crowded.
- **Region sheet** (`LandmarkLine`): the painting in a 64-point well (was a 32-point pictogram on a gilt-rimmed
  40-point tile), standing on its floor, sized by its proportions, no frame; the row stays one row (name, bonus, "?").
