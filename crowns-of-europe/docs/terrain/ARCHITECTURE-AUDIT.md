# Crowns of Europe: map architecture audit for multiresolution terrain tiles

> **How this was made, and what changed since.** Six parallel readers each audited one area of the code. A second
> agent then re-checked every claim against the files: it opened the cited lines, re-ran the commands and recomputed
> the numbers, and dropped anything it could not confirm. A final pass wrote this document. It is a snapshot taken
> while the prototype was being built (HEAD 9fcf0411 and commit 8dc7b895), so line numbers and some sizes have moved
> since. Issues it raised that have since been addressed on this branch:
>
> - **Sea zones washed over land in Illustrated.** They are now cut to the water, as in Painted (`MapView.tsx`,
>   `#water`).
> - **Two Danubes.** Inside the illustrated region the gameplay river strokes along borders are no longer drawn; the
>   real river courses stand in for them. Outside the region they are drawn as before.
> - **Fine tiles covered only 15% past the screen against the 30% drawn.** The level below the needed one now covers
>   the whole drawn area, so a long pan shows half-resolution terrain at the edges rather than the coarsest.
> - **Hidden layer drawn.** Once the needed level is opaque, the level under it is no longer drawn or decoded beneath
>   it (`terrainLayer.ts`, tested).
> - **`serve.mjs` had no `.jpg` type.** It now serves `.jpg` and `.webp` with their types.
> - **The plan's "30–50 tiles" at play zoom.** Superseded by the measured numbers in `perf.json` and the README.
> - **`ARCHITECTURE-AUDIT.md` did not exist.** This is it.
>
> Still open, and listed in [README.md](README.md):
> - native memory: `release()` frees nothing on native, and the LRU cap is soft;
> - lakes painted as scenery inside game land;
> - map-mode terrain data that the art could contradict;
> - nothing has yet been measured on a device.

This is a read-only audit of `crowns-of-europe`. It covers what replacing the map's low-resolution terrain artwork with multiresolution, geographically accurate illustrated terrain tiles would involve. No file was edited. The game has never run on a physical phone (CLAUDE.md:165; CLAUDE.md:180†). Every timing below comes from headless Chromium, and every native cost is unknown unless a measurement is given.

**Baselines and citation key**

- **HEAD 9fcf0411** (19:52:52) is the code before the terrain work. Painted is the default style there (store.ts:53). Line numbers in `MapView.tsx`, `styles.ts`, `store.ts`, `app.json`, `package.json` and `CLAUDE.md` without a mark are HEAD lines (`git show HEAD:<path>`).
- **8dc7b895** (2026-10-12 20:49:01, "Illustrated terrain prototype: offline tile pipeline and in-game tile layer") is the terrain-tile working tree that was being edited during the audit and was then committed. `git status` was clean afterwards. Lines marked **†** are 8dc7b895 lines.
  - Anchors that were read in both trees agree: PLAY_K is at MapView.tsx:834†, `PixelRatio.get()` at :410†, and the root viewBox at :434†.
  - Line shifts from HEAD: OVER :33→:37†, StaticLayer :306→:310†, root Svg :402→:434†, PLAY_K :775→:834†, UnitLayer :866→:925†. MapView.tsx is 1085 lines in 8dc7b895†.
- **Files that changed between the two.** `git status` at 20:27 listed only .gitignore, app.json, package-lock.json, package.json, store.ts, MapView.tsx and styles.ts as modified. CLAUDE.md changed later, shifting its lines by +7 to +15.
  - Everything else cited (camera.ts, geometry.ts, tap.ts, colors.ts, terrain.ts, paintingTiles.ts, reliefTiles.ts, scripts/build-*.ts, scripts/lib/geo.ts, src/content/map.json) has the same lines in both.
  - store.ts differs only in the value at :53.
- **Paths.**
  - Files in `src/ui/map/` are cited by basename.
  - `store.ts` means `src/state/store.ts`.
  - UI components such as Bars.tsx, Outliner.tsx and Cards.tsx are cited by basename, as in the source findings. Bars.tsx, RegionSheet.tsx and UnitSheets.tsx are in `src/ui/game/`.
  - Files inside third-party packages are prefixed with the package name.
  - Everything else is repo-relative.
- **Notation.**
  - u = map unit.
  - k = screen points per u.
  - dpr = device pixels per point.
  - Magnification "×" = k·dpr ÷ (source px per u).
- **Web measurement setup.** Playwright at 390×844, DPR 2, with touch (scripts/screens.mjs:10-17). The build was the HEAD export (entry-7777664…js, 4,707,301 B, built 19:47:07). The browser was headless Chromium 141.0.7390.37 (Playwright build 1194), and `nproc` was 4. The 8dc7b895 export is 5,241,962 B, which is 534,661 B larger.

## Summary

- **Renderer.** react-native-svg 15.15.4 draws every map pixel.
  - The map is one `<Svg>` in map units (StaticLayer) plus screen-space `<Svg>`s and React Native Views for units (UnitLayer).
  - Both sit in one Reanimated `Animated.View` that is 1.6× the screen size.
  - During a gesture only that view's native transform changes. When the fingers lift, the camera commits and StaticLayer re-renders.
  - No Skia, MapLibre, expo-image, expo-gl or canvas package is installed.
- **Map space.** The map uses spherical Mercator, which is the EPSG:3857 formula, over 101°W–47°E and 71.2°N–24.983258°S.
  - It is 2575 × 2242 u at 996.8691368 u per radian (17.3986486 u per degree).
  - Map units are an exact affine transform of EPSG:3857 at 6398.168791 m per u.
- **Geometry.** Coasts, regions, borders and veils are vector paths in map.json, made of absolute M/L/Z commands at 0.1 u precision and derived from Natural Earth 1:50m. Every baked raster mask is filled from these drawn paths.
- **Resolution today.**
  - Painted, the HEAD default, tops out at the painting's native density of 2.2515 px/u.
  - Atlas and Parchment use whole-map rasters at 0.9002 px/u, limited by the 5.2 MP cap.
  - At PLAY_K = 1.7, the painting is magnified 1.51× on 2x screens and 2.27× on 3x screens; the whole-map rasters 3.78× and 5.67×.
  - At K_MAX = 5, the painting is magnified 4.44× / 6.66×; the whole-map rasters 11.1× / 16.7×.
- **What maximum zoom needs.**
  - To avoid magnification at K_MAX the art needs 10 px/u (2x) or 15 px/u (3x).
  - That is 639.8 or 426.5 EPSG:3857 metres per pixel, about 411 or 274 ground metres per pixel at 50°N.
  - In Web-Mercator terms that is zoom 7.93 or 8.52, so source data at z9 (20.93 px/u).
  - At 15 px/u the 2575×2242 window alone is 1,299 MP, so only a tile pyramid can work.
- **Current state.** Commit 8dc7b895 already ships this approach as the default style, Illustrated.
  - Tiles are react-native-svg `<Image>` elements at 1/2/4/8/16 px/u, 512 px square.
  - They cover only a 576×512 u region: 398 tiles, 26.5 MB.
  - The level is chosen from k and the device pixel ratio, and a prefetch LRU cache keeps tiles warm.
- **Decision.**
  - Keep react-native-svg with a tile layer, as built.
  - Use Skia 2.6.2 under the SVG, on native only, only if phone measurements fail.
  - Reject MapLibre RN 11.5.0: it has no web build, cannot run in Expo Go, replaces the camera, gesture and tap stack, and stops at ±85.0511° latitude.
- **Main risks.**
  - Tiles must align with the game's drawn coastline, not with Natural Earth or other real-world data.
  - Memory: on Android each `<Svg>` is a full-size ARGB bitmap; decoded tiles add more; the LRU cap is soft.
  - StaticLayer re-renders often and at real cost.
  - The simulation depends on the projection and on terrain and river data that new art may contradict.
  - Nothing has run on a device.

---

## 1. Renderer and packages

### 1.1 Installed stack

| Package | Installed | Declared (HEAD) | Role |
|---|---|---|---|
| expo | 57.0.27 | package.json:32 `~57.0.27` | SDK |
| react-native | 0.86.3 | :44 | |
| react-native-gesture-handler | 2.32.0 | :45 `~2.32.0` | Pan, Pinch, Tap |
| react-native-reanimated | 4.5.1 | :46 | shared values and the native transform |
| react-native-worklets | 0.10.1 | :51 | worklet runtime |
| react-native-svg | 15.15.4 | :49 | draws every map pixel |
| react-native-web | 0.21.4 | :50 `~0.21.0` | web target |
| babel-preset-expo | 57.0.14 | transitive | adds the worklets Babel plugin automatically |
| three | 0.186.1 | :73, under devDependencies (:53) | used only by scripts/build-models.mjs; not shipped |

- **Versions.** Printed by `node -p require('./node_modules/<p>/package.json').version`. react-native-svg, gesture-handler and reanimated match Expo 57's pins (node_modules/expo/bundledNativeModules.json:105, 111, 114).
- **Not installed:** Skia, MapLibre, Mapbox, expo-image, expo-gl and any canvas package.
  - `ls node_modules/expo-image node_modules/@shopify/react-native-skia node_modules/@maplibre*` printed "No such file" for each.
  - `grep -i -c -E 'skia|maplibre' package-lock.json package.json` printed 0 and 0.
  - 8dc7b895 adds expo-asset to package.json and app.json.
- **Babel.** There is no babel.config.js or metro.config.js. node_modules/babel-preset-expo/build/configs/expo.js:96-100 adds the worklets plugin whenever `react-native-worklets/plugin` resolves.
- **React Compiler is off.** It turns on only through `exp.experiments.reactCompiler` (node_modules/@expo/metro-config/build/rewriteRequestUrl.js:85-86, babel-transformer.js:84). app.json:28 has only `experiments {typedRoutes:false}`. babel-plugin-react-compiler is present in node_modules but unused.

### 1.2 View tree (HEAD)

```
GestureDetector                                              MapView.tsx:253-260
└ View absoluteFill            (tap e.x/e.y are relative to this view)
  ├ Animated.View {translateX: tx, translateY: ty, scale: sc}    :220-222
  │   W = w·OVER, H = h·OVER, left (w−W)/2, top (h−H)/2, OVER = 1.6 (:33)
  │   ├ StaticLayer   memo (:306) → one <Svg viewBox in map units> (:402)
  │   └ UnitLayer     (:866-948)
  │       ├ route <Svg> (selected moving unit)                   :896-901
  │       ├ token + fort <Svg>, mounted even when empty           :904-931 (:904)
  │       ├ siege bars: React Native Views                       :884-895
  │       └ battle chips: React Native Views                     :932-945
  └ vignette <Svg> outside the transform (non-null only in Parchment, styles.ts:162)   :262-272
```

- **Stale docs.** The header comment "Units are plain views" (MapView.tsx:5) and CLAUDE.md:107-109 ("all drawn in one SVG on top") are out of date. There are up to 3 `<Svg>` roots inside the transform, plus the vignette.
- **Web.** Both top-level SVGs measured 624 × 1350.4 at 390×844.
- **Android.** react-native-svg draws each `<Svg>` into its own `Bitmap.createBitmap(width, height, ARGB_8888)` (node_modules/react-native-svg/android/src/main/java/com/horcrux/svg/SvgView.java:267-284). It recycles the bitmap whenever the view is invalidated (:122-125) and draws the cached mBitmap (:134-135).
- **iOS.** The backing-store size was not verified.

**Sizes on a 390×844 screen:**

- The layer box is W × H = 624 × 1350.4 pt, which is 1.6² = 2.56× the screen area.
- The margin past each screen edge is 0.3 of the screen: 117 pt horizontally and 253.2 pt vertically, which is 68.8 u and 148.9 u at k = 1.7.
- At dpr 3, one layer is 1872 × 4051 = 7.58 MP; at 4 bytes per pixel that is 30.3 MB. Two layers are 60.7 MB; three (with a route) are 91.0 MB.
- At dpr 2, one layer is 1248 × 2701 = 3.37 MP = 13.5 MB.

### 1.3 When things render

**During a gesture.**

- Pan and Pinch worklets only call `show()`, which sets tx, ty and sc (MapView.tsx:136-150, :171-211).
- Pan has minDistance 6 and averageTouches. Tap has maxDuration 300 ms and maxDistance 10 pt. The composition is `Race(Simultaneous(pan, pinch), tap)` (:212-218).
- There is no fling inertia: line :11 imports Easing, runOnJS, useAnimatedStyle, useSharedValue and withTiming, but not withDecay.

**Rubber-banding applies only past the clamp.**

- The pan offset is tx = bx + rubber(x1 − bx, w·(OVER−1)/2) (:136-150; camera.ts:30-34). The zoom uses rubberZoom with exponent 0.3 (camera.ts:37-41).
- A pan that stays inside the map is therefore not limited to the OVER margin. The comment at :147 ("Never further than the picture rendered past the screen's edge") does not hold for such pans.
- On a 390-wide screen, a pan longer than 117 pt shows the background colour until release. So does a pinch-out below 1/1.6 = 0.625.
- Past a clamp, rubber() approaches 0.3w = 117 pt. When the overshoot equals that dimension it gives (1 − 1/1.55)·117 = 41.5 pt.
- A pinch-in scales the cached bitmap, so the picture is soft on native until release.

**On release.**

- `settle()` clamps the view and animates back over 320 ms with an ease-out cubic (:34, :152-170).
- Then `runOnJS(commit)` calls setCam (:77-82).
- A useLayoutEffect resets tx, ty and sc to 0, 0 and 1 and publishes `store.camera` (:84-89).
- Whether the new SVG and the transform reset land in the same native frame cannot be determined from the repo.

**What changes the camera, and so re-renders all of StaticLayer:**

- every pan or pinch release (:160, :167);
- focus requests, which call setState during render (:69-75);
- the end of the selection glide (:107-129);
- every web wheel event, with zoom factor exp(−deltaY·0.0015) (:224-245, :232);
- a layout size change (:57-67).

**The game clock keeps running during gestures.**

- `grep -rn setPaused src/ui src/app` finds only Bars.tsx:101 (the play button) and src/app/game.tsx:31 (app sent to background). No map code pauses.
- frame() emits once per day batch (store.ts:204-237).
- MapView re-renders on every emit (useStore at :37) and rebuilds its gesture objects (:171-218).
- UnitLayer receives `version` (:257), so it re-renders on every emit too.
- StaticLayer also re-renders mid-gesture, at the old camera, whenever that day batch marked the map dirty.

**Emit rate.**

- Speeds are [1.5, 3, 6] days per second (store.ts:38-39); the default index is 1 (:55).
- The loop is setInterval(frame, 50) (:197), at most 4 days per frame (:213-217), with one emit per batch (:237).
- A toast emits twice: when shown and again 3.2 s later (:120-127).
- The speeds are labelled 1×, 2× and 4× (Bars.tsx:110-111).
- At 4×, carry grows 6 × 0.05 = 0.3 days per 50 ms tick, about 6 emits per second. At 2× it is about 3 per second; at 1× about 1.5.

**StaticLayer memo.**

- StaticLayer is `React.memo` over (cam, w, h, mapVersion, mode, selection, styleId) (:306, :256).
- It draws only region, sea and nation selections (:325-327). But `select()` stores a new object for every selection (store.ts:137-140), so army and fleet selections re-render it too.
- mapVersion bumps come from:
  - `emit(map)` (store.ts:86-90);
  - `run()`, where map defaults to true (:116);
  - setMapMode and setMapStyle (:141-151);
  - frame emits (:222, :237) when the sim called markMapDirty: any nation learning an advance (src/sim/science.ts:160), setController and transferRegion (src/sim/territory.ts:24, :40), and more calls in colonies.ts and territory.ts.

**What is cached.**

- Inside StaticLayer only four values are memoized: regionFills, nationArcs, nationLabels and borderLines (:315-322). nationLabels is used only by Flat (:639 placeLabels; styles.ts:185 curved:false; :98, :129, :160 curved:true).
- Module-level caches:
  - COAST_CELLS and FAR_COAST_CELLS (geometry.ts:47-48);
  - hit-test shapes and WASTE_BBOX (geometry.ts:95-110);
  - terrain-mark cell paths, built once per 128-u cell (terrain.ts:14-15 CELL 128, COLS 64; :113-120). The join of the cells runs on every call (:124-137).
  - the mountain list (terrain.ts:150-163). There are 387 mountains, 10–40 u wide, median 14.4 u. There are 7811 marks: 4100 conifer, 2835 broadleaf, 278 dune and 598 marsh.

