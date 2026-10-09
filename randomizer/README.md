# Randomizer: Spin & Reveal

> A beautiful way to pick anything: fairly, dramatically, and with the odds you choose.

A polished, offline iPhone randomizer. Add people or things, pick how the result is revealed (Spin Wheel, Name Reel, Lottery Balls or Mystery Reveal), optionally set the odds, and draw. One-time paid download: no ads, accounts, subscriptions, servers or internet needed.

The full product spec is [`docs/build-plan.md`](docs/build-plan.md). What was built against it, and the choices it left open, are in [`docs/checklist.md`](docs/checklist.md). App Store copy and privacy answers are in [`docs/store-listing.md`](docs/store-listing.md).

## What it does

- **Saved lists** with a first-run sample you can draw from in seconds. Add names one by one or paste up to 200 at once.
- **Three odds modes:** Equal Odds, custom Weights (0 to 1,000) and a Reverse Standings preset for fantasy drafts (N down to 1). Every entry shows its weight and its live chance.
- **Four reveal styles** on top of one draw engine. The winner is chosen and saved before the animation starts; every reveal can be skipped and falls back to a fade with Reduce Motion.
- **Remove after selection** sits in the sticky footer of every draw screen. On: winners leave the pool for the session. Off: repeats are possible. Restore removed and Undo last draw are always one tap away.
- **Several winners per tap**, unique or with repeats, revealed one by one.
- **Unique draft orders** (with removal on), revealed from the last pick to the first or the other way round.
- **History** with the chance each winner had at the moment of the draw, New session, and sharing as text or an image.
- Sound effects made for the app, haptics, three animation speeds, VoiceOver announcements and a presenter mode.

## Requirements

- Xcode 16 or later (the project uses Xcode 16 synchronized folders). CI builds with the runner's current Xcode.
- iOS 17 or later, iPhone. No third-party dependencies.

## Build and run

1. Open `randomizer/Randomizer.xcodeproj`.
2. Pick the **Randomizer** scheme and an iPhone simulator, then Run (Cmd+R).
3. To run on a device or archive for the App Store, select the Randomizer target, open **Signing & Capabilities**, choose your team, and change the bundle identifier (`com.bryankanejr.randomizer`) if you need to.

The app stores its lists in `Application Support/Randomizer/randomizer_store_v1.json` inside its sandbox. Delete the app to start fresh.

## Tests

| What | How | Covers |
| --- | --- | --- |
| Draw engine, odds, session rules, storage | `cd Packages/RandomizerCore && swift test` (macOS or Linux), or pick the **RandomizerCore** scheme in Xcode and press Cmd+U | Every probability, toggle and persistence acceptance test in the build plan, plus a 120,000-draw frequency check |
| UI tests | **Randomizer** scheme, Cmd+U on an iPhone simulator | The toggle in all 4 styles x 3 odds modes and presenter mode, draft order rules, undo/restore, double taps, empty pool, first run, relaunch persistence, paste |
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

- **Airplane Mode / offline:** the app makes no network calls; everything works with networking off.
- **Force quit mid-spin:** start a draw, swipe the app away before it lands, reopen. The result is already in history and shown as the last draw; nothing is drawn again.
- **Reduce Motion:** Settings > Accessibility > Motion > Reduce Motion. Reveals become a fade.
- **VoiceOver:** the stage, odds rows and controls are labeled; winners, undo and restore are announced.
- **Ringer switch:** sounds use the ambient audio session, so the silent switch mutes them.

## Layout

```text
randomizer/
  Packages/RandomizerCore/   draw engine, models, odds, session rules, storage + unit tests
  Randomizer/
    App/                     app entry, AppState (saves before every reveal), preferences, UI-test seeds
    Screens/                 Home, list editor, paste, odds, draw, history, draft order, settings
    RevealStyles/            RevealStage + wheel, reel, balls, mystery card
    Components/              Remove after selection footer, share card
    Design/                  colors, type, button styles
    Services/                sounds, haptics
    Resources/               asset catalog, sounds, privacy manifest
  RandomizerUITests/         UI tests and the screenshot tour
  Config/                    Info.plist additions (launch screen, export compliance)
  docs/                      build plan, checklist, store listing
```

## Known limitations

- Verified on the iOS 26 simulator in CI (iPhone 16 Pro), not yet on a physical iPhone. Haptics don't run in the simulator, and sounds aren't checked by the automated tests.
- iPhone, portrait, dark mode only. iPad layouts and landscape are not built.
- Dynamic Type is checked up to the XXXL text size; the accessibility sizes beyond that aren't tuned yet.
- New session clears the current results (after a confirmation). There is no archive of past sessions.
- Before submitting: set your signing team, confirm the name and trademark are available, and capture 6.9" screenshots on a Pro Max simulator.

## Fairness

Every result comes from `SelectionEngine`, which draws a ticket with `Int.random(in:using:)` from `SystemRandomNumberGenerator` and maps it onto the eligible entries' weights. The outcome, the odds at that moment and any removal are saved together before the reveal plays. Reveal styles only animate that saved outcome. It is a recreational picker, not a regulated lottery or certified prize-draw service.
