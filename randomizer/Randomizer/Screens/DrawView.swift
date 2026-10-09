import SwiftUI
import RandomizerCore

/// One reveal of one tap of Draw: the committed outcome and which of its
/// picks is on screen.
struct RevealSession: Equatable {
    let outcome: DrawOutcome
    var index: Int = 0

    var current: DrawResult { outcome.results[index] }
    var pool: [PoolMember] { outcome.pool(forPick: index) }
    var count: Int { outcome.results.count }
    var hasMore: Bool { index + 1 < count }
}

/// The heart of the app: who's eligible, the reveal, the result, and a
/// sticky footer with Remove after selection and the Draw button.
struct DrawView: View {
    let listID: UUID
    @Binding var path: [Route]
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var driver = RevealDriver()
    @State private var session: RevealSession?
    @State private var batchCount = 1
    @State private var presenting = false
    @State private var showingHistory = false
    @State private var showingOdds = false
    @State private var showingRestore = false
    @State private var showingLegend = false
    @State private var confirmDraftOrder = false
    @State private var confirmNewSession = false
    @State private var errorMessage: String?
    @State private var toast: String?
    @State private var lastDrawAt = Date.distantPast

    var body: some View {
        if let list = appState.list(listID) {
            screen(list)
        } else {
            ContentUnavailableView("List not found", systemImage: "questionmark.folder")
        }
    }

