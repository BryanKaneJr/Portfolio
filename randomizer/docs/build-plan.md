> **Source of truth for product behavior.** This is the build plan the app was built from, with the working title
> "DrawMode" replaced by the shipping name **Randomizer: Spin & Reveal** (home screen name: Randomizer).
> Where the implementation made a choice the plan left open, [`checklist.md`](checklist.md) says so.
>
> **Owner decision (2026-10-09):** no disclaimer copy anywhere. Where this plan says the preset is "not official" or the app is "not a regulated lottery", that is guidance on what not to claim, not text to show. Don't add disclaimers to the app, shared results or the store listing.

# Randomizer - Complete iOS Build Plan

> Working title: **Randomizer** (verify App Store and trademark availability before launch)
>
> Product: A polished, offline iPhone randomizer with multiple reveal styles, transparent weighted odds, saved lists, and draft-order draws.
>
> Business model: **One-time paid download**. No ads, accounts, subscriptions, paid APIs, server, or required internet connection.
>
> This document is a build specification for Claude Code or another coding assistant. Build the smallest complete, reliable product described here before adding optional features.

---

## 1. The app in one sentence

**Add people or things, choose how to draw a result, optionally adjust the odds, and reveal the result with a satisfying animation.**

Examples:

- A fantasy commissioner runs a weighted, reverse-standings draft lottery.
- A teacher randomly picks a student while preventing repeats.
- Friends spin for a movie, restaurant, game, or chore.
- A group runs a raffle with or without replacement.
- A host dramatically reveals a complete randomized order.

The appeal is both utility and presentation. It should be usable in seconds and fun to watch.

### Non-negotiable product rule

**A prominently visible, interactive `Remove after selection` toggle must exist on every draw screen, in every reveal style and selection mode. It must NEVER be buried inside Settings.**

- **ON:** A selected entry is removed from eligibility for future draws in the current session.
- **OFF:** A selected entry stays eligible for future draws; repeats are possible.
- The toggle is visible before a draw, while viewing the result, and in full-screen presentation mode.
- Changing the toggle affects **future draws only**. It does not retroactively remove or restore previous winners.
- A clearly labeled **Restore removed** action is always available when entries have been removed.
- The current toggle setting is saved with each list and restored when the list is reopened.
- There is an **Undo last draw** action; if that draw removed an entry, undo restores that entry's eligibility and reverses its draw-history entry.
- For a complete **unique draft order**, removal must be ON. If the user turns it OFF, single draws continue with repeats allowed, but **Generate unique order** is disabled with a clear explanation. Never silently override the toggle.

Treat this as a release-blocking acceptance criterion.

---

## 2. Business requirements and scope

**Primary goal:** A paid utility that feels more polished than a free spinner website while remaining small, fully local, and inexpensive to operate.

**Suggested launch price:** $4.99 or $6.99, tested with real potential customers. Charge once for the complete app. Do not implement in-app purchases in v1.

### In scope for v1

1. Create, rename, edit, duplicate, and delete saved lists.
2. Add entries one-by-one or paste many names (one per line).
3. Three odds configurations: Equal Odds, Custom Weights, and Reverse Standings preset.
4. Four visual reveal modes: Spin Wheel, Name Reel, Lottery Balls, and Mystery Reveal.
5. Persistent, prominent **Remove after selection** toggle across all modes.
6. One-at-a-time draws, multiple-winner draws, and full unique draft order generation.
7. Live odds display and automatic recalculation when winners are removed.
8. Result history, Undo Last Draw, Restore Removed, and New Session.
9. Shareable result card / text summary using the native share sheet.
10. Local persistence, tasteful bundled sounds, optional haptics, reduced-motion accessibility.
11. Full offline operation, no account, no telemetry service.

### Intentionally out of scope for v1

- Online multiplayer, shared rooms, cloud sync, accounts, login, web version.
- Payment collection, real-money gambling, sweepstakes administration, prize fulfillment.
- Official NBA lottery rules or licensed NBA imagery.
- Streaming results to TVs, AirPlay-specific controls, screen recording, or live broadcasting.
- User-uploaded music, complex 3D environments, particle/physics engines.
- AI, remote databases, push notifications, paid SDKs, ads, subscriptions.
- Thousands of animation themes or a theme marketplace.

**Important:** There must be exactly **one draw engine**. Wheel, reel, balls, and mystery card are interchangeable ways to **reveal** an outcome selected by the same engine.

---

## 3. Positioning, naming and first-run experience

