import SwiftUI
import RandomizerCore

/// Saved lists, three ready-made examples you can draw from in seconds,
/// and New List.
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
                if appState.userLists.isEmpty, !appState.exampleLists.isEmpty {
                    examplesSection(title: "Try an example", subtitle: "Tap one to draw right away.") { list in
                        exampleCard(list)
                    }
                }
                Button(action: createList) {
                    Label("New List", systemImage: "plus")
                }
                .buttonStyle(PrimaryButtonStyle())
                .accessibilityIdentifier("newListButton")

                if !appState.userLists.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionTitle("Your lists")
                        ForEach(appState.userLists) { list in
                            listCard(list)
                        }
                    }
                    if !appState.exampleLists.isEmpty {
                        examplesSection(title: "Examples", subtitle: nil) { list in
                            listCard(list)
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

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(Theme.rounded(.headline, weight: .semibold))
            .foregroundStyle(Theme.textSecondary)
            .accessibilityAddTraits(.isHeader)
    }

    private func examplesSection<Card: View>(
        title: String,
        subtitle: String?,
        @ViewBuilder card: @escaping (DrawList) -> Card
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                sectionTitle(title)
                if let subtitle {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(Theme.textTertiary)
                }
            }
            ForEach(appState.exampleLists) { list in
                card(list)
            }
        }
    }

    private func exampleCard(_ list: DrawList) -> some View {
        Button {
            path.showDraw(list.id)
        } label: {
            ExampleCard(list: list)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("exampleCard")
        .contextMenu { listActions(list) }
    }

    private func listCard(_ list: DrawList) -> some View {
        Button {
            open(list)
        } label: {
            ListCard(list: list)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listCard")
        .contextMenu { listActions(list) }
    }

    @ViewBuilder
    private func listActions(_ list: DrawList) -> some View {
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

/// A built-in example: its reveal style drawn small, what it's for, and
/// the first few entries. One tap opens the draw screen.
private struct ExampleCard: View {
    let list: DrawList

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Theme.accentSoft)
                RevealStyleIcon(style: list.revealStyle)
                    .scaleEffect(0.9)
            }
            .frame(width: 64, height: 64)

            VStack(alignment: .leading, spacing: 3) {
                Text(list.revealStyle.title)
                    .font(Theme.rounded(.caption, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .textCase(.uppercase)
                Text(list.title)
                    .font(Theme.rounded(.title3, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(list.entries.prefix(4).map(\.name).joined(separator: " \u{00B7} ") + (list.entries.count > 4 ? " \u{2026}" : ""))
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "play.circle.fill")
                .font(.title)
                .foregroundStyle(Theme.accent)
        }
        .card(padding: 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the draw screen")
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
                        Tag(text: "Example", tint: Theme.caution)
                    }
                }
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                if let used = list.lastUsedAt {
                    Text("Used \(used.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .lineLimit(1)
                }
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
        "\(list.entries.count) \(list.entries.count == 1 ? "entry" : "entries") · \(list.revealStyle.title)"
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
