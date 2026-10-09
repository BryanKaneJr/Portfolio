# Implementation checklist

Built in the plan's order: engine and tests first, then lists, a working draw screen, the four reveal styles, draft orders and polish. "Test" names the automated check; `Core` tests live in `Packages/RandomizerCore/Tests`, `UI` tests in `RandomizerUITests`.

## Non-negotiable: Remove after selection

| Requirement | Where | Test |
| --- | --- | --- |
| Visible, interactive toggle on every draw screen, all 4 styles x 3 odds modes | `RemovalToggleFooter` in `DrawView`'s sticky footer | UI `testToggleIsVisibleAndWorksInEveryRevealStyleAndOddsMode` |
| Visible before a draw, while revealing, on the result | same footer, never hidden by state | same |
| Visible in presenter (full-screen) mode | `DrawView` presenter mode keeps the footer | UI `testToggleStaysVisibleInPresenterMode` |
| Also on the draft order reveal | `DraftOrderView` footer | UI `testUniqueDraftOrderNeedsRemovalOn` |
| ON removes the winner from future draws | `DrawList.draw` | Core `testToggle2_OnRemovesWinner` |
| OFF keeps the winner eligible | `DrawList.draw` | Core `testToggle1_OffKeepsWinnerEligible` |
| ON to OFF keeps earlier removals out | `setRemoveAfterSelection` | Core `testToggle3_...` |
| OFF to ON doesn't retroactively remove | `setRemoveAfterSelection` | Core `testToggle4_...` |
| Restore removed (all or chosen) | footer menu, `RestoreRemovedSheet` | Core `testToggle5_...`, UI `testUndoAndRestoreFromTheFooter` |
| Undo last draw restores only what that draw removed | `undoLastDraw` | Core `testToggle6_...`, `testToggle7_...`, `testUndoDoesNotTouchAnEntryRestoredSinceItsDraw` |
| Saved per list, default ON, restored on reopen | `DrawList.removeAfterSelection` | Core `testNewListDefaultsToRemovalOn`, `testToggle8_...`; UI `testNewListSurvivesRelaunch` |
| Unique draft order requires ON, explained, never silently overridden | `draftOrderAvailability` | Core `testToggle11_...`, `testToggle12_...`; UI `testUniqueDraftOrderNeedsRemovalOn` |

## Phase 1: engine

- [x] Models: `DrawEntry`, `DrawList`, `DrawResult`, enums, versioned `StoreDocument`
- [x] Equal, Weighted (0 to 1,000), Reverse Standings (N to 1) weights
- [x] Normalized odds, `<0.1%` for tiny chances, never a false 0% or 100%
- [x] `SelectionEngine` with `SystemRandomNumberGenerator`, weighted, with and without replacement
- [x] Draw-time odds snapshot on every result
- [x] 120,000-draw frequency sanity test with a chi-square check

## Phase 2: lists

- [x] Home with saved lists, first-run sample (Try a draw / Create my list), rename, duplicate, delete
- [x] Add one at a time, paste many with a preview, 200-entry limit with feedback
- [x] Reorder (drag), swipe to delete, clear with confirmation
- [x] Duplicate-name warning; each entry stays its own participant
- [x] Atomic local JSON storage, backup of the previous save, unreadable files set aside

## Phase 3: draw screen

- [x] Eligible count and odds mode summary, View odds sheet with weights, chances and bars
- [x] Sticky footer: toggle, Restore removed, Undo last draw, Draw, winners per draw, Draft order
- [x] Single and multi-winner draws; "Repeats possible" label when OFF
- [x] "All entries have been selected" with Restore removed / Start new session, never a dead button
- [x] History in draw order with time and draw-time chance; edited-session label after undo; New session
- [x] Share results as text or image

## Phase 4: reveal styles

- [x] Mystery Reveal, Name Reel, Spin Wheel, Lottery Balls, all on one `RevealStage` API
- [x] Winner committed before any animation; tap to skip lands on the same result
- [x] Reduce Motion and the Instant speed show a fade instead of motion
- [x] Wheel sectors proportional to weights; above 24 entries numbers plus a legend that suggests Name Reel
- [x] Switching style never changes pool, odds, toggle or winner (Core `testRevealStyleNeverChangesOddsOrPool`)

## Phase 5: draft order

- [x] Standings editor (worst first), live weights and chances
- [x] Unique weighted order of everyone eligible, saved before the reveal (Core `testDraftOrderIsAPermutationOfEligibleEntries`)
- [x] Reveal last pick first or pick 1 first without changing the order; share as text or image

## Phase 6: polish

- [x] Bundled sounds made for the app (tick, clack, chime), ambient session that respects the ringer switch
- [x] Haptics on ticks and landing, switchable
- [x] Animation speed: Standard, Fast, Instant
- [x] VoiceOver: announcements for winners, undo and restore; labels on controls, odds rows and the stage; skip action
- [x] App icon, launch background, privacy manifest, export-compliance key
- [x] Screenshot tour UI test for App Store images

## How it was verified

- 75 RandomizerCore unit tests, run with `swift test` on Linux and macOS in CI.
- 12 UI tests on an iOS 26.2 simulator (iPhone 16 Pro) in CI, including the toggle in all 12 style and odds-mode combinations, presenter mode, draft order rules, undo/restore, double taps, the empty pool, first run, relaunch persistence and paste.
- Every main screen reviewed from the screenshot tour (normal and XXXL text). Fixes from that review: the repeats-allowed control row, reel neighbours below the winner, the mystery card stripe, history row wrapping, the editor's bottom bar.
- Not yet run on a physical iPhone; haptics and sound output need a device check.

## Choices the plan left open

- **Engine as a local Swift package** (`RandomizerCore`): it keeps the engine separate from the views and lets its tests run anywhere with `swift test`.
- **Rank is list order.** In Reverse Standings the first entry is the worst finish; there is no separate rank field to drift.
- **Undo works per tap.** A batch or a draft order is undone as one action, restoring everyone it removed.
- **A draft order is a draw.** With removal ON, its picks are recorded in history and leave the pool. Undo restores them; New session clears them.
- **No session archive in v1.** New session clears the current results after a confirmation that suggests sharing first.
- **Repeats-possible batches** are capped at 50 winners per tap.
- **Paste** drops leading bullets (`- `, `* `, `•`) but keeps numbers, so "1. FC Köln" survives.
- **Names** are capped at 80 characters, list titles at 60.
- **Lottery Balls** shows up to 20 balls (always including the winner) and says "Showing 20 of N" for bigger pools.
- **iPhone, portrait, dark mode** for v1. iPad and landscape are left for later.
- **Bundle ID** `com.bryankanejr.randomizer`. Set your team in Signing & Capabilities before archiving.

## Not built (v1.1 ideas from the plan)

CSV/JSON import and export, themes, more reveal modes, saved weight presets, read-aloud winners, brackets, an iPad presentation layout, PDF export.