**Positioning statement:** "A beautiful way to pick anything - fairly, dramatically, and with the odds you choose."

Potential App Store subtitle: **Wheels, lotteries & draft picks** (verify length and availability before use).

The first time the app opens, show a useful sample list (for example: "Pizza, Tacos, Burgers, Sushi") with immediate options:

- **Try a draw** (sample list; no signup or tutorial wall)
- **Create my list**

The user should be able to draw a sample result within **15 seconds** of opening the app. After the demonstration, offer to save or replace the sample list.

No onboarding carousel. Use small inline hints only where features are unfamiliar.

---

## 4. App structure and navigation

Keep navigation shallow:

```text
Launch
  |
  +-- Home / Saved Lists
  |     +-- Create List
  |     +-- Open Existing List
  |
  +-- List Editor
  |     +-- Entries / bulk paste
  |     +-- Odds (Equal / Custom / Reverse Standings)
  |     +-- Reveal Style picker
  |     +-- Start Draw
  |
  +-- Draw Screen
  |     +-- Live eligibility / odds summary
  |     +-- Selected visual presentation
  |     +-- REMOVE AFTER SELECTION TOGGLE (always visible)
  |     +-- Draw / Next Draw
  |     +-- Result / Undo / Restore / History
  |
  +-- Draft Order Results
  |     +-- Reveal one-by-one OR reveal from last to first
  |     +-- Share order
  |
  +-- Settings (sound, haptics, reduce animation, about)
```

Avoid a large tab bar. Home and list editor can use a simple navigation stack; draw mode is the main destination.

### Screen A - Home

- App title: **Randomizer**.
- Primary button: **New List**.
- Saved list cards show name, number of entries, last used time, and selected reveal style.
- Tap card to continue; long press/context menu for Rename, Duplicate, Delete.
- Display a "Try It" sample if no user-created lists exist.

### Screen B - List editor

- Text field for list name.
- Entry list, each with a unique internal ID and editable display name.
- Buttons: **Add Entry**, **Paste Names**, **Clear List** (confirmation).
- Drag handles to reorder entries, especially for Reverse Standings.
- Segmented control: **Equal / Weighted / Reverse Standings**.
- Choose reveal style via compact previews.
- Button: **Start Drawing**.
- Validate at least two eligible entries initially; after removals, allow drawing the last remaining entry at 100% odds.
- When duplicates exist, warn "Two entries have the same name" but allow them: each entry is a distinct participant with its own ID.

### Screen C - Draw screen (the heart of the product)

Layout, top to bottom:

```text
[Back]       Friday Fantasy Draft       [Edit] [History]

        8 eligible of 10 entries
        [Equal Odds / Weighted: View Odds]

       LARGE REVEAL VISUAL / ANIMATION
       wheel, name reel, bouncing balls, etc.

       Draw result or recent winner

  Remove after selection            [ ON ]  <-- ALWAYS VISIBLE
  [Restore removed (2)]  [Undo last draw]

               [ DRAW ]
           [Draw 3]  [Draw Order]
```

Design a **sticky control footer** containing the toggle and primary draw control. It stays visible with each animation, on the result screen, in full-screen presenter mode, and for all odds configurations.

When there are no eligible entries, replace Draw with **All entries have been selected** and provide **Restore removed** / **Start new session**; do not leave a dead button.

### Screen D - Results and session history

- Display selected names in draw order.
- Each result shows draw number and timestamp (local).
- Option to show the odds the winner had **at the moment of that draw**.
- Show when a draw was undone rather than quietly rewriting the audit trail if keeping persistent history; for simplest v1, remove undone draw from the active results and label the session as edited.
- **Share Results** generates a good-looking image or text summary entirely on-device.
- **New Session** resets the eligible pool and starts fresh history, without deleting the saved list or its weights.

---

## 5. Selection modes vs. presentation styles

These must be independent concepts.

### Selection/odds modes

| Mode | Meaning | Typical use |
|---|---|---|
| Equal Odds | Every eligible entry has the same chance | Chores, restaurants, classroom |
| Custom Weights | Each entry has a numeric weight | Give certain names higher odds |
| Reverse Standings | Earlier-ranked entries automatically get greater weights | Fantasy draft lotteries |

### Presentation/reveal styles

| Style | Animation concept | Build approach |
|---|---|---|
| Spin Wheel | Colored sectors rotate and land under a fixed pointer | SwiftUI Canvas, angle animation |
| Name Reel | Vertical ticker of names scrolls and settles | Native SwiftUI scrolling/offset animation |
| Lottery Balls | Numbered/colored balls bounce before one is selected | Simple 2D paths/animations; no real physics requirement |
| Mystery Reveal | Envelope or card opens to reveal the selected entry | SwiftUI scale/flip/opacity transitions |

