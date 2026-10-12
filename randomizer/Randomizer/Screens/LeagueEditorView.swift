import SwiftUI
import RandomizerCore

/// League name, last season's standings (worst first), the lottery format
/// and the reveal style, then Go to Lottery.
struct LeagueEditorView: View {
    let leagueID: UUID
    @Binding var path: [Route]
    @Environment(AppState.self) private var appState
    @State private var titleDraft = ""
    @State private var newName = ""
    @State private var showingPaste = false
    @State private var showingOdds = false
    @State private var confirmClear = false
    @State private var reordering = false
    @State private var addMessage: String?
    @State private var keyboardVisible = false
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case title
        case newTeam
    }

    var body: some View {
        if let league = appState.league(leagueID) {
            editor(league)
        } else {
            ContentUnavailableView("League not found", systemImage: "questionmark.folder")
        }
    }

    private func editor(_ league: League) -> some View {
        List {
            Section {
                TextField("League name", text: $titleDraft)
                    .font(Theme.rounded(.title2, weight: .bold))
                    .focused($focus, equals: .title)
                    .submitLabel(.done)
                    .onSubmit(commitTitle)
                    .accessibilityIdentifier("leagueTitleField")
            }
            .listRowBackground(Theme.surface)

            standingsSection(league)

            Section {
                Button {
                    showingPaste = true
                } label: {
                    Label("Paste teams", systemImage: "doc.on.clipboard")
                }
                .disabled(league.isFull)
                .accessibilityIdentifier("pasteTeamsButton")
                if !league.teams.isEmpty {
                    Button(role: .destructive) {
                        confirmClear = true
                    } label: {
                        Label("Remove all teams", systemImage: "trash")
                    }
                }
            }
            .listRowBackground(Theme.surface)

            typeSection(league)
            if league.type == .pro, league.teams.count >= Limits.minTeams {
                proFormatSection(league)
            }

            Section {
                Picker("Reveal", selection: Binding(
                    get: { league.revealStyle },
                    set: { style in appState.update(leagueID) { $0.setRevealStyle(style) } }
                )) {
                    ForEach(RevealStyle.allCases, id: \.self) { style in
                        Label(style.title, systemImage: style.systemImage).tag(style)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("revealStylePicker")
            } header: {
                Text("Reveal")
            } footer: {
                Text("Only changes how each pick is shown. Who gets which pick is decided before the reveal.")
            }
            .listRowBackground(Theme.surface)
        }
        .themedList()
        .scrollDismissesKeyboard(.interactively)
        .environment(\.editMode, .constant(reordering ? .active : .inactive))
        .navigationTitle("Edit league")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(reordering ? "Done" : "Reorder") {
                    dismissKeyboard()
                    withAnimation { reordering.toggle() }
                }
                .disabled(league.teams.count < 2)
                .accessibilityIdentifier("reorderButton")
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { dismissKeyboard() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            // While typing, the bar would float over the rows above the
            // keyboard and can't be used anyway, so it steps aside.
            if !keyboardVisible {
                goBar(league)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
        .sheet(isPresented: $showingPaste) {
            PasteNamesSheet(leagueID: leagueID)
        }
        .sheet(isPresented: $showingOdds) {
            OddsView(leagueID: leagueID)
        }
        .confirmationDialog("Remove every team?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Remove all teams", role: .destructive) {
                appState.update(leagueID) { $0.clearTeams() }
            }
        } message: {
            Text("The latest draft order keeps the names it was drawn with.")
        }
        .onAppear {
            titleDraft = league.title == AppState.newLeagueTitle ? "" : league.title
            if league.teams.isEmpty { focus = .newTeam }
        }
        .onDisappear {
            commitTitle()
            appState.discardIfUntouched(leagueID)
        }
    }

    // MARK: Sections

    private func standingsSection(_ league: League) -> some View {
        Section {
            ForEach(Array(league.teams.enumerated()), id: \.element.id) { index, team in
                TeamRow(
                    team: team,
                    standing: index + 1,
                    status: league.status(atIndex: index),
                    chance: league.firstPickChanceText(of: team.id),
                    onRename: { name in try? appState.update(leagueID) { try $0.renameTeam(team.id, to: name) } }
                )
            }
            .onDelete { offsets in
                let ids = Set(offsets.map { league.teams[$0].id })
                appState.update(leagueID) { $0.deleteTeams(ids) }
            }
            .onMove { source, destination in
                appState.update(leagueID) { $0.moveTeams(fromOffsets: source, toOffset: destination) }
            }

            if !reordering {
                addRow(league)
            }
        } header: {
            HStack {
                Text("Last season: worst first")
                Spacer()
                Text("\(league.teams.count)/\(Limits.maxTeams)")
                    .monospacedDigit()
            }
        } footer: {
            standingsFooter(league)
        }
        .listRowBackground(Theme.surface)
    }

    private func addRow(_ league: League) -> some View {
        HStack(spacing: 10) {
            TextField(league.isFull ? "League is full (\(Limits.maxTeams))" : "Add a team", text: $newName)
                .focused($focus, equals: .newTeam)
                .submitLabel(.next)
                .onSubmit(addTeam)
                .disabled(league.isFull)
                .accessibilityIdentifier("addTeamField")
            Button(action: addTeam) {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
            }
            .disabled(NameRules.clean(newName) == nil || league.isFull)
            .accessibilityLabel("Add team")
            .accessibilityIdentifier("addTeamButton")
        }
    }

    @ViewBuilder
    private func standingsFooter(_ league: League) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let message = addMessage {
                Text(message).foregroundStyle(Theme.caution)
            }
            if let duplicate = league.duplicateNames.first {
                Label(
                    league.duplicateNames.count == 1
                        ? "More than one team is named \u{201C}\(duplicate)\u{201D}. Each is its own team with its own chance."
                        : "Some teams share a name. Each is its own team with its own chance.",
                    systemImage: "person.2"
                )
                .foregroundStyle(Theme.caution)
            }
            Text("The last-place team goes first. Tap Reorder to drag teams into last season's finish.")
            if league.latestRun != nil {
                Text("Changes apply to the next run. The latest draft order keeps the names and odds it was drawn with.")
            }
        }
        .font(.footnote)
    }

    private func typeSection(_ league: League) -> some View {
        Section {
            ForEach(LotteryType.allCases, id: \.self) { type in
                TypeOption(type: type, isSelected: league.type == type) {
                    appState.update(leagueID) { $0.setType(type) }
                }
            }
            Button {
                showingOdds = true
            } label: {
                Label("View odds", systemImage: "chart.bar.xaxis")
            }
            .disabled(league.teams.count < Limits.minTeams)
            .accessibilityIdentifier("viewOddsButton")
        } header: {
            Text("Lottery type")
        } footer: {
            Text(league.type.explanation)
        }
        .listRowBackground(Theme.surface)
    }

    private func proFormatSection(_ league: League) -> some View {
        Section {
            Stepper(
                value: Binding(get: { league.playoffTeams }, set: { count in appState.update(leagueID) { $0.setPlayoffTeams(count) } }),
                in: 0...max(league.teams.count - Limits.minTeams, 0)
            ) {
                FormatStepperLabel(title: "Playoff teams", value: "\(league.playoffTeams)")
            }
            .accessibilityIdentifier("playoffTeamsStepper")
            Stepper(
                value: Binding(get: { league.drawnPicks }, set: { count in appState.update(leagueID) { $0.setDrawnPicks(count) } }),
                in: 1...max(league.lotteryTeams, 1)
            ) {
                FormatStepperLabel(
                    title: "Picks drawn",
                    value: league.drawnPicks == league.lotteryTeams ? "All \(league.drawnPicks)" : "Top \(league.drawnPicks)"
                )
            }
            .accessibilityIdentifier("drawnPicksStepper")
        } header: {
            Text("Pro Lottery format")
        } footer: {
            // Word joiners keep a range like "7–10" on one line.
            Text(formatExplanation(league).replacingOccurrences(of: "\u{2013}", with: "\u{2060}\u{2013}\u{2060}"))
        }
        .listRowBackground(Theme.surface)
    }

    private func formatExplanation(_ league: League) -> String {
        let lottery = league.lotteryTeams
        let drawn = league.drawnPicks
        let total = league.teams.count
        var text = lottery == total
            ? "Every team is in the lottery."
            : "The \(lottery) teams that missed the playoffs are in the lottery; the \(total - lottery) playoff teams pick \(lottery + 1)\u{2013}\(total) by standings."
        if drawn < lottery {
            text += " The lottery draws picks 1\u{2013}\(drawn), so a team can fall at most \(drawn) spots; the rest pick next, worst first."
        } else {
            text += " The lottery draws all \(lottery) of its picks."
        }
        return text
    }

    private func goBar(_ league: League) -> some View {
        VStack(spacing: 8) {
            if let problem = league.runProblem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .accessibilityIdentifier("runProblem")
            }
            Button {
                commitTitle()
                path.showLottery(leagueID)
            } label: {
                Label("Go to Lottery", systemImage: "sparkles")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(league.runProblem != nil)
            .accessibilityIdentifier("goToLotteryButton")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(Theme.background.ignoresSafeArea())
    }

    // MARK: Actions

    private func addTeam() {
        guard NameRules.clean(newName) != nil else { return }
        do {
            try appState.update(leagueID) { try $0.addTeam(named: newName) }
            newName = ""
            addMessage = nil
        } catch LeagueEditError.leagueFull {
            addMessage = "Leagues hold up to \(Limits.maxTeams) teams."
        } catch {
            addMessage = nil
        }
        DispatchQueue.main.async { focus = .newTeam }
    }

    private func commitTitle() {
        guard appState.league(leagueID) != nil else { return }
        guard NameRules.cleanTitle(titleDraft) != nil else { return }
        try? appState.update(leagueID) { try $0.rename(to: titleDraft) }
    }
}

private struct FormatStepperLabel: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .font(Theme.rounded(.body, weight: .bold))
                .foregroundStyle(Theme.accent)
                .monospacedDigit()
        }
    }
}

