import SwiftUI
import RandomizerCore

/// Reveals a saved unique order pick by pick. The order was generated and
/// saved before this screen opened; revealing last-to-first or first-to-last
/// only changes the order of the reveal, never the order itself.
struct DraftOrderView: View {
    let listID: UUID
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var driver = RevealDriver()
    @State private var direction: RevealDirection = .lastToFirst
    @State private var revealed = 0
    @State private var revealingIndex: Int?
    @State private var showingRestore = false
    @State private var shareImage: Image?

    enum RevealDirection: String, CaseIterable, Identifiable {
        case lastToFirst
        case firstToLast

        var id: String { rawValue }

        var title: String {
            switch self {
            case .lastToFirst: return "Last pick first"
            case .firstToLast: return "Pick 1 first"
            }
        }
    }

    var body: some View {
        if let list = appState.list(listID), let picks = list.latestDraftOrder {
            content(list, picks: picks)
        } else {
            ContentUnavailableView(
                "No draft order",
                systemImage: "list.number",
                description: Text("Generate one from the draw screen with Remove after selection on. Undoing an order removes it.")
            )
            .background(Theme.background.ignoresSafeArea())
        }
    }

    private func sequence(_ picks: [DrawResult]) -> [DrawResult] {
        direction == .firstToLast ? picks : picks.reversed()
    }