Changing the reveal style **must not** change the winner, active pool, weights, or whether removal is enabled.

### Simple animation principles

- **Compute winner FIRST**, then animate the presentation to that fixed winner. Do not determine winners from animation frame rate or where the UI happened to stop.
- Every animation must be skippable. Skipping produces the same winner.
- Default duration target: roughly 3-5 seconds; optional fast-draw mode.
- Respect Reduce Motion; offer a direct result fade in place of spinning/bouncing.
- All sounds are bundled locally, licensed/created for the project, and can be muted.
- Avoid copying any TV show's protected artwork, branding, jingles, or exact presentation package. A scrolling name reel may be inspired by game shows without using their marks.
- If a wheel uses weighted odds, wheel sector proportions should **accurately reflect the configured weights**. If many names make the sectors unreadable, present a legend or recommend Name Reel rather than distorting odds.

---

## 6. Always-visible removal toggle - exact behavior

**Exact label:** `Remove after selection`

**Default for a new list:** ON. The user can turn it OFF with one tap. Remember their choice separately for every saved list. No mode may silently change this value.

The same toggle must appear on:

- Equal-odds Wheel / Reel / Balls / Mystery screens.
- Weighted Wheel / Reel / Balls / Mystery screens.
- Reverse Standings draw screens.
- Single draw, multi-winner draw, and presenter/full-screen draw screens.
- The result view before the next draw.

### When ON

1. Draw from current eligible pool.
2. **Atomically commit** the winner, draw-time odds, and entry removal to the current session, then persist the state **before** playing the animation.
3. Reveal the already-committed result; skipping or interrupting the animation never draws again.
4. Recompute normalized odds among the remaining eligible entries for the next draw.
5. Keep the removal count and **Restore removed** action visible.

Example: Three equal entries A, B, C have 33.33% each. Draw B with toggle ON. Next draw contains only A and C at 50% each.

### When OFF

1. Draw from current eligible pool.
2. **Commit and persist** the winner, draw-time odds, and unchanged eligible pool **before** the animation.
3. Reveal the already-committed result.
4. Subsequent draws use the same pool and same weights unless the user changes them.
5. Repeat winners are allowed and should not be treated as bugs.

Example: Three equal entries A, B, C. Draw B with toggle OFF. The next draw still includes A, B, C at 33.33% each.

### Toggling mid-session

- ON -> OFF: previously removed entries stay removed; only future draws stop removing winners.
- OFF -> ON: previous winners are **not** retroactively removed; future draws remove winners.
- **Restore removed** returns all or selected removed entries to eligibility without deleting the entries from the saved list.
- A list edit should not silently reset the current session. If adding/removing entries alters the pool, explain the effect and keep the history coherent.
- **Undo last draw** removes that result from the active history and restores that entry **only if** the draw had removed it. Undo does not reroll secretly.

### Multiple winners

- Toggle ON: draw without replacement; each winner is unique for that batch.
- Toggle OFF: draw with replacement; one name may appear more than once. Label this "Repeats possible" beside the batch-draw count.
- Batch count cannot exceed the number of eligible participants when ON.
- Results can be presented sequentially for suspense even though the entire batch was computed when Draw was tapped.

### Draft order compatibility

- **Generate unique draft order** requires ON, because each participant must occupy one slot.
- The toggle remains visible **and adjustable**; if OFF, keep ordinary repeat-enabled draws available and show: "Turn on Remove after selection to generate a unique draft order."
- Never relabel a sequence containing duplicate participants as a valid unique draft order.
- Save a generated full order independently of the current animation; users can choose "Reveal from last pick to first" without changing the result.

---

## 7. Weighted probabilities and draft lottery

### Equal odds

For N eligible entries, each probability = 1/N.

### Custom weights

Each entry has an integer weight from **0 to 1,000**.

- Default weight: 1.
- Weight 0 means the entry is **temporarily ineligible** for selection, visibly labeled "0% - excluded"; it is **not** the same thing as being in the removed pool.
- At least one eligible entry must have positive weight.
- Probability for entry i = weight_i / sum(weights of currently eligible entries).
- Entering weights like 40, 30, 20, 10 yields 40%, 30%, 20%, and 10% if these are the only eligible entries.
- If the 40-weight entry is removed, the remaining weights become 30/60 = 50%, 20/60 = 33.33%, and 10/60 = 16.67%.
- Make it clear that weights are **relative chances**, not fixed percentages that remain unchanged after removals.