    private func screen(_ list: DrawList) -> some View {
        VStack(spacing: 0) {
            if presenting {
                presenterHeader(list)
            }
            summaryHeader(list)
                .padding(.horizontal, 16)
                .padding(.top, presenting ? 4 : 8)
            if list.isSample, !list.activeResults.isEmpty, !presenting {
                sampleBanner
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
            }
            stage(list)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            resultArea(list)
                .frame(maxWidth: .infinity, minHeight: 92)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .overlay(alignment: .top) {
            if let toast {
                ToastView(text: toast)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            controlFooter(list)
        }
        .navigationTitle(list.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(presenting ? .hidden : .visible, for: .navigationBar)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .statusBarHidden(presenting)
        .persistentSystemOverlays(presenting ? .hidden : .automatic)
        .toolbar { toolbarContent(list) }
        .sheet(isPresented: $showingHistory) {
            ResultsHistoryView(
                listID: listID,
                onOpenDraftOrder: { path.append(.draftOrder(listID)) },
                onNewSession: startNewSession
            )
        }
        .sheet(isPresented: $showingOdds) {
            OddsEditorView(listID: listID)
        }
        .sheet(isPresented: $showingRestore) {
            RestoreRemovedSheet(listID: listID, onRestored: clearLandedReveal)
        }
        .sheet(isPresented: $showingLegend) {
            WheelLegendSheet(pool: session?.pool ?? list.poolMembers)
        }
        .confirmationDialog(
            "These are the current odds. Generate a unique order of \(list.eligibleCount) entries?",
            isPresented: $confirmDraftOrder,
            titleVisibility: .visible
        ) {
            Button("Generate unique order") { generateDraftOrder() }
            Button("View odds first") { showingOdds = true }
        } message: {
            Text("Everyone eligible gets exactly one pick. Higher weights tend to pick earlier, with no guarantee. The order is saved before any reveal.")
        }
        .confirmationDialog("Start a new session?", isPresented: $confirmNewSession, titleVisibility: .visible) {
            Button("New session", role: .destructive, action: startNewSession)
        } message: {
            Text("Everyone becomes eligible again and this session's results are cleared. Entries, weights and settings stay.")
        }
        .alert("Can't draw", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onChange(of: driver.landings) { _, _ in announceLanding() }
        .onChange(of: list.maxBatchCount) { _, maximum in
            batchCount = min(max(batchCount, 1), max(maximum, 1))
        }
        .onDisappear {
            driver.reset()
            session = nil
        }
    }

    // MARK: Header

    private func presenterHeader(_ list: DrawList) -> some View {
        HStack(alignment: .center) {
            Text(list.title)
                .font(.system(size: 28, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Spacer()
            Button {
                withAnimation { presenting = false }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Theme.textSecondary)
            }
            .accessibilityLabel("Exit presenter mode")
            .accessibilityIdentifier("exitPresenterButton")
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func summaryHeader(_ list: DrawList) -> some View {
        VStack(spacing: 6) {
            Text("\(list.eligibleCount) eligible of \(list.entries.count) \(list.entries.count == 1 ? "entry" : "entries")")
                .font(Theme.rounded(.subheadline, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .accessibilityIdentifier("eligibleSummary")
            HStack(spacing: 8) {
                Tag(text: list.oddsMode.title, systemImage: list.oddsMode.systemImage, tint: Theme.accent)
                Button("View odds") { showingOdds = true }
                    .font(Theme.rounded(.footnote, weight: .semibold))
                    .accessibilityIdentifier("drawViewOddsButton")
            }
            if let detail = poolDetail(list) {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func poolDetail(_ list: DrawList) -> String? {
        var parts: [String] = []
        let removed = list.removedEntries.count
        let excluded = list.excludedEntries.count
        if removed > 0 { parts.append("\(removed) removed") }
        if excluded > 0 { parts.append("\(excluded) at weight 0") }
        return parts.isEmpty ? nil : parts.joined(separator: " \u{00B7} ")
    }

    private var sampleBanner: some View {
        HStack(spacing: 10) {
            Text("This is an example list.")
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            Spacer(minLength: 0)
            Button("Keep it") { appState.keepSample(listID) }
                .buttonStyle(ChipButtonStyle())
                .accessibilityIdentifier("keepSampleButton")
            Button("Make my own") {
                let list = appState.createList()
                path = [.editor(list.id)]
            }
            .buttonStyle(ChipButtonStyle(tint: Theme.textPrimary))
            .accessibilityIdentifier("makeMyOwnButton")
        }
    }

    // MARK: Stage and result

    @ViewBuilder
    private func stage(_ list: DrawList) -> some View {
        let pool = session?.pool ?? list.poolMembers
        if pool.isEmpty {
            VStack(spacing: 10) {
                Image(systemName: list.entries.isEmpty ? "tray" : "checkmark.seal")
                    .font(.system(size: 44))
                    .foregroundStyle(Theme.accent)
                Text(list.entries.isEmpty ? "Add entries to start drawing." : "Nobody left to draw.")
                    .font(Theme.rounded(.headline, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
            }
        } else {
            RevealStage(
                style: list.revealStyle,
                pool: pool,
                winnerID: session?.current.entryID,
                phase: session == nil ? .idle : driver.phase,
                token: driver.token
            )
            .contentShape(Rectangle())
            .onTapGesture { driver.skip() }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(stageAccessibilityLabel(list, pool: pool))
            .accessibilityAddTraits(driver.phase.isAnimating ? .isButton : [])
            .accessibilityAction(named: "Skip animation") { driver.skip() }
            .accessibilityIdentifier("revealStage")
            .overlay(alignment: .bottomTrailing) {
                if list.revealStyle == .wheel, pool.count > WheelGeometry.labelLimit {
                    Button {
                        showingLegend = true
                    } label: {
                        Label("Legend", systemImage: "list.number")
                    }
                    .buttonStyle(ChipButtonStyle())
                    .accessibilityIdentifier("wheelLegendButton")
                }
            }
        }
    }

    private func stageAccessibilityLabel(_ list: DrawList, pool: [PoolMember]) -> String {
        let style = list.revealStyle.title
        switch (session, driver.phase) {
        case (.some, .animating):
            return "\(style) is revealing the result. Double tap to skip."
        case (.some(let session), .landed):
            return "\(style) shows \(session.current.nameSnapshot)."
        default:
            return "\(style) with \(pool.count) \(pool.count == 1 ? "entry" : "entries")."
        }
    }

    @ViewBuilder
    private func resultArea(_ list: DrawList) -> some View {
        if let session, driver.phase == .landed {
            ResultBanner(session: session, reduceMotion: reduceMotion)
                .id(session.current.id)
                .transition(reduceMotion ? .opacity : .scale(scale: 0.85).combined(with: .opacity))
        } else if session != nil {
            VStack(spacing: 4) {
                Text("Drawing\u{2026}")
                    .font(Theme.rounded(.title3, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
                Text("The result is already locked in. Tap to skip.")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }
            .accessibilityIdentifier("drawingInProgress")
        } else if let last = list.activeResults.last {
            VStack(spacing: 2) {
                Text("Last draw")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
                    .textCase(.uppercase)
                Text(last.nameSnapshot)
                    .font(Theme.rounded(.title2, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .accessibilityIdentifier("lastDrawName")
                Text("\(last.chanceText) chance \u{00B7} \(last.removedAfterDraw ? "removed from the pool" : "stayed in the pool")")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
        } else {
            Text(list.eligibleCount > 0 ? "Tap Draw to pick from \(list.eligibleCount) \(list.eligibleCount == 1 ? "entry" : "entries")." : " ")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
        }
    }

    // MARK: Footer

    private func controlFooter(_ list: DrawList) -> some View {
        VStack(spacing: 12) {
            RemovalToggleFooter(
                isOn: Binding(
                    get: { list.removeAfterSelection },
                    set: { isOn in appState.update(listID) { $0.setRemoveAfterSelection(isOn) } }
                ),
                removedCount: list.removedEntries.count,
                canUndo: list.canUndo,
                onRestoreAll: restoreAll,
                onChooseRestore: { showingRestore = true },
                onUndo: undo
            )
            Rectangle()
                .fill(Theme.stroke)
                .frame(height: 1)
            drawControls(list)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26, style: .continuous)
                .fill(Theme.surface)
                .overlay {
                    UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26, style: .continuous)
                        .stroke(Theme.stroke, lineWidth: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        }
    }

    @ViewBuilder
    private func drawControls(_ list: DrawList) -> some View {
        if let session, session.hasMore, driver.phase == .landed {
            VStack(spacing: 8) {
                Button(action: revealNext) {
                    Label("Reveal pick \(session.index + 2) of \(session.count)", systemImage: "sparkles")
                }
                .buttonStyle(PrimaryButtonStyle())
                .accessibilityIdentifier("revealNextButton")
                Button("Show all picks", action: showAllPicks)
                    .font(Theme.rounded(.footnote, weight: .semibold))
                    .accessibilityIdentifier("showAllPicksButton")
            }
        } else if list.eligibleCount == 0 {
            exhaustedPanel(list)
        } else {
            VStack(spacing: 10) {
                Button {
                    draw(list)
                } label: {
                    Label(batchCount > 1 ? "Draw \(batchCount)" : "Draw", systemImage: "sparkles")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(driver.phase.isAnimating)
                .accessibilityIdentifier("drawButton")

                HStack(spacing: 8) {
                    BatchCountControl(count: $batchCount, maximum: list.maxBatchCount)
                    if !list.removeAfterSelection {
                        Tag(text: "Repeats possible", systemImage: "repeat", tint: Theme.caution)
                            .fixedSize()
                            .accessibilityIdentifier("repeatsPossibleLabel")
                    }
                    Spacer(minLength: 0)
                    if list.removeAfterSelection {
                        draftOrderButton(list)
                    }
                }
                if !list.removeAfterSelection, let why = list.draftOrderAvailability.explanation {
                    HStack(spacing: 10) {
                        draftOrderButton(list)
                        Text(why)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("draftOrderExplanation")
                    }
                }
            }
        }
    }

    private func draftOrderButton(_ list: DrawList) -> some View {
        Button {
            confirmDraftOrder = true
        } label: {
            Label("Draft order", systemImage: "list.number")
                .lineLimit(1)
                .fixedSize()
        }
        .buttonStyle(ChipButtonStyle())
        .disabled(list.draftOrderAvailability != .available || driver.phase.isAnimating)
        .accessibilityIdentifier("draftOrderButton")
    }

    @ViewBuilder
    private func exhaustedPanel(_ list: DrawList) -> some View {
        VStack(spacing: 10) {
            if list.removedEntries.isEmpty {
                Text(list.entries.isEmpty ? "This list has no entries." : "No entries can be drawn. Give an entry a weight above 0.")
                    .font(Theme.rounded(.headline, weight: .semibold))
                    .multilineTextAlignment(.center)
                Button(list.entries.isEmpty ? "Add entries" : "Edit odds") {
                    if list.entries.isEmpty { path.showEditor(listID) } else { showingOdds = true }
                }
                .buttonStyle(SecondaryButtonStyle())
            } else {
                Text("All entries have been selected")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .accessibilityIdentifier("allSelectedMessage")
                HStack(spacing: 10) {
                    Button(action: restoreAll) {
                        Label("Restore removed", systemImage: "arrow.uturn.backward.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .accessibilityIdentifier("exhaustedRestoreButton")
                    Button {
                        confirmNewSession = true
                    } label: {
                        Label("Start new session", systemImage: "arrow.counterclockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .accessibilityIdentifier("exhaustedNewSessionButton")
                }
                if list.latestDraftOrder != nil {
                    Button {
                        path.append(.draftOrder(listID))
                    } label: {
                        Label("View draft order", systemImage: "list.number")
                    }
                    .font(Theme.rounded(.footnote, weight: .semibold))
                    .accessibilityIdentifier("viewDraftOrderButton")
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private func toolbarContent(_ list: DrawList) -> some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                path.showEditor(listID)
            } label: {
                Image(systemName: "pencil")
            }
            .accessibilityLabel("Edit list")
            .accessibilityIdentifier("editListButton")

            Button {
                showingHistory = true
            } label: {
                Image(systemName: "clock.arrow.circlepath")
            }
            .accessibilityLabel("History")
            .accessibilityIdentifier("historyButton")

            Menu {
                Picker("Reveal style", selection: Binding(
                    get: { list.revealStyle },
                    set: { style in appState.update(listID) { $0.setRevealStyle(style) } }
                )) {
                    ForEach(RevealStyle.allCases, id: \.self) { style in
                        Label(style.title, systemImage: style.systemImage).tag(style)
                    }
                }
                Button {
                    withAnimation { presenting = true }
                } label: {
                    Label("Presenter mode", systemImage: "rectangle.inset.filled")
                }
                Button {
                    showingOdds = true
                } label: {
                    Label("View odds", systemImage: "chart.bar.xaxis")
                }
                ShareLink(item: ResultsExporter.resultsText(title: list.title, results: list.activeResults, sessionEdited: list.sessionEdited)) {
                    Label("Share results", systemImage: "square.and.arrow.up")
                }
                .disabled(list.activeResults.isEmpty)
                Divider()
                Button(role: .destructive) {
                    confirmNewSession = true
                } label: {
                    Label("New session", systemImage: "arrow.counterclockwise")
                }
                .disabled(!list.hasActiveSession)
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More")
            .accessibilityIdentifier("drawMenu")
        }
    }

    // MARK: Actions

    private func draw(_ list: DrawList) {
        // One tap, one draw: ignore taps while a reveal plays or right after one.
        guard !driver.phase.isAnimating, Date().timeIntervalSince(lastDrawAt) > 0.4 else { return }
        lastDrawAt = Date()
        let count = min(max(batchCount, 1), max(list.maxBatchCount, 1))
        do {
            let outcome = try appState.draw(listID, count: count)
            let next = RevealSession(outcome: outcome)
            session = next
            driver.start(style: list.revealStyle, poolCount: next.pool.count, reduceMotion: reduceMotion)
        } catch let error as DrawError {
            errorMessage = error.message
        } catch {
            errorMessage = "Nothing was drawn."
        }
    }

    private func revealNext() {
        guard var next = session, next.hasMore, let list = appState.list(listID) else { return }
        next.index += 1
        session = next
        driver.start(style: list.revealStyle, poolCount: next.pool.count, reduceMotion: reduceMotion)
    }

    private func showAllPicks() {
        guard var last = session else { return }
        last.index = last.count - 1
        session = last
        driver.showLanded()
    }

    private func undo() {
        driver.reset()
        session = nil
        var undone: [DrawResult] = []
        appState.update(listID) { undone = $0.undoLastDraw() }
        guard !undone.isEmpty else { return }
        let names = undone.map(\.nameSnapshot).joined(separator: ", ")
        let restored = undone.contains(where: \.removedAfterDraw)
        showToast(restored ? "Undid \(names). Back in the pool." : "Undid \(names).")
    }

    private func restoreAll() {
        guard let list = appState.list(listID) else { return }
        let count = list.removedEntries.count
        appState.update(listID) { $0.restoreAllRemoved() }
        clearLandedReveal()
        showToast("Restored \(count) \(count == 1 ? "entry" : "entries")")
    }

    /// After the pool changes, the stage shows the new pool instead of the
    /// last landed reveal (the result stays as "Last draw").
    private func clearLandedReveal() {
        guard !driver.phase.isAnimating else { return }
        driver.reset()
        session = nil
    }

    private func startNewSession() {
        driver.reset()
        session = nil
        appState.update(listID) { $0.startNewSession() }
        showToast("New session started")
    }

    private func generateDraftOrder() {
        driver.reset()
        session = nil
        do {
            _ = try appState.generateDraftOrder(listID)
            path.append(.draftOrder(listID))
        } catch let error as DrawError {
            errorMessage = error.message
        } catch {
            errorMessage = "No order was generated."
        }
    }

    private func showToast(_ text: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { toast = text }
        AccessibilityNotification.Announcement(text).post()
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.2))
            if toast == text {
                withAnimation(.easeOut(duration: 0.25)) { toast = nil }
            }
        }
    }

    private func announceLanding() {
        guard let session else { return }
        let result = session.current
        var text = "\(result.nameSnapshot). \(result.chanceText) chance."
        text += result.removedAfterDraw ? " Removed from the pool." : " Stays in the pool."
        if session.count > 1 {
            text = "Pick \(session.index + 1) of \(session.count): " + text
        }
        AccessibilityNotification.Announcement(text).post()
    }
}

/// The landed result: the winner, their chance at that moment, and whether
/// the draw removed them.
struct ResultBanner: View {
    let session: RevealSession
    let reduceMotion: Bool

    var body: some View {
        let result = session.current
        VStack(spacing: 4) {
            if session.count > 1 {
                Text("Pick \(session.index + 1) of \(session.count)")
                    .font(Theme.rounded(.caption, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .textCase(.uppercase)
            }
            Text(result.nameSnapshot)
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.5)
                .accessibilityIdentifier("resultName")
            HStack(spacing: 6) {
                Text("\(result.chanceText) chance")
                Text("\u{00B7}")
                Text(result.removedAfterDraw ? "Removed from the pool" : "Stays in the pool")
                    .foregroundStyle(result.removedAfterDraw ? Theme.textSecondary : Theme.caution)
            }
            .font(.footnote)
            .foregroundStyle(Theme.textSecondary)
            if session.count > 1, session.index > 0 {
                Text(session.outcome.results.prefix(session.index + 1).map { "\($0.positionInAction). \($0.nameSnapshot)" }.joined(separator: "   "))
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.top, 2)
            }
        }
    }
}

/// Removed entries, to restore all or just some.
struct RestoreRemovedSheet: View {
    let listID: UUID
    var onRestored: () -> Void = {}
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if let list = appState.list(listID), !list.removedEntries.isEmpty {
                    Section {
                        Button {
                            appState.update(listID) { $0.restoreAllRemoved() }
                            onRestored()
                            dismiss()
                        } label: {
                            Label("Restore all \(list.removedEntries.count)", systemImage: "arrow.uturn.backward.circle.fill")
                        }
                    } footer: {
                        Text("Restored entries can be drawn again. Past results stay in history.")
                    }
                    .listRowBackground(Theme.surface)
                    Section("Removed this session") {
                        ForEach(list.removedEntries) { entry in
                            HStack {
                                Text(entry.name)
                                Spacer()
                                Button("Restore") {
                                    appState.update(listID) { $0.restore([entry.id]) }
                                    onRestored()
                                }
                                .buttonStyle(ChipButtonStyle())
                            }
                        }
                    }
                    .listRowBackground(Theme.surface)
                } else {
                    ContentUnavailableView("Nobody is removed", systemImage: "checkmark.circle", description: Text("Everyone is in the pool."))
                        .listRowBackground(Color.clear)
                }
            }
            .themedList()
            .navigationTitle("Restore removed")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
