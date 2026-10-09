# ShiftTips - Complete iOS App Build Plan

**Working title:** ShiftTips (final brand TBD)  
**Product:** A fast, offline tip-pool calculator for restaurant, bar, cafe, and hospitality teams  
**Platform:** iPhone / SwiftUI  
**Business model:** One-time paid App Store download; no subscription, advertising, or in-app purchases  
**Product promise:** "Close the shift. Split every cent. Share a clear breakdown."  
**Status:** Implementation blueprint / handoff to Claude Code  
**Revision:** 1.0 - October 2026

---

## 1. The product in one paragraph

ShiftTips helps one person settle a shared tip pool at the end of a shift. Select a saved crew, type the tip amount, enter each person's hours, pick the restaurant's approved distribution method, and see how much each person receives. The results must be transparent, exact to the cent, easy to share, and saved for later. No login, no cloud, no POS integration, no payments, and no paid APIs.

**Critical positioning:** This is NOT a customer-facing restaurant tip-percentage or bill-splitting calculator. The buyer is a shift lead, bartender, server, restaurant manager, or small hospitality operator who already has an established, lawful pooling policy and needs the calculations done correctly and quickly.

## 2. Nonnegotiable product rules

1. **100% offline:** Every screen, calculation, saved record, and export works without internet. No server, analytics SDK, paid API, login, or hosted database.
2. **One-time sale:** Every advertised feature is included after purchasing the app. No paywalls, quotas, or recurring subscriptions.
3. **Fast repeat use:** A returning user with a saved team can finish an ordinary shift in roughly 30-60 seconds. This is a usability target to test, not a guaranteed claim.
4. **No cents disappear:** The sum of the displayed employee allocations must equal the distributable pool exactly to the cent, in every supported scenario.
5. **No automatic legal decisions:** The app calculates from the user's policy. It must not assert that a proposed pool, participant, deduction, or method is lawful.
6. **No hidden deductions:** Never silently subtract processing fees, withholding, wages, or other expenses.
7. **Clarity over feature count:** The calculation and result view must be excellent before secondary tools are added.
8. **No fake payroll claims:** An exported settlement is a user-entered calculation record, not a payroll filing, payment confirmation, or legal compliance certificate.
9. **No misleading payouts:** Differentiate money allocated by the pool calculation from money physically paid to an employee.
10. **Local privacy:** Store no Social Security numbers, bank data, employee addresses, or sensitive tax data.

## 3. Intended users and core job

- **Shift closer:** Repeats the same group each evening, updates hours and tips, shares the result.
- **Small restaurant manager:** Needs a readable record of how the amount was split under the business's policy.
- **Bar/cafe team:** May split equally or proportionally to time worked.
- **Hospitality or catering lead:** Occasionally splits an event-specific pool among a temporary crew.

### Primary use case

"We collected $472.38 in pooled tips today. These six employees worked different hours and our policy uses hours times role points. How much does each person get?"

The answer must be legible immediately, with no spreadsheet or external calculator.

## 4. Scope boundaries: build / do not build

### Launch scope (v1.0)

- Save, edit, and reuse a crew of employees.
- Add a one-off employee to a shift without adding them to the saved crew.
- Employee: name, optional role label, default points/weight, eligible-for-pool toggle.
- Shift: date, optional label, total pooled tips (one combined amount), selected employees, hours worked.
- **Three core split methods:** Equal, By Hours, Hours x Points.
- **Totals by Person** (owner decision, 2026-10-09): from History, each person's tips across the saved shifts in a pay period (this week, last week, last 2 weeks, this month, last month or custom), both modes, shared as text or CSV for payroll. A plain report from frozen snapshots, not an analytics dashboard.
- **Tip Out mode** (owner decision, 2026-10-09): a second mode next to Tip Pool, where each person keeps their own tips and pays house-rule percentages of their own tips or sales to support roles. See section 5E.
- Optional separate cash-tip and card-tip amount fields; together they equal the full pool.
- Automatic precise allocations and explanatory breakdown.
- Recalculate instantly when values change; a separate "Finish Shift" action freezes a snapshot.
- History of finished shifts; inspect, duplicate, delete after confirmation.
- Share a clear text summary and a polished PDF report using the iOS share sheet.
- Local data persistence and manual backup/export to Files.
- Dark and light mode, dynamic type, VoiceOver labels, large tap targets, simple onboarding.