Provide an **Odds** sheet that shows each entry, editable weight, normalized percentage, and an accessible proportional bar chart.

### Reverse Standings preset

User drags participants into **worst-to-best previous finish** order. Use a simple, transparent starting preset:

```text
N participants ranked 1 (worst) through N (best):
weight = N - rank + 1

For 8 participants, weights become:
8, 7, 6, 5, 4, 3, 2, 1
```

This is an **illustrative weighted fantasy draft preset**, NOT the NBA's official draft lottery odds or procedure. Do not call it "Official NBA Odds."

- Show actual normalized percentages immediately.
- Reordering teams updates the preset weights.
- If the user manually changes a weight, label the configuration **Custom weights** while preserving the ranking order.
- Optionally add "More aggressive" and "More even" presets later, but not required for v1.

### Full unique draft order

For a unique full order, repeatedly select a participant from the remaining pool using the applicable weights, remove them, and record the order. This makes worse-ranked teams more likely to receive an *earlier* pick, without guaranteeing it.

Do not promise this matches any professional league's complex lottery rules. It is a generic **weighted draft-order randomizer**.

### Display rules

- Present weights and odds separately: "Weight 8 | Chance 22.2%."
- Recalculate the percentages after each removal or eligibility change.
- A very small nonzero probability must not be rounded to a misleading `0%`; use a suitable precision or `<0.1%` label.
- Optional confirmation dialog before large public draft draws: "These are the current odds. Start draft?"

---

## 8. Fairness: one independent random-selection engine

Use Swift's system-backed `SystemRandomNumberGenerator` through `Int.random(in:using:)` for unbiased integer draws. No external randomness provider or network request.

Conceptual selection pseudocode:

```swift
struct DrawCandidate {
    let id: UUID
    let weight: Int
}

func selectWinner(_ all: [DrawCandidate]) throws -> UUID {
    let active = all.filter { $0.weight > 0 }
    guard !active.isEmpty else { throw DrawError.noEligibleEntries }

    let total = active.reduce(0) { $0 + $1.weight }
    var rng = SystemRandomNumberGenerator()
    let ticket = Int.random(in: 0..<total, using: &rng)

    var running = 0
    for candidate in active {
        running += candidate.weight
        if ticket < running { return candidate.id }
    }
    throw DrawError.internalInvariantFailure
}
```

In implementation, only feed currently eligible entries into the function. Equal-odds mode assigns every eligible participant an effective weight of 1. Use the entry's UUID, **never its name**, for eligibility and history.

Input limits (maximum 200 entries, each weight <= 1,000) prevent integer overflow with this approach. If limits change, audit overflow safety.

**Important fairness promise:** The outcome is chosen from the displayed probabilities and the full state transition is committed to local storage **before the animation begins**, never afterward. If the app is interrupted during the animation, resume the saved outcome rather than selecting again. No undisclosed "rig result" feature, hidden favoritism, or mid-animation reselection.

The app is a recreational decision/draw tool, **not** a regulated lottery system, gambling platform, or independently audited prize-drawing service. Do not market results as cryptographically verifiable or legally certified.

---

## 9. Concrete app data model

Use a small Codable-based local storage system; no database is required at this scale. Keep Swift types separate from visual views.

```swift
enum OddsMode: String, Codable {
    case equal, customWeighted, reverseStandings
}

enum RevealStyle: String, Codable {
    case wheel, reel, lotteryBalls, mysteryCard
}

struct DrawEntry: Codable, Identifiable, Equatable {
    var id: UUID
    var name: String
    var weight: Int              // Stored custom/preset weight
    var rank: Int?                // Previous-season finish, if used
}

struct DrawResult: Codable, Identifiable {
    var id: UUID
    var entryID: UUID
    var displayedNameSnapshot: String
    var drawnAt: Date
    var ordinal: Int
    var removedAfterDraw: Bool
    var numeratorWeight: Int
    var totalEligibleWeight: Int
    var sessionID: UUID
}

struct DrawList: Codable, Identifiable {
    var id: UUID
    var title: String
    var entries: [DrawEntry]
    var oddsMode: OddsMode
    var revealStyle: RevealStyle
    var removeAfterSelection: Bool   // PER-LIST, ALWAYS PRESENT IN UI
    var removedEntryIDs: Set<UUID>
    var activeSessionID: UUID
    var activeResults: [DrawResult]
    var createdAt: Date
    var updatedAt: Date
}
```

