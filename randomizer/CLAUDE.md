# Draft Lottery: notes for AI coding agents

This app does one thing: fantasy draft lotteries (owner, 2026-10-11: "fantasy draft lottery is our goal... kill everything that isn't obviously pushing in that direction"). Don't add general-purpose randomizer features back (wheels, name pickers, raffles, repeats, multi-winner draws). [`docs/build-plan.md`](docs/build-plan.md) is the original randomizer spec, kept for its engine, storage and quality rules; [`docs/checklist.md`](docs/checklist.md) says what was built and which choices were made.

## Commands

- `cd Packages/RandomizerCore && swift test`: the lottery engine, odds, format rules and storage. Runs on macOS and Linux. Run it before every commit that touches the package.
- In Xcode, open `Randomizer.xcodeproj`: scheme **Randomizer** + Cmd+U runs the UI tests on a simulator; scheme **RandomizerCore** + Cmd+U runs the package tests.
- CI (`.github/workflows/randomizer.yml`) runs both, and uploads `randomizer-screens` (PNG screenshots from `ScreenshotTourUITests`) and `randomizer-logs`.

## Lottery rules

- `League.teams` is last season's finish, **worst first**. List order is the ranking; there's no rank field.
- The worst `lotteryTeams` teams are in the lottery (`lotteryTeamCount`, nil = all). The lottery draws picks 1 to `drawnPicks` (`drawnPickCount`, nil = every lottery pick) by weight, without replacement. Lottery teams not drawn pick next by standings, then the teams outside the lottery by standings.
- Weighted by standings counts over the lottery teams only: L lottery teams weigh L down to 1. Teams outside the lottery have weight 0 in every mode. A Custom Odds lottery team at weight 0 picks by standings after the drawn picks.
- Odds shown are the real odds: `OddsCalculator.topPickProbabilities` is exact (it walks every partial draw) and returns nil instead of estimating when the table is too large. Percentages never round a nonzero chance to 0% or a sub-certain one to 100%.

## Invariants

- **One draw engine.** Every drawn pick comes from `SelectionEngine` via `League.runLottery`. Reveal views never choose, re-roll or influence a pick.
- **Commit before the show.** `AppState.runLottery` records the whole order and saves it before returning; reveals only show it. Reveal progress (`LotteryRun.revealedCount`) is saved before each reveal animates, so leaving mid-reveal never shows a pick early or twice, and never draws again.
- **Every run is counted.** `runCount` goes up with each run and `LotteryRun.number` is shown on the board and in shared text and images. Running again always asks first. Only New season resets the count.
- **The reveal counts down** from the last lottery pick to #1. Teams outside the lottery are shown from the start (their picks are known). Undrawn lottery picks are revealed in the countdown as standings cards, not balls.
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