    private func content(_ list: DrawList, picks: [DrawResult]) -> some View {
        let order = sequence(picks)
        let current = revealingIndex.map { order[$0] }
        let stagePool = poolMembers(for: order, from: revealingIndex ?? 0, list: list)
        return VStack(spacing: 0) {
            Picker("Reveal order", selection: $direction) {
                ForEach(RevealDirection.allCases) { direction in
                    Text(direction.title).tag(direction)
                }
            }
            .pickerStyle(.segmented)
            .disabled(revealed > 0 || driver.phase.isAnimating)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .accessibilityIdentifier("revealDirectionPicker")

            RevealStage(
                style: list.revealStyle,
                pool: stagePool,
                winnerID: current?.entryID,
                phase: current == nil ? .idle : driver.phase,
                token: driver.token
            )
            .frame(maxWidth: .infinity)
            .frame(height: 230)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            .onTapGesture { driver.skip() }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(stageLabel(current))
            .accessibilityAction(named: "Skip animation") { driver.skip() }

            board(picks: picks, order: order)
        }
        .background(Theme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            footer(list, order: order)
        }
        .navigationTitle("Draft order")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ShareLink(item: ResultsExporter.draftOrderText(title: list.title, picks: picks)) {
                        Label("Share as text", systemImage: "text.alignleft")
                    }
                    if let shareImage {
                        ShareLink(item: shareImage, preview: SharePreview("\(list.title) draft order", image: shareImage)) {
                            Label("Share as image", systemImage: "photo")
                        }
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Share order")
                .accessibilityIdentifier("shareOrderMenu")
            }
        }
        .sheet(isPresented: $showingRestore) {
            RestoreRemovedSheet(listID: listID)
        }
        .task(id: picks.first?.actionID) {
            shareImage = ShareRenderer.draftOrderImage(title: list.title, picks: picks)
        }
        .onChange(of: driver.landings) { _, _ in
            guard let index = revealingIndex else { return }
            revealed = max(revealed, index + 1)
            let pick = order[index]
            AccessibilityNotification.Announcement("Pick \(pick.positionInAction): \(pick.nameSnapshot)").post()
        }
        .onDisappear { driver.reset() }
    }

    /// Who is still face down, for the reveal visual.
    private func poolMembers(for order: [DrawResult], from index: Int, list: DrawList) -> [PoolMember] {
        order.suffix(from: min(index, order.count)).map { pick in
            PoolMember(
                id: pick.entryID,
                name: pick.nameSnapshot,
                weight: pick.numeratorWeight,
                listIndex: list.index(of: pick.entryID) ?? pick.positionInAction - 1
            )
        }
        .sorted { $0.listIndex < $1.listIndex }
    }

    private func stageLabel(_ current: DrawResult?) -> String {
        guard let current else { return "Draft order ready. Nothing revealed yet." }
        if driver.phase.isAnimating { return "Revealing pick \(current.positionInAction). Double tap to skip." }
        return "Pick \(current.positionInAction): \(current.nameSnapshot)."
    }

    private func board(picks: [DrawResult], order: [DrawResult]) -> some View {
        let shown = Set(order.prefix(revealed).map(\.id))
        let latest = revealed > 0 ? order[revealed - 1].id : nil
        return ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(picks) { pick in
                        DraftSlot(pick: pick, isRevealed: shown.contains(pick.id), isLatest: pick.id == latest)
                            .id(pick.id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: revealed) { _, _ in
                guard let latest else { return }
                withAnimation { proxy.scrollTo(latest, anchor: .center) }
            }
        }
    }

    private func footer(_ list: DrawList, order: [DrawResult]) -> some View {
        VStack(spacing: 12) {
            RemovalToggleFooter(
                isOn: Binding(
                    get: { list.removeAfterSelection },
                    set: { isOn in appState.update(listID) { $0.setRemoveAfterSelection(isOn) } }
                ),
                removedCount: list.removedEntries.count,
                canUndo: list.canUndo,
                onRestoreAll: { appState.update(listID) { $0.restoreAllRemoved() } },
                onChooseRestore: { showingRestore = true },
                onUndo: {
                    driver.reset()
                    revealingIndex = nil
                    revealed = 0
                    appState.update(listID) { $0.undoLastDraw() }
                }
            )
            Rectangle().fill(Theme.stroke).frame(height: 1)
            if revealed < order.count {
                Button {
                    revealNext(list, order: order)
                } label: {
                    Label("Reveal pick #\(order[revealed].positionInAction)", systemImage: "sparkles")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(driver.phase.isAnimating)
                .accessibilityIdentifier("revealNextPickButton")
                Button("Reveal all") {
                    revealingIndex = order.count - 1
                    revealed = order.count
                    driver.showLanded()
                }
                .font(Theme.rounded(.footnote, weight: .semibold))
                .accessibilityIdentifier("revealAllButton")
            } else {
                Text("All \(order.count) picks revealed")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .accessibilityIdentifier("allPicksRevealed")
                Button {
                    driver.reset()
                    revealingIndex = nil
                    revealed = 0
                } label: {
                    Label("Replay the reveal", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26, style: .continuous)
                .fill(Theme.surface)
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func revealNext(_ list: DrawList, order: [DrawResult]) {
        guard revealed < order.count, !driver.phase.isAnimating else { return }
        revealingIndex = revealed
        driver.start(style: list.revealStyle, poolCount: order.count - revealed, reduceMotion: reduceMotion)
    }
}

private struct DraftSlot: View {
    let pick: DrawResult
    let isRevealed: Bool
    let isLatest: Bool

    var body: some View {
        HStack(spacing: 14) {
            Text("#\(pick.positionInAction)")
                .font(Theme.rounded(.headline, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(Theme.accent)
                .frame(minWidth: 40, alignment: .leading)
            if isRevealed {
                Text(pick.nameSnapshot)
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text("\(pick.chanceText) at pick")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.textSecondary)
            } else {
                Text("? ? ?")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textTertiary)
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 48)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isLatest ? Theme.accentSoft : Theme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(isLatest ? Theme.accent : Theme.stroke, lineWidth: isLatest ? 2 : 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(isRevealed ? "Pick \(pick.positionInAction): \(pick.nameSnapshot)" : "Pick \(pick.positionInAction): not revealed yet")
        .accessibilityIdentifier(isRevealed ? "draftSlotRevealed" : "draftSlotHidden")
    }
}
