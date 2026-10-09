import SwiftUI
import RandomizerCore

/// Name, entries, odds and reveal style, then Start Drawing.
struct ListEditorView: View {
    let listID: UUID
    @Binding var path: [Route]
    @Environment(AppState.self) private var appState
    @State private var titleDraft = ""
    @State private var newName = ""
    @State private var showingPaste = false
    @State private var showingOdds = false
    @State private var confirmClear = false
    @State private var reordering = false
    @State private var addMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case title
        case newEntry
    }

    var body: some View {
        if let list = appState.list(listID) {
            editor(list)
        } else {
            ContentUnavailableView("List not found", systemImage: "questionmark.folder")
        }
    }

    private func editor(_ list: DrawList) -> some View {
        List {
            Section {
                TextField("List name", text: $titleDraft)
                    .font(Theme.rounded(.title2, weight: .bold))
                    .focused($focus, equals: .title)
                    .submitLabel(.done)
                    .onSubmit(commitTitle)
                    .accessibilityIdentifier("listTitleField")
            }
            .listRowBackground(Theme.surface)

            oddsSection(list)
            entriesSection(list)

            Section {
                Button {
                    showingPaste = true
                } label: {
                    Label("Paste names", systemImage: "doc.on.clipboard")
                }
                .disabled(list.isFull)
                .accessibilityIdentifier("pasteNamesButton")
                if !list.entries.isEmpty {
                    Button(role: .destructive) {
                        confirmClear = true
                    } label: {
                        Label("Clear list", systemImage: "trash")
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Section {
                RevealStylePicker(selection: Binding(
                    get: { list.revealStyle },
                    set: { style in appState.update(listID) { $0.setRevealStyle(style) } }
                ))
                .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
            } header: {
                Text("Reveal style")
            } footer: {
                Text("Only changes how the result is shown. Odds, entries and Remove after selection stay the same.")
            }
            .listRowBackground(Theme.surface)
        }
        .themedList()
        .environment(\.editMode, .constant(reordering ? .active : .inactive))
        .navigationTitle("Edit list")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(reordering ? "Done" : "Reorder") {
                    dismissKeyboard()
                    withAnimation { reordering.toggle() }
                }
                .disabled(list.entries.count < 2)
                .accessibilityIdentifier("reorderButton")
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { dismissKeyboard() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            startBar(list)
        }
        .sheet(isPresented: $showingPaste) {
            PasteNamesSheet(listID: listID)
        }
        .sheet(isPresented: $showingOdds) {
            OddsEditorView(listID: listID)
        }
        .confirmationDialog("Clear every entry?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear list", role: .destructive) {
                appState.update(listID) { $0.clearEntries() }
            }
        } message: {
            Text("Past results keep the names they were drawn with.")
        }
        .onAppear {
            titleDraft = list.title
            if list.entries.isEmpty { focus = .newEntry }
        }
        .onDisappear {
            commitTitle()
            appState.discardIfUntouched(listID)
        }
    }

    // MARK: Sections

    private func oddsSection(_ list: DrawList) -> some View {
        Section {
            Picker("Odds", selection: Binding(
                get: { list.oddsMode },
                set: { mode in appState.update(listID) { $0.setOddsMode(mode) } }
            )) {
                ForEach(OddsMode.allCases, id: \.self) { mode in
                    Text(mode.shortTitle).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("oddsModePicker")
            Text(list.oddsMode.explanation)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            Button {
                showingOdds = true
            } label: {
                Label("View odds", systemImage: "chart.bar.xaxis")
            }
            .disabled(list.entries.isEmpty)
            .accessibilityIdentifier("viewOddsButton")
        } header: {
            Text("Odds")
        }
        .listRowBackground(Theme.surface)
    }

    private func entriesSection(_ list: DrawList) -> some View {
        Section {
            ForEach(Array(list.entries.enumerated()), id: \.element.id) { index, entry in
                EntryRow(
                    entry: entry,
                    rank: index + 1,
                    mode: list.oddsMode,
                    weight: list.effectiveWeight(atIndex: index),
                    chance: list.chanceText(of: entry.id),
                    status: list.status(of: entry.id),
                    onRename: { name in try? appState.update(listID) { try $0.renameEntry(entry.id, to: name) } },
                    onSetWeight: { weight in appState.update(listID) { $0.setWeight(weight, for: entry.id) } }
                )
            }
            .onDelete { offsets in
                let ids = Set(offsets.map { list.entries[$0].id })
                appState.update(listID) { $0.deleteEntries(ids) }
            }
            .onMove { source, destination in
                appState.update(listID) { $0.moveEntries(fromOffsets: source, toOffset: destination) }
            }

            if !reordering {
                addRow(list)
            }
        } header: {
            HStack {
                Text(list.oddsMode == .reverseStandings ? "Standings: worst first" : "Entries")
                Spacer()
                Text("\(list.entries.count)/\(Limits.maxEntries)")
                    .monospacedDigit()
            }
        } footer: {
            entriesFooter(list)
        }
        .listRowBackground(Theme.surface)
    }

    private func addRow(_ list: DrawList) -> some View {
        HStack(spacing: 10) {
            TextField(list.isFull ? "List is full (200)" : "Add a name", text: $newName)
                .focused($focus, equals: .newEntry)
                .submitLabel(.next)
                .onSubmit(addEntry)
                .disabled(list.isFull)
                .accessibilityIdentifier("addEntryField")
            Button(action: addEntry) {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
            }
            .disabled(NameRules.clean(newName) == nil || list.isFull)
            .accessibilityLabel("Add entry")
            .accessibilityIdentifier("addEntryButton")
        }
    }

    @ViewBuilder
    private func entriesFooter(_ list: DrawList) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let message = addMessage {
                Text(message).foregroundStyle(Theme.caution)
            }
            if let duplicate = list.duplicateNames.first {
                Label(
                    list.duplicateNames.count == 1
                        ? "More than one entry is named \u{201C}\(duplicate)\u{201D}. Each is a separate participant with its own chance."
                        : "Some entries share a name. Each is a separate participant with its own chance.",
                    systemImage: "person.2"
                )
                .foregroundStyle(Theme.caution)
            }
            if list.oddsMode == .reverseStandings {
                Text("Drag to reorder (tap Reorder). Weights update as the order changes.")
            }
            if list.hasActiveSession {
                Text("Edits apply to future draws. Past results keep the names and odds they were drawn with.")
            }
        }
        .font(.footnote)
    }

    private func startBar(_ list: DrawList) -> some View {
        VStack(spacing: 8) {
            if let problem = list.startProblem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .accessibilityIdentifier("startProblem")
            }
            Button {
                commitTitle()
                path.showDraw(listID)
            } label: {
                Label("Start Drawing", systemImage: "play.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(list.startProblem != nil)
            .accessibilityIdentifier("startDrawingButton")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(Theme.background.opacity(0.96).ignoresSafeArea())
    }

    // MARK: Actions

    private func addEntry() {
        guard NameRules.clean(newName) != nil else { return }
        do {
            try appState.update(listID) { try $0.addEntry(named: newName) }
            newName = ""
            addMessage = nil
        } catch ListEditError.listFull {
            addMessage = "Lists hold up to \(Limits.maxEntries) entries."
        } catch {
            addMessage = nil
        }
        DispatchQueue.main.async { focus = .newEntry }
    }

    private func commitTitle() {
        guard let list = appState.list(listID) else { return }
        if NameRules.cleanTitle(titleDraft) == nil {
            titleDraft = list.title
            return
        }
        try? appState.update(listID) { try $0.rename(to: titleDraft) }
    }
}

/// One editable entry. The name is a local draft committed on return or
/// when focus leaves, so typing a space never gets trimmed mid-word.
struct EntryRow: View {
    let entry: DrawEntry
    let rank: Int
    let mode: OddsMode
    let weight: Int
    let chance: String
    let status: EntryStatus
    let onRename: (String) -> Void
    let onSetWeight: (Int) -> Void

    @State private var draft = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            if mode == .reverseStandings {
                Text("\(rank)")
                    .font(Theme.rounded(.subheadline, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.accent)
                    .frame(minWidth: 26)
                    .accessibilityLabel("Rank \(rank)")
            }
            TextField("Name", text: $draft)
                .focused($nameFocused)
                .submitLabel(.done)
                .onSubmit(commit)
                .foregroundStyle(status == .eligible ? Theme.textPrimary : Theme.textSecondary)
            Spacer(minLength: 4)
            statusTag
            trailing
        }
        .onAppear { draft = entry.name }
        .onChange(of: entry.name) { _, name in
            if !nameFocused { draft = name }
        }
        .onChange(of: nameFocused) { _, focused in
            if !focused { commit() }
        }
    }

    @ViewBuilder
    private var statusTag: some View {
        switch status {
        case .removed:
            Tag(text: "Removed", tint: Theme.caution)
        case .excluded:
            Tag(text: "Excluded", tint: Theme.textTertiary)
        case .eligible:
            EmptyView()
        }
    }

    @ViewBuilder
    private var trailing: some View {
        switch mode {
        case .equal:
            Text(chance)
                .font(.footnote.monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
        case .customWeighted:
            HStack(spacing: 6) {
                TextField("1", value: Binding(get: { entry.weight }, set: { onSetWeight($0) }), format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 52)
                    .padding(.vertical, 4)
                    .padding(.horizontal, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Theme.surfaceRaised))
                    .accessibilityLabel("Weight for \(entry.name)")
                Text(chance)
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(Theme.textSecondary)
                    .frame(minWidth: 52, alignment: .trailing)
            }
        case .reverseStandings:
            Text("W \(weight) · \(chance)")
                .font(.footnote.monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private func commit() {
        guard NameRules.clean(draft) != nil else {
            draft = entry.name
            return
        }
        if draft != entry.name { onRename(draft) }
    }
}

/// Compact previews of the four reveal styles.
struct RevealStylePicker: View {
    @Binding var selection: RevealStyle

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            ForEach(RevealStyle.allCases, id: \.self) { style in
                Button {
                    selection = style
                } label: {
                    VStack(spacing: 8) {
                        RevealStyleIcon(style: style)
                            .frame(height: 44)
                        Text(style.title)
                            .font(Theme.rounded(.footnote, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(selection == style ? Theme.accentSoft : Theme.surfaceRaised)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(selection == style ? Theme.accent : Color.clear, lineWidth: 2)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == style ? .isSelected : [])
                .accessibilityIdentifier("revealStyle-\(style.rawValue)")
            }
        }
    }
}

/// A small drawing of each style, not just an SF Symbol.
struct RevealStyleIcon: View {
    let style: RevealStyle

    var body: some View {
        switch style {
        case .wheel:
            MiniWheel(count: 8)
                .frame(width: 44, height: 44)
        case .reel:
            VStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { row in
                    Capsule()
                        .fill(row == 1 ? Theme.accent : Theme.textTertiary)
                        .frame(width: row == 1 ? 46 : 34, height: row == 1 ? 10 : 6)
                }
            }
        case .lotteryBalls:
            HStack(spacing: -6) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Theme.paletteColor(index * 3))
                        .frame(width: 24, height: 24)
                        .overlay(Circle().fill(.white).frame(width: 11, height: 11))
                }
            }
        case .mysteryCard:
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Theme.accentGradient)
                .frame(width: 32, height: 42)
                .overlay(Text("?").font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(.white))
        }
    }
}