### Out of scope for v1.0

- POS, payroll, banking, credit card processing, Venmo, payment transfers.
- Automatic credit card processing fee deductions. (Sales-based tip-outs moved into v1.0 with Tip Out mode, section 5E.)
- Staff accounts, invitations, collaboration, network sync, real-time team dashboards.
- OCR, photo receipt scanning, AI, chatbots, tax estimators, employer compliance checks.
- Clock-in/clock-out time-tracking or schedule integration (manual shift duration only).
- Tip-outs taken from tip-outs someone received (each tip-out is only ever a percentage of what that person collected themselves), and splitting a role's tip-outs by anything other than hours.
- Analytics dashboards, recurring subscriptions, advanced permissions, multi-location organizations.
- Optional cash denomination / making-change solver (can be explored after launch).

**Why these exclusions matter:** A small, trustworthy offline calculator is easier to build, easier to sell, and easier to support than a restaurant operating system.

## 5. The split methods (exact definitions)

### A. Equal

Each eligible, included employee with a positive participation weight receives one equal share. Hours are not needed in this mode.

`employee_weight = 1`

### B. By Hours

Each included employee receives a share proportional to eligible hours worked. Hours must be greater than zero to participate.

`employee_weight = minutes_worked`

### C. Hours x Points

Each included employee receives a share proportional to eligible hours multiplied by their policy-defined points. Hours and points must be greater than zero to participate.

`employee_weight = minutes_worked * points_units`

Example: 8-hour server with 1.0 points => 8 effective hours; 6-hour bartender with 1.5 points => 9 effective hours; 6-hour support worker with 0.5 points => 3 effective hours.

**Important:** Do not ship preset role weight recommendations presented as universally fair or legal. Labels (server, bartender, busser, etc.) are editable, and all point values come from the user's actual policy. Start every new role at `1.0` point until explicitly configured.

### D. Employee participation

- A saved employee can be included/excluded for a particular shift.
- A saved employee can be flagged as **Not Eligible for Pool** and must not be included in the calculation unless the user explicitly changes the eligibility setting after seeing a warning.
- Do not assume that role titles identify legal status; a "Manager" label is not sufficient to determine statutory eligibility.
- If a participant is explicitly flagged by the user as an owner/manager/supervisor, disable pooled participation and display a short explanation with a link to the official guidance. Do not provide a confirmation override that allows participation in the pool.
- If the user changes a person's status from owner/manager/supervisor to eligible, require a separate deliberate edit of the eligibility setting and explain that the software cannot determine legal status. Do not use a role label alone to change eligibility.
- Separately earned direct tips for service the manager alone performed are outside this app's pooled calculation. Eligibility flags are user-managed; the tool cannot verify legal status.

### E. Tip Out mode (owner decision, 2026-10-09)

Tip Out ships in v1.0 as its own mode, offered after Tip Pool on the New Shift screen.

- **Rules** belong to the crew (copied into each shift): "everyone in role A pays N% of their own tips, sales, food sales or bar sales to role B". Percentages are integer basis points (2.5% = 250), up to 100%.
- **Inputs:** people who pay enter the tips they collected (and the sales their rules use); people who receive enter hours.
- **Each tip-out** is the percentage of the person's own amount, rounded to the nearest cent (half a cent rounds up). Tip-outs are never taken from tip-outs received, so a bartender who receives from servers and pays a barback pays only from their own tips.
- **Never more than the tips collected:** if someone's tip-outs add up to more than their tips (possible with sales-based rules), each is reduced in proportion, by largest remainder, so they total exactly the tips. The breakdown says so.
- **Pots:** everything paid to a role is one pot, split among that role's people by minutes worked with the same largest-remainder method as Tip Pool.
- **Skipped rules:** a rule whose paying or receiving role has nobody on the shift isn't taken, and the breakdown says why.
- **Eligibility:** owners, managers, supervisors and anyone marked not eligible neither pay nor receive tip-outs. Role labels decide which rule applies, never eligibility.
- **Reconciliation:** "Tipped out $X, received $X, $0.00 left over", and every person's tips = kept + tipped out.

## 6. The mathematical contract: exact to the cent

