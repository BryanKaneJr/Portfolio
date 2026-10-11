# Implementation checklist

The app was first built as a general randomizer from [`build-plan.md`](build-plan.md), then narrowed to fantasy draft lotteries (owner, 2026-10-11). This records what Draft Lottery does now, where it lives and what checks it. `Core` tests live in `Packages/RandomizerCore/Tests`, `UI` tests in `RandomizerUITests`.

## Removed in the narrowing

Spin Wheel and Name Reel reveals, single and multi-winner draws, the Remove switch and repeats, undo and restore, session history, the dinner and contestant examples, and the 200-entry lists. The engine, storage, odds formatting, lottery balls, the card reveal, presenter mode, sounds and haptics carried over.

## The lottery

| Rule | Where | Test |
| --- | --- | --- |
| Teams in last season's finish, worst first; list order is the ranking | `League.teams` | Core `testReorderingMovesStandingsOdds` |
| Worst N teams in the lottery (2 to all), stored as "all" when every team is in | `lotteryTeams`, `setLotteryTeams` | Core `testFormatIsClampedToTheLeague`, `testSettingLotteryTeams` |
| Top M picks drawn (1 to all lottery picks); "top 4" survives a smaller lottery when it fits | `drawnPicks`, `setDrawnPicks` | Core `testDrawnPicksFollowTheLottery` |
| Teams outside the lottery pick after it, in standings order | `runLottery` | Core `testTeamsOutsideTheLotteryPickInStandingsOrder`; UI `testTeamsOutsideTheDrawPickByStandings` |
| Lottery teams not drawn pick next, worst first | `runLottery` | Core `testUndrawnLotteryTeamsFollowTheDrawnPicksByStandings` |
| Weighted by standings counts over lottery teams only (L down to 1) | `effectiveWeight(atIndex:)` | Core `testStandingsWeightsCountOnlyLotteryTeams` |
| Custom weight 0 inside the lottery: never drawn, still ahead of non-lottery teams | `status(atIndex:)`, `runLottery` | Core `testZeroWeightLotteryTeamIsNeverDrawnButStaysAheadOfNonLotteryTeams` |
| Exact #1 and top-N chances; nil rather than an estimate for huge tables | `OddsCalculator.topPickProbabilities` | Core `testTopPickChancesMatchAWellKnownFourteenTeamTable`, `testTopPickChancesAlwaysSumToThePicksDrawn`, `testObservedPickSharesMatchTheOddsTable` |
| Whole order drawn and saved before any reveal | `AppState.runLottery` | Core `testRunIsASnapshot`; UI `testNewLeagueSurvivesRelaunch` |
| Countdown reveal from the last lottery pick; progress saved per pick | `LotteryRun.revealOrder`, `revealNextPick` | Core `testRevealCountsDownThroughTheLotteryPicks`, `testReopeningRestoresTheRunAndRevealProgress`; UI `testSampleLeagueRunsWithinSeconds` |
| Every run numbered; Run Again asks first; New season resets | `runCount`, `LotteryRun.number` | Core `testRunNumbersCountEveryRunUntilANewSeason`; UI `testRunAgainIsConfirmedAndCounted` |
| Shared text and image carry the run number, format and drawn odds | `ResultsExporter.runText`, `ShareRenderer.runImage` | Core `testShareTextNamesTheRunAndHowEachPickWasDecided` |

## Engine and storage (carried over)

- [x] `SelectionEngine` with `SystemRandomNumberGenerator`, weighted, without replacement; 120,000-draw frequency check with chi-square
- [x] Percentages to two decimals, `<0.1%` for tiny chances, never a false 0% or 100%
- [x] Atomic local JSON storage, backup of the previous save, unreadable files set aside, lenient decoding of missing or unknown fields

## Screens

- [x] Home: your leagues (with the latest run's state), the sample league, New League; rename, duplicate, delete
- [x] League editor: name, standings with drag to reorder and swipe to delete, add or paste teams (32 max), lottery format steppers with a plain-English explanation, odds mode, reveal style
- [x] Odds table: mode, weights (Custom), #1 and top-N chances with bars, "Not in lottery" rows
- [x] Lottery: format summary, odds preview with the fixed picks of non-lottery teams, Run the Lottery with confirmation, countdown reveal, Reveal all, board with hidden and revealed picks, Share, Replay, Run Again, New season, presenter mode
- [x] Settings: sound, haptics, reveal speed, how the lottery works, privacy

## Polish

- [x] Sounds made for the app (rattle, drumroll, chime) on the ambient session; haptics on ticks and landings
- [x] Reveal speed Standard, Fast, Instant; Reduce Motion shows a fade
- [x] VoiceOver: each pick announced as it lands; labels on the stage, odds rows and draft slots; skip action on the stage
- [x] App icon (a drum of numbered balls with #1 rising), launch background, privacy manifest, export-compliance key
- [x] Screenshot tour UI test for App Store images

## Choices

- **One saved order per league.** The latest run is kept; earlier runs are counted (Run #2), not archived.
- **The countdown is the only reveal order.** It's how draft lotteries are shown, and it keeps the drum honest: it only ever holds teams whose picks are still hidden.
- **Undrawn lottery picks reveal as standings cards**, not balls, so a ball only ever rises for a pick the lottery actually drew.
- **Standings numbers in pastes** ("1. ", "12) ") are dropped; numbers that are part of a name ("76ers", "1.FC") stay.
- **Names** are capped at 60 characters, league names at 60.
- **Lottery Balls** shows up to 20 balls (always including the drawn team) and says "Showing 20 of N" beyond that.
- **iPhone, portrait, dark mode** for v1.
- **Bundle ID** `com.bryankanejr.draftlottery`. Set your team in Signing & Capabilities before archiving.

## Ideas not built

Keeper and traded-pick handling (a team owning another team's pick), saved odds templates, importing standings from a league site, a pick-by-pick probability grid, an iPad or TV presentation layout, PDF export.