**UnitLayer has no inner memo (:866-948).** Every render recomputes:

- unitPositions (:806-853), which calls matters() for every army and fleet below ALL_UNITS_K = 1.4;
- sieges, looping over all 211 regions (:884-895);
- forts, looping over all 211 regions again (:905-916).

### 1.4 Work StaticLayer redoes on every camera change (HEAD)

All of this runs outside the memos:

- the viewport (:310-314);
- `striped`, two passes over all 211 regions (:331-340);
- per-colour land strings concatenated from the visible regions (:344-352);
- the visible waste paths (:354-355);
- the `beyond` frame (:360);
- coast-cell filtering and joining (:363-369);
- the painting-tile filter over levels [2, fine] (:395-396). That is 9 + 42 = 51 bbox tests when the fine level is 0, 9 + 16 = 25 when it is 1, and 9 when it is 2;
- terrainPaths and mountainsIn, for styles with drawn terrain (:384, :387);
- placeNames for curved names when k < 1.15 (:397).

It also rebuilds JSX for:

- 45 seas, twice when k ≥ 0.9 (:456-460);
- 211 regions, for occupation (:498-506) and for names when k ≥ 1.15 (:603-614);
- 12 far labels and 29 wastelands, each wasteland doing a nested `MAP.wastelands.find` (:551-574; the find is at :566);
- 5 lakes and the sea labels (:585-602).

Stroke widths and font sizes are px = n/k (:323), so a zoom changes them on every element. The `beyond` path, the #water clip (:416) and the grain rect embed vx/vy, so a pan alone changes them. The 29 wastelands are listed in src/content/seas.json (content.ts:66); the 42/16/9 painting tiles in paintingTiles.ts.

### 1.5 Path data that is never culled (HEAD)

- **Whole-map paths:**
  - borderLines over all 382 borders (:280-292);
  - province lines, rivers (width 0 in Painted, so not drawn), the nation halo and the nation line (:522-525);
  - `MAP.unknownWater` plus the visible wastes (:511);
  - `MAP.uncharted` (:512).
  - Only the wastes are bbox-culled.
- **The visible land path is emitted three times in Painted:**
  - as the colour fills (:463-465);
  - as the #land clipPath (:468-473), which in Painted clips only the grain rect because landColour and relief are 0 (styles.ts:79-81);
  - inside the #water clipPath (:409-418).
