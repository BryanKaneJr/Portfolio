# ShiftTips

> **Close the shift. Split every cent. Share a clear breakdown.**

ShiftTips is a paid, offline iPhone app that settles tips at the end of a shift, two ways:

- **Tip Pool:** pick the crew, type the pooled tips and each person's hours, choose the workplace's method (Equal, By Hours, or Hours × Points), and see exactly what everyone is allocated, to the cent.
- **Tip Out:** each server or bartender keeps their own tips and pays the house's percentages (of their tips, sales, food sales or bar sales) to support roles like bussers, runners, hosts and barbacks, who share each role's pot by hours.

Save it, share a text or PDF breakdown, and do it again tomorrow without retyping the team.

No account, no server, no network calls, no analytics, no subscription. The full product spec is [`docs/build-plan.md`](docs/build-plan.md); if the code disagrees with it, the code is wrong.

## Layout

| Path | What it is |
| --- | --- |
| [`Packages/ShiftTipsKit/`](Packages/ShiftTipsKit) | Swift package with everything that isn't a view. Builds and tests on macOS **and Linux**. |
| `ShiftTipsKit/Sources/ShiftTipsCore` | Pure domain: integer cents, minutes and fixed-point points; the split engine (`PoolCalculator`, `LargestRemainder`); parsers; the New Shift form as a value (`ShiftForm`); explanations; text summary, CSV and the backup format. Foundation only. |
| `ShiftTipsKit/Sources/ShiftTipsData` | `FileStorage` (atomic JSON in Application Support) and `AppStore`, the observable source of truth the UI binds to. |
| [`ShiftTips/`](ShiftTips) | The SwiftUI app: New Shift, Review, History, Crew, Settings, Welcome; the PDF renderer and share sheet. |
| [`ShiftTipsTests/`](ShiftTipsTests) | App-hosted tests for what only runs on iOS (the PDF report). |
| [`ShiftTipsUITests/`](ShiftTipsUITests) | XCUITests: example shift, review, save, history; blocked review; first launch. They save screenshots into the test results. |
| `ShiftTips.xcodeproj` | Xcode 16 project using folder-synced groups: **add Swift files to a folder and they're in the target, no project edits.** |

## Building

**On a Mac (Xcode 16 or later):** open `ShiftTips.xcodeproj`, pick an iPhone simulator, Run. For a device, set your team under Signing & Capabilities.

**Engine tests anywhere Swift 6 runs (including Linux):**

```bash
swift test --package-path Packages/ShiftTipsKit
```

**CI:** `.github/workflows/shifttips.yml` runs the engine tests on Linux, then on a macOS runner runs them again, builds the app, runs the unit and UI tests on a simulator, and builds the Release configuration unsigned. The UI-test screenshots are in the `ShiftTips-test-results` artifact (open the `.xcresult` in Xcode).

**TestFlight:** `.github/workflows/shifttips-testflight.yml` archives, signs (with an App Store Connect API key) and uploads, started by hand from the Actions tab. See [`docs/testflight.md`](docs/testflight.md).

UI tests launch the app with `-ui-testing`, which uses in-memory storage, so they never touch real data. Add `-show-welcome` to see first-launch onboarding.

## How the math works

- **Integers only.** Money is `Int64` cents, time is `Int64` minutes, points are `Int64` thousandths (1.5 points = 1500). No `Double`, `Float` or `Decimal` touches money or allocation. Parsers read text digit by digit.
- **Weights.** Equal: 1. By Hours: minutes. Hours × Points: minutes × point units. Weights are never rounded.
- **Largest remainder.** Everyone gets `floor(P × w / W)` cents. The leftover cents (always fewer than the number of people) go one each to the largest remainders `P × w mod W`. Exact ties go to whoever is higher on the crew list (the frozen display order). The engine asserts the shares sum to the pool.
- **Overflow.** `P × w` is computed at 128-bit width (`multipliedFullWidth`) and divided back (`dividingFullWidth`); the quotient can't exceed `P`. The only sum that could overflow, `W`, is checked. Inputs are also bounded (`Limits`: $999,999.99, 1,000 hours, 100 points, 200 people), well inside the arithmetic's range.
- **Cash and card** are split independently with the same weights and order; cash, card and combined totals each reconcile.
- **Hours input.** `7.5`, `7:30` and `7h 30m` all mean 450 minutes. Decimal hours (up to two decimals) round to the nearest minute (`7.33` is 7h 20m) and are always echoed back.
- **Live but never stale.** The screen recomputes from the typed text on every change. If someone is missing hours, the people who can be paid share the pool (so the total still reconciles), the row says "Needs hours", and Review stays blocked until it's fixed.
- **Tip Out.** Each rule is "role A pays N% of their own tips or sales to role B". Each tip-out rounds to the nearest cent (half up), is taken only from what that person collected (never from tip-outs they received), and a person's tip-outs never exceed their tips: if they would, each is reduced in proportion by largest remainder. Everything paid to a role is one pot, split among that role's people by minutes with the same largest-remainder method. A rule with nobody to pay or receive on the shift is skipped and noted. The breakdown reconciles as "Tipped out $X, received $X, $0.00 left over". The full spec is in the plan, section 5E.
- **Frozen history.** A saved shift stores copies of every name, role, hours, points, status and cent, plus the engine version. It's never recalculated; changing it means duplicating it into a new shift. Saving uses the draft's id, so a double tap can't save twice.