Additional considerations:

- Use a versioned root storage document (`schemaVersion`) so later migrations are possible.
- Only store `UUID` identifiers in the removed set. Two people named Alex are distinct entries.
- Store draw-time probability numerator/denominator so history is accurate even after weights change.
- A `DrawResult` can record `removedAfterDraw = true` even if that entry is later restored. Its history is a snapshot.
- For v1, the active session can be saved on the list and optionally archived to a separate local `SessionArchive` document when starting a new session.
- Avoid persisting animation state; restore to the last stable result after a force quit.
- Keep app preferences (sound/haptics) separately in UserDefaults.

### Local files

Suggested app sandbox files:

```text
Application Support/
  randomizer_store_v1.json
  sessions_v1.json          # optional; only if archived history is included
```

Use atomic writes and a temporary backup/safe write strategy so a crash does not corrupt saved lists. Add graceful recovery behavior for malformed data. User data never leaves the device except through an explicit Share action.

---

## 10. Recommended technical stack

- **Platform:** iPhone first; iPad responsive layout if convenient.
- **Minimum OS:** iOS 17+ (adjust only for an explicit product reason).
- **Language:** Swift.
- **UI:** SwiftUI.
- **State:** `@Observable` / an app-level store or a simple ObservableObject if project setup requires it.
- **Storage:** Foundation + Codable JSON files locally; UserDefaults for a few preferences.
- **Random selection:** SystemRandomNumberGenerator.
- **Animations:** SwiftUI Canvas, animation timelines/transitions, simple Core Animation when needed.
- **Sounds:** Small bundled audio assets with AVFoundation.
- **Haptics:** UIKit feedback generators or Core Haptics if the simple option proves insufficient.
- **Sharing:** SwiftUI ShareLink / UIActivityViewController with locally generated image/text.
- **Tests:** XCTest / Swift Testing, selected based on the project's Xcode environment.

No Firebase, Supabase, backend, API keys, analytics account, subscriptions, or mandatory third-party SDKs.

### Suggested folder organization

```text
Randomizer/
  App/
    RandomizerApp.swift
    AppState.swift
  Models/
    DrawEntry.swift
    DrawList.swift
    DrawResult.swift
    DrawEnums.swift
  Services/
    SelectionEngine.swift
    OddsCalculator.swift
    ListRepository.swift
    SessionManager.swift
    ResultsExporter.swift
  Screens/
    HomeView.swift
    ListEditorView.swift
    OddsEditorView.swift
    DrawView.swift
    ResultsHistoryView.swift
    DraftOrderView.swift
    SettingsView.swift
  RevealStyles/
    WheelRevealView.swift
    ReelRevealView.swift
    BallsRevealView.swift
    MysteryRevealView.swift
  Components/
    EntryRow.swift
    RemovalToggleFooter.swift
    OddsBar.swift
    ResultCard.swift
  Resources/
    Sounds/
  Tests/
    SelectionEngineTests.swift
    SessionManagerTests.swift
    OddsCalculatorTests.swift
    PersistenceTests.swift
```

Don't force needless layers or architectures. This is a small offline utility and should stay one.

---

## 11. Design direction

Feel: **premium, joyful, crisp, and slightly theatrical**. Think clean productivity app meeting a fun game-show moment, without copying any game-show brand.

### Visual system

- Dark-first interface with a warm near-black background.
- One strong accent (electric violet, turquoise, or bright amber) and a tasteful multi-color palette for wheel sectors.
- System typography with large legible names.
- Rounded controls; generous touch targets; unobtrusive shadows.
- Smooth animations, concise labels, clear hierarchy.
- Wheel and balls can be colorful; the surrounding interface should remain calm.

### UX principles

- One obvious primary action per screen.
- The same **Remove after selection** footer is reused across every reveal style.
- Name entry should never require a complex form.
- Show live odds transparently; avoid misleading decorative sectors.
- Use plain terms: **Equal Odds**, **Weighted**, **Remove after selection**, **Restore removed**.
- No fake loading, fake suspense that changes results, or full-screen ads.
- Add VoiceOver labels, Dynamic Type support for controls, high-contrast indicators, and reduced-motion alternatives.

### Customization in v1

- Reveal style.
- Sound on/off.
- Haptics on/off.
- Animation speed: Standard / Fast / Instant (if time permits).
- Optional color preset (not a custom theme editor).

---

## 12. Detailed flows and examples

### Flow A - Dinner decision, repeats allowed