**Do not use binary floating-point (Float/Double) for monetary values or the allocation math.** Store dollars as whole integer cents (`Int64`). Store time as whole integer minutes. Store points as fixed-point integer units (for example `1.25 points = 1250` units if scale is 1000).

### Largest-remainder (Hamilton) allocation

For a distributable pool of `P` cents and positive integer weights `w[i]`:

1. Compute `W = sum(w[i])`.
2. Calculate exact rational entitlement `P * w[i] / W`.
3. Give each employee the floor of their entitlement in cents.
4. There will be between 0 and `employeeCount - 1` undistributed cents.
5. Rank employees by descending remainder (`P * w[i] % W`).
6. Award the remaining one-cent units in that order.
7. For equal remainders, break ties using the frozen crew display order, then employee stable ID.
8. Assert `sum(allocatedCents) == P`.

Implement without integer overflow: use checked arithmetic, a safe full-width multiply/divide routine, or `Decimal` for intermediate entitlement and fractional comparison while ensuring a deterministic result. Document the selected approach and test large inputs. The engine must not silently overflow.

**Cash and card tips:** If the user enters them separately, allocate each pool independently with the same weights and same deterministic ordering. For every employee, `totalShare = cashShare + cardShare`. Verify that cash, card, and overall totals each reconcile exactly. Do not suggest that an allocated card tip has already been paid out.

### Worked test cases

1. Equal: $10.00 / 3 => $3.34, $3.33, $3.33 (in frozen roster order).
2. Hours: $150.00; 8 hours and 4 hours => $100.00 and $50.00.
3. Hours x Points: $190.00; weights 8, 9, 3 => $76.00, $85.50, $28.50.
4. Zero-dollar pool: 3 included employees => all $0.00; still permit saved record with confirmation.
5. Separate cash/card: $100.01 cash and $50.02 card among 3 equal recipients => cash totals $100.01, card totals $50.02, combined $150.03 exactly.
6. No eligible participating employees with a positive pool => BLOCK finalization; show a clear correction message.
7. Total weight zero with positive pool => BLOCK calculation; explain which values are missing.
8. Excluded employees => zero allocation, and not counted in the divisor.
9. Input changes followed by recomputation must never retain stale employee allocations.

### Money input and rounding

- Display USD with exactly two decimals at launch. If another currency is later supported, add currency-specific minor unit rules rather than hard-coding cents for every currency.
- Parse user-entered money using a controlled decimal parser, not `Double`.
- Reject negative amounts, more than two decimal places, invalid text, and amounts exceeding validated bounds.
- Accept `$472.38`, `472.38`, and `472` as equivalent sensible input.
- Allow hours as `7.5` and convert to exactly `450` minutes; display `7h 30m`. Require quarter-hour inputs only if the user sets such a preference; otherwise support full minutes.
- Prevent point values of zero/negative for included participants in the points mode.
- Do not round employee weights early; only distribute final currency cents.

## 7. App structure

Three top-level destinations, but favor a welcoming single primary screen over a crowded tab bar:

1. **New Shift** (primary; opens on launch)
2. **History**
3. **Crew & Settings** (may live behind a top-right gear/person button)

### Screen A: New Shift

Visual order:

- Header: `ShiftTips`, today's date, optional shift label.
- Huge primary input: **Total pooled tips** with numeric keypad.
- Optional `Split cash & card` toggle. When on, show separate fields and calculated combined total.
- Crew strip: saved crew selector, selected crew count, `Edit Crew`.
- Method selector: `Equal | By Hours | Hours x Points`.
- Employee rows: name, role, include/exclude control, hours field (if applicable), points field (if applicable), live allocation on the right.
- Sticky bottom summary: `Distributing $472.38` and `Review Split`.

**Usability:** Do not force users through three separate setup screens every night. Show the familiar crew, retain method preference, and focus the user's keyboard on the next missing value.

### Screen B: Review Split

- Large total at top; display each employee's exact allocated amount.
- If cash/card mode, show separate amounts per employee and the combined total.
- A tap on an employee reveals how their payout was calculated (hours, points, effective weight, percentage, allocated cents).
- Mandatory reconciliation line: `Allocated $472.38 of $472.38 - $0.00 remaining`.
- Display warnings for excluded/ineligible people and inputs that changed since last review.
- Buttons: `Edit`, `Save Shift`, `Share Breakdown`.
- Do not claim money has been physically paid.

