# Draft Lottery: notes for AI coding agents

This app does one thing: fantasy draft lotteries, in three types (owner, 2026-10-11: "fantasy draft lottery is our goal... kill everything that isn't obviously pushing in that direction"). Don't add general-purpose randomizer features back (wheels, name pickers, raffles, repeats, multi-winner draws, custom weight editors). [`docs/build-plan.md`](docs/build-plan.md) is the original randomizer spec, kept for its engine, storage and quality rules; [`docs/checklist.md`](docs/checklist.md) says what was built and which choices were made.

## Commands

- `cd Packages/RandomizerCore && swift test`: the lottery engine, odds, format rules and storage. Runs on macOS and Linux. Run it before every commit that touches the package.
- In Xcode, open `Randomizer.xcodeproj`: scheme **Randomizer** + Cmd+U runs the UI tests on a simulator; scheme **RandomizerCore** + Cmd+U runs the package tests.
- CI (`.github/workflows/randomizer.yml`) runs both, and uploads `randomizer-screens` (PNG screenshots from `ScreenshotTourUITests`) and `randomizer-logs`.

## Lottery rules

Three types (owner, 2026-10-11: the pro format is the main one, plus a high-variance one where even the champion has a 1% shot, plus a third from what fantasy leagues actually use). `LotteryType` is the whole format; there are no per-team weights.

- `League.teams` is last season's finish, **worst first**. List order is the ranking; there's no rank field.
- **Pro Lottery** (`.pro`, default): the worst `lotteryTeams` (the non-playoff teams; `lotteryTeamCount`, nil = `LotteryOdds.defaultProLotteryTeams`) draw for picks 1 to `drawnPicks` (`drawnPickCount`, nil = 4) with `LotteryOdds.proTable` (140, 140, 140, 125 ... 5 out of 1,000; a smaller lottery uses the first N, so ratios match the pros). Undrawn lottery teams pick next by standings, then playoff teams by standings.
- **Long Shot** (`.longShot`): every team in, every pick drawn, `LotteryOdds.longShotWeights`: the champion (last in the list) holds exactly 10 of 1,000, each worse finish an equal step more.
- **Slot Draft** (`.slotDraft`, Kentucky Derby style): equal-odds draw of every team sets the choosing order (`LotteryRun.picks`, pick 1 = chooses first). After the reveal, `chooseSlot` records each team's slot in `slotChoices`; the last team gets the last slot automatically; `undoSlotChoice` fixes a mis-tap. `draftOrder` is the final order. No replay once choosing has started.
- Odds shown are the real odds: `OddsCalculator.topPickProbabilities` is exact (it walks every partial draw, in sorted order so the digits never change) and returns nil instead of estimating when the table is too large. Percentages never round a nonzero chance to 0% or a sub-certain one to 100%.
- Don't put a real league's name in the app or listing; describe the Pro Lottery as the pro basketball format.

## Invariants

- **One draw engine.** Every drawn pick comes from `SelectionEngine` via `League.runLottery`. Reveal views never choose, re-roll or influence a pick.
- **Commit before the show.** `AppState.runLottery` records the whole order and saves it before returning; reveals only show it. Reveal progress (`LotteryRun.revealedCount`) is saved before each reveal animates, so leaving mid-reveal never shows a pick early or twice, and never draws again.
- **Every run is counted.** `runCount` goes up with each run and `LotteryRun.number` is shown on the board and in shared text and images. Running again always asks first. Only New season resets the count.
- **The reveal counts down** from the last lottery pick to #1 (in a Slot Draft, to 1st choice). Playoff teams are shown from the start (their picks are known). Undrawn lottery picks are revealed in the countdown as standings cards, not balls.
- Identity is the UUID, never the name. Duplicate names are separate teams.
- A run is a snapshot: `LotteryPick` keeps the name, finish and draw-time odds. Edits never rewrite it.
- Local only: no network calls, accounts, analytics or third-party SDKs. Leagues live in `Application Support/DraftLottery/draft_lottery_store_v1.json` (atomic writes, previous save kept as a backup, unreadable files set aside, never deleted).
- Keep the core package Foundation-only so its tests keep running on Linux.
- **No disclaimer copy** (owner, 2026-10-09). Don't add "not official", "for entertainment only", "not gambling" or similar apologetic lines to the app, shared results or the store listing. Still never use real league or TV-show names, logos or artwork.

## Layout

`Packages/RandomizerCore/` (engine, models, storage, tests), `Randomizer/` (SwiftUI app: `App/`, `Screens/`, `RevealStyles/`, `Components/`, `Design/`, `Services/`, `Resources/`), `RandomizerUITests/`, `Config/` (Info.plist additions), `docs/`. Folder, project, target and package names are still `Randomizer`; the product is Draft Lottery (display name, bundle ID `com.bryankanejr.draftlottery`).

The Xcode project uses synchronized folders: new files under `Randomizer/` or `RandomizerUITests/` join their target automatically. Don't put stray files (READMEs, scripts) inside those folders; they would be bundled.

## UI

Build from `Design/Theme.swift` and `Design/Components.swift`. Dark-first, warm near-black base, one violet accent, the bright palette only for balls (`StandingBadge` and the balls share a team's colour by finish). Copy is plain and league-flavoured: Run the Lottery, Reveal pick #4, By standings, Run #2. Every reveal must be skippable and must fall back to a fade with Reduce Motion or the Instant speed. UI tests find controls by `accessibilityIdentifier`; keep identifiers stable.