1. Create list "Dinner Choices."
2. Paste Pizza, Tacos, Sushi, Burgers.
3. Equal Odds; choose Spin Wheel.
4. Turn **Remove after selection OFF**.
5. Spin: Sushi.
6. Spin again: Sushi is still eligible. This is expected.

### Flow B - Classroom picking with no repeats

1. Open "Period 3" list.
2. Select Name Reel.
3. Keep **Remove after selection ON**.
4. Pick Alex.
5. Alex moves to Removed; eligible count decreases by one.
6. Pick again; Alex cannot repeat.
7. Tap Restore removed to make Alex eligible again.

### Flow C - Weighted choice

1. Enter Team A weight 40, Team B weight 30, Team C weight 20, Team D weight 10.
2. Open Odds to verify 40%, 30%, 20%, 10%.
3. Turn removal ON.
4. Draw Team A and remove it.
5. Verify next odds are 50%, 33.33%, 16.67% for B, C, D.
6. Changing visual style does not modify odds.

### Flow D - Fantasy lottery reveal

1. Paste eight team names.
2. Arrange last season's standings from worst to best.
3. Choose Reverse Standings preset; check weights and percentages.
4. Turn **Remove after selection ON**.
5. Tap **Generate Unique Draft Order**.
6. App generates and stores a complete weighted permutation.
7. Choose **Reveal from last pick to first** for suspense.
8. Reveal each pick using Mystery Card or Name Reel.
9. Share a simple image showing positions 1 through 8.
10. If the user turns removal OFF before generation, disable "Generate Unique Draft Order" and explain why. Leave normal draws available.

### Flow E - Raffle with repeat winners

1. Create a list of ticket entries (duplicate display names allowed, unique IDs).
2. Toggle OFF for draws with replacement, or ON for unique recipients.
3. Draw 3 winners; announce upfront whether repeats are possible.
4. Share the results.

---

## 13. Edge cases and non-obvious requirements

- Empty list -> show Add Entries; disable draw.
- One remaining eligible entry -> it has a 100% chance; can be drawn.
- Zero eligible entries -> no draw; offer Restore removed or edit weights.
- Duplicate names -> distinct IDs and independent probabilities.
- Blank/whitespace names -> ignore on paste; reject empty manual entries.
- Very long names -> truncate visually but show full name on detail/share; support accessibility reading.
- Batch count > active pool with removal ON -> validation and explanation.
- All custom weights 0 -> cannot draw.
- All eligible entries removed -> restore/reset path.
- Toggle switched mid-session -> no retroactive eligibility changes.
- Weight adjusted after previous draw -> history displays past snapshot, new draws use new weight.
- Entry deleted mid-session -> past result retains name snapshot and remains in session history.
- New participant added mid-session -> joins future draws only; show confirmation in an active draft-order generation flow.
- App interrupted during animation -> restore the already selected result, not pick a new one.
- Double-tapping Draw -> only one draw processed; lock CTA until outcome committed and result shown.
- VoiceOver -> announce current odds, winner, and removal state.
- Reduced Motion -> simple instant/fade reveal; no flashing and no required animation to use the app.
- Large wheels -> if labels cannot fit, use an accompanying numbered legend and suggest switching to Reel.
- Undo -> must not silently manipulate results; show it as an explicit user action.

---

## 14. Implementation roadmap - do this in order

Do not start with animations. Make the underlying probability engine correct first.

### Phase 0 - Initialize the repository

Tasks:

- Create iOS SwiftUI Xcode project called `Randomizer`.
- Set minimum OS and app display name.
- Establish folder structure, models, color tokens, and basic navigation.
- Add unit test target.
- Set build configuration with **no network dependencies**.

Done when: clean simulator build launches Home screen and tests run.

### Phase 1 - Core domain and fairness engine

Tasks:

- Implement entry/list/result models.
- Implement Equal Odds, Custom Weights, Reverse Standings weight generation.
- Implement normalized odds calculation.
- Implement `selectWinner` and selection of a sequence with and without replacement.
- Write tests for the full behavior of **Remove after selection** (see section 15).
- Implement draw-time odds snapshots.

Done when: all selection, weight, removal, and history unit tests pass without any animations.

### Phase 2 - Create/edit/save lists

Tasks:

- Home screen with saved lists and sample list.
- Add, edit, delete, reorder participants.
- Paste one name per line with preview and confirmation.
- Save and reopen lists using atomic local JSON storage.
- Configure weights and reverse standings.
- Save reveal style and removal toggle per list.