## Decisions

- **SwiftUI, iOS 17+, iPhone only, portrait.** Observation (`@Observable`) for state. No third-party code.
- **JSON files, not SwiftData.** The data is small, a file is trivially backed up and imported, it's testable on Linux, and there's one persistence system. The library file is itself in the backup format. Unreadable data is set aside (`library-unreadable-*.json`), never overwritten.
- **Backups are validated whole before anything changes.** Every saved shift in a backup must recompute to exactly its stored amounts. Import can add (merge, never overwrite) or replace everything.
- **Eligibility is the user's call.** Role labels never decide it. Owners, managers and supervisors never receive and have no override; making anyone eligible again needs a separate confirmation that ShiftTips can't determine legal status.
- **Allocation, not payment.** Every breakdown, PDF and summary says so.
- **App target is Swift 5 language mode; the package is Swift 6.** The package (where the logic is) gets full strict concurrency checking; the UI layer stays simple.

## Where we are

Following the build plan's phases (section 11):

- [x] Phase 0: project, design tokens, README, no network dependencies
- [x] Phase 1: calculation engine and tests (the plan's nine worked cases, acceptance criteria, randomized reconciliation, ties, overflow)
- [x] Phase 2: New Shift and Review, live calculation, Try Example, blocked and invalid states (built; needs a run on a real device)
- [x] Phase 3: saved crews, eligibility, frozen shifts, History, duplicate, delete with confirmation
- [x] Phase 4: text summary, multipage PDF, CSV, JSON backup and import (merge or replace)
- [x] Tip Out mode (added to v1.0 by the owner, 2026-10-09): crew rules, per-person tips and sales, pots by hours, caps, reviews, exports
- [x] Totals by Person (added to v1.0 by the owner, 2026-10-09): each person's tips for a pay period across both modes, from History, as text or CSV
- [x] TestFlight from GitHub Actions, no Mac needed (setup: [`docs/testflight.md`](docs/testflight.md))
- [ ] Phase 5: polish and usability tests on real iPhones, including timing a repeat closeout, VoiceOver, large text and five real closers
- [ ] Phase 6: App Store launch (checklist below)

## Launch checklist

- [ ] **Name.** "ShiftTips" is a working title; the plan lists candidates (TipClose recommended) that need App Store Connect and trademark checks. The Xcode project can stay `ShiftTips` whatever the store name.
- [ ] **Bundle ID.** `app.shifttips` is a placeholder; set the real one before the first upload (it can't change after).
- [ ] **Signing.** Set `DEVELOPMENT_TEAM` in the project (or in Xcode).
- [ ] **Support contact.** Set `AppInfo.supportEmail` in `ShiftTips/App/ShiftTipsApp.swift`; the Settings row appears once it's set.
- [ ] **Privacy policy and support page.** A static page is enough. App Privacy answer: no data collected.
- [ ] **Icon.** The current icon is a generated placeholder (`ShiftTips/Assets.xcassets/AppIcon.appiconset`).
- [ ] **Screenshots** from the real app with real arithmetic (the UI tests' screenshots are a starting point).
- [ ] **Price.** Plan hypothesis: $5.99 to $7.99.
- [ ] TestFlight on a physical iPhone, then the airplane-mode pass from the plan. No Mac needed: follow [`docs/testflight.md`](docs/testflight.md), then run the **ShiftTips TestFlight** workflow.
- [x] Privacy manifest (`ShiftTips/PrivacyInfo.xcprivacy`): no tracking, no data collected.

## Non-goals (v1.0)

POS, payroll or payments; card-fee or withholding deductions; accounts, sync or collaboration; OCR, AI or tax estimates; clock-in tracking; tip-outs taken from tip-outs received; currencies other than USD. See the plan, section 4.