### Screen C: Crew

- Add employee manually, with name and optional role.
- Include by default, optional participation eligibility setting.
- Set points only when using policy-based weighted distribution.
- Save a primary crew; support multiple saved crews if implementation remains simple.
- A `Use for New Shift` action loads the roster while resetting hours for the new shift.
- One-off people should not silently enter the saved crew.

### Screen D: History

- Group saved shifts by date with total pool and headcount.
- Tap to inspect the **frozen calculation snapshot** (not recalculated using today's changed crew policy).
- Duplicate as new shift with adjustable values, but never edit a historical snapshot in place without clearly making a new revision.
- Swipe delete with confirmation; no hidden network backup.
- `Export CSV` and `Export PDF` should operate completely locally.

### Screen E: Settings

- Default distribution method.
- Saved crew selection.
- Currency fixed to USD in v1.0; explain it rather than suggesting unsupported locales.
- Presentation: light/dark/system, haptics on/off.
- Export backup, import backup, delete all local data with explicit confirmation.
- Legal/informational disclaimer and references.
- App version, support contact, privacy summary.

## 8. Visual direction

Aim for a polished iPhone utility, not enterprise payroll software.

- **Brand attributes:** confident, calm, fast, trustworthy.
- **Palette concept:** deep midnight navy, mint/teal accent, warm off-white backgrounds, restrained positive green for reconciled totals. Avoid making everything bright green, which can read like a trading app.
- **Typography:** SF Pro / system type, prominent tabular monetary figures, visible hierarchy.
- **Rows:** a recognizable reusable employee-card component with clear editable values.
- **Haptics:** subtle when adding an employee and saving a finished shift; not on every number edit.
- **States:** polished empty states, missing-input messages, success state, destructive-action confirmations.
- **Accessibility:** Dynamic Type, VoiceOver labels for controls and values, text alternatives to colors, 44pt minimum hit targets, strong contrast.
- **Product screenshots should visually prove:** enter tips, allocate by hours, see a reconciled team breakdown, share a report.

### Sample storyboard

```text
SHIFT TIPS                       History  Gear
Thu, October 8                       Dinner

       TODAY'S POOLED TIPS
             $472.38
      [ ] Separate cash & card

Crew: Thursday Dinner (6)          Edit

Split method:
[ Equal ] [ Hours ] [ Hours x Points ]

Ava       Server       7h 30m      $102.69
Marco     Server       6h 15m       $85.57
Jordan    Barback      5h 00m       $42.79
... example layout only; amounts not final math ...

$472.38 allocated of $472.38
[       REVIEW SPLIT       ]
```

Use mathematically validated fixture data for actual app screenshots, never invented dollar allocations.

## 9. Domain model (Swift-friendly outline)

Prefer small immutable calculation inputs and separately saved snapshots.

```text
Employee
  id: UUID
  displayName: String
  roleLabel: String?
  pointsUnits: Int64             // 1000 == 1.000 point
  poolEligibility: eligible | excluded | managerSupervisorOwner
  sortOrder: Int

CrewTemplate
  id: UUID
  name: String
  employees: [Employee]
  defaultSplitMethod: SplitMethod

ShiftDraft
  id: UUID
  date: Date
  label: String?
  templateId: UUID?
  method: equal | hours | weightedHours
  amountMode: totalOnly | cashAndCard
  totalPoolCents / cashPoolCents / cardPoolCents
  participants: [ShiftParticipant]

ShiftParticipant
  id: UUID
  employeeId: UUID?            // optional for one-off
  displayNameSnapshot: String
  roleSnapshot: String?
  included: Bool
  eligibilitySnapshot: Eligibility
  minutesWorked: Int64
  pointsUnitsSnapshot: Int64
  sortOrder: Int

AllocationResult
  participantId: UUID
  cashShareCents: Int64
  cardShareCents: Int64
  totalShareCents: Int64
  effectiveWeight: <exact representation>
  allocationOrder: Int

FinishedShift
  id: UUID
  createdAt: Date
  finishedAt: Date
  sourceDraftSnapshot: ShiftDraft
  allocations: [AllocationResult]
  inputHashOrVersion: String
  calculationEngineVersion: Int
```

Use `SwiftData` for local persistence (iOS 17+) if migrations and test setup remain manageable. Keep the math as a framework-independent pure Swift module. Store historical participant names, weights, and allocations as snapshots so later crew edits do not change old results.

A local JSON file repository is an acceptable alternative if it is more reliable and easier to back up; do not combine two persistence systems without a compelling reason.

## 10. Architecture / suggested folder structure

```text
ShiftTips/
  App/
    ShiftTipsApp.swift
    AppDependencies.swift
  Domain/
    Employee.swift
    CrewTemplate.swift
    ShiftDraft.swift
    FinishedShift.swift
    SplitMethod.swift
    PoolCalculator.swift
    MoneyParser.swift
    Validation.swift
  Data/
    LocalRepository.swift
    StoredModels.swift
    BackupImporter.swift
  Features/
    NewShift/
      NewShiftView.swift
      EmployeeRowView.swift
      NewShiftViewModel.swift
    Review/
      ReviewSplitView.swift
      AllocationExplanationView.swift
    Crew/
      CrewListView.swift
      EmployeeEditorView.swift
    History/
      HistoryView.swift
      FinishedShiftDetailView.swift
    Settings/
      SettingsView.swift
  Export/
    ShareSummaryBuilder.swift
    PDFReportRenderer.swift
    CSVExporter.swift
  DesignSystem/
    Theme.swift
    CurrencyText.swift
    EmptyStateView.swift
  Tests/
    PoolCalculatorTests.swift
    ValidationTests.swift
    PersistenceTests.swift
    ExportTests.swift
    ViewModelTests.swift
    UITests/
```

**Technical recommendation:** SwiftUI, Swift, iOS 17+, SwiftData or local JSON, native PDF rendering, ShareLink/UIActivityViewController, XCTest. Avoid React Native or external libraries for this small iOS-only utility unless the existing codebase makes that a clear advantage.

## 11. Implementation plan (strict order)

### Phase 0 - Project setup

- [ ] Create iOS application, deployment target, bundle identifier, and build scheme.
- [ ] Establish formatting, typography, color tokens, and accessibility conventions.
- [ ] Create a simple `README` with architecture, build instructions, and non-goals.
- [ ] Confirm offline use on airplane mode from the start.

**Exit:** App launches, navigates between placeholders, and has no network dependencies.

### Phase 1 - Correct calculation engine

- [ ] Define integer money, integer minutes, fixed-point points, domain types.
- [ ] Implement Equal, By Hours, Hours x Points.
- [ ] Implement stable, exact largest-remainder penny distribution.
- [ ] Implement separate cash/card pools and reconciliation assertions.
- [ ] Implement validation errors and safe input parsing.
- [ ] Write tests with known answers, random scenarios, zeros, ties, max values, ineligible participants.

**Exit:** Tests demonstrate exact reconciliation for every supported input; no UI required to verify it.

### Phase 2 - Happy-path shift UI

- [ ] Build New Shift, employee rows, method switch, numerical inputs.
- [ ] Build Review screen and clear formula explanation.
- [ ] Live calculation on every valid edit; never display stale amounts.
- [ ] Add demo crew and an explicit `Try Example` option (not fake persisted employee data).
- [ ] Support no-results and invalid-entry states gracefully.

**Exit:** A first-time user can split and review a pool with no saved crew.

### Phase 3 - Saved crew and finished shifts

- [ ] Add employee editor, role labels, eligibility states, points.
- [ ] Store saved crew(s) locally.
- [ ] Save finished shifts as frozen snapshots.
- [ ] Add History, detail view, duplication, deletion and confirmation.
- [ ] Verify roster changes never rewrite old shift records.

**Exit:** A repeat user can close another shift without retyping the same team.

### Phase 4 - Reports and backups

- [ ] Build plain-text share summary.
- [ ] Build one-page PDF for normal-size teams; multipage for longer teams.
- [ ] Add CSV export with unambiguous column headings and cents-safe formatting.
- [ ] Add manual JSON backup/import with schema version, validation, and safe conflict handling.
- [ ] Test all exports in Files, Mail, Messages, and without network access.

**Exit:** Users can share a comprehensible calculation and preserve their local data.

### Phase 5 - Polish and usability tests

- [ ] Time the repeat-crew workflow on a small iPhone.
- [ ] Test dark mode, large text, VoiceOver, landscape/keyboard interaction as applicable.
- [ ] Test interruptions, force-close/relaunch, out-of-storage, backup restore, and invalid inputs.
- [ ] Observe at least 5 real tip-pooling users doing a closeout using their own policy.
- [ ] Refine whichever inputs or labels cause hesitation.

**Exit:** A real closer understands the difference between total tips, pool allocation, and payment.

### Phase 6 - Paid App Store launch

- [ ] Choose final name and run App Store Connect availability / trademark checks.
- [ ] Prepare icon and 5 honest screenshot panels.
- [ ] Select an initial up-front price (hypothesis: $5.99-$7.99 USD; test willingness to pay).
- [ ] Fill out app privacy disclosures to match actual data handling and exports.
- [ ] Create a simple privacy policy/support page (a static site is sufficient; no app backend needed).
- [ ] Complete App Store listing, age rating, accessibility information, review notes.
- [ ] Test on a physical iPhone via TestFlight.
- [ ] Remove demo/personal data and launch.

**Exit:** Stable offline product, truthful listing, complete pay-once value proposition.

## 12. Edge cases / acceptance criteria

- [ ] One participating employee receives 100% of the pool.
- [ ] Changing from Equal to Hours updates payouts and hides/shows relevant fields correctly.
- [ ] Added employees initially have sane defaults; no accidental inclusion of ineligible people.
- [ ] A zero-hour included person cannot quietly receive a nonzero payout under Hours mode.
- [ ] Exact total reconciliation after every calculation, regardless of decimal inputs.
- [ ] Ties in penny distribution have deterministic, documented outcomes.
- [ ] Typing incomplete numbers (`.`, `0.`, empty) does not crash or quietly save bogus values.
- [ ] $0.00 pool behavior is predictable and clear.
- [ ] The same employee name can occur twice without merging records.
- [ ] Changes to saved employees never retroactively change historical employee labels or payout results.
- [ ] Cash and card never get interchanged, merged incorrectly, or silently treated as paid.
- [ ] The finalization action is disabled when required inputs are invalid.
- [ ] No accidental duplicate shift on a rapid double tap.
- [ ] Import of malformed backup fails safely without replacing valid data.
- [ ] A deleted shift prompts confirmation; users can export before deletion.
- [ ] Exported PDF and CSV totals reconcile to the same calculation snapshot.
- [ ] Colorblind and VoiceOver users can identify rows and amounts without relying on color.
- [ ] Every feature works in airplane mode.

## 13. Legal and real-world operational cautions

**Tip pooling is regulated and varies by location. The app must not supply generic defaults that imply legal compliance.** In the United States, Department of Labor guidance says employers/managers/supervisors generally cannot retain other employees' pooled tips; tip-credit status can affect which workers may participate, and more protective state rules can apply. The app cannot infer compliance from a role label, and local law may differ.

At the point where a user configures eligibility or weighted policies, display a concise message such as:

> ShiftTips calculates allocations from your inputs. Check your workplace policy and applicable tip-pooling rules. It does not verify legal eligibility, wages, or payroll compliance.

**Specific implementation guardrails:**

- Do not auto-include employees marked owner/manager/supervisor in pooled payouts.
- Do not imply that arbitrary support-role participation is legal in all contexts.
- Avoid withholding or card fee settings in v1.0. Their treatment depends on applicable law and business policy.
- Treat service charges separately from voluntary tips; do not silently assume they are equivalent.
- The export is a calculation worksheet, not proof funds were paid, taxes were withheld, or the organization complied with wage-and-hour requirements.
- Users must independently check their workplace's policies and the law where they operate.

**Useful official references (review for launch-date accuracy):**

- US Department of Labor Fact Sheet #15: https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa
- US Department of Labor Fact Sheet #15B: https://www.dol.gov/agencies/whd/fact-sheets/15b-managers-supervisors-tips-flsa
- US Department of Labor Tip Regulations: https://www.dol.gov/agencies/whd/flsa/tips

## 14. Competitive positioning

As of the October 2026 research snapshot, apps such as **Tip Out: Tip Pool Calculator** and **TipCrew** already advertise splits by hours and points, saved crews, and sharing. These are not novel features by themselves.

- Tip Out: https://apps.apple.com/us/app/tip-out-tip-pool-calculator/id6759682320
- TipCrew: https://apps.apple.com/us/app/tipcrew-tip-pool-calculator/id6794305120

**Differentiation to validate with real users:** faster repeat closeouts; exceptionally readable receipt/report; trustworthy penny-accurate reconciliations; clear handling of cash versus card allocations; no ongoing subscription or account; restrained, premium visual design.

Do not market the app as legally certified, integrated with payroll, or a method for changing the employer's distribution policy.

## 15. App Store marketing draft

**Working display name:** ShiftTips  
**Draft subtitle:** Split Pooled Tips by Shift  
**Positioning line:** Close out tips in seconds. Every cent accounted for.  
**Monetization:** $5.99 or $7.99 up front (test before deciding).  

**Screenshot story:**

1. `Split the whole shift, not just the bill.`
2. `Enter tips. Pick your crew.`
3. `Equal, hours, or weighted points.`
4. `Every payout. Every cent. Explained.`
5. `Save the shift and share the breakdown.`

**Short description draft:**

ShiftTips makes pooled tip calculations simple. Add your team, enter the shift's pooled tips and hours, and see an exact per-person breakdown. Choose equal, hourly, or weighted-hour distribution under your workplace's policy. Save your crew, keep a local history, and share a clear report. No account, subscriptions, ads, or internet connection required.

## 16. Working brand-name candidates

Names have NOT been cleared in App Store Connect or trademark registers. Preliminary web searches returned clear conflicts for TipSplit, TipShift, TipLedger, ShiftSplit, TipShare, and TipSettle; do not use those exact names. Absence of an obvious search result is not proof a candidate is available.

| Candidate | Brand feel | Notes |
|---|---|---|
| **TipClose** | Direct and professional | My recommended new candidate: links tips to end-of-shift closeout. |
| **ShiftTips** | Simple and explanatory | Strong original working name; near `ShiftTip AI` and `TipShift` in search, so requires a careful check. |
| **PoolShift** | Modern, compact | More distinctive sounding but less immediately self-explanatory. |
| **TipRoster** | Team-first | Suggests managing names and tip allocations together. |
| **CloseTips** | Action-oriented | Reads naturally as a quick closing task. |
| **TipRound** | Friendly | Evokes rounding/distribution, but can sound like rounding up a dining check. |
| **PoolTab** | Short and app-like | Good brand potential but does not immediately say restaurant tips. |
| **ShiftPayout** | Businesslike | Sounds like a payroll tool: be careful not to imply actual funds are sent. |

### Preferred listing constructions

- **TipClose** - `Split Tips by Shift`
- **ShiftTips** - `Pool & Split Tips Fast`
- **PoolShift** - `Tip Pool Calculator`

Pick the name only after checking App Store Connect availability, US trademark conflicts, and confusingly similar competitors. The app can retain `ShiftTips` as an internal Xcode project name regardless of the final storefront name.

## 17. Implementation instructions for Claude Code

Paste this prompt into a new Claude Code session with this Markdown file:

```text
You are the lead iOS engineer and product designer for ShiftTips, a paid, offline iPhone app for calculating staff tip-pool allocations. Read this entire Markdown specification before changing code.

Implement in SwiftUI using a small, testable architecture. No server, no accounts, no AI, no network calls, no subscriptions, and no third-party SDK unless indispensable. Use only native iOS APIs where possible.

START WITH PHASE 1: create pure Swift calculation/domain models and automated tests before building UI. Monetary values must be exact integer cents. Time must be integer minutes. Points must be fixed precision. Every split must reconcile to the cent, with deterministic largest-remainder distribution. Implement equal, hours, and hours x points, plus optional separate cash/card allocation. Include strong validation and tests for zero, tie, exclusion, and overflow cases.

Then implement the fast New Shift and Review Split screens. Follow the staged roadmap in order. Preserve historical snapshots and make reports honest about allocation vs actual payment. Do not improvise legally questionable participation rules, automated card fees, or payroll features.

At the end of each phase, run available tests/build commands, report changed files, note any known limitations, and move to the next phase. Prefer the smallest polished reliable implementation over extra features.
```

---

## 18. Definition of done

The launch version is done when a user can open it offline, load a team, enter a tip pool, calculate a transparent split under their chosen lawful workplace rules, account for every cent, save the result, export a readable breakdown, and repeat the process on their next shift without setup friction. Anything else is optional.