Done when: create a 20-person list, force-quit, reopen, and see exactly the same configuration.

### Phase 3 - Minimal functional draw screen

Tasks:

- Implement **one** simple Mystery Reveal or instant result view.
- Add sticky **Remove after selection** switch, Draw button, count, odds preview, Restore removed, Undo.
- Wire draw and session-history state transitions.
- Support with-replacement and without-replacement drawing.
- Generate simple text results with the native share sheet.

Done when: the entire app already works as a complete random picker without the other animations.

### Phase 4 - All four reveal styles

Implement sequentially:

1. Mystery Reveal (if not already built).
2. Name Reel.
3. Spin Wheel.
4. Lottery Balls.

For each style:

- Outcome supplied by the common SelectionEngine.
- **Remove after selection** footer remains visible and interactive.
- Skip animation and reduced-motion path work.
- Names and weights are displayed honestly.
- Test with 2, 8, 20, and 100 entries.

Done when: switching styles never changes the selection algorithm, pool, or toggle setting.

### Phase 5 - Draft order feature

Tasks:

- Previous standings editor (worst -> best).
- Reverse Standings weights and live percentages.
- Generate a full **unique** weighted order when removal is ON.
- If removal OFF, leave toggle editable, prohibit unique-order generation, and show explanation.
- Results view supporting first-to-last and last-to-first reveal.
- Store completed order before any animated reveal.

Done when: every valid draft order contains every eligible participant exactly once, and reversing reveal order never alters it.

### Phase 6 - Polish, accessibility, and exports

Tasks:

- Bundled audio and haptics.
- Responsive design for small iPhones, large iPhones, and landscape as feasible.
- VoiceOver, Dynamic Type, Reduce Motion.
- Clean shareable result image.
- Great empty/error states and confirmations.
- Better input ergonomics and compact example list.
- Performance optimization and animation cancellation handling.

Done when: the app feels like one coherent finished product, not a collection of demos.

### Phase 7 - Beta and App Store shipping

Tasks:

- Internal TestFlight testing and bug fixing.
- Have 5-10 testers cover friends/family, fantasy commissioner, and educator/organizer use cases.
- Test genuine weighted drafts, repeated draws, restoration, and force quits.
- Create icon and App Store screenshots showing wheel, reel, odds, and unique order.
- Write accurate App Store copy and privacy disclosures.
- Verify name and trademarks; avoid implying affiliation with leagues or TV shows.
- Set paid download price, submit for review, release.

Done when: every release-blocking acceptance test is green and store listing accurately describes the shipped app.

---

## 15. Mandatory tests / acceptance criteria

### Core probability and eligibility tests

- Equal odds with 4 entries -> each probability exactly 25%.
- Weights [40,30,20,10] -> exact expected shares.
- Remove the 40-weight entry -> remaining normalized shares of 50%, 33.33%, 16.67%.
- Weight 0 -> participant not drawn until weight increased.
- No eligible entries -> graceful error, no crash.
- Single eligible entry -> deterministic 100% result.
- Batch with removal ON -> no duplicate IDs and max count limited to pool.
- Batch with removal OFF -> repeat IDs allowed; candidate pool stays unchanged.
- Reverse standings for 8 -> weights [8,7,6,5,4,3,2,1] in ranking order.
- Every full unique draft order -> exact permutation of eligible entry IDs.
- Swapping animation styles before or after draw -> probabilities and saved list identical.
- Drawn winner always matches the animated result and shared result.

### Toggle tests - release blockers

1. Create a list, turn removal OFF, draw a winner: winner remains eligible.
2. Turn removal ON, draw a winner: winner becomes ineligible for future draws.
3. Turn OFF after removing someone: previously removed person stays out.
4. Turn ON after earlier draws with removal OFF: earlier winners stay in until selected again.
5. Tap Restore removed: selected removed IDs become eligible again.
6. Undo draw made with removal ON: restore the last removed entry.
7. Undo draw made with removal OFF: pool remains unchanged.
8. Close and reopen saved list: removal toggle, active pool, and results persist.
9. For EACH of the four reveal styles and three odds modes, verify toggle visible and operational.
10. Verify toggle remains visible in full-screen mode and the result screen.
11. Toggle OFF in draft mode: unique draft action disabled with explanation, normal repeated draws still available.
12. Toggle ON: unique draft order action enabled when other eligibility conditions are met.

### Reliability, quality, and accessibility tests

