# ShiftTips: notes for AI coding agents

Read [`docs/build-plan.md`](docs/build-plan.md) before changing behavior; it is the product spec. [`README.md`](README.md) explains the math, the decisions and what's done.

## Commands (run from `shifttips/`)

- `swift test --package-path Packages/ShiftTipsKit`: all engine, parser, form, export, backup and store tests. Runs on Linux. Run it before every commit.
- The iOS app (SwiftUI views, PDF renderer, UI tests) only builds with Xcode on macOS. Without a Mac, push and read the `ShiftTips` GitHub Actions run (`.github/workflows/shifttips.yml`), which builds the app and runs its unit and UI tests on a simulator.
- New Swift files: put them in the right folder. The Xcode project uses folder-synced groups, so never edit `project.pbxproj` just to add a file.

## Invariants

- **Money is integer cents, time is integer minutes, points are integer thousandths.** Never use `Double`, `Float` or `Decimal` for money, weights or allocation, including in parsing and formatting.
- **Every split reconciles to the cent.** `PoolCalculator.calculate` asserts it; `SplitResult.reconciles` checks cash, card and total. Leftover cents go by largest remainder, ties by roster order. Keep the plan's worked cases in `PoolCalculatorTests` passing exactly.
- **Saved shifts are frozen.** Never recalculate, migrate or edit a `FinishedShift`'s amounts. Changing the arithmetic or status rules means bumping `PoolCalculator.engineVersion`, and old shifts keep showing their stored numbers.
- **Eligibility is never inferred.** Role labels are labels. `managerSupervisorOwner` never receives, with no override; moving anyone to `eligible` needs the separate confirmation in `EmployeeEditorView`.
- **Allocation, not payment.** Don't add copy, exports or features that imply money was paid, taxes withheld, or legal compliance checked. No automatic deductions.
- **Offline only.** No network code, SDKs, analytics or accounts. Links to official guidance open in Safari and are the only exception.
- **Raw values are stored.** Don't rename the raw values of `SplitMethod`, `Eligibility`, `ParticipationStatus` or `Appearance`, or Codable keys, without a backup schema version bump and a migration.
- **Imports validate everything before changing anything.** A bad backup must leave the library untouched.
- **No em dashes (U+2014)** in ShiftTips copy, docs or comments; CI checks `*.swift` and `*.md`. Rewrite the sentence rather than substituting another dash.

## UI

- Build with `Theme` colors and the button styles in `DesignSystem/`. Colors carry meaning only alongside an icon or words.
- Amounts use `MoneyText` (tabular figures, spoken as words for VoiceOver).
- Keep tap targets at least 44pt and let text wrap at large Dynamic Type sizes.
- UI tests find elements by `accessibilityIdentifier`; keep those stable.
