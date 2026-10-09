import SwiftUI
import RandomizerCore

/// This session's results in draw order, with the odds each winner had at
/// the moment of their draw.
struct ResultsHistoryView: View {
    let listID: UUID
    var onOpenDraftOrder: () -> Void
    var onNewSession: () -> Void
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var showOdds = true
    @State private var confirmNewSession = false
    @State private var shareImage: Image?

    var body: some View {
        NavigationStack {
            Group {
                if let list = appState.list(listID) {
                    content(list)
                } else {
                    ContentUnavailableView("List not found", systemImage: "questionmark.folder")
                }
            }
            .navigationTitle("Results")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("historyDoneButton")
                }
                if let list = appState.list(listID), !list.activeResults.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            ShareLink(item: ResultsExporter.resultsText(
                                title: list.title,
                                results: list.activeResults,
                                sessionEdited: list.sessionEdited,
                                includeChances: showOdds
                            )) {
                                Label("Share as text", systemImage: "text.alignleft")
                            }
                            if let shareImage {
                                ShareLink(item: shareImage, preview: SharePreview("\(list.title) results", image: shareImage)) {
                                    Label("Share as image", systemImage: "photo")
                                }
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .accessibilityLabel("Share results")
                        .accessibilityIdentifier("shareResultsMenu")
                    }
                }
            }
        }
    }

    private func content(_ list: DrawList) -> some View {
        List {
            if list.activeResults.isEmpty {
                ContentUnavailableView(
                    "No draws yet",
                    systemImage: "clock",
                    description: Text("Results appear here in draw order, with the chance each winner had at that moment.")
                )
                .listRowBackground(Color.clear)
            } else {
                if list.sessionEdited {
                    Label("Edited session: a draw was undone.", systemImage: "pencil.circle")
                        .font(.footnote)
                        .foregroundStyle(Theme.caution)
                        .listRowBackground(Theme.surface)
                }
                ForEach(Array(list.actions.enumerated()), id: \.offset) { _, action in
                    Section {
                        ForEach(action) { result in
                            HistoryRow(result: result, showOdds: showOdds)
                        }
                        if action.first?.kind == .draftOrder, action.first?.actionID == list.latestDraftOrder?.first?.actionID {
                            Button {
                                dismiss()
                                onOpenDraftOrder()
                            } label: {
                                Label("Open draft order reveal", systemImage: "list.number")
                            }
                        }
                    } header: {
                        Text(header(for: action))
                    }
                    .listRowBackground(Theme.surface)
                }
                Section {
                    Toggle("Show odds at time of draw", isOn: $showOdds)
                        .tint(Theme.accent)
                } footer: {
                    Text("Each chance is the winner's share of the pool's total weight when they were drawn. Later edits don't change it.")
                }
                .listRowBackground(Theme.surface)
            }

            Section {
                Button(role: .destructive) {
                    confirmNewSession = true
                } label: {
                    Label("New session", systemImage: "arrow.counterclockwise")
                }
                .disabled(!list.hasActiveSession)
                .accessibilityIdentifier("historyNewSessionButton")
            } footer: {
                Text("Makes everyone eligible again and clears these results. Your list, weights and settings stay.")
            }
            .listRowBackground(Theme.surface)
        }
        .themedList()
        .task(id: list.activeResults.count) {
            shareImage = ShareRenderer.resultsImage(for: list)
        }
        .confirmationDialog("Start a new session?", isPresented: $confirmNewSession, titleVisibility: .visible) {
            Button("New session", role: .destructive) {
                onNewSession()
                dismiss()
            }
        } message: {
            Text("Share these results first if you need them.")
        }
    }

    private func header(for action: [DrawResult]) -> String {
        guard let first = action.first else { return "" }
        let time = first.drawnAt.formatted(date: .omitted, time: .shortened)
        switch first.kind {
        case .single:
            return "Draw \u{00B7} \(time)"
        case .batch:
            return "Draw \(action.count) \u{00B7} \(first.removedAfterDraw ? "unique winners" : "repeats possible") \u{00B7} \(time)"
        case .draftOrder:
            return "Draft order \u{00B7} \(action.count) picks \u{00B7} \(time)"
        }
    }
}

private struct HistoryRow: View {
    let result: DrawResult
    let showOdds: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(result.kind == .draftOrder ? "#\(result.positionInAction)" : "\(result.ordinal).")
                .font(Theme.rounded(.subheadline, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.accent)
                .frame(minWidth: 30, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(result.nameSnapshot)
                    .font(Theme.rounded(.body, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                HStack(spacing: 6) {
                    Text(result.drawnAt.formatted(date: .omitted, time: .standard))
                    if showOdds {
                        Text("\u{00B7} \(result.chanceText) chance (\(result.numeratorWeight) of \(result.totalEligibleWeight))")
                    }
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
            if result.removedAfterDraw {
                Tag(text: "Removed", tint: Theme.textTertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("historyRow")
    }
}