/// One team in the standings. The name is a local draft committed on
/// return or when focus leaves, so typing a space never gets trimmed
/// mid-word.
struct TeamRow: View {
    let team: Team
    let standing: Int
    let status: TeamStatus
    let chance: String
    let onRename: (String) -> Void

    @State private var draft = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            StandingBadge(standing: standing, size: 28)
                .accessibilityLabel("Finish \(standing)")
            TextField("Team name", text: $draft)
                .focused($nameFocused)
                .submitLabel(.done)
                .onSubmit(commit)
                .foregroundStyle(status == .inLottery ? Theme.textPrimary : Theme.textSecondary)
            Spacer(minLength: 4)
            switch status {
            case .inLottery:
                Text(chance)
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(Theme.textSecondary)
            case .notInLottery:
                Tag(text: "Playoffs", tint: Theme.textTertiary)
            }
        }
        .onAppear { draft = team.name }
        .onChange(of: team.name) { _, name in
            if !nameFocused { draft = name }
        }
        .onChange(of: nameFocused) { _, focused in
            if !focused { commit() }
        }
    }

    private func commit() {
        guard NameRules.clean(draft) != nil else {
            draft = team.name
            return
        }
        if draft != team.name { onRename(draft) }
    }
}

/// One of the three lottery types, as a selectable row.
private struct TypeOption: View {
    let type: LotteryType
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: type.systemImage)
                    .font(.title3)
                    .foregroundStyle(isSelected ? Theme.accent : Theme.textSecondary)
                    .frame(width: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(type.title)
                        .font(Theme.rounded(.headline, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(type.tagline)
                        .font(.footnote)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Theme.accent : Theme.textTertiary)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("lotteryType-\(type.rawValue)")
    }
}