- **Largest paths, POR, Painted** (breakdown.mjs):
  - At k = 1.7: 103,361 chars (unknownWater + wastes), 93,242 (#water), 77,132 (#land), 71,622 (halo), 71,622 (nation), 39,753 (province), 33,801 (uncharted).
  - At k = 5: 102,150 / 71,622 / 71,622 / 39,753 / 34,227 (defs) / 33,801.
- **Never-culled total.** 2×71,622 + 39,753 + 33,801 + 87,345 = 304,143 characters. That is 304,143 / 398,895 = 76.2% of all path data at k = 5, and 304,143 / 565,230 = 53.8% at the POR opening.
- **#water check.** 77,132 (land path) + 16,016 (wastes in view: 103,361 − 87,345) + about 94 (viewport rect) = 93,242.

### 1.6 Measured element counts (Painted; 1444 start: 75 armies, 20 fleets, 73 nations, 211 regions)

**Opening view by nation, k = 1.7:**

| View | StaticLayer elements | path / image / text | Path data (chars) | UnitLayer elements | DOM nodes |
|---|---|---|---|---|---|
| POR | 187 (g 44, rect 2, clipPath 2, pattern 1) | 35 / 8 / 94 | 565,230 | 154 (image 40, ellipse 57, rect/text/g 19 each) | 347 |
| HAB | 322 | 64 / 8 / 165 | 922,747 | 380 (image 86, ellipse 147, rect/text/g 49 each) | 708 |
| FRA | 330 | 62 / 7 / 173 | 860,473 | 362 (image 86, ellipse 138, rect/text/g 46 each) | 698 |

**POR, Painted, by zoom:**

| k | Elements | path / image / text / textPath | Path data (chars) |
|---|---|---|---|
| 0.3 | 282 | 121 / 19 / 56 / 30 | 1,904,612 |
| 0.6 | 346 | 124 / 28 / – / – | 1,266,938 |
| 1.0 | 335 | 110 / 10 / 91 / 69 | 917,985 |
| 3 | 100 | 23 / 6 / 43 / – | 451,983 |
| 5 | 72 | 17 / 6 / 28 / – | 398,895 |

**Atlas, HAB.**

- At k = 1.0: 747 elements (161 path, 177 image, 131 text, 111 textPath) and 2,008,623 chars. The 177 images are 4 full-map rasters (relief-sea, land colour, relief-land, shadow), the grain and 172 mountains.
- At k = 1.7: StaticLayer 478 elements (116 images) and 1,231,523 chars, plus UnitLayer 380.
- At k = 0.6 there are only 5 images, because mountainAlpha = (0.6 − 0.6)/0.4 = 0.
- Relevant styles: styles.ts:83 drawn null for Painted; :114 drawn for Atlas; :117 Atlas unknown.shadow 0.6.

**Tokens.**

- Each token is 1 g, 3 ellipses (+1 when selected), 1 image, 1 rect and 1 text, plus a circle when moving (MapView.tsx:987-998).
- HAB has 49 tokens, giving 49 × 3 = 147 ellipses. Its 86 images are 49 figures plus 37 forts.
- Below UNITS_K = REGION_NAMES_K = 1.15 (:767, :771) the token Svg is empty unless a unit is selected (:811).

### 1.7 Web specifics and timing

- **Real DOM SVG.** react-native-svg renders DOM SVG on web (node_modules/react-native-svg/src/web/WebShape.ts:1-12). Images become `<image href=asset URL>` (node_modules/react-native-svg/src/web/utils/prepare.ts:125-126).
- **One JS thread.** Reanimated uses its JS implementation on web (node_modules/react-native-reanimated/src/common/constants/platform.ts:15, :23; src/ReanimatedModule/js-reanimated/index.ts:36-103 in the same package). The transform therefore runs on the same thread as the 50 ms game loop and React.
- **Web-only behaviour.**
  - Wheel zoom exists only on web (MapView.tsx:227).
  - Fonts get CSS fallbacks (styles.ts:60-62).
  - Haptics are skipped (tap.ts:14).
  - The export is a single-page app (app.json:22, web.output 'single').
- **No deployment URL** is recorded in README.md, docs, CLAUDE.md or AGENTS.md.
- **Test server MIME types.** scripts/serve.mjs:7 has no .jpg type, so painting tiles are served as application/octet-stream. Chromium sniffs the bytes and still renders them (screens/04-map.png shows the painting).

**Time per camera change** (HAB, 6 runs each). "Commit" is focusOn up to setTimeout(0): React render plus DOM mutation, without layout or paint. "+2rAF" waits for two animation frames, so it overstates the work.

| Style | k | Commit (ms) | +2rAF (ms) |
|---|---|---|---|
| Painted | 0.3 | 15–28 | 28–46 |
| Painted | 1 | 16–44 | 41–52 |
| Painted | 1.7 | 24–30 | 36–47 |
| Painted | 5 | 11–18 | 28–54 |
| Atlas | 0.3 | 18–30 | 30–47 |
| Atlas | 1 | 28–54 | 46–63 |
| Atlas | 1.7 | 23–30 | 40–53 |
| Atlas | 5 | 10–21 | 29–47 |

- The original audit gave Painted commit 7–41 ms (15–56 ms to the second rAF) and Atlas at k = 1 38–50 / 50–66 ms.
- The commit alone exceeds the 16.7 ms frame budget in about 38 of 48 rerun samples. Only k = 5 stays consistently under 22 ms.
- Native cost is unknown.

### 1.8 Tests

- tests/map.test.ts unit-tests the camera math (clampView, rubber, rubberZoom, K_MAX) and the geometry (lineCells, COAST_CELLS, nationArcs). It imports camera and geometry at :5-6 and calls clampView at :85.
- jest.config.js:5 maps png and jpg to a stub; the test environment is node.
- No test renders MapView. Rendering, gestures and the commit/reset sequence are covered only by the Playwright walkthroughs, which read store.camera and `__coe.unitPoint` (scripts/screens.mjs:60-61, :75-78; scripts/screens-war.mjs:37-38, :46).
- 8dc7b895 adds tests/terrain.test.ts with 13 tests. It imports terrainLayer, terrainTiles and styles (:3-5) and mocks react-native (:7).

### 1.9 Terrain prototype in 8dc7b895 (Illustrated, the default style)

- **Default.** store.ts:53† sets mapStyle to 'illustrated'; saved preferences override it (store.ts:72-73). In styles.ts:137-138†, Illustrated has painting null and terrain.fill 0.5.
- **Pyramid.** 512-px JPEG tiles at levels L0–L4 = 1/2/4/8/16 px/u (scripts/terrain/config.py:26, :30, :31). The quadtree is anchored at map (0, 0) (:5-6).
- **Coverage.** TERRAIN_REGION = {x0 1792, y0 576, x1 2368, y1 1088} (terrainTiles.ts:19), which is 576 × 512 u. Using the inverse formulas in §2.2:
  - lon(1792) = −101 + 1792/17.3986486 = 1.997°E;
  - lon(2368) = −101 + 136.1025 = 35.10°E;
  - lat(576) = 2·atan(exp(1.7984885 − 0.577809)) − π/2 = 57.12°N;
  - lat(1088) = 37.51°N.
- **Tile counts.** L0 4, L1 9, L2 25, L3 72 (9×8), L4 288 (18×16): 398 tiles. Sizes are 64,044 + 247,210 + 1,289,646 + 5,070,496 + 19,859,020 = 26,530,416 B.
- **Generated index.** terrainTiles.ts (430 lines) is generated by scripts/terrain/render.py:473-503. Tiling is at :429-442 and the JPEG write at :467.
- **Drawing.**
  - Tiles are SvgImage elements in map units inside StaticLayer (MapView.tsx:497-499†), in the same viewBox as the vectors (:434†).
  - The level comes from k × `PixelRatio.get()` (:403-411†, :410†).
  - terrainLayer.ts holds the selection logic: pickLevel (:40-52), SHARPNESS 0.85 (:17), FADE 0.4 (:19), BUFFER 0.15 (:21), tilesToDraw (:78-89).
  - Adjacent tiles overlap by 0.6 pt to hide seams (:412-413†).
  - A cache and stats effect runs with no dependency array (:423-428†).
  - The tIn and tOut clip paths are at :446-455†.
  - The cache holds CACHE_TILES = 160 (terrainCache.ts:13). On native it calls Image.prefetch; on web it creates `new Image()` (:20-33).
- **Vectors.** Natural Earth 10m rivers (362) and lakes (244) are drawn as vectors: terrainVectors.ts; MapView.tsx:414-421†, :561-565†; scripts/terrain/config.py:64-77; vectors.py.
- **Web zoom helper.** webZoom(k, upd) = log2(upd·k·360/256) (terrainLayer.ts:148-150). It is called with MAP_W/(east − west) (MapView.tsx:417†).
- During the audit the L4 directory was briefly emptied while being rebuilt (288 → 0 files at 20:44). 8dc7b895 contains all 288.

---

## 2. Coordinate system and projection

### 2.1 Constants and rounding

- **Build constants.** scripts/build-map.ts:39-43 sets WEST −101, EAST 47, NORTH 71.2, SOUTH −25 and UNITS_PER_DEGREE 17.4 (comment at :37-38). Projection code is d3-geo 3.1.1.
- **map.json** stores:
  - projection `{type:'mercator', west:-101, east:47, north:71.2, south:-25}`;
  - width 2575 and height 2242;
  - margin [800, 1400] (build-map.ts:843-845, :859).
  - It stores no CRS code and no geotransform.
- **Width.** WIDTH = round(148 × 17.4) = round(2575.2) = 2575 (:44).
- **Scale.** The scale is taken from the rounded width (:45-52; scripts/lib/geo.ts:23):
  - S = 2575 / (148·π/180) = 2575 / 2.5830873 = **996.8691368 u per radian**;
  - u per degree = 2575/148 = **17.3986486** (geo.ts:27), not 17.4.
  - d3 gives left −1.7627825445, right 0.8203047484, top −1.7984884996 and bottom 0.4508753300.
- **Height.** HEIGHT = round((0.4508753 + 1.7984885) × 996.8691) = round(2242.3214) = 2242. So y = 2242 lies at **24.983258°S**, not 25°S. The east edge is exactly 47°E.

### 2.2 Forward and inverse formulas (identical to build-map's toPx and toLonLat)

```
x   = (lon + 101) · 17.3986486                                   build-map.ts:53-56
y   = 1792.8576782 − 996.8691368 · ln tan(π/4 + φ/2)              (d3 negates y)
lon = −101 + x / 17.3986486                                       geo.ts:22-26; build-map.ts:57-60
φ   = 2·atan(exp(1.7984885 − y/996.8691368)) − π/2
```

- **Derivation.** 1757.2635 = 101 × 17.3986486 (x at longitude 0). 1792.8577 = 1.7984885 × 996.8691 (y at the equator).
- **Source of the y flip.** d3's mercatorRaw is [λ, ln tan((π/2 + φ)/2)] (node_modules/d3-geo/src/projection/mercator.js:5-7). The projection returns [dx + k·x, dy − k·y] (index.js:30).
- **Spot checks.**
  - Paris [2.35, 48.85] → [1798.1503, 816.1020].
  - New York [−74, 40.7] → [469.7635, 1016.3555].
  - [0, 45] → [1757.2635, 914.2436]; [0, 50] → y 785.3388; the equator → y 1792.8577.
  - The closed form and toPx differ by at most 2.3e-13.
- **Edges.** latOf(0) = 71.2; latOf(2242) = −24.983258.
- **Stored lonlat.** All 211 regions' stored lonlat reproduce their stored labels within |dx| 0.1328 and |dy| 0.1830 u. The residual is rounding: labels to 0.1 u (build-map.ts:584, round() at :61-64) and lonlat to 0.01° (toLonLat :57-60, used at :586).
- geo.ts reads only west, east and north, never south (:19; comment "same as build-map" at :21), so its inverse matches the rounded height.

### 2.3 Relation to EPSG:3857

The projection is spherical Mercator applied directly to WGS84 degrees: d3 geoMercator on the unit sphere (build-map.ts:16, :45) over world-atlas land-50m (:69). That is the EPSG:3857 formula, not EPSG:3395 (ellipsoidal Mercator). With R = 6378137:

```
X = R·λ,  Y = R·ln tan(π/4 + φ/2)
a = S/R = 996.8691368 / 6378137 = 1.562947200e-4 u/m;   1/a = 6398.168791 m/u
x =  a·X + 1757.2635135          X = 6398.168791 · (x − 1757.2635135)
y = −a·Y + 1792.8576782          Y = 6398.168791 · (1792.8576782 − y)

GDAL geotransform, raster at f px/u whose top-left is map (0,0):
  [−11243268.570, 6398.168791/f, 0, 11471006.044, 0, −6398.168791/f]
  X_west = −1757.2635/a = −11,243,268.57 m;  Y_north = 1792.8577/a = 11,471,006.04 m

XYZ tile pixel at zoom z (256-px tiles):
  (56.177778 + 0.0408716·x,  54.722986 + 0.0408716·y) · 2^z
  0.0408716 = 256 / (2π·996.8691368) = 256 / 6263.51
  56.1778 = 256·(180 − 101)/360
  54.7230 = 128 − 256·11,471,006.04/40,075,016.69 = 128 − 73.277
```

- **Same formula elsewhere.** scripts/lib/geo.ts:61-66 tilePixel uses the same spherical formula, ln(tan + sec) = ln tan(π/4 + φ/2). It is used for terrarium tiles (:40) and for GIBS epsg3857 Blue Marble (:122). Going through EPSG:3857 reproduces toPx to 1e-13 (Paris [1798.150338, 816.101991]).
- **Window in EPSG:3857.**
  - X runs from −11,243,268.57 to 5,232,016.07 m, a width of 16,475,284.64 m.
  - Y runs from 11,471,006.04 down to −2,873,688.39 m at y = 2242 (it would be −2,875,744.62 at a nominal 25°S).
- **Tile examples.**
  - z0: 0.04087163 px/u.
  - z5: map (0, 0) is at tile pixel (1797.6889, 1751.1356), at 1.307892 px/u.
  - z9: map (0, 0) is at (28763.0222, 28018.1690) and (2575, 2242) at (82648.178, 74934.875), at 20.926274 px/u.
  - The ratio is never a whole number of tile pixels per unit, so resampling is always needed.
- **Error if EPSG:3395 is used by mistake.** y shifts by 4.294 u at 40°N, 4.724 at 45°N, 5.119 at 50°N, 5.789 at 60°N and 6.330 at 71.2°N.

### 2.4 How build-map projects each input

- **Natural Earth land** goes through d3's spherical pipeline. Polygon edges are great-circle arcs, adaptively resampled to 0.1 u and clipped to [−1, W+1] × [−1, H+1] (build-map.ts:94-101, :122). Once clipExtent is set, d3's y limits are that extent, not the world square (mercator.js:42-48).
- **Seeds** are projected pointwise (:194-195, :333).
- **Great Lakes outlines** are interpolated linearly in lon/lat, 4 sub-steps per edge, before toPx (:129-136).
- **Far lands** use precision 0.5 (:686-693, :739).
- **Regions** are Voronoi cells built in map units (planar).
- A per-pixel GDAL reprojection therefore matches the vertices exactly, and differs along edges by no more than the 0.1 u resampling tolerance.

### 2.5 Margin and the EPSG:3857 square

- **Margin box.** map.margin = [FAR_X, FAR_Y] = [800, 1400] (build-map.ts:675-676, :677-693, :859). The far lands and the painting cover [−800, 3375] × [−1400, 3642] (scripts/build-painting.ts:29-33): 146.98°W–92.98°E and 85.345°N–72.215°S.
- **Strip past the Web-Mercator limit.** y at 85.0511°N = 1792.8577 − a·π·R = −1338.899. That leaves 1400 − 1338.90 = **61.10 u** of margin north of the EPSG:3857 square. geo.ts:64 clamps latitude to ±85.05.
- **Margin box in EPSG:3857.** X from −16,361,803.6 to 10,350,551.1. Y from 20,428,442.4 (beyond π·R = 20,037,508.3) to −11,831,124.7.
- **Painting levels** (paintingTiles.ts):
  - full, 42 tiles: x −150.21…2725.21, y −150.16…2392.15;
  - half, 16 tiles: x −450.01…3025.01, y −450.41…2692.39;
  - quarter, 9 tiles: x −800…3375.00, y −1400…3641.98.
  - 67 tiles in total, matching the 67 files in assets/map/painting.

### 2.6 Ground scale

Units per km = (996.8691368 / 6378.137) / cos φ = 0.15629472 / cos φ.

| Latitude | u per km | km per u |
|---|---|---|
| 0° | 0.156295 | 6.3982 |
| 45° | 0.221034 | 4.5242 |
| 50° | 0.243151 | 4.1127 |
| 60° | 0.312589 | 3.1991 |

- **Other radii.**
  - build-relief.ts:162 uses 111320 m per degree × cos φ, since 111320 ≈ 2π·6378137/360 = 111319.49. That gives 0.221033 at 45° and 0.243150 at 50°.
  - The mean sphere (6371.0088 km) gives 0.221281 and 0.243423. §3 quotes km with 6371 km: 4.519 km/u at 45° and 4.108 km/u at 50°.
- **True WGS84 ellipsoid scale of this formula.** East-west 0.220664 (45°) and 0.242673 (50°); north-south 0.221407 and 0.243349.

### 2.7 World to screen (HEAD)

The camera is {cx, cy, k}, where k is screen points per map unit (MapView.tsx:28-32).

```
sx = w/2 + (x − cx)·k,  sy = h/2 + (y − cy)·k                 :114-115, :868-869
tap inverse: mx = cx + (sx − w/2)/k                            :94-95
viewBox = `${cx − W/2/k} ${cy − H/2/k} ${W/k} ${H/k}`, W = 1.6w, H = 1.6h
                                                 :248-249, :255, :310-313, :402
during a gesture: sx = w/2 + tx + sc·(x − cx)·k                :220-222, :148-149, :155
commit: cx' = cx − tx/(sc·k)  (cy likewise),  k' = k·sc        :77-82
```

- **Baked whole-map images** are placed at x 0, y 0 with size MAP_W × MAP_H (:452-453, :470-471). Every entry in reliefTiles.ts:18-45 has w 2575 and h 2242.
- **UnitLayer** draws in screen points: toX = (x − cx)·k + W/2 (:927-928†).
- **Visible area on 390×844.**
  - At K_MAX: 390/5 × 844/5 = 78 × 168.8 u; the 1.6× layer covers 124.8 × 270.1 u.
  - At PLAY_K: 229.4 × 496.5 u, which is 229.4/17.4 = 13.2° of longitude.

### 2.8 Camera limits

- **Bounds.** K_MAX = 5 (camera.ts:8). kMin = 0.95·min(w/MAP_W, h/MAP_H), or 0.3 before layout (MapView.tsx:48). MAP_W and MAP_H come from geometry.ts:5-6.
- **Clamping.**
  - clampView clamps k to [kMin, K_MAX], then calls clampCentre (camera.ts:11-16, :19-24).
  - clampCentre keeps cx in [w/2k, MAP_W − w/2k], or at MAP_W/2 when w/k ≥ MAP_W; cy likewise. The limits are the play window, not the margin.
- **During a gesture** rubberZoom lets the effective k go past both limits: K_MAX·(k/K_MAX)^0.3 above, kMin·(k/kMin)^0.3 below (camera.ts:30-34, :37-42).
- **Opening and other paths.**
  - The opening k is max(w/420, PLAY_K = 1.7), set without clampView and with its own centre clamp (:60-65, :62, :775).
  - Focus requests go through clampCam (:74). The wheel clamps k explicitly (:239).
  - REGION_NAMES_K = UNITS_K = 1.15, ALL_UNITS_K = 1.4 (:767-775). See also CLAUDE.md:104.

**kMin and how far past the map it shows:**

| Screen | kMin | Units shown above and below the map |
|---|---|---|
| 390×844 | 0.95·min(0.151456, 0.376450) = 0.143883 | screen spans 2710.5 × 5865.9 u → (5865.9 − 2242)/2 = 1811.9 u, more than FAR_Y = 1400 (the 1.6× layer reaches about 3572 u) |
| 375×667 | 0.138350 | 1289.6 u (inside FAR_Y) |
| 430×932 | 0.158641 | 1816.5 u |
| 820×1180 | 0.302524 | 829.3 u |

### 2.9 Where the projection is used at runtime

- **HEAD.** src reads only MAP.width and MAP.height (geometry.ts:5-6; MiniMap.tsx:13, 87, 89). The `Math.tan` / `Math.atan` hits at geometry.ts:235, 278 and 280 are label arc fitting and lean, not projection.
- **8dc7b895** reads MAP.projection.east and west to compute a web zoom (MapView.tsx:417†).
- **The simulation reads each region's stored lonlat** (types.ts:87). Read sites: src/sim/ai.ts:281, src/sim/events.ts:177-178, src/sim/religion.ts:23-24, src/sim/military.ts:457-458. The rules are:
  - AI colonial spheres;
  - the Reformation zone (lat > 54, or 13 < lon < 24 and lat > 51);
  - Protestant spread (lat > 53, …);
  - cold regions (lat > 50 or lon > 22).
- lonlat is regenerated from each label on every rebuild (build-map.ts:586).

### 2.10 The terrain toolchain's copy of the projection

scripts/terrain/mapproj.py (8dc7b895; it states that map units are an exact affine of EPSG:3857 metres at :11-17) reimplements the projection:

- It uses the same S and TOP and reads only width, west, east and north, never south.
- It clamps latitude to ±85.05112878 (:49).
- It builds Affine(R/(S·ppu), 0, X0, 0, −R/(S·ppu), Y0).
- Relevant lines: :31 (R), :34-42, :45-52, :55-61, :64-69, :83-87, :106-110.

**Discrepancy.** km_per_unit uses the mean radius 6371.0088 km, giving 4.5191 km/u at 45°N against 4.5242 from R = 6378137. The ratio is 1.001119 (0.11%).

**grid.json check.** The git-ignored scripts/data/terrain-work/grid.json has epsg3857_transform = [399.8855494515652, 0, 17508.502435446713, 0, −399.8855494515652, 7990402.221088455] at ppu 16, x0 1760, y0 544. It matches §2.3:

- 6398.168791/16 = 399.886;
- 6398.168791 × (1760 − 1757.2635135) = 17,508.5;
- 6398.168791 × (1792.8576782 − 544) = 7,990,402.2.

**Could not be checked here.**

- `python3 -c 'import mapproj'` failed with ModuleNotFoundError: No module named 'affine'.
- tests/terrain.test.ts:160-171 read `sources.projection_check`. assets/map/terrain/sources.json had no such key when checked (it had note, region_bbox_lonlat, retrieved, etopo, worldcover and natural_earth), so that assertion would have failed then. The files were changing during the audit.

---

## 3. Existing geometry, coastlines, masks, political shading

### 3.1 Source and build pipeline

- **Only input data.** world-atlas 2.0.2 `land-50m.json`: Natural Earth 1:50m physical land, NE 4.1.0, quantized but unprojected lon/lat (scripts/build-map.ts:4, :69; node_modules/world-atlas/package.json:3; package-lock.json:15340-15343; node_modules/world-atlas/README.md:3, :36). Plus the seeds and lake outlines in regions.json and seas.json.
  - It has 1425 arcs and 60,635 points; 1419 polygons and only 2 holes worldwide.
  - The quantum is 0.0036° of longitude = 0.0036 × 17.3986 = 0.0626 u, and 0.001736° of latitude = 0.001736 × π/180 × 996.869 / cos 50° = 0.0470 u. Both are below the 0.1 u output rounding.
  - The build reads no Natural Earth lakes, rivers or coastline layer.
- **Land preparation.**
  - Each polygon is resampled at precision 0.1 and clipped 1 u past the window (:94-101). Rings are XOR-composed, unioned and intersected with the window (:103-127).
  - The five Great Lakes are cut with hand-drawn outlines, each edge densified 4× in degrees (:128-137). Superior has 20 points, Michigan 17, Huron 19, Erie 11 and Ontario 10.
  - Landmasses whose outer ring is under 0.6 u² are dropped (:138).
  - Result: 442 polygons (20,800 vertices after projection; 21,063 after the cuts; 5 holes), 437 kept and 5 dropped.
- **Lakes that are land.** The only Natural Earth hole that touches the window is the Caspian ([46.7, 36.6, 54.7, 47.1]). It shows as a notch at the east edge, reaching 0.3° (about 5.2 u) past 47°E. Ladoga, Onega, Vänern, Chad, Victoria, Nicaragua and Winnipeg are all solid land.
- **Regions** (:228-236, :245-329; seedDel.find at :308).
  - A landmass whose seeds all belong to one owner goes entirely to that owner (:270-274).
  - Otherwise each point of a fixed jittered grid (CELL 4.5 u, jitter ±0.45·4.5 = ±2.025 u, from an integer hash) goes to the nearest of all seeds on that landmass.
  - Leftover land goes to the wasteland seeds by plain Voronoi.
  - An island with no seed joins the nearest seed within 120 u of its polylabel point, or else the nearest wasteland seed (:262-267).
  - Counts: 211 regions from 728 seeds (46 New World regions from 150 seeds); 29 wastelands from 163 seeds.
- **Topology and simplification.**
  - topojson quantization 1e5 over [0, 0, 2575, 2242] gives a quantum of 2575/99999 = 0.02575 u in x and 0.02242 u in y (:404).
  - presimplify uses planarTriangleArea (:405; node_modules/topojson-simplify/src/presimplify.js:9-10, :72-77), then simplify keeps points of weight ≥ 0.35 u² (:422).
  - Arcs used only by wastelands are weighted ×0.3, so their effective threshold is 0.35/0.3 = 1.167 u² (:406-421).
  - Neighbours come from the unrounded topology (:488, :580).
  - Point counts go 34,506 → 27,263 (−21.0%) → 37,360 drawn (+37.0%).

### 3.2 Two coastline geometries

- **Unrounded arcs (used by the game).** Labels, areas, bboxes, neighbours and coastal seas.
- **Drawn arcs (used by everything visible).**
  - Two Chaikin passes (0.75/0.25), Douglas-Peucker thinning at 0.15 u, output rounded to 0.1 u (:428-485, :486-487, :504-507, :516-528, :533-592, :808-813, :838).
  - They feed the regions, wastelands, borders, coast, unknownWater and uncharted paths, and every baked raster mask.
  - The build's reason for rounding: to avoid a "staircase of short straight runs" (:423-427).

**Dense comparison** (sampled every ≤ 0.25 u; units are map units):

| Comparison | p50 | p90 | p99 | max |
|---|---|---|---|---|
| NE → unrounded coast | 0.007 | 0.129 | 0.373 | 3.62 |
| NE → drawn coast | 0.109 | 0.314 | 0.748 | 5.95 (hand-drawn Lake Huron outline, −81.70, 45.20) |
| Coast arcs, drawn → unrounded | 0.081 | 0.219 | 0.643 | 10.3 |
| Coast arcs, unrounded → drawn | 0.086 | 0.259 | 0.855 | 14.7 |
| All arcs, drawn → unrounded (0.5 u step) | – | – | 1.56 | 15.4 |
| All arcs, unrounded → drawn | – | – | 1.87 | 27.8 |

- **Large deviations.** Of 1370 arcs, 110 deviate by more than 1 u, 31 by more than 2 u and 12 by more than 5 u. Of those 12:
  - 10 are wasteland–wasteland edges; the worst is northern_wilds/great_plains at 27.84 u (−93.38, 48.68);
  - 1 is the SE window corner (swahili, 14.69 u);
  - 1 is Lake Huron at Georgian Bay (huronia, 5.95 u).
  - None is on a drawn region border.
- **Length and area.** Coast length goes from 53,109 u unrounded to 50,908 drawn (−4.14%); Natural Earth's is 53,363. Total area changes by 0.208%; the worst single change is the Azores, 85.8 → 76.8 u² (10.5%).
- **In kilometres at 50°N.** NE → drawn p99 is 0.748 u × 4.108 = 3.07 km. The 0.1 u rounding adds at most 0.05·√2 = 0.071 u ≈ 0.29 km.

**Vertex comparison** (scratch coast2.mjs, same projection):

- Drawn vertices to the NE50m coastline: median 0.084 u, p90 0.273.
- Over the 20,943 vertices that are real coast: p99 0.502, p99.9 0.732, max 1.570.
- NE50m vertices to the drawn coast: median 0.226, p90 0.492, p99 0.992, max 3.969. The largest gaps are dropped islets, for example the Florida Keys (80.8°W, 24.8°N).
- Of 21,317 drawn coast vertices, 374 are more than 2 u from NE50m:
  - 258 are hand-cut Great Lakes shore;
  - 13 are within 3 u of the frame;
  - 103 are more than 10 u from any NE50m coast. These are inland lines that the coast path also carries (e.g. 73.9°W 48.4°N, 99.0°W 29.4°N).
- How the drawn coast compares with higher-resolution data (NE 10m, ETOPO, WorldCover) was not measured.

**Accuracy of NE 1:50m itself.**

- The repo states none. The US NMAS small-scale convention (0.508 mm at publication scale) is external, not repo data. At 1:50,000,000 it gives 25.4 km.
- That is 3.97 u at 0°, 5.62 at 45°, 6.18 at 50°, 7.95 at 60° and 11.62 at 70°.
- At K_MAX (×5 pt per u) that is 19.9 / 28.1 / 30.9 / 39.7 / 58.1 pt.
- NE segment length inside the window: median 1.949 u (p90 4.956, p99 10.196, max 41.367). The median is 8.0 km, or 9.7 pt at K_MAX.

### 3.3 map.json inventory (1,469,923 B)

**Format.**

- Every geometry is an SVG path in map units using only absolute M, L and Z, with at most one decimal.
- Polygons omit the closing vertex and end each ring with Z. Lines (borders, coast, far.coast) have no Z.
- Holes are wound opposite to their outer ring (build-map.ts:61-64, :516-528, :548, :581-591, :842-860).

| Family | Count | Rings (+ / − / zero-area) | Vertices | Characters | Notes |
|---|---|---|---|---|---|
| regions | 211 | 569 (562 / 0 / 7) | 38,371 | 489,658 | path, label (1 dp), labelRadius, lonlat (2 dp), bbox (1 dp, from the unrounded arcs), area (integer u²), neighbors, seas |
| wastelands | 29 | 159 (148 / 6 / 5) | 13,039 | 160,002 | id, path, label, area. The 6 holes are pinholes ≤ 0.1 u² (great_plains 1, sahara 3, caucasus 1, lapland 1) |
| borders | 382 | 430 subpaths | 11,114 | 141,627 | region–region only; 11,114/382 = 29.1 vertices per pair |
| seas | 45 (39 open, 6 closed) | 45 (45 / 0 / 0) | 650 | 8,284 | every sea is a single ring |
| coast | 1 | open lines | 21,317 | 263,916 | |
| unknownWater | 1 | 105 (18 / 87 / 0) | 7,448 | 87,345 | 86 holes, plus one 3-point 0.2 u² outer ring at 34.5, 1251.9 whose winding flipped |
| uncharted | 1 | 9 (6 / 3 / 0) | 2,721 | 33,801 | |
| far.path | 38 cells | 269 (all +) | 8,186 | 105,143 | |
| far.coast | 38 cells | lines | 8,433 | 108,098 | |

- Also stored: 5 lakes, 12 farLabels and margin [800, 1400].
- Median segment length (without / with the closing edge): regions 1.63 / 1.62 u, seas 67.6 / 69.7. Coast 1.80 u, far lands 6.20 u.
- The zero-area rings are collapsed coastal specks, e.g. carolina at −76.68, 34.70 and guinea_forest's speck at Ascension Island (−14.42, −7.94).

### 3.4 Borders, seas, coast, far lands, unknown

- **Borders.** One entry per pair of pieces that share arcs used by exactly two pieces, keeping only region–region pairs (:490-514, :594-599). Region–wasteland and wasteland–wasteland edges are never stroked.
- **Seas.**
  - Plain Voronoi cells of 186 sea seeds, unioned per sea and intersected with the window plus a 40 u pad (:331-342, pad at :82; sea path at :610).
  - They run under the land: "land is drawn on top, so they never need clipping" (:8).
  - A sea's bbox comes from its largest polygon only. That is harmless while all 45 seas are single rings.
  - **Coastal seas** come from an internal raster of the projected NE land: 2 px/u, 5150 × 4484 = 23,092,600 cells, with lakes marked 2 so they make no coast. It is probed ±2 u around the unrounded outline every ≤ 2 u; a sea needs ≥ 3 hits and must not be closed (:344-392, :551-579, :604, :612).
  - **Sea–sea adjacency** requires open water at the midpoint between two Delaunay-adjacent seeds, with seaLinks overrides (:617-641).
  - **Drawing.** In Painted the sea zones are clipped to #water, an even-odd clip of view rect + land path + wastes (MapView.tsx:414-417, :455-461; :456-460†, :500-507†).
- **Coast.**
  - map.coast is the drawn arcs used by exactly one piece, minus segments whose two ends are both within 0.6 u of the same window edge (:643-669).
  - It includes the Great Lakes shores and the wasteland coasts; it excludes the far lands.
  - It is drawn after the parchment and the edge fade (MapView.tsx:508-536; :567-595†).
  - It carries two kinds of non-geographic line:
    - **Window-cut runs.** 556 u in total (E 179, N 214, W 63, S 100; 53 segments), which is 556/50,922 = 1.09%. They survive because Chaikin moved their end points more than 0.6 u off the edge. Examples: 2573.3,248.5 → 2574.4,321 (72.5 u) and 874.1,0.8 → 931.3,0.3 (57.2 u). None is axis-parallel, so tests/map.test.ts:20-28 passes.
    - **Interior gap arcs.** 45–48 arcs, 132–136 u in total, each ≤ 7.4 u, around tiny unclaimed gaps where three pieces meet; each involves a wasteland. In Iowa the triangle 124.5,964.5 / 124.1,964.6 / 119.3,966.6 has area ½|(−0.4)(2.1) − (0.1)(−5.2)| = 0.16 u², and its edges belong to illinois, northern_wilds and great_plains. Others: gao/sahara (3.80, 15.17), baghdad/syrian_desert (42.72, 31.44), maranhao/sertao (−49.38, −5.68).
  - For scale, 5 u at 43°N = 5 × 6371·cos 43°/996.869 = 5 × 4.674 = 23.4 km.
- **Far lands** (:675-765).
  - A second projection at precision 0.5, clipped to the window ±800 u in x and ±1400 u in y.
  - Each ring is simplified with Douglas-Peucker at 0.9 u; rings under 6 u² are dropped; the rest are XOR-composed, unioned, clipped and have the play window subtracted.
  - Pieces are grouped into 600 u cells: 269 pieces in 38 cells. No lakes are cut.
- **unknownWater and uncharted** (:773-840).
  - unknownWater = (water ∩ wobble(closed uncharted seas)) ∪ (water − a wobbled inset frame). Five of the six closed seas count; red_sea is charted. The sea wobble has amplitude 16 u and scale 70; the frame has inset 60, amplitude 30 and scale 90.
  - uncharted = New World drawn shapes ∪ (water ∩ wobble(non-closed New World seas)) ∪ the raw lake polygons.
  - Wobble splits edges into ≤ 4 u steps and uses fixed-hash value noise, so it is deterministic. The build log reports 19 and 6 pieces.
  - The wobble is at most 16 u (≈ 65.7 km at 50°N); the frame band runs 30–90 u from the edges.

### 3.5 Raster masks at build time

- **How masks are filled.**
  - parseRings reads M/L/Z into flat rings (scripts/lib/geo.ts:174-192).
  - landRings is every region, wasteland and far path (:193-196).
  - landMask scanline-fills even-odd across all given rings at once, sampling pixel centres x = ox + (col + 0.5)/f (:199-222).
- **Users of these masks:**
  - relief and land colour at HI 0.9 and LO 0.25 px/u (build-relief.ts:38, :152, :439-440);
  - water lines, supersampled 2× with a 16 u margin (:362-370);
  - shadows at SHADOW_F 0.5 px/u (:408, :410-418, :504-509). These are masks of the unknown (wastes, unknownWater, uncharted), not of land;
  - terrain region grids at 1 px/u (build-terrain.ts:30, :45);
  - the painting's reference land at 1 px/u over the margins (build-painting.ts:29-33, :86).
- build-map's own isWater raster is a separate mask of Natural Earth land, used only for coastal seas, sea links and seed checks.
- **Runtime clip.** At K_MAX one 0.9 px/u pixel is 5/0.9 = 5.56 pt, so MapView clips land rasters to the vector coast (comment at MapView.tsx:375-379).

**Defect: overlapping families cancel under even-odd filling.**

- build-relief.ts:418 says "the shapes never overlap", but unknownWater and uncharted overlap by about 18,000 u²: 17,979 px at 1 px/u, mostly in cells (1000,2200): 8318, (200,800): 3581 and (1000,2000): 2126.
- The overlaps are around the Great Lakes (x ≈ 200–400, y ≈ 800–1000), along the west edge, and off southern Brazil.
- At 0.5 px/u, 4,568 px = 4,568/0.25 = 18,272 u² cancel to "known".
- As a result, shadow-uncharted.png has 12,754 pixels with alpha above 0 (max 248) that lie more than 24 u from any truly known area and more than 45 u from the edges.
- It is visible before discovery wherever unknown.shadow > 0: Illustrated and Atlas 0.6, Parchment 0.3, Flat 0.18, Painted 0 (MapView.tsx:579†; styles.ts:90†, :122†, :154†, :186†, :218†).
- The default landMask also loses 111 px = 111 u² at 1 px/u where region and wasteland rings overlap slightly.

### 3.6 Political shading and overlays

- **Fill colours.** regionFills (colors.ts:37-43) gives each region a colour:
  - political: the nation colour mixed 12% toward parchment #efe3c2;
  - unowned: WILD #f1e8cf, except in the goods, terrain and faith modes (colors.ts:19-22, :50-53).
  - It is memoized on [mapVersion, mode] (MapView.tsx:316; :320†).
- **One path per colour.** byFill maps each colour through the style (st.land(f), or st.wild for WILD), joins the paths of visible, non-hidden regions, and emits one `<Path>` per painted colour (:343-352, :463-465; :347-356†, :511-513†).
  - Fill opacity is 0.42 in Painted (styles.ts:101; :105†), 0.5 in Illustrated (styles.ts:138†) and 1 otherwise.
  - That gives at most one fill path per colour on screen, plus 3 whole-map line paths (4 with the halo).
- **The land clip.** The joined string landD (:375; :379†) is the clip for land colour, relief, grain and drawn terrain (:409-413; :441-445†). It excludes wastelands, far lands and the undiscovered New World.
- **Border lines.** Province, river and nation (+ halo) are whole-map paths memoized on mapVersion (:280-292, :322, :522-525; :284-296†, :326†, :581-584†). provinceAlpha = (k − 0.32)/0.45 (:389; :393†).
- **Occupation stripes** (:331-341, :404-408, :498-506; :335-345†, :436-439†, :552-560†).
  - Each controller or colonizer gets a userSpaceOnUse Pattern: tile 7/k u (7 pt), three diagonal strokes 0.32 × 7 = 2.24 pt wide in the nation colour (#222 for rebels).
  - Shown in political and diplomatic modes only; colonized regions at opacity 0.75.
- **Selection.**
  - Nation: the owned region paths joined without culling, fill rgba(255,255,255,0.18), gold 1.6 pt stroke (:537-547; :596-606†).
  - Region: fill 0.25 white with a #fff6d8 2.6 pt stroke, then goldDark 1.2 pt (:548-549; :607-608†).
  - Sea: fill rgba(255,255,255,0.22) (:458; :504†).
- **Rivers in the committed pipeline are gameplay data, not geography.**
  - seas.json lists 19 rivers as 33 region pairs, all of them existing borders: Rhine 5 pairs, Danube 4, Sava/Vistula/Elbe/Loire/Po/Ebro/Dnieper 2 each, 10 others 1 each (src/sim/content.ts:73-77; scripts/validate-content.ts:56).
  - A battle records river = riverBetween(from, node), and the attacker takes −1 on every roll (src/sim/battle.ts:57, :164).
  - The stroked river is the drawn border path of those pairs (MapView.tsx:287, :523; :291†, :582†): 1,083 vertices, 13,662 characters.
  - Widths: Painted 0 (styles.ts:90; :94†), Illustrated #4f7189 1.5 (:126†), Atlas #4f7189 1.5 (:121; :158†), Parchment #5b7c86 1.5 (:152; :190†), Flat #3d7db3 1.6 (:183; :222†).
  - No committed build script reads a river dataset.
- **Added in 8dc7b895.** Natural Earth 10m rivers and lakes v5.1.2, clipped to the game's land (scripts/terrain/config.py:64-77, vectors.py), are written to terrainVectors.ts: 362 rivers and 244 lakes. They are drawn inside TERRAIN_REGION (MapView.tsx:414-421†, :561-565†), on top of the gameplay river stroke.

### 3.7 Client-side geometry

- **Coast cells.** lineCells cuts the coast into runs of ≤ 48 points (step 47, so runs share end points) and groups them by run-bbox centre into a 320 u grid (geometry.ts:17-44). A cell's bbox is the union of its runs and can extend past 320 u. COAST_CELLS and FAR_COAST_CELLS are at :47-48. Only cells in view are stroked (MapView.tsx:362-369; :366-373†).
- **Hit testing.**
  - parsePath (geometry.ts:57-78) builds the shapes; closed seas are filtered out (:99-104).
  - inside() is an even-odd crossing test with a bbox prefilter from the parsed rings, not from map.json's sea bbox (:112-126).
  - regionAt, wasteAt and seaAt are at :128-139.
  - tap.ts:33-35 tests region, then wasteland, then sea.

### 3.8 Reproducibility

- A scratch rebuild from the committed regions.json and seas.json was byte-identical to src/content/map.json on all four runs. sha256 ec61a6e47f39b40b9693741835989fdcb72337839f86f9cc94a2c287731f1485.
- It took 27.5–32 s.
- The build log reports regions 211, borders 382, seas 45, wastelands 29, inland regions 70, size 1435 KB.
- map.json and build-map.ts last changed together in 766087bd; regions.json and seas.json in 2298d2e1.

---

## 4. Vector vs raster: what each geometry is

**Vector layers** are re-rendered at the new camera on every commit, so they are crisp at any committed zoom.

- Stored geometry has a 0.1 u step. At K_MAX that is 1.5 device px on 3x and 1.0 px on 2x. The largest rounding error, 0.05 u, is 0.75 px and 0.5 px.
- Decimal counts in map.json paths (one decimal / integer): regions 68,920 / 7,822; borders 19,943 / 2,285; seas 1,118 / 182; coast 38,420 / 4,214.
- Marks are rounded to 0.1 (terrain.ts:53; "All in map units", terrain.ts:4-5).
- Map-space strokes use px(n) = n/k, so they keep a constant width on screen (MapView.tsx:323; CLAUDE.md:105-107).

| Layer | Kind | Space | What it is | Where drawn (HEAD) |
|---|---|---|---|---|
| Sea background | vector rect | map u | flat colour | MapView.tsx:448 |
| Sea zones | vector | map u | Voronoi of 186 seeds, running under the land | :455-461 |
| Region fills | vector | map u | jittered-grid Voronoi on NE50m land, drawn arcs; one path per colour | :463-465 |
| #land / #water clips | vector | map u | land path from visible regions (+ wastes and view rect for #water); keep raster coasts crisp | :409-418 |
| Trees, dunes, reeds | vector | map u | 7811 marks from terrainSymbols.ts; screen-constant strokes | :490-497 |
| Occupation stripes | vector pattern | map u, 7 pt tile | | :498-506 |
| Unknown parchment | vector | map u | unknownWater, uncharted | :507-519 |
| Province, nation, river lines | vector | map u | whole-map paths; rivers are border pairs | :522-525 |
| Edge fades | vector gradients | map u | | :527-534 |
| Coast | vector | map u | single-use drawn arcs | :536 |
| Selection outlines | vector | map u | | :537-549 |
| Labels | SVG text / TextPath / Inked | map u | curved nation names, region, sea and lake names | :551-646, :654-668 |
| Token bases, badges, route | vector | screen pt | | :987-996, :898-899 |
| NE 10m rivers and lakes † | vector | map u | terrainVectors.ts, 362 + 244 features | MapView.tsx:561-565† |
| Mountains | vector placement of raster art | map u | 387 placements (terrainSymbols.ts:11-16), h = w·art.h/art.w (terrain.ts:157-160), 6 PNG drawings | Atlas, Parchment |
| Painting tiles | raster | map u | 67 JPEGs in 3 levels | :449-451 |
| Relief, land colour, water lines, shadows | raster | map u | single whole-map images, x 0, y 0, 2575 × 2242 | :452-453, :470-471, :520 |
| Terrain tiles † | raster | map u | 512-px JPEG pyramid, 1–16 px/u | :497-499† |
| Grain | raster pattern | screen-sized (106–212 pt tile) | 256² LA | :419-423, :472 |
| Unit and fort sprites | raster | screen pt | 192² RGBA | :956-963, :987 |

All baked rasters except the painting art itself take their land and water masks from the drawn vector paths (§3.5). The painting is warped by up to 45 u to fit them (§Decision, Painting warp).

---

## 5. Assets that lose resolution when zooming

**Threshold arithmetic.** Device px per u = k·dpr, so a raster with p px/u is magnified when k > p/dpr.

- PLAY_K = 1.7 gives 3.4 (2x) or 5.1 (3x) device px/u. K_MAX = 5 gives 10 or 15.
- The opening k is max(width/420, 1.7) (MapView.tsx:62, :775). Every screen up to 420 × 1.7 = 714 pt wide opens at 1.7; an 820-pt screen opens at 1.952; a 1024-pt iPad at 2.438.
- HEAD never reads the device pixel ratio (`git grep -n PixelRatio HEAD -- src` returns nothing); 8dc7b895 does (MapView.tsx:410†).

| Asset | Pixels | Extent (u) | px/u | Magnifies above k (2x / 3x) | Drawn when, styles | × at PLAY_K (2x / 3x) | × at K_MAX (2x / 3x) |
|---|---|---|---|---|---|---|---|
| Painting, full (42 JPEG, q82) | 1026² (43 of the 67 tiles); edge tiles 330 or 1026 wide × 604 or 1026 tall | x −150.21…2725.21, y −150.16…2392.15 | 1026/455.7 = **2.2515** | 1.1257 / 0.7505 | k ≥ 0.55; Painted (HEAD default) | **1.51 / 2.27** | **4.44 / 6.66** |
| Painting, half (16) | 1026 or 840 × 1026 or 466 | x −450.01…3025.01, y −450.41…2692.39 | 1026/911.39 = 1.1257 | 0.5629 / 0.3752 | 0.28 ≤ k < 0.55 | – (in range ≤ 0.977 / ≤ 1.466) | – |
| Painting, quarter (9) | 1026 or 302 × 1026 or 790 | −800…3375 × −1400…3641.98 | 1026/1822.79 = 0.5629 | 0.2815 / 0.1876 | k < 0.28, and always drawn underneath; MiniMap | covered by full | covered (in range ≤ 0.995 / ≤ 1.492) |
| relief-land.png, relief-sea.png (LA) | 2318×2018 | 0…2575 × 0…2242 | 2318/2575 = **0.9002** | 0.4501 / 0.3001 | k ≥ 0.35; Atlas, Parchment | **3.78 / 5.67** | **11.11 / 16.66** |
| land-colour.jpg (RGB) | 2318×2018 | same | 0.9002 | 0.4501 / 0.3001 | 0.35 ≤ k < 2.2; Atlas | 3.78 / 5.67 (4.89 / 7.33 just below 2.2) | not used (soft image instead) |
| water-lines-dark.png (LA) | 2318×2018 | same | 0.9002 | 0.4501 / 0.3001 | Parchment only, opacity 0.42, fades in over k 0.35–0.6 | 3.78 / 5.67 | 11.11 / 16.66 |
| water-lines-light.png | 2318×2018 | same | 0.9002 | – | never; bundled but unused | – | – |
| relief-*-soft.png (LA) | 644×561 | same | 0.2501 | 0.1250 / 0.0834 | k < 0.35; MiniMap | – (≤ 2.80 / ≤ 4.20 just below 0.35) | – |
| land-colour-soft.jpg | 579×504 | same | 0.2249 | 0.1124 / 0.0750 | k < 0.35 and k ≥ 2.2; Atlas | – | **44.47 / 66.71** (19.57 / 29.35 at k 2.2) |
| shadow-charted / -uncharted.png (LA) | 1288×1121 | same | 0.5002 | 0.2501 / 0.1667 | Atlas 0.6, Parchment 0.3, Flat 0.18, Illustrated† 0.6, Painted 0; MiniMap | 6.80 / 10.20 | 19.99 / 29.99 |
| Mountain art (6 PNG, RGBA) | longest side 768 (steep 580×768) | 387 placements, 10–40 u wide | 14.5–76.8 | only steep at w = 40: never on 2x (14.5/2 = 7.25 > K_MAX) / 14.5/3 = 4.833 | Atlas, Parchment; fade over k 0.6–1.0 | shrunk up to 22.6 / 15.1 | 1 placement at 1.03, 3x only |
| grain.png (LA) | 256² | tile 2^round(log2(150/k)) u = 106.07–212.13 pt | screen-sized | n/a: on 2x when the tile exceeds 128 pt; on 3x always (≥ 106.07·3/256 = 1.243) | Painted 0.55, Atlas 1, Parchment 0.7, Flat 0 | 0.85 / 1.275 | 1.25 / 1.875 (worst 1.657 / 2.486) |
| Unit and fort sprites | 192² RGBA | 24–44.8 pt on screen | screen-sized | never after a re-render (would need dpr > 4.29) | all | < 1 | < 1 |
| Terrain L0–L4 † | 512² | 1792…2368 × 576…1088 | 1 / 2 / 4 / 8 / 16 | L4: 8 / 5.333, both above K_MAX | Illustrated† | L3 at 5.1/8 = 0.64, fading in at alpha 0.29 over L2 at 5.1/4 = 1.275 (3x) | L4 at 10/16 = 0.625 / 15/16 = 0.94 |

**Evidence for the table.**

- **Image sizes:** `file assets/map/*` and PIL. Formats: 2318×2018 PNGs are LA, land-colour.jpg is RGB, painting tiles are RGB, mountains and sprites are RGBA.
- **reliefTiles.ts:**
  - full-resolution images at :18, :22, :32-33, :38;
  - soft images at :19, :23, :39;
  - shadows at :44-45;
  - grain (px 256) at :28;
  - water-lines-light, which no style uses, at :32. `git grep WATER_LINES HEAD -- src scripts` finds only MapView.tsx:453.
- **paintingTiles.ts:**
  - pxPerUnit at :15 / :62 / :83;
  - tile widths 455.7 / 911.39 / 1822.79 at :17 / :64 / :85.
- **scripts/build-relief.ts:**
  - HI 0.9 (:439), LO 0.25 (:440);
  - 2318 and 2018 come from Math.round(W·HI) (:460-461);
  - the soft land colour is the sharp one shrunk 4× (:483);
  - SHADOW 20 u fade = 10 source px (:406); SHADOW_F 0.5 (:408).
- **scripts/build-painting.ts:**
  - TILE 1024 + 2 px overlap (:13, :34, :349-351);
  - QUALITY 82 (:35);
  - levels at :331-335.
  - The step is 304.6 − (−150.21) = 454.81 u, and 454.81 × 2.2515 = 1024.0 px. An edge tile of 146.57 u × 2.2515 = 330 px.
- **Painting tile-size tally:** 43 at 1026×1026; 6 at 1026×604; 5 at 330×1026; 3 at 840×1026; 3 at 1026×466; 2 at 302×1026; 2 at 1026×790; 1 at 840×466; 1 at 330×604.
- **Painting totals:**
  - full: 42 tiles, 37.19 MP, 5,173,385 B;
  - half: 16 tiles, 13.89 MP, 2,085,762 B;
  - quarter: 9 tiles, 6.69 MP, 986,937 B;
  - all: 8,246,084 B (7.86 MiB).
- **Level selection is hard-coded in k, not read from pxPerUnit.**
  - Painting: fine = k ≥ 0.55 ? 0 : k ≥ 0.28 ? 1 : 2, drawn over the always-present quarter level (MapView.tsx:395-396).
  - Relief is soft when k < 0.35. Land colour is soft when k < 0.35 or k ≥ 2.2 (:376-377).
  - Nothing outside paintingTiles.ts reads pxPerUnit.
  - The full painting level is magnified on every 2x and 3x screen from REGION_NAMES_K = 1.15 up (:767), since 1.15 × 2 = 2.3 > 2.2515.
- **Mountains.**
  - Art sizes: great 768×698, massif 768×644, range 768×452, ridge 768×554, scattered 768×555, steep 580×768.
  - Placements: ridge 40, range 56, steep 54, great 79, massif 90, scattered 68.
  - build-terrain.ts:204-206 sets ART_MAX 768, MIN_ART 10 and MAX_ART 40. :227-238 crops each drawing to its ink and scales it by min(1, 768/max(cw, ch)) from originals of 1254², 1448×1086 or 1086×1448.
  - mountainAlpha is at MapView.tsx:386. styles.ts:83 and :176 set drawn null for Painted and Flat.
  - Shrink factors at PLAY_K: 76.8/5.1 = 15.06 (3x) and 76.8/3.4 = 22.59 (2x). steep at w 40: 15/14.5 = 1.034 at K_MAX on 3x.
- **Sprites.**
  - 192² RGBA, from scripts/build-models.mjs:29.
  - Figures: troop 36 pt and ship 40 pt (MapView.tsx:956-957). Forts: tower 24 and castle 28 (:962-963).
  - tokenScale ≤ 1 (:777); ×1.12 when selected (:987); the Svg has no viewBox (:904); forts are drawn at pic.size (:914).
  - A selected ship is 40 × 1.12 = 44.8 pt = 134.4 px on 3x. A selected troop is 40.32 pt = 120.96 px on 3x and 80.6 px on 2x.
- **Grain.**
  - GRAIN_SCREEN = 150 (:295); grainSize (:378); Pattern (:419-423); Rect fill (:472).
  - Opacity per style: styles.ts:82, :113, :144, :175.
  - At k 1.7 a 64 u tile is 108.8 pt; at k 5 a 32 u tile is 160 pt.

**What loses resolution at PLAY_K, by style (HEAD).**

- **Painted.** styles.ts:79-83: relief 0, landColour 0, grain 0.55, drawn null. painting.land 0.42 at :101.
  - The full painting level is magnified 1.51× / 2.27×. It is both the land and the sea, and lies under everything (MapView.tsx:449-451).
  - Its rivers exist only in the painting: river width is 0 (styles.ts:90, "the painting has its rivers"), and MapView.tsx:523 draws rivers only when width > 0.
- **Atlas** (styles.ts:110-114). Relief-sea at 1, relief-land at 0.30 and land colour at 0.34 are all 3.78× / 5.67×. The shadow at 0.6 is 6.8× / 10.2×. The mountains stay crisp.
- **Parchment** (:141-145). Relief-sea at 0.55, relief-land at 0.1925 and water-lines-dark at 0.42 are 3.78× / 5.67×. The shadow at 0.3 is 6.8× / 10.2×.
- **Flat** (:172-176). Only the shadow, at 0.18.
- **Hill-shade fade.** reliefLand = relief·(1 − clamp((k − 1)/0.7)·(1 − reliefClose)) (MapView.tsx:383). It fades on purpose because the shading "would only smear enlarged" (:379-380).
  - Atlas: 1·(1 − 1·0.7) = 0.30. Parchment: 0.55·(1 − 1·0.65) = 0.1925.
  - linesAlpha = clamp((k − 0.35)/0.25) (:391).
- **Illustrated†.** Outside TERRAIN_REGION its fallback layers were not quantified in this audit.

**During a gesture** everything, vectors included, is scaled temporarily.

- The last bitmap is scaled by sc (MapView.tsx:220-222, :255-258, :146).
- Pinching to 2 × K_MAX shows 5·2^0.3 = 6.16 (camera.ts:39), which is 1.23× past K_MAX.
- A selected ship on 3x stays crisp until sc > 192/134.4 = 1.43 (troop: 192/120.96 = 1.59).
- One pinch from kMin 0.1439 to K_MAX scales the old bitmap by up to 5/0.1439 = 34.7× before release.
- How much each platform blurs this scaling is unknown.

**MiniMap (title screen and nation picker).**

- It draws only coarse images:
  - RELIEF.land.soft (MiniMap.tsx:40);
  - RELIEF.sea.soft (:77);
  - PAINTING[PAINTING.length − 1], the quarter level (:78);
  - SHADOWS.uncharted (:87).
- Other relevant lines: slice at :75; OLD_WORLD = 1422 × 1620.4 u (:16-23); pad at :53.
- **Title screen** (src/app/index.tsx:45, dimmed to 0.55): k = max(390/1422, 844/1620.4) = 0.5209 (0.4116 on 375×667, 0.5752 on 430×932). The quarter painting is 1.042/0.5629 = 1.85× on 2x and 1.563/0.5629 = 2.78× on 3x.
- **Nation picker** (src/app/new-game.tsx:26 default POR; :29 the 22 playable nations; :53 a (width − 24) × 180 frame): k = 180/h.
  - MLO 1.0028, BRA 0.9994, TEU 0.8132, POR 0.2458, DAN 0.1272.
  - Milan shows the painting at 2.006/0.5629 = 3.56× and 3.008/0.5629 = 5.34×, and the soft relief (Atlas) at 8.02× / 12.03×.
- The MiniMap has no code path for the Illustrated tiles.

**Caps that set today's densities.**

- **5.2 MP rule.** Every baked picture must stay under 5.2 MP, because iPhone and iPad web views decode anything larger at half size (CLAUDE.md:140-141; :156†; build-relief.ts:437-439; build-painting.ts:13).
  - 2318 × 2018 = 4,677,724 px = 89.96% of the cap (522,276 px of headroom).
  - A single whole-map image can be at most √(5.2e6 / (2575·2242 = 5,773,150)) = **0.9491 px/u**. Even at that ceiling, PLAY_K on 3x gives 5.1/0.9491 = 5.37×.
  - Share of the cap for other images: painting tile 1,052,676 px (20.24%); shadow 1,443,848 (27.77%); largest mountain 536,064 (10.31%); soft relief 361,284; sprite 36,864.
- **Source data.**
  - Sharp relief and the drawn terrain are shaded from terrarium z5 = 256·32/360 = 22.756 px/° ÷ 17.399 u/° = **1.308 px/u**. Soft relief uses z4 (0.654). Land colour uses Blue Marble z6 (2.616).
  - Evidence: build-relief.ts:445-447 (fetches), :452 (soft, z4), :459 (sharp, z5; signature :142); build-terrain.ts:55 elevation(5, …); geo.ts:27, :30 (TILE 256), :113 (BM_Z 6), ~:122 (GIBS epsg3857).
  - All are Web Mercator like the map, so these ratios hold at every latitude.
  - The build-relief.ts header (:11-12) still says "one pixel per map unit", but HI is 0.9 (:439).
- **The painting's source.** The full level already is the native density of art/painting/fullmap.png: 9400 × 11360 RGBA, 106.784 MP, 157,287,461 B, git-ignored (.gitignore:57).
  - 9400/4175 = 2.2515 and 11360/5042 = 2.2531, where 4175 = 2575 + 1600 and 5042 = 2242 + 2800 (art/painting/README.md:4-5).
  - The build samples it at s = src.width/TW with the full level at scale 1 (build-painting.ts:232, :332).
  - The README (:13-14) says twice that resolution would be sharp at play zoom. 2 × 2.2515 = 4.503 px/u covers 2x at PLAY_K but still leaves 5.1/4.503 = 1.13× on 3x.
  - docs/design-notes.md:214-215 calls it "sharp zoomed out, soft close up".

**Decoded memory** (assuming RGBA8, which the repo cannot confirm).

- A 1026² tile is 4,210,704 B = 4.21 MB = 4.02 MiB. The POR opening's 7 painting tiles are at most 7 × 4.21 = 29.5 MB; this is an upper bound because edge tiles are smaller.
- A 2318×2018 image is 18.7 MB (17.84 MiB); a shadow is 5.51 MiB.
- Tiles in view on 390×844:
  - At k 1.7 the 1.6× layer spans 624/1.7 × 1350.4/1.7 = 367.1 × 794.4 u. That is at most 2 × 3 = 6 full tiles (454.81 u step) plus 1–4 quarter tiles (1819.23 u step).
  - At K_MAX it spans 124.8 × 270.1 u: at most 2 × 2 full tiles.
- Painted's simulated worst case is 30 painting tiles, about 112.0 MiB decoded, at k = 0.55.

---

## 6. Maximum zoom and the detail it requires

- **Limits.** K_MAX = 5 (camera.ts:8), enforced by clampView (camera.ts:21) and by the wheel handler (MapView.tsx:239). Rubber-zoom can overshoot transiently (6.16 at a 2× over-pinch).
- **Visible area at K_MAX on 390×844.** 78 × 168.8 u (1.6× layer: 124.8 × 270.1 u). That is 78 × 4.1127 = 320.8 km wide at 50°N.
- **One screen point at K_MAX** covers 904.8 ground m at 45°N and 822.5 m at 50°N. On 3x that is 3.316 and 3.647 device px per km.

**Detail needed for no magnification.** EPSG:3857 m/px = 6398.168791 ÷ (px/u). Ground m/px = that × cos φ. Web-Mercator zoom z = log2(px/u × 6263.51/256). XYZ tile px/u = 256·2^z/6263.51: z6 2.616, z7 5.231, z8 10.463, z9 20.926.

| Case | Device px/u | EPSG:3857 m/px | Ground m/px at 45°N | at 50°N | Web-Mercator z | Smallest standard source zoom |
|---|---|---|---|---|---|---|
| PLAY_K, 2x | 1.7×2 = 3.4 | 1881.81 | 1330.64 | 1209.61 | log2(83.187) = 6.378 | z7 (5.231) |
| PLAY_K, 3x | 5.1 | 1254.54 | 887.10 | 806.40 | log2(124.78) = 6.963 | z7 (5.231 ≥ 5.1) |
| K_MAX, 2x | 10 | 639.82 | 452.42 | 411.27 | log2(244.67) = 7.935 | z8 (10.463) |
| K_MAX, 3x | 15 | **426.54** | **301.61** | **274.18** | log2(367.00) = **8.520** | **z9 (20.926)** |

- At K_MAX on 3x the ground resolution is also 213.27 m/px at 60°N and 137.46 m/px at 71.2°N.
- Tile px per map unit is the same over the whole map, because both the map and the tiles are Mercator. z9 is 305.748 m/px at the equator.

**Current best against the need.**

| Art | px/u | EPSG:3857 m/px | Shortfall at K_MAX on 3x |
|---|---|---|---|
| Painting, full | 2.2515 | 6398.168791/2.2515 = 2841.74 (≈ 1826.6 ground m at 50°N) | 15/2.2515 = 6.66× |
| Relief, land colour | 0.9002 | 6398.168791/0.90019 = 7107.6 (≈ 4568.7 ground m at 50°N) | 16.7× |
| Terrarium z5 source | 1.3079 | – | 15/1.3079 = 11.47× |
| Prototype L4 † | 16 | 399.886 (matches grid.json) | none (0.94×). SHARPNESS 0.85 allows up to 1/0.85 = 1.18× before switching to a finer level (terrainLayer.ts:17) |

**Size of a no-magnification pyramid** for the 2575×2242 window, margins excluded, in 1024-px tiles:

| px/u | Raster | MP | 1024-px tiles |
|---|---|---|---|
| 3.4 | 8755 × 7623 | 66.7 | 9 × 8 = 72 |
| 5.1 | 13132.5 × 11434.2 | 150.2 | 13 × 12 = 156 |
| 10 | 25750 × 22420 | 577.3 | 26 × 22 = 572 |
| 15 | 38625 × 33630 | 1,298.96 | 38 × 33 = 1254 |
| 15, including the margin | 62,625 × 75,630 | 4,736.33 | – |

- For comparison, the current full painting level is 42 tiles and 37.19 MP.
- docs/terrain/WORLD-SCALING-PLAN.md:22-29 sizes a whole-map 512-px pyramid at 4,577 tiles, about 307 MB (L4 alone about 224 MB). The prototype is 398 tiles and 26.5 MB.

**Geometric precision at K_MAX on 3x** (15 px/u).

- The 0.1 u storage step is 1.5 px.
- Drawn coast vs NE50m: p99 0.502 u = 2.5 pt = 7.5 px; max 1.570 u = 7.9 pt = 23.6 px. NE50m to drawn: p99 0.992 u = 5.0 pt = 14.9 px.
- Using 17.4 u/° instead of 17.3986: up to 0.200 u at the east edge = 1.0 pt = 3 px.
- Fitting a raster to a nominal 25°S bottom edge: up to 0.3214 u = 1.6 pt.
- Using EPSG:3395: 4.72–5.12 u = 23.6–25.6 pt.

---

## 7. Interaction and systems that must be preserved

Lines marked † are 8dc7b895; HEAD lines are in brackets. tap.ts and geometry.ts are unchanged.

### 7.1 Camera contract

- **The camera** is {cx, cy, k}, with k in screen points per map unit. It lives in React state and is published to store.camera in a layout effect (MapView.tsx:32-36†, :45†, :88-93†, :92†; store.ts:60-61).
- **Opening.** The game opens on the player's capital at k = max(width/420, PLAY_K), with the centre clamped by hand (:61-71†).
- **focusOn(x, y, zoom)** (:73-79†; store.ts:61, :161-164).
  - With a zoom, k = width/zoom, where zoom is the number of map units across the screen.
  - Without one, k = max(current k, w/420, 1.7).
  - It jumps without animation, because it calls setState during render.
  - Every in-game "show on map" omits zoom: Outliner.tsx:46, NationSheet.tsx:172, Panels.tsx:265, Menu.tsx:104, ColonySheets.tsx:37, UnitSheets.tsx:277.
- **Bounds.** kMin is at :52†; camera.ts:8 and :11-24 hold K_MAX and the clamps. On 390×844, kMin = 0.143883, so the whole map is 2575 × 0.143883 = 370.5 pt wide.
- **Walkthrough zooms** 700/900/1400/1700/2200/2600 give k = 0.557/0.433/0.279/0.229/0.177/0.150.

### 7.2 Gestures and commit

- **Structure** (:37-38†, :46-50†, :81-93†, :138-174†, :175-215†, :224-226†, :252-262†; camera.ts:30-42).
  - Gestures write only tx, ty and sc on one Animated.View that holds StaticLayer and UnitLayer. The view is 1.6× the screen and centred, so scaling happens about the screen centre.
  - settle() commits at once if the change is under 0.5 pt; otherwise it animates for 320 ms.
  - commit() calls setCam, and the layout effect resets the transform.
- **Rubber band on 390×844.** It tends to 117 pt horizontally and 253.2 pt vertically. rubber(100, 117) = (1 − 1/(55/117 + 1))·117 = 37.41 pt. rubberZoom(10) = 5·2^0.3 = 6.156.
- **Wheel (web).** Calls setCam on every event, with factor exp(−deltaY·0.0015) clamped to [kMin, K_MAX] each time. There is no rubber band and no native transform (:228-249†).
- **The vignette** is outside the Animated.View (:266-276†).
- **Render box on 390×844.** 624 × 1350.4 pt = 842,650 pt²: 3.37 MP at DPR 2 and 7.58 MP at DPR 3. Its width in map units is 624/k: 367.1 at 1.7, 124.8 at 5 and 4336.8 at kMin.
- **The mapping every layer must share.**
  - StaticLayer draws in map units through its viewBox (:314-318†, :434†).
  - UnitLayer draws in screen points with toX = (x − cx)·k + W/2 (:927-928†).
  - The prototype's tiles are SvgImage elements inside StaticLayer's SVG, so inside the Animated.View (:401-428†, :497-499†). The coarsest level covers the whole 1.6× area. Finer levels cover only the screen grown by BUFFER = 0.15 per side (terrainLayer.ts:21).
  - The over-render margin is 0.3 of the screen per side; the fine-tile margin is 0.15. A pan of more than 0.15 screen therefore shows only the coarsest tiles in the margin until commit.
  - terrainCache.ts:20-33 prefetches tiles.
- **Taps during a 320 ms settle or glide**, or before the commit render lands, are hit-tested with the old camera. handleTap uses only `cam` (:95-103†), and nothing blocks the Tap gesture during an animation (:81-86†, :127-132†, :167-173†).
  - The correct mapping while a transform is live is x = cx + (sx − w/2 − tx)/(sc·k), the algebra commit() uses.
  - Example: halfway through a 200 pt glide, the ease-out cubic gives 1 − 0.5³ = 0.875, so the view has moved 175 pt. A tap then is 175/1.7 = 102.9 u off at k = 1.7.

### 7.3 Tap pipeline and priority

- **Conversion.** MapView converts the tap to map units with mx = cx + (x − w/2)/k, my = cy + (y − h/2)/k, then calls onMapTap(mx, my, k) (:95-103† [91-99]; tap.ts:17).
  - Pan starts after 6 pt (:176†). A tap fails if it lasts over 300 ms or moves over 10 pt (:216-221†). The composition is `Gesture.Race` (:222† [218]).
  - e.x and e.y are relative to the untransformed outer View (:257-259†).
- **Priority in onMapTap** (tap.ts:10-11, :13-15, :21-32, :33-35, :38-46, :47-54, :55-69):
  1. **Unit tokens** within HIT = 22 pt, measured from TOKEN_MIDDLE·tokenScale(k) pt above the token's point. Your own units win, then the closest. While your army or fleet is selected, another of your units takes the tap only within HIT_SWITCH = 14 pt.
  2. **regionAt.**
  3. **seaAt**, only if neither regionAt nor wasteAt hit.
- **Orders.**
  - With your army selected, a tap on a region marches there (moveArmy, `{map:false}`) unless the best hit is your own unit. A foreign token near the tap does not block the march.
  - With your fleet selected, the target is the tapped sea, or else the tapped region's seas[0]. A landlocked region falls through to selection.
- **Selection.** Otherwise a unit hit selects the army, fleet or battle; else the region; then the sea; else nothing. Tapping the current selection again deselects it.
- Haptics run on native only, and only for unit selections and successful orders.
- **Hit radius.** HIT = 22/k u: 19.13 at k 1.15, 12.94 at 1.7 (= 12.94/17.3986 = 0.744° of longitude), and 4.40 at 5 (0.253°). HIT_SWITCH = 14/1.7 = 8.24 u.
- **Dead code.** tap.ts:39-41 can never run: it needs !(best && best.mine), yet a selected army is always the player's (:21, :27). Deselecting actually happens at :55-56.

### 7.4 Hit geometry and coverage

- **Hit tests** use the drawn, rounded paths: MAP.regions/wastelands/seas[].path (geometry.ts:57-78, :95-108, :112-126, :128-139). Those are the same paths the SVG fills and highlights (build-map.ts:428-429, :430-485, :537, :581-591; MapView.tsx:355† [351], :556-557†, :607-608† [548-549]).
  - Only M/L/Z commands are used. Closed seas are excluded, and the first match in array order wins.
  - Shapes: regions 569 rings / 38,371 vertices; open seas 39 rings / 561 vertices; closed seas 6 rings / 89 vertices; wastelands 159 rings / 13,039 vertices.
  - Timing over 20,000 random points (node v22, 3 runs): regionAt 4.2–5.8 µs; the full chain 7.5–9.6 µs.
- **bbox culling is safe.** bbox, label, labelRadius and area come from the unrounded geometry (build-map.ts:545-548), but 0 of 211 regions have a drawn path outside the stored bbox.
- **Coverage.** Sea polygons are Voronoi cells that run under all land (build-map.ts:8, :82, :331-342, :610). The order region → waste → sea is therefore load-bearing.
  - Cell-centre grid at step 2 (1,442,727 samples): 0 in more than one region; 0 in no shape; 203,355 in a closed sea only; 229,845 in a region; 422,381 in a wasteland and no region; 587,146 in an open sea only.
  - 205 of 211 region labels lie inside an open-sea polygon. The union bbox of the sea paths is [−40, −40, 2615, 2282].
  - 211 of 211 region labels hit their own region; 39 of 39 open-sea labels resolve to their own sea through the tap order.
- **The parchment veils do not block taps.** tap.ts has no charted() check (tap.ts:33-35).
  - unknownWater (step 6): 25,345 samples; 3,111 select an open sea, 22,234 hit a closed sea (nothing selected), 0 hit a region or waste.
  - uncharted: 28,118 samples; 7,487 select a region, 20,487 an open sea, 2 a waste, 142 nothing.
  - The sheets show UnchartedSheet (RegionSheet.tsx:43; UnitSheets.tsx:224).
  - The region highlight has no hidden() check (:607-608†), so an uncharted region's outline is drawn on blank parchment. Sea zones do skip hidden ones (:503†). The parchment paths are at :567-578†.

### 7.5 Units and labels tied to SVG text layout

- **Unit placement** (:826-838† [767-779], :842-848†, :850-853†, :856-862†, :865-912†, :1014-1032†).
  - Positions are pure functions of GameState and k, shared by UnitLayer and tap hit-testing. Hidden units cannot be tapped.
  - Below UNITS_K = REGION_NAMES_K = 1.15 only the selected unit is placed, including battles. From 1.15 to ALL_UNITS_K = 1.4, only units for which matters() is true, plus the selected one. From 1.4 on, every unit.
  - New World armies are skipped before discovery.
  - Armies stand under the region name (armyAnchor), or on the label point when no name is written.
  - Fleets stand 16·ts pt above the sea label; battles 0.9·step above the label.
  - A moving unit is interpolated toward path[0] by min(1, progress/edgeDays) and is not stacked.
- **Sizes.**
  - tokenScale = clamp(0.82 + (k − 1.15)/0.55·0.18, 0.82, 1): 0.82 at 1.15, 0.9018 at 1.4, 1.0 at 1.7.
  - step = 26·ts pt. Armies sit side by side at 1.6·step = 41.6 pt; fleets at 1.9·step = 49.4 pt.
  - nameSize = clamp(labelRadius·k·0.42, 9, 14). The median labelRadius is 17.7 (range 1.3–67.8), giving 12.64 at k 1.7.
  - armyAnchor drops the army by 12.64·0.55 + 3 + 27·1 = 36.95 pt = 21.74 u. The constants are NAME_EM 0.68, BASE_Y 6, BASE_RX 14, BASE_RY 5, TOKEN_TOP 27 and TOKEN_MIDDLE 8.
- **Hit-test inconsistencies.**
  - tap.ts passes a selected id only for armies and fleets (tap.ts:23, :25), while UnitLayer also passes battles (:929† [870]). A selected battle drawn below UNITS_K therefore cannot be tapped.
  - The TOKEN_MIDDLE offset is also applied to the 88×26 battle chip, which is centred on its point (:1000† [941], :1064†). That puts the hit centre 8 pt off at k ≥ 1.7 and 6.56 pt off at 1.15.
  - The selected token's extra scale(1.12) is ignored by hit testing (:1046†).
  - unitPoint uses store.selection?.id for any kind of selection (:1080† [1021]).
- **Labels.**
  - nationArcs samples every second vertex of the drawn region rings (i += 4 on flat x,y pairs). It fits a principal axis, level when the spread is under 0.25 and tilted at most 75°, and builds a quadratic Bézier spine (geometry.ts:190, :206-308, :213, :236-239). nationLabels is at :311-363.
  - placeNames writes names along nm_/ns_ paths with TextPath (:749-794†, :757-758†, :773†). Font size = min(thickness·0.6, length·0.95/(len·(em + spacing)), 30/k). A name under 8 pt on screen, or one that collides with names already placed, is dropped.
  - Flat uses straight Inked text (styles.ts:224† curved:false).
  - Region names show from k ≥ 1.15 when labelRadius·k ≥ 13, at nameSize with a 2.2 pt outline. Sea names show from k ≥ 0.9 (open seas, or closed seas marked charted). Lake names show from k ≥ 1.0, once the New World is discovered. Wasteland names show from k ≥ 0.3. (MapView.tsx:429†, :623-633†, :644-661†, :662-673†, :674-697†, :797-813†.)
  - Forts are placed by an estimated name width (NAME_EM 0.68), not by measuring the text (:964-975†, :970†).
  - tests/map.test.ts:60-77 requires more than 30 arcs, tilt ≤ 76° and France's arc longer than 100.
- **Region names hidden for being too small.**
  - At k 1.7 (labelRadius < 13/1.7 = 7.647): 12 regions. At 1.15 (< 11.304): 32. At 1.4: 18.
  - At K_MAX (< 2.6): 4 (antilles 1.7, azores 1.3, cape_verde 2.1, madeira 1.8).
  - Calais (labelRadius 8.5) shows from 13/8.5 = 1.529; Constantinople (6.1) from 2.131; Zealand (8) from 1.625.

### 7.6 Selection rendering and glide

- **Highlights.**
  - Region and nation highlights come after the coasts (:595†) and before the names (:596-608† [537-549]).
  - The sea highlight is drawn in the sea-zone group, before the land fills (:501-507† [455-461], :511-513†). It is clipped to #water only in Painted, so in opaque styles the land covers it.
  - A selected token gets scale(1.12), a glow ellipse and a #ecd08f rim (:1046-1051†).
  - The route is a screen-space path: #fff6d8 4 px at 0.9 opacity, then C.red 2 px dashed "6 5" (:955-960† [896-901]).
  - Map-space strokes use px(n) = n/k (:327† [323]).
- **Glide.**
  - When the selection changes, the camera animates for 320 ms so the selection sits in the clear band between the top bar and the sheet (:105-133† [101-129]; src/ui/layout.ts:5-19: TOP_BAR_H 54, DOCK_H 60, dockTop, sheetHeight, freeBand; selectionPoint :915-923†).
  - It skips nations, skips while a pan or pinch is live, and skips when the point is already acceptable.
  - It assumes a compact sheet for every army and fleet (:117†), but sheets open compact only for your own units (UnitSheets.tsx:94, :204 `compact={mine}`). The hints in src/app/game.tsx:67 check ownership correctly.
- **Glide numbers on 390×844 with zero insets.**
  - The band top is 0 + 6 + 54 + 8 = 68; dockTop = 8 + 60 + 8 = 76.
  - Compact sheet: max(220, 0.3 × 844) = 253.2, so the band bottom is 844 − 76 − 253.2 = 514.8.
  - Half sheet: max(260, 0.42 × 844) = 354.48, so the band bottom is 413.52.
  - A point is left alone if 40 < sx < 298 and 118 < sy < bottom − max(80, (bottom − 68)/4): 403.1 for compact, 327.14 for half.
  - So a foreign army at sy between 327 and 403 is left in place, even though its half sheet starts at 413.52.

### 7.7 Draw order to preserve

- **HEAD** (MapView.tsx:448-649):
  1. sea rect (:448)
  2. painting tiles (:449-451)
  3. sea relief (:452)
  4. water lines (:453)
  5. sea zones clipped to #water (:455-461)
  6. country fills, at 0.42 opacity in Painted (:463-465)
  7. #land-clipped land colour, relief and grain (:468-473)
  8. mountains and marks (:490-497)
  9. occupation (:498-506)
  10. veil and shadow (:507-519)
  11. province, river and nation borders (:522-525)
  12. edge fades (:527-534)
  13. coasts (:536)
  14. selection (:537-549)
  15. labels (:551-646)
- **8dc7b895:**
  1. sea Rect (:490†; Illustrated sea #a1b5b5, styles.ts:112†)
  2. painting tiles (:491-493†)
  3. sea relief (:494†)
  4. terrain tiles (:497-499†)
  5. sea zones (:501-507†)
  6. base land clipped to tOut (:510†)
  7. land fills at tr.fill (:511-513†)
  8. Atlas overlays cut by tOut (:518†, :529†, :544†; clips at :446-455†)
  9. … rivers and lakes (:561-565†)
  10. parchment (:567-578†)
  11. coasts (:595†)
  12. highlights (:596-608†)
  13. names
- **Illustrated defect (from the draw order; not checked visually).**
  - Illustrated has painting null, so its sea zones are not clipped to #water (styles.ts:113†, :137-138†; MapView.tsx:456-460†, :497-507†, :510†, :512†).
  - Inside TERRAIN_REGION the opaque base is clipped away and the land fills are at 0.5. The open-sea Voronoi cells under the land therefore show through: their 0.8 pt rgba(52,78,88,0.16) outlines, and a selected sea's rgba(255,255,255,0.22) wash, appear across the land at half strength.
  - All 53,604 land samples in the region (step 2) lie inside one of 11 open-sea cells: baltic 16,587, black_sea 13,560, adriatic 10,667, channel 3,284, aegean 3,152, tyrrhenian 2,754, west_med 1,753, levant 814, north_sea 780, ionian 180, biscay 73.
  - Selecting the Baltic would wash 16,587/53,604 = 31% of that land.

### 7.8 Map modes and the simulation data the art must not contradict

- **Map modes.** There are 8 MapMode values (store.ts:18). setMapMode bumps mapVersion (store.ts:86-90, :141-144).
  - That recomputes regionFills (memo on [mapVersion, mode]) and nationArcs, nationLabels and borderLines (memo on [mapVersion]) (MapView.tsx:320-326†, :348-356†, :511-513†).
  - Stripes appear only in political and diplomatic modes (:552-560†).
  - Per-mode fill rules: colors.ts:37-43, :45-102; MAP_MODES at :104-113. Science is palest at 5 or more advances behind (:67); development uses t = (dev − 1)/9 (:57); threat saturates at 80 (:97); diplomatic opinion at ±150 (:86).
- **Terrain classes.** Terrain mode colours regions from regions.json `terrain` via TERRAIN_COLOR (theme.ts:92-98), not from any drawn terrain: plains 70, hills 66, forest 42, mountains 25, marsh 8 (70 + 66 + 42 + 25 + 8 = 211). These classes drive battles, movement and supply.
- **Rivers.** The river attacker penalty applies at the 33 border pairs (src/sim/battle.ts:164).
- **Latitude and longitude rules** read region lonlat (§2.9).

### 7.9 Test hooks and walkthroughs

- **window.__coe.**
  - store.ts installs `store`, `commands`, `point(id)` (a region or sea label in map units) and `advance(days)` (store.ts:268-284).
  - MapView adds `unitPoint(id)` at module load and, in 8dc7b895, `terrain()` (:1072-1085† [1013-1025]).
  - This relies on store.ts being evaluated first, which ES import order guarantees (MapView imports store at :16†).
- **What the scripts use.**
  - Store members: state, select, selection, camera, focusOn, run, open, close and paused. screens-terrain.mjs adds setMapStyle and setPaused?.() (scripts/screens-terrain.mjs:39, :47, :109).
  - Commands: moveArmy, stopArmy, playerDeclareWar. Hooks: point, unitPoint, advance, terrain.
  - scripts/screens-newworld.mjs:51 calls store.bump?.(), which does not exist, so it is a no-op.
- **Walkthroughs.**
  - They convert map points to screen points themselves: innerWidth/2 + (x − cam.cx)·cam.k (scripts/screens.mjs:58-63), or the centre of the "map" test ID's bounding box (scripts/screens-war.mjs:33-50). They then throw if a token tap does not select the army or a region tap gives no march order (screens.mjs:17, :68, :70, :71-87, :90; screens-war.mjs:11, :61, :71, :82).
  - screens-terrain.mjs runs at DPR 3 (:21) with 4× CPU throttling (:92). It taps 22 pt above Bavaria's label and only records the result in perf.json (:72-85).
- **Margins of the existing taps.**
  - The token tap lands 2 pt below the token point at k 1.7: 2 + 8·1 = 10 pt from the hit centre, under 22.
  - screens-war zooms with 4 wheel events of deltaY −250, each f = exp(0.375) = 1.455, clamped per event: 1.7 → 2.474 → 3.599 → 5.236 (clamped to 5) → 5. Its tapArmy then lands 8 pt from the hit centre. This assumes each Playwright wheel() is a single wheel event.
- **Which scripts run.** `npm run screens` runs screens.mjs and screens-war.mjs only; `screens:terrain` is separate. screens-newworld.mjs is in neither.
- No Jest test touches tap.ts, regionAt or unitPositions. MapView.tsx cannot load in the node Jest environment without mocks.
- **Selectors used: 21 test-ID patterns, 3 accessibility labels and 2 text matches.**
  - Test IDs: map (MapView.tsx:255†), new-campaign (src/app/index.tsx:74), nation-<ID> (src/app/new-game.tsx:121), begin (:113), hint-ok (Help.tsx:147), choice-<i> (Cards.tsx:67), offer-accept/offer-decline (Cards.tsx:138-139), report-close (Cards.tsx:177), menu (Bars.tsx:121), tab-<key> (kit.tsx:243), advance-<id> (Science.tsx:124), declare-war (Panels.tsx:201), playpause (Bars.tsx:101), mapmode (Outliner.tsx:66), mode-<key> (Bars.tsx:155), war-<id> (Bars.tsx:216), peace-<region> (WarScreen.tsx:269), send-peace (WarScreen.tsx:132), menu-expedition (ColonySheets.tsx:150), colonize (ColonySheets.tsx:115).
  - Labels: "Settings" (Menu.tsx:76), "Close" (Sheet.tsx:77, Panels.tsx:41), "Messages" (Bars.tsx:64).
  - Text: "What they want" (NationSheet.tsx:103), "Declare war…" (NationSheet.tsx:168).
  - mapstyle-<id> (Bars.tsx:171) exists but no script uses it.

### 7.10 Module coupling

- **No SVG and no React:** geometry.ts (imports only sim/content, :2-3), camera.ts (worklets, :6) and layout.ts.
- **SVG-free but not platform-free:**
  - colors.ts imports theme.ts (colors.ts:2-8), which imports react-native (theme.ts:1).
  - tap.ts imports expo-haptics, react-native, the store (AsyncStorage: store.ts:10, src/state/storage.ts:2) and MapView.tsx (tap.ts:2-8).
- **Pure functions in the wrong module.** unitPositions, armyAnchor, fleetAnchor, matters, tokenScale and selectionPoint are plain functions, but they live in MapView.tsx, which imports react-native-svg, Reanimated and gesture-handler (:9-12†).
- **Circular import.** tap.ts imports from MapView.tsx (tap.ts:8, :43, :50) and MapView imports onMapTap from tap.ts (:24†). It works only because the imports are used at call time.
- **Unused re-exports.** MapView re-exports regionAt and seaAt, but nothing imports them (:1070† [1011]). Only tap.ts and src/app/game.tsx import MapView.
- **SVG-specific parts:**
  - all of StaticLayer (:310-710†): viewBox mapping; ClipPaths #land, #water, #tIn, #tOut; occupation and grain Patterns; edge LinearGradients; TextPath names; Inked text; selection paths; terrain SvgImages;
  - UnitLayer's tokens, forts and route (:925-1007†);
  - the vignette (:266-276†).
  - Siege bars and battle chips are plain React Native Views (:950†, :1000†).
- **Re-render triggers.**
  - StaticLayer re-renders on every selection change (:260† [256], :310†). In 8dc7b895 that includes tilesToDraw, the river and lake filter, and the terrainCache effect (:401-428†).
  - Orders from taps use `{map:false}`, and game ticks bump mapVersion only when the map changed (store.ts:86-90, :111-118, :137-140, :237).

---

## Rendering engine decision

| Criterion | Keep react-native-svg + tile layer (as in 8dc7b895) | React Native Skia 2.6.2 | MapLibre React Native 11.5.0 |
|---|---|---|---|
| Installed | yes, 15.15.4; matches the Expo 57 pin (bundledNativeModules.json:105, 111, 114) | no | no (`ls node_modules/@shopify node_modules/@maplibre` → not found) |
| Expo SDK 57 pin | 15.15.4 | **2.6.2** (bundledNativeModules.json:121). npm latest is 2.14.0 (2026-10-01), but `npx expo install` (AGENTS.md:16) picks 2.6.2 (published 2026-04-04) | none (map entries are only expo-maps :65 and react-native-maps :108) |
| Expo Go | yes | yes. Expo v57 docs list `platforms: android, ios, tvos, web, expo-go` and `inExpoGo: true` | **no**: "can't be used with Expo Go", needs its config plugin (app.plugin.js) and a rebuild. A native library needs a development build (AGENTS.md:40). There is no ios/, android/ or eas.json (CLAUDE.md:181†) |
| Peer ranges vs repo (react 19.2.3, RN 0.86.3, reanimated 4.5.1) | fine | react ≥ 19.0, RN ≥ 0.78, reanimated ≥ 3.19.1 (RN and reanimated optional) | expo ≥ 54 (optional), react ≥ 19.1.0, RN ≥ 0.80.0. New architecture only. Wraps MapLibre Native Android 13.6.1 / iOS 6.31.0 (android/gradle.properties:8; MapLibreReactNative.podspec:7). Published 2026-10-04, 8 days before the audit |
| Web | DOM SVG. CI (`../.github/workflows/crowns-of-europe.yml:26-27`) and all walkthroughs keep working | runs through CanvasKit WASM, loaded asynchronously before the first frame (LoadSkiaWeb.js:7, :13-21). canvaskit-wasm 0.41.0's full/canvaskit.wasm is 8,076,553 B, 3,246,373 B gzipped. Against the 5,241,962 B / 1,522,195 B gz bundle that is 1.541× raw and 2.133× gz; first load goes 1,522,195 → 4,768,568 B gz (3.13×), plus 123,600 B of glue JS | **none**: 979 files, 0 web files (`tar -tzf … \| grep -c -i -E '\.web\.\|/web/'` → 0). README.md:17-18 says Android and iOS; codegen components (package.json:116; MapViewNativeComponent.ts; Native*Module.ts). `expo export --platform web`, the CI job and every Playwright walkthrough would break, unless a second maplibre-gl-js renderer were kept for web |
| Web setup friction | none | setup-canvaskit.js treats the project as Metro only if app.json has `web.bundler === "metro"` (:48-49); this app.json:27-30† has no such key, so by default it copies to web/static/js (:79-80; a folder can be passed instead, :25-28; it resolves the full build, :67). There is no public/ folder; scripts/serve.mjs:7 has no .wasm type and serves unknown types as octet-stream (:13). Whether the loader tolerates that MIME type was not tested | n/a |
| Coordinate space | the same map-unit viewBox as the vectors, clip paths and hit tests: aligned by construction (MapView.tsx:434†) | map units through its own transform. Vectors must be redrawn in Skia, or the canvas sits under the SVG | lon/lat → EPSG:3857. Map units are an exact affine of it (§2.3), but every tile corner must go through the inverse affine. The ±85.0511° cap cuts **61.10 u** of the painted margin; at kMin the 390×844 view top (y −1811.9) is 473.0 u = 68.1 pt past MapLibre's world edge, with behaviour there untested. The pyramid sits at fractional XYZ zooms 4.613 + L (painting 5.784), so RasterSource (tileSize :47, xyz/tms :54) would need re-cut tiles, or one ImageSource per tile (4 lon/lat corners, ImageSource.tsx:26-29): 398 now, about 4,577 for the world |
| Camera, gestures, taps, hooks | unchanged | unchanged. Camera and gestures (MapView.tsx:40-249†, :140-174†, :175-222†, :228-249†; camera.ts:11-42), taps (:95-103† → tap.ts:17 → geometry.ts:128, 136) and terrainLayer.ts (no platform imports, :1-4) stay | **replaced**: MapLibre owns the camera, gestures, level of detail and tile cache. The {cx, cy, k} state (:45†), store.camera (:92†; store.ts:60-61) that screens.mjs:58-63, :68, :87 use, the rubber band, the 1.6× native-transform scheme (:37†, :252-262†), the glide (:105-133†), the __coe hooks (:1072-1085†), UnitLayer inside the transform (:925-1007†, :259-262†), and terrainLayer/terrainCache would all be rewritten or become dead code. onRegionIsChanging is a native event (Map.tsx:477-479). Taps could survive via the inverse affine with k = 512·2^z/6263.51 |
| Zoom mapping | k | k | z = log2(6263.51·k/512): K_MAX → 5.935, PLAY_K → 4.378, REGION_NAMES_K → 3.814, kMin (390×844) → 0.816 |
| Labels, clips, patterns | as now | StaticLayer (about 401 lines, :310-710†, Inked :713-730†) rewritten. Fonts come from files via useFont/useFonts (Font.d.ts:6, 17); tiles via async useImage (Image.d.ts:5, null until loaded). SkImage.dispose exists (Image.d.ts:46; JsiInstance.d.ts:1-4), and there is an Atlas component. react-native-svg is imported by 7 src files (BurningShield, Flag, Icon, Panels, WarScreen, MapView, MiniMap); only MapView would change | style spec; needs `glyphs` or local fonts (MapLibreRNStyles.ts:518-525). Whether expo-font fonts reach MapLibre Native was not verified |
| Offline (CLAUDE.md:38†) | bundled require() assets, hashed on export (e.g. dist/assets/assets/map/terrain/L4/61_33.a90e772b….jpg) | bundled require() | the style, glyphs and every tile must be local. A z/x/y URL template does not fit Expo's hashed asset names (unverified). The getting-started example uses demotiles.maplibre.org |
| Tile lifetime and memory | Native Image.prefetch returns no handle, so release() frees nothing (terrainCache.ts:29-37). The LRU is soft: the pinned set reaches 240 keys against CACHE_TILES 160. On Android each `<Svg>` is a full ARGB bitmap (30.3 MB per layer at 3x on 390×844) | explicit dispose() is possible | its own tile cache |
| Install cost | 0 | about **782,044,847 B** unpacked: skia-android@147.1.0 228,467,070; apple-ios 214,452,582; apple-tvos 214,457,708; apple-macos 88,966,996; canvaskit-wasm 25,527,424; core 10,173,067. That is 1.60× node_modules (490,280,663 B, `du -sb`). No os/cpu restrictions, so CI installs all of it on every `npm ci` | native rebuild; tarball size not measured |
| Jest | tests/terrain.test.ts (13 tests) kept | kept, if the same API is kept | moot |
| Measured performance | headless Chromium, 390×844 @3x (docs/terrain/perf.json). Pan at play zoom, Illustrated: 386 frames, median 16.7 ms, p95 16.8, max 16.8, 0 over 33 ms. At 4× CPU: max 33.2 ms, 0 over 33 ms. Re-render after a camera change at 4× CPU: region k 0.9, Illustrated 323 ms vs Atlas 209; alps-play 208 vs 248. scripts/screens-terrain.mjs:5-6: "A browser is not a phone" | none | none |
| On a device | never run (CLAUDE.md:180†) | never run | never run |

**Already decided in the repo.**

- docs/terrain/WORLD-SCALING-PLAN.md:45 (option B: Skia drawAtlas on native) and :49-52 recommend A, then B.
- :96-101 says to keep react-native-svg for the political layers, put a Skia canvas under the SVG on native only, and keep SVG `<image>` or CanvasKit on web. It points to an ARCHITECTURE-AUDIT.md that does not exist (`find`, `git log --all`).
- :120-122 makes the Skia layer step 3, after phone measurements.
- The plan's "about 30–50 tiles" at play zoom (:103-104) understates the measured 59.

**Tile counts with the real algorithm.** These come from tilesToDraw and decodedBytes over the real index (terrainLayer.ts). The finest level and the one below each cover the screen + 15%; L0 covers the 1.6× area.

| Screen | Case | Tiles | Decoded |
|---|---|---|---|
| 390×844 @3x | k 1.7 (L3; need 1.7·3·0.85 = 4.335, L3 alpha log2(4.335/4)/0.4 = 0.29) | up to 72 simulated; 59 measured (alps-play) | 65.1 MiB simulated; 53.1 MiB measured |
| 390×844 @3x | k 3.2 (need 8.16, just over L3's 8 ppu) | 102 measured (alps-close) | 100.5 MiB |
| 390×844 @3x | simulated worst, k ≈ 3.15 | 116 | 113.1 MiB |
| 430×932 @3x | simulated worst | 134 | 131.1 MiB |
| @2x | simulated worst, k ≈ 4.75 | 64 | 61.1 MiB |

- The largest pinned key sets are 240 (390×844 @3x, k ≈ 1.60; 233.1 MiB if all were decoded), 256 (430×932 @3x; 249.1 MiB) and 151 (390×844 @2x).
- Pinning (terrainLayer.ts:117-125) covers every drawn tile plus neighbours() (:140-145), which are passed in at MapView.tsx:426†.
- docs/terrain/verification.json records offline checks that tiles join; seams on a device are unverified.

**Painting warp.** The painting is deliberately moved by up to 45 u ("45 map units at most", docs/design-notes.md:206-213, :211) to match the game's coasts, and "the game's borders never move" (:213).

- build-painting.ts:90 sets MAX_SHIFT = 45; :243-256 builds and applies the warp.
- The actual maximum shift is only printed to the console (:246) and not recorded in the repo.
- 45 × 6398.17 = 287,918 EPSG:3857 m, about 287,918 × cos 45° = 203.6 km on the ground at 45°N.
- So the alignment that matters is in map units, which favours a renderer that works in map units.

**Recommendation**

1. **Keep react-native-svg with the tile layer committed in 8dc7b895.**
   - Tiles share StaticLayer's map-unit viewBox with the vector coasts, clips, fills and hit tests, so they align by construction.
   - It adds no native dependency, leaves Expo Go, the web export, CI and every Playwright walkthrough intact, and is the only option with measurements.
   - Extend the pyramid from TERRAIN_REGION to the map as WORLD-SCALING-PLAN.md describes, after resolving these points within this architecture (see Risks):
     - bound the pinned set to CACHE_TILES;
     - give fine tiles the same margin as OVER, or accept coarse tiles in the margin during pans;
     - clip sea zones to water in Illustrated;
     - take every land and water mask from map.json's drawn paths;
     - measure memory on a device.
2. **Treat Skia 2.6.2 only as a native-only canvas under the SVG.** Add it if phone measurements show react-native-svg cannot hold frame rate or memory (WORLD-SCALING-PLAN.md:96-101, :122). Keep SVG on web so the 8 MB CanvasKit download and the bundler/MIME issues never arise.
   - Accept that this path would never run in CI or the walkthroughs.
   - Accept about 782 MB of npm installs.
   - Accept rebuilding the paint order where the opaque sea Rect and sea relief sit above the canvas (MapView.tsx:490†, :494†).
3. **Reject MapLibre React Native.** It has no web implementation, cannot run in Expo Go, replaces the whole camera, gesture, tap and test-hook stack, cuts the painted margin at 85.0511°, needs the pyramid re-cut onto integer XYZ zooms, and needs every asset served locally.

---

## Risks for the terrain work

**Baseline**

- **Line numbers drift.** Line numbers for MapView.tsx, styles.ts and CLAUDE.md differ by up to about 60 lines between HEAD 9fcf0411 and 8dc7b895, and the terrain files were being rebuilt mid-audit (L4 288 → 0 → 288). dist/ was rebuilt from the working tree at 20:34:41 and again at 20:49:24, so re-running count.mjs or timing.mjs against dist/ measures 8dc7b895, not HEAD. Re-check citations against whichever commit the rewrite lands on.

**Alignment and data**

- **Projection constants.** Derive every tile grid and EPSG:3857 geotransform from map.json (geo.ts:19-27; mapproj.py:34-41), never from the nominal constants.
  - 17.4 u/° instead of 2575/148 is up to 0.200 u off at the east edge.
  - Fitting a raster to 25°S stretches it by 2242/2242.3214, up to 0.32 u off at the bottom.
  - EPSG:3395 instead of the spherical formula is 4.72–5.12 u off at 45–50°N (23.6–25.6 pt at K_MAX).
  - The vectors.py docstring still says "17.4 * k". This is documentation only; MapView's webZoom uses MAP_W/(east − west).
- **The margin exceeds Web Mercator.** It reaches 85.345°N, so XYZ sources cannot fill the 61.10 u strip above y = −1338.90 (geo.ts:64 and mapproj.py:49 clamp latitude). At kMin a 390×844 view shows 1811.9 u above and below the map (430×932: 1816.5), past FAR_Y = 1400, and the 1.6× layer and rubber zoom reach further. Tiles must tolerate views well past the margin.
- **Tiles must take land and water from the drawn paths.** The game reads the unrounded arcs; everything drawn or baked uses the Chaikin-rounded arcs. On the real coast these differ by p99 0.64–0.86 u (about 2.6–3.5 km at 50°N), more at window corners (14.7 u) and on undrawn wasteland edges (up to 27.8 u). Tiles must use the drawn paths (geo.ts:193-196 landRings, or the map.json outlines as scripts/terrain/prepare.py does), not Natural Earth or the unrounded topology. CLAUDE.md:141-143 and build-map.ts:423-427 already require this for anything drawn.
- **Higher-resolution data will not match the game's coast.**
  - NE50m vertices sit up to 3.97 u from the drawn coast where islets were dropped.
  - The NMAS convention suggests about 6 u (≈ 31 pt at K_MAX) of nominal 50m error; that is an external convention, not a measurement.
  - The prototype already clips NE 10m rivers and lakes to game land (scripts/terrain/vectors.py:45-60, :99, :124) and keeps inland water off the game coast (scripts/terrain/render.py:196-201). Every new layer must do the same.
- **Tap targets near coasts.** Hit-testing uses the drawn region paths (geometry.ts:128-139). Tiles that bake their own coastline would make taps near coasts disagree with what the player sees.
- **map.coast is not purely geographic.** It contains 556 u of window-cut runs and 45–48 interior gap arcs (132–136 u). A coast-distance field or water lines derived from map.coast, rather than from the filled polygons, would draw false shores. tests/map.test.ts:20-28 catches only exactly axis-parallel edge segments.
- **Even-odd filling across ring families is unsafe.** unknownWater and uncharted overlap by about 18,000 u², and region and wasteland rings by about 111 u². The shipped shadow-uncharted.png is already wrong (alpha up to 248 deep in the unknown). Union each family, or rasterize them separately, before combining. Inside one family, use even-odd or check winding: there are 86 holes in unknownWater, a flipped outer ring, 3 holes in uncharted, 6 wasteland pinholes and 12 degenerate rings.
- **Lakes that are land.** Lakes other than the 5 Great Lakes, and the Caspian notch, are solid land in every game mask, in pathing and in the land clip. The prototype paints 244 NE 10m lakes as scenery water inside game land (scripts/terrain/prepare.py:10-13, :131-144), so players will see water where armies march.
- **Two Danubes.** Gameplay rivers are border strokes at 33 pairs that carry the −1 attacker penalty (src/sim/battle.ts:164). Illustrated draws both that stroke (styles.ts:126†, width 1.5) and the NE 10m courses (MapView.tsx:561-565†), so the player sees two different Danube lines.
- **Art vs simulation data.** Redrawn terrain can visibly contradict regions.json `terrain` (plains 70, hills 66, forest 42, mountains 25, marsh 8), which drives battles, movement and supply.
- **Painting vs geodata.** The painting is warped up to 45 u to fit the coasts (build-painting.ts:6-9, :90). Tiles built from true geodata can disagree with the painted ground by that much.
- **Keep the projection and map.json fixed.**
  - Region lonlat is regenerated from labels (build-map.ts:586), and the sim's rules read it (events.ts:178, religion.ts:24, military.ts:458, ai.ts:281). Changing the projection or rebuilding map.json changes rule boundaries and seeded replays (tests/soak.test.ts).
  - Rebuild in the order map → relief/terrain/painting/tiles, and never hand-edit map.json or generated files (CLAUDE.md:39-41; 8dc7b895 adds terrainTiles.ts and terrainVectors.ts to that list).
- **Sea zones under land.** Sea zones are Voronoi cells under the land, with bboxes from the largest polygon only. Any style without opaque land must clip them to water, as Painted does; Illustrated does not (31% of the land in its region is washed when the Baltic is selected). Any picking scheme must keep the order units → regions → wastes → open seas, with closed seas selecting nothing.

**Resolution and source data**

- **The painting cannot get sharper without new art.** Its full level is the source's native density (9400 × 11360 over 4175 × 5042 u); upscaling fullmap.png only adds tiles. The rebuild also needs git-ignored inputs: scripts/data/terrain-cache (.gitignore:52) and the 157 MB fullmap.png (.gitignore:57).
- **New source data is needed for 15 px/u.** Whole-map images are capped at 0.949 px/u by the 5.2 MP rule. The cached sources support only about 1.31 px/u for relief (z5 DEM) and 2.62 px/u for land colour (z6 Blue Marble). 15 px/u needs z9 data.
- **Two detail-selection systems.** HEAD's level thresholds are hard-coded in k (0.28, 0.35, 0.55, 2.2 at MapView.tsx:376-377 and :395) and ignore dpr; pxPerUnit is never read. terrainLayer.ts does use dpr. Make one rule.
- **MiniMap coupling.** MiniMap.tsx:77-87 hard-wires the quarter painting, the soft relief and the uncharted shadow. Changing paintingTiles.ts or reliefTiles.ts silently changes the title and picker screens, and the MiniMap has no path for terrain tiles.
- **Painted rivers.** In Painted, rivers exist only inside the painting (styles.ts:90, width 0). Crisp rivers there need a vector layer.
- **Leftovers.** water-lines-light.png (500,684 B) is bundled but unused (reliefTiles.ts:32). The build-relief.ts:11-12 header is stale.
- **Screen-space assets.** Sprites and grain are sized in screen points. Moving anything between map units and screen units changes its sharpness.

**Memory and performance**

- **Android memory.** Each mounted `<Svg>` is a full ARGB bitmap, re-created on every redraw (SvgView.java:267-284). That is 30.3 MB per layer at 3x on 390×844, at least 2 layers (60.7 MB), and 91.0 MB with a route. Decoded tiles come on top:
  - Painted's opening adds up to 29.5 MB (about 112 MiB worst case);
  - Illustrated's simulated worst is 113.1 MiB (131.1 MiB on 430×932);
  - each 2318×2018 raster is 18.7 MB.
  - Baked pictures must also stay under 5.2 MP (CLAUDE.md:140-141).
- **The LRU cap is soft.** CACHE_TILES = 160 is exceeded by the pinned set (240 keys), and on native release() frees nothing (terrainCache.ts:29-37). Peak memory is decided by the native image cache, not by CACHE_TILES. Mitigations from the plan: skip the coarser level under the screen once the fine one has fully faded in (WORLD-SCALING-PLAN.md:108), lower SHARPNESS or CACHE_TILES, or keep the pinned set within capacity.
- **Re-render cost.** StaticLayer re-renders on every camera change, every selection change (armies and fleets included) and every mapVersion bump (including any AI learning an advance). Each time it re-sends 0.4–2.0 M path characters, of which 304,143 are never culled, plus up to three copies of the visible land path. Tiles inside StaticLayer add tilesToDraw and a cache effect with no dependency array to every such render. In Chromium the commit alone exceeds 16.7 ms in about 38 of 48 samples.
- **Mid-gesture renders.** The clock runs during gestures, so MapView, UnitLayer and, on map-dirty days, StaticLayer re-render mid-gesture at the old camera: about 1.5, 3 or 6 times a second. Tile loading tied to React renders fires then too.
- **Margins and soft pictures during gestures.**
  - In-bounds pans are not limited to the 117 / 253.2 pt OVER margin.
  - Fine tiles cover only 0.15 of the screen per side against the 0.3 drawn, so pans longer than 0.15 screen show the coarsest level until commit.
  - Pinch-out below 0.625 shows the edges.
  - Pinch-in scales the old bitmap (soft) until release.
- **Commit flash and pop-in.** The transform is reset in a useLayoutEffect while the new picture is drawn. Asynchronous decode can leave holes or a one-frame flash at each commit. The "fade" is opacity tied to zoom (terrainLayer.ts:19, :50), not a timed crossfade, so late tiles pop in. Seams rely on a 0.6 pt overlap (MapView.tsx:412-413†). None of this has been verified on a device.
- **Web build.** Reanimated and gesture-handler run on the JS thread with the 50 ms game loop and the UnitLayer re-renders. Wheel zoom re-renders the whole SVG on every event. Tile decode competes for the same thread. serve.mjs has no .jpg MIME type (:7); it works only because Chromium sniffs the bytes.

**Interaction and tests**

- **Veils stay tappable.** Taps go through the parchment veils, and sheets rely on charted() to show UnchartedSheet. The region highlight is drawn even for a hidden New World region. Moving the veil into tiles does not make those areas untappable.
- **Unit anchors depend on SVG text.** Army anchors, fort placement and token offsets assume region names drawn at nameSize = clamp(labelRadius·k·0.42, 9, 14) pt in Cinzel (NAME_EM 0.68, TOKEN_TOP 27). Rasterizing names, changing the font, or changing REGION_NAMES_K 1.15 or MIN_NAME_RADIUS 13 moves tokens onto names and moves tap targets and __coe.unitPoint.
- **Nation names depend on the vertex sampling.** nationArcs samples every second drawn vertex. Densifying or re-fitting region paths moves nation names and can break tests/map.test.ts:60-77.
- **Taps during animations.** Taps during the 320 ms settle or glide ignore tx, ty and sc. Heavier StaticLayer renders lengthen that window.
- **Any engine change must rebuild the z-order** (§7.7): selection highlights, occupation stripes, the #land, #water, #tIn and #tOut clips, and TextPath names are react-native-svg features.
- **Test contract.** Only Playwright covers interaction: screens.mjs:70 and :90, screens-war.mjs:71 and :82, plus screens-terrain's tap, which does not assert. They need:
  - store.camera = {cx, cy, k}, with the camera centre at the map-view centre;
  - __coe.point and unitPoint (plus terrain, setMapStyle and setPaused for screens:terrain);
  - testID "map" and the other 20 test-ID patterns.
  - Renaming an ID that tapId() clicks throws after Playwright's timeout. IDs probed only with has() (hint-ok, choice-0, offer-*, report-close, peace-granada, send-peace) would be skipped silently.
  - No automated test renders MapView, so renderer regressions surface only there.
- **Fragile module loading.** The tap.ts ↔ MapView.tsx circular import, and the order in which __coe is installed, must keep working. Moving the unit-position helpers to a module with no platform imports would fix both and make them testable in Jest.
- **Unknown from the repo:**
  - how react-native-svg on iOS and Android decodes LA PNGs and JPEGs inside `<Image>`;
  - whether it mipmaps when shrinking (mountains are shrunk up to 22.6× at PLAY_K and may alias);
  - how much the native transform blurs the picture mid-gesture;
  - the iOS backing-store size;
  - whether Image.prefetch accepts bundled-asset URIs in a native release build (failures are swallowed by `.catch` at terrainCache.ts:31).