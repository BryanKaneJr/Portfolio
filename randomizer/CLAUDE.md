# Randomizer: notes for AI coding agents

Read [`docs/build-plan.md`](docs/build-plan.md) before changing behavior. It is the product spec; [`docs/checklist.md`](docs/checklist.md) records where the build made a choice the plan left open.

## Commands

- `cd Packages/RandomizerCore && swift test`: the draw engine, odds, session rules and storage. Runs on macOS and Linux. Run it before every commit that touches the package.
- In Xcode, open `Randomizer.xcodeproj`: scheme **Randomizer** + Cmd+U runs the UI tests on a simulator; scheme **RandomizerCore** + Cmd+U runs the package tests.
- CI (`.github/workflows/randomizer.yml`) runs both, and uploads `randomizer-screens` (PNG screenshots from `ScreenshotTourUITests`) and `randomizer-logs`.

## Invariants

- **One draw engine.** Every winner comes from `SelectionEngine` via `DrawList.draw` / `generateDraftOrder`. Reveal views never choose, re-roll or influence a result.
- **Commit before the show.** `AppState.draw` mutates the list (results, draw-time odds, removal) and saves it before returning; the reveal only animates that outcome. Skipping, switching style mid-reveal or a force quit must never draw again.
- **Remove (Remove after selection) is always on the draw screen**, as a compact "Remove" switch at the bottom right of the sticky footer (owner, 2026-10-09: small, not a big banner). `RemoveToggle` is the one component, used in `DrawView` (every style, mode, batch, result, presenter mode) and `DraftOrderView`. Never move it into Settings, hide it, or change its value for the person. It affects future draws only. Undo and Restore are small chips that appear only when there's something to undo or restore.
- A unique draft order requires Remove ON. With it OFF, tapping Draft order asks "Turn on Remove?" (Cancel leaves it off; Turn On is the person's explicit choice); normal draws stay available.
- Identity is the UUID, never the name. Duplicate names are separate participants.
- History is a snapshot: `DrawResult` keeps the name and the numerator/denominator from the moment of the draw. Edits never rewrite it.
- Odds shown are the real odds: wheel sectors are proportional to weight; percentages never round a nonzero chance to 0% or a sub-certain one to 100%.
- Local only: no network calls, accounts, analytics or third-party SDKs. Lists live in `Application Support/Randomizer/randomizer_store_v1.json` (atomic writes, previous save kept as a backup, unreadable files set aside, never deleted).
- Keep the core package Foundation-only so its tests keep running on Linux.
- **No disclaimer copy** (owner, 2026-10-09). Don't add "not official", "illustrative preset", "not a lottery/gambling" or similar apologetic lines to the app, shared results or store listing. Reverse Standings is simply inspired by a popular draft format. Still never use real league or TV-show names, logos or artwork.

## Layout

`Packages/RandomizerCore/` (engine, models, storage, tests), `Randomizer/` (SwiftUI app: `App/`, `Screens/`, `RevealStyles/`, `Components/`, `Design/`, `Services/`, `Resources/`), `RandomizerUITests/`, `Config/` (Info.plist additions), `docs/`.

The Xcode project uses synchronized folders: new files under `Randomizer/` or `RandomizerUITests/` join their target automatically. Don't put stray files (READMEs, scripts) inside those folders; they would be bundled.

## UI

Build from `Design/Theme.swift` and `Design/Components.swift`. Dark-first, warm near-black base, one violet accent, the bright palette only for sectors and balls. Copy is plain: Equal Odds, Weighted, Remove after selection, Restore removed. Every reveal must be skippable and must fall back to a fade with Reduce Motion or the Instant speed. UI tests find controls by `accessibilityIdentifier`; keep identifiers stable.