- Repeated fast taps do not produce accidental extra winners.
- Force quit during an animation does not trigger an additional draw on reopening.
- JSON save/restore handles an interrupted write safely.
- Pasting hundreds of lines enforces 200-entry limit with user feedback.
- Duplicate names are not mistakenly merged.
- Odds labels reflect current eligible entries, not all saved entries.
- History displays the probability at **time of each draw**.
- Dynamic Type, VoiceOver, Reduce Motion, and mute switches work.
- All draws work with Airplane Mode ON.
- Stress test: 100,000+ simulated draws on a fixed weighted configuration and verify observed frequencies are statistically reasonable within chosen tolerances. This is a sanity test, not proof of perfect fairness.

---

## 16. Suggested launch App Store content

**App name (working):** Randomizer

**Subtitle candidate:** Spin, draw & draft fairly

**Core screenshot sequence:**

1. **Random picks, made fun.** - clear, beautiful wheel.
2. **Choose your reveal.** - Wheel, Reel, Lottery Balls, Mystery Card.
3. **No repeats? Your choice.** - prominent Remove after selection toggle.
4. **Set custom odds.** - transparent weights and percentages.
5. **Run your fantasy draft.** - reverse standings and dramatic final order.
6. **Save lists. Share results.** - reusable lists and export.

Use truthful marketing: "Works offline"; "No account"; "One purchase. All reveal modes."

Avoid: "Official NBA lottery," "Certified fair," "Guaranteed unbiased gambling draw," or affiliation with entertainment brands.

### Metrics to evaluate manually after launch

Without adding remote analytics, review App Store performance, support email themes, and opt-in customer feedback:

- Do customers understand the app from screenshots?
- Are they mainly using wheels, name reels, or draft orders?
- Do they request export/import or additional presentation options?
- Is the price positioning acceptable?
- Are complaints about fairness actually misunderstandings of relative odds?

Only add features that repeatedly emerge as meaningful problems.

---

## 17. Potential v1.1 features - DO NOT build first

- Import/export lists as CSV or JSON (local Files integration).
- App icon themes and background customization.
- More draw reveal modes: cascading cards, race finish, bingo cage.
- Weighted probability presets saved per list.
- Automatic read-aloud winner names with on-device system speech.
- Multi-round brackets and tournament builders.
- A dedicated iPad presentation layout or external-display view.
- Printable draft results as PDF.

Treat all of these as ideas, not launch dependencies.

---

## 18. Claude Code execution instructions

When given this Markdown specification:

1. Read it fully, then create a concise implementation checklist in the repository.
2. Build the **domain engine and unit tests first**. Do not start by drawing a flashy wheel.
3. Keep the entire app local-first with no API keys, network clients, backend, auth, or external database.
4. Implement the **Remove after selection** toggle as one reusable component shared by every draw view. Make it always visible and persistent per saved list.
5. Implement weighted selection correctly, and select the winning UUID **before** playing an animation.
6. Finish the single working draw flow before implementing the remaining three reveal styles.
7. Use a clean, premium SwiftUI design with native controls and bundled assets.
8. Follow the phases above. Build and run tests at every phase; fix problems before advancing.
9. Do not invent features outside the scope; favor a polished finished MVP.
10. At completion, provide the developer with build steps, simulator test instructions, a test summary, and any remaining known limitations.

### Suggested initial Claude Code prompt

```text
Build the iOS app described in Randomizer_Complete_iOS_Build_Plan.md.
Treat it as the source of truth for product behavior and scope.
Use SwiftUI and native offline APIs, with a one-time paid App Store download model.

CRITICAL: Every draw screen, every reveal style, every selection/odds mode,
and full-screen presenter view must visibly contain an interactive and
persistent "Remove after selection" toggle. ON removes selected entries
from future draws; OFF allows repeats; switching modes never hides the toggle.

Start with the app skeleton, Codable models, weighted random selection engine,
removal/session logic, and thorough unit tests. Then build list management,
a plain working draw view, animations, draft-order generation, polish,
and App Store readiness in the documented order.

No backend, subscription, remote API, account, or third-party paid SDK.
Do not silently change requirements or claim features work without testing.
```

---

## 19. Definition of done

Randomizer is ready for sale when a new customer can install it, paste names, choose an attractive reveal style, optionally customize their odds, draw a result, choose **whether the winner can appear again**, and confidently save/share the result - entirely offline.

It must also support a unique weighted draft order when removal is on, behave predictably when the removal toggle changes mid-session, and remain stable across app interruptions.

**Build one trustworthy selection engine. Put four delightful reveal styles on top. Keep the removal toggle available everywhere.**
