# ShiftTips: notes for AI coding agents

Read [`docs/build-plan.md`](docs/build-plan.md) before changing behavior; it is the product spec. [`README.md`](README.md) explains the math, the decisions and what's done.

## Commands (run from `shifttips/`)

- `swift test --package-path Packages/ShiftTipsKit`: all engine, parser, form, export, backup and store tests. Runs on Linux. Run it before every commit.
- The iOS app (SwiftUI views, PDF renderer, UI tests) only builds with Xcode 26 on macOS. Without a Mac, push and read the `ShiftTips` GitHub Actions run (`.github/workflows/shifttips.yml`), which builds the app and runs its unit and UI tests on a simulator. Its `ShiftTips-test-results` artifact has screenshots (light, dark, large text) for checking the design.
- `swiftc -parse` on the app's Swift files catches syntax errors on Linux before pushing.
- New Swift files: put them in the right folder. The Xcode project uses folder-synced groups, so never edit `project.pbxproj` just to add a file.

## Invariants

- **Money is integer cents, time is integer minutes, points are integer thousandths.** Never use `Double`, `Float` or `Decimal` for money, weights or allocation, including in parsing and formatting.
- **Every split reconciles to the cent.** `PoolCalculator.calculate` asserts it; `SplitResult.reconciles` checks cash, card and total. Leftover cents go by largest remainder, ties by roster order. Keep the plan's worked cases in `PoolCalculatorTests` passing exactly.
- **Tip Out follows the plan's section 5E.** Tip-outs come only from what each person collected themselves, round to the nearest cent, never exceed the tips collected (proportional cap by largest remainder), and each role's pot splits by minutes. `TipOutPlan` decides who pays, who receives and which fields show; the engine and `ShiftForm` must both use it. Keep `TipOutCalculatorTests.theExampleShiftWorksOutToTheCent` passing exactly.
- **Simple stays simple** (plan 5F): in Simple, New Shift is tips, people and hours, split by hours. Don't surface modes, methods, points, rules or cash and card there; `AppStore` shapes every new form (`ShiftForm.makeSimple`, or the crew's setup in Advanced). Style starting numbers are labeled as starting points, never recommendations.
- **Saved shifts are frozen.** Never recalculate, migrate or edit a `FinishedShift`'s amounts. Changing the arithmetic or status rules means bumping `PoolCalculator.engineVersion`, and old shifts keep showing their stored numbers.
- **Eligibility is never inferred.** Role labels are labels. `managerSupervisorOwner` never receives, with no override; moving anyone to `eligible` needs the separate confirmation in `EmployeeEditorView`.
- **Allocation, not payment.** Don't add copy, exports or features that imply money was paid, taxes withheld, or legal compliance checked. No automatic deductions.
- **Offline only.** No network code, SDKs, analytics or accounts. Links to official guidance open in Safari and are the only exception.
- **Raw values are stored.** Don't rename the raw values of `ShiftMode`, `SplitMethod`, `TipOutBasis`, `Eligibility`, `ParticipationStatus`, `TipOutStatus` or `Appearance`, or Codable keys, without a backup schema version bump and a migration. New fields decode with defaults (`decodeIfPresent`) so older data still loads.
- **Imports validate everything before changing anything.** A bad backup must leave the library untouched.
- **No em dashes (U+2014)** in ShiftTips copy, docs or comments; CI checks `*.swift` and `*.md`. Rewrite the sentence rather than substituting another dash.

## UI

- Follow [`docs/design.md`](docs/design.md) ("a receipt, softened"): rounded white cards on warm paper, `Font.display` (SF Pro Rounded) for headlines and big amounts, `Font.mono` for figures and labels, and yellow only for the primary action and the result. Keep shapes rounded (no sharp corners or heavy outlines); no shadows or gradients.
- Build with `Theme` tokens and the components in `DesignSystem/` (`card()`, `SectionHeader`, the button styles, `SegmentedTabs`, `SelectionMark`, `fieldBox()`, `Tag`, `receiptSlip()`, `ledgerList()`). Colors carry meaning only alongside an icon or words.
- Amounts use `MoneyText` (tabular figures, spoken as words for VoiceOver).
- Keep tap targets at least 44pt and let text wrap at large Dynamic Type sizes.
- UI tests find elements by `accessibilityIdentifier`; keep those stable.
