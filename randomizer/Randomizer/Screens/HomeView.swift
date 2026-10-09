import SwiftUI
import RandomizerCore

/// Saved lists, a first-run sample you can draw from in seconds, and New List.
struct HomeView: View {
    @Environment(AppState.self) private var appState
    @Binding var path: [Route]
    @State private var showingSettings = false
    @State private var renaming: DrawList?
    @State private var renameText = ""
    @State private var deleting: DrawList?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                if let notice = appState.storeNotice {
                    noticeBanner(notice)
                }
                if appState.userLists.isEmpty, let sample = appState.sampleList {
                    TryItCard(
                        list: sample,
                        onTry: { path.showDraw(sample.id) },
                        onCreate: createList
                    )
                }
                Button(action: createList) {
                    Label("New List", systemImage: "plus")
                }
                .buttonStyle(PrimaryButtonStyle())
                .accessibilityIdentifier("newListButton")

                if !appState.userLists.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Your lists")
                            .font(Theme.rounded(.headline, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                        ForEach(appState.userLists) { list in
                            listCard(list)
                        }
                        if let sample = appState.sampleList {
                            listCard(sample)
                        }
                    }
                }

                if appState.lists.isEmpty {
                    emptyState
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
        .background(Theme.background.ignoresSafeArea())
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")
                .accessibilityIdentifier("settingsButton")
            }
        }
        .toolbarBackground(Theme.background, for: .navigationBar)
        .sheet(isPresented: $showingSettings) {
            SettingsView()
        }
        .alert("Rename list", isPresented: renameBinding) {
            TextField("List name", text: $renameText)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                if let renaming {
                    try? appState.update(renaming.id) { try $0.rename(to: renameText) }
                }
            }
        }
        .confirmationDialog(
            "Delete \u{201C}\(deleting?.title ?? "")\u{201D}?",
            isPresented: deleteBinding,
            titleVisibility: .visible
        ) {
            Button("Delete list", role: .destructive) {
                if let deleting { appState.delete(deleting.id) }
            }
        } message: {
            Text("Its entries, weights and results are removed from this iPhone.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Randomizer")
                .font(.system(size: 40, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
            Text("Spin & Reveal")
                .font(Theme.rounded(.title3, weight: .semibold))
                .foregroundStyle(Theme.accentGradient)
        }
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func noticeBanner(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.caution)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Theme.textPrimary)
            Spacer(minLength: 0)
            Button {
                appState.dismissStoreNotice()
            } label: {
                Image(systemName: "xmark")
            }
            .accessibilityLabel("Dismiss")
        }
        .card(padding: 14)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "circle.circle")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
            Text("No lists yet")
                .font(Theme.rounded(.title3, weight: .bold))
            Text("Make a list of people or things, then spin, reel, roll or reveal a winner.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private func listCard(_ list: DrawList) -> some View {
        Button {
            open(list)
        } label: {
            ListCard(list: list)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listCard")
        .contextMenu {
            Button {
                path.showEditor(list.id)
            } label: {
                Label("Edit list", systemImage: "pencil")
            }
            Button {
                renameText = list.title
                renaming = list
            } label: {
                Label("Rename", systemImage: "character.cursor.ibeam")
            }
            Button {
                appState.duplicate(list.id)
            } label: {
                Label("Duplicate", systemImage: "plus.square.on.square")
            }
            Button(role: .destructive) {
                deleting = list
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func open(_ list: DrawList) {
        if list.startProblem == nil {
            path.showDraw(list.id)
        } else {
            path.showEditor(list.id)
        }
    }

    private func createList() {
        let list = appState.createList()
        path.append(.editor(list.id))
    }

    private var renameBinding: Binding<Bool> {
        Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
    }
}

/// First-run hero: draw from the sample right away, or start your own.
private struct TryItCard: View {
    let list: DrawList
    let onTry: () -> Void
    let onCreate: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                MiniWheel(count: list.entries.count)
                    .frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Try it now")
                        .font(Theme.rounded(.caption, weight: .bold))
                        .foregroundStyle(Theme.accent)
                        .textCase(.uppercase)
                    Text(list.title)
                        .font(Theme.rounded(.title2, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(list.entries.map(\.name).joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                }
            }
            HStack(spacing: 10) {
                Button(action: onTry) {
                    Label("Try a draw", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle(tint: .white, fill: Theme.accentDeep))
                .accessibilityIdentifier("tryDrawButton")
                Button(action: onCreate) {
                    Text("Create my list")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())
                .accessibilityIdentifier("createMyListButton")
            }
        }
        .card(padding: 18)
    }
}

/// A saved list at a glance: name, size, reveal style and last use.
struct ListCard: View {
    let list: DrawList

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.accentSoft)
                Image(systemName: list.revealStyle.systemImage)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.accent)
            }
            .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(list.title)
                        .font(Theme.rounded(.headline, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    if list.isSample {
                        Tag(text: "Sample", tint: Theme.caution)
                    }
                }
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                if list.hasActiveSession {
                    Text(sessionLine)
                        .font(.caption)
                        .foregroundStyle(Theme.accent)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
        }
        .card(padding: 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts = ["\(list.entries.count) \(list.entries.count == 1 ? "entry" : "entries")", list.revealStyle.title]
        if let used = list.lastUsedAt {
            parts.append("Used \(used.formatted(.relative(presentation: .named)))")
        }
        return parts.joined(separator: " · ")
    }

    private var sessionLine: String {
        let draws = list.activeResults.count
        let removed = list.removedEntryIDs.count
        var parts = ["\(draws) drawn"]
        if removed > 0 { parts.append("\(removed) removed") }
        return parts.joined(separator: " · ")
    }
}

/// A tiny static wheel used as an icon.
struct MiniWheel: View {
    let count: Int

    var body: some View {
        Canvas { context, size in
            let n = max(count, 2)
            let radius = min(size.width, size.height) / 2
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            for index in 0..<n {
                let start = Angle.degrees(Double(index) / Double(n) * 360 - 90)
                let end = Angle.degrees(Double(index + 1) / Double(n) * 360 - 90)
                var path = Path()
                path.move(to: center)
                path.addArc(center: center, radius: radius, startAngle: start, endAngle: end, clockwise: false)
                path.closeSubpath()
                context.fill(path, with: .color(Theme.paletteColor(index, count: n)))
            }
            let hub = Path(ellipseIn: CGRect(x: center.x - radius * 0.22, y: center.y - radius * 0.22, width: radius * 0.44, height: radius * 0.44))
            context.fill(hub, with: .color(Theme.background))
        }
        .accessibilityHidden(true)
    }
}
