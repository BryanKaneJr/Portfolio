# Draft Lottery

> Run your fantasy league's draft lottery live: real formats, exact odds, and a countdown reveal everyone can watch.

An offline iPhone app for fantasy commissioners. Enter your teams in last season's finish, choose the lottery format your league uses, check the odds table, then run the lottery and reveal the draft order from the last lottery pick down to #1. One-time paid download: no ads, accounts, subscriptions, servers or internet needed.

The app began as a general randomizer ([`docs/build-plan.md`](docs/build-plan.md)) and was narrowed to the draft lottery on 2026-10-11. [`docs/checklist.md`](docs/checklist.md) records what was built and the choices along the way. App Store copy and privacy answers are in [`docs/store-listing.md`](docs/store-listing.md).

## What it does

- **Leagues** of 2 to 32 teams, entered one at a time or pasted from a standings table (numbers and bullets are stripped). Drag to set last season's finish, worst first.
- **Lottery format:** how many of the worst teams are in the lottery (every team, or just the ones that missed the playoffs), and how many picks the lottery draws (all of them, or only the top few). Lottery teams that aren't drawn pick next by standings, then everyone else.
- **Odds:** weighted by standings (with 6 lottery teams the worst gets 6 chances, the next 5, down to 1), equal, or custom weights (0 to 1,000, for leagues with their own odds table).
- **Odds table** with each team's exact chance at #1 and, when the lottery draws fewer picks than it has teams, its exact chance of landing a drawn pick.
- **Run the Lottery** draws and saves the whole order at once. Then reveal it pick by pick, counting down, with **Lottery Balls** (numbered by finish) or a **Card Flip**. Every reveal can be skipped; Reveal all shows the rest.
- **Every run is numbered.** Running again replaces the order and shows Run #2 on screen and on everything shared. New season clears it.
- **Share** the final order as text or an image, with the format, each drawn pick's odds and the run number.
- A ten-team sample league to try in seconds, presenter mode for a TV or a call, sound effects made for the app, haptics, three reveal speeds and VoiceOver announcements.

## Requirements

- Xcode 16 or later (the project uses Xcode 16 synchronized folders). CI builds with the runner's current Xcode.
- iOS 17 or later, iPhone. No third-party dependencies.

## Build and run

1. Open `randomizer/Randomizer.xcodeproj`.
2. Pick the **Randomizer** scheme and an iPhone simulator, then Run (Cmd+R). The app installs as **Draft Lottery**.
3. To run on a device or archive for the App Store, select the Randomizer target, open **Signing & Capabilities**, choose your team, and change the bundle identifier (`com.bryankanejr.draftlottery`) if you need to.

The app stores leagues in `Application Support/DraftLottery/draft_lottery_store_v1.json` inside its sandbox. Delete the app to start fresh.

## Tests

| What | How | Covers |
| --- | --- | --- |
| Lottery engine, odds, format rules, storage | `cd Packages/RandomizerCore && swift test` (macOS or Linux), or the **RandomizerCore** scheme in Xcode and Cmd+U | Standings placement for every format, exact top-N odds (checked against a well-known 14-team table and 60,000 seeded runs), run numbering, reveal progress, persistence and recovery |
| UI tests | **Randomizer** scheme, Cmd+U on an iPhone simulator | Sample league first run, countdown reveal, Run Again confirmation and numbering, standings picks, a new league surviving relaunch mid-reveal, paste, odds table, card flip |
| Screenshot tour | `ScreenshotTourUITests` (part of Cmd+U) | Saves every main screen as an attachment; with `SCREENSHOT_DIR` set, also as PNGs |

From the command line:

```bash
cd randomizer
xcodebuild test -project Randomizer.xcodeproj -scheme Randomizer \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

To save screenshots as files, prefix the command with `TEST_RUNNER_SCREENSHOT_DIR="$PWD/screens"` (the folder must exist). Use a Pro Max simulator for full-size App Store images.

CI (`.github/workflows/randomizer.yml`) runs the engine tests on Linux and macOS, then builds the app and runs the UI tests on an iOS simulator. Each run uploads the screenshots as the `randomizer-screens` artifact.

### Testing by hand on a simulator

- **Offline:** the app makes no network calls; everything works with networking off.
- **Force quit mid-reveal:** run the lottery, start a reveal, swipe the app away. Reopen: the order is the same, the pick you were revealing is shown, nothing is drawn again.
- **Reduce Motion:** Settings > Accessibility > Motion > Reduce Motion. Reveals become a fade.
- **VoiceOver:** the stage, odds rows, draft slots and controls are labeled; each pick is announced as it lands.
- **Ringer switch:** sounds use the ambient audio session, so the silent switch mutes them.

## Layout

```text
randomizer/
  Packages/RandomizerCore/   lottery engine, league model, odds, storage + unit tests
  Randomizer/
    App/                     app entry, AppState (saves the run before any reveal), preferences, UI-test seeds
    Screens/                 Home, league editor, paste, odds table, lottery, settings
    RevealStyles/            RevealStage + lottery balls and card flip
    Components/              share card
    Design/                  colors, type, button styles, standing badge
    Services/                sounds, haptics
    Resources/               asset catalog, sounds, privacy manifest
  RandomizerUITests/         UI tests and the screenshot tour
  Config/                    Info.plist additions (launch screen, export compliance)
  docs/                      original build plan, checklist, store listing
```

The folder, Xcode project, target and package keep their original `Randomizer` names; the app's display name, bundle ID and store file are Draft Lottery's.

## Known limitations

- Verified on the iOS 26 simulator in CI (iPhone 16 Pro), not yet on a physical iPhone. Haptics don't run in the simulator, and sounds aren't checked by the automated tests.
- iPhone, portrait, dark mode only. iPad layouts and landscape are not built.
- Dynamic Type is checked up to the XXXL text size; the accessibility sizes beyond that aren't tuned yet.
- One saved order per league (the latest run). Earlier runs are counted, not kept.
- The top-N column is worked out exactly; for very large lotteries (for example 16 picks drawn from 32 teams) it's left out rather than estimated. The #1 chance is always shown.
- Before submitting: set your signing team, confirm the name and trademark are available, and capture 6.9" screenshots on a Pro Max simulator.

## Fairness

Every drawn pick comes from `SelectionEngine`, which draws a ticket with `Int.random(in:using:)` from `SystemRandomNumberGenerator` and maps it onto the remaining lottery teams' weights; each drawn team leaves before the next pick. `League.runLottery` records the whole order, with each drawn pick's odds at that moment, and the app saves it before the first reveal. The balls and cards only show that saved order.
