# Implementation checklist

The app was first built as a general randomizer from [`build-plan.md`](build-plan.md), then narrowed to fantasy draft lotteries (owner, 2026-10-11). This records what Draft Lottery does now, where it lives and what checks it. `Core` tests live in `Packages/RandomizerCore/Tests`, `UI` tests in `RandomizerUITests`.

## Removed in the narrowing

Spin Wheel and Name Reel reveals, single and multi-winner draws, the Remove switch and repeats, undo and restore, session history, the dinner and contestant examples, and the 200-entry lists. Later (with the three types) the separate odds modes and per-team custom weights. The engine, storage, odds formatting, lottery balls, the card reveal, presenter mode, sounds and haptics carried over.

## Three lottery types (owner, 2026-10-11)

Chosen from what fantasy leagues use without an in-person event: weighted lotteries are the popular middle ground between a random draw and reverse standings, and "drafting draft positions" (Kentucky Derby style, used by the NFBC and NFFC) lets the draw decide who picks their slot first.

| Rule | Where | Test |
| --- | --- | --- |
| Pro Lottery is the default and the sample league's type | `League.type`, `SampleLeague` | Core `testSampleLeague` |
| Pro: the pros' combinations; the 14-team table gives 52.14% top-four odds to each of the worst three | `LotteryOdds.proTable`, `topPickProbabilities` | Core `testProTableForFourteenTeams`, `testProTopFourChancesMatchTheProTable` |
| Pro: smaller lotteries keep the pros' ratios; non-playoff teams by default; top 4 drawn | `proWeights`, `defaultProLotteryTeams` | Core `testProSixTeamLotteryInATenTeamLeague`, `testProDefaultsFollowLeagueSize` |
| Pro: undrawn lottery teams then playoff teams by standings; the worst team falls no further than 5th with 4 drawn | `runLottery` | Core `testProPlacesEveryoneTheDrawDidntReachByStandings`; UI `testTeamsOutsideTheDrawPickByStandings` |
| Long Shot: champion exactly 1% at #1, worse finishes an equal step more | `longShotWeights` | Core `testLongShotGivesTheChampExactlyOnePercent`, `testLongShotChampWinsAboutOnePercentOfTheTime`; UI `testLongShotGivesTheChampOnePercent` |
| Slot Draft: equal-odds choosing order, slots chosen on the board, last slot automatic, undo | `chooseSlot`, `undoSlotChoice`, `draftOrder` | Core `testSlotDraftTeamsChooseTheirSlotsInDrawOrder`, `testSlotDraftChoicesSurviveReopening`; UI `testSlotDraftTeamsChooseTheirSlots` |
| Exact #1 and top-N chances, the same digits every time; nil rather than an estimate for huge tables | `OddsCalculator` | Core `testTopPickChancesAlwaysSumToThePicksDrawn`, `testTopPickChancesAreTheSameEveryTime`, `testObservedProSharesMatchTheOddsTable` |
| Whole order drawn and saved before any reveal | `AppState.runLottery` | Core `testRunIsASnapshot`; UI `testNewLeagueSurvivesRelaunch` |
| Countdown reveal; progress saved per pick | `LotteryRun.revealOrder`, `revealNextPick` | Core `testRevealCountsDownThroughTheLotteryPicks`, `testReopeningRestoresTheRunAndRevealProgress`; UI `testSampleLeagueRunsWithinSeconds` |
| Every run numbered; Run Again asks first; New season resets | `runCount`, `LotteryRun.number` | Core `testRunNumbersCountEveryRunUntilANewSeason`; UI `testRunAgainIsConfirmedAndCounted` |
| Shared text and image carry the type, run number and how each pick was decided | `ResultsExporter.runText`, `ShareRenderer.runImage` | Core `testShareTextNamesTheRunAndHowEachPickWasDecided`, `testSlotDraftShareTextListsTheChosenOrder` |

## Engine and storage (carried over)

- [x] `SelectionEngine` with `SystemRandomNumberGenerator`, weighted, without replacement; 120,000-draw frequency check with chi-square
- [x] Percentages to two decimals, `<0.1%` for tiny chances, never a false 0% or 100%
- [x] Atomic local JSON storage, backup of the previous save, unreadable files set aside, lenient decoding of missing or unknown fields

## Screens

- [x] Home: your leagues (with the latest run's state), the sample league, New League; rename, duplicate, delete
- [x] League editor: name, standings with drag to reorder and swipe to delete, add or paste teams (32 max), the three lottery types, Pro playoff-team and drawn-pick steppers with a plain-English explanation, reveal style
- [x] Odds table: the type's explanation, #1 and top-N chances with bars, playoff teams marked
- [x] Lottery: type and format summary, odds preview with the fixed picks of playoff teams, Run the Lottery with confirmation, countdown reveal, Reveal all, board with hidden and revealed picks and each team's movement, Slot Draft choosing board with Undo, Share, Replay, Run Again, New season, presenter mode
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
- **Revealed picks show movement, not per-pick odds.** A drawn pick's chance at that moment (100% for the last team in the drum) read like its odds for the whole lottery.
- **The Pro Lottery's name.** It's described as the pro basketball format; the league's name stays out of the app and listing (App Review guideline 5.2).
- **Slot Draft odds are equal**, as in the high-stakes leagues that use it; the draw only decides who chooses first.
- **Standings numbers in pastes** ("1. ", "12) ") are dropped; numbers that are part of a name ("76ers", "1.FC") stay.
- **Names** are capped at 60 characters, league names at 60.
- **Lottery Balls** shows up to 20 balls (always including the drawn team) and says "Showing 20 of N" beyond that.
- **iPhone, portrait, dark mode** for v1.
- **Bundle ID** `com.bryankanejr.draftlottery`. Set your team in Signing & Capabilities before archiving.

## Ideas not built

Keeper and traded-pick handling (a team owning another team's pick), importing standings from a league site, a weighted Slot Draft, an anti-tank ordering by potential points, a pick-by-pick probability grid, an iPad or TV presentation layout, PDF export.
