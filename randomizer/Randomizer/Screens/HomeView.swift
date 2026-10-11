import SwiftUI
import RandomizerCore

/// Your leagues, the sample league you can run in seconds, and New League.
struct HomeView: View {
    @Environment(AppState.self) private var appState
    @Binding var path: [Route]
    @State private var showingSettings = false
    @State private var renaming: League?
    @State private var renameText = ""
    @State private var deleting: League?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                if let notice = appState.storeNotice {
                    noticeBanner(notice)
                }
                if appState.userLeagues.isEmpty, let sample = appState.sampleLeague {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionTitle("Try it with a sample league")
                        sampleCard(sample)
                    }
                }
                Button(action: createLeague) {
                    Label("New League", systemImage: "plus")
                }
                .buttonStyle(PrimaryButtonStyle())
                .accessibilityIdentifier("newLeagueButton")

                if !appState.userLeagues.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionTitle("Your leagues")
                        ForEach(appState.userLeagues) { league in
                            leagueCard(league)
                        }
                    }
                    if let sample = appState.sampleLeague {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionTitle("Sample")
                            leagueCard(sample)
                        }
                    }
                }

                if appState.leagues.isEmpty {
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
        .alert("Rename league", isPresented: renameBinding) {
            TextField("League name", text: $renameText)
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
            Button("Delete league", role: .destructive) {
                if let deleting { appState.delete(deleting.id) }
            }
        } message: {
            Text("Its teams, odds and draft order are removed from this iPhone.")
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            BallCluster()
                .frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(AppInfo.name)
                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("For your fantasy league")
                    .font(Theme.rounded(.headline, weight: .semibold))
                    .foregroundStyle(Theme.accentGradient)
            }
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
            BallCluster()
                .frame(width: 56, height: 56)
            Text("No leagues yet")
                .font(Theme.rounded(.title3, weight: .bold))
            Text("Add your league's teams in last season's order, pick a lottery format, and run it live.")
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

    private func sampleCard(_ league: League) -> some View {
        Button {
            path.showLottery(league.id)
        } label: {
            SampleCard(league: league)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("sampleLeagueCard")
        .contextMenu { leagueActions(league) }
    }

    private func leagueCard(_ league: League) -> some View {
        Button {
            open(league)
        } label: {
            LeagueCard(league: league)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("leagueCard")
        .contextMenu { leagueActions(league) }
    }

    @ViewBuilder
    private func leagueActions(_ league: League) -> some View {
        Button {
            path.showEditor(league.id)
        } label: {
            Label("Edit league", systemImage: "pencil")
        }
        Button {
            renameText = league.title
            renaming = league
        } label: {
            Label("Rename", systemImage: "character.cursor.ibeam")
        }
        Button {
            appState.duplicate(league.id)
        } label: {
            Label("Duplicate", systemImage: "plus.square.on.square")
        }
        Button(role: .destructive) {
            deleting = league
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private func open(_ league: League) {
        if league.runProblem == nil || league.latestRun != nil {
            path.showLottery(league.id)
        } else {
            path.showEditor(league.id)
        }
    }

    private func createLeague() {
        let league = appState.createLeague()
        path.append(.editor(league.id))
    }

    private var renameBinding: Binding<Bool> {
        Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
    }
}

/// The sample league: its format and first few teams. One tap opens its
/// lottery.
private struct SampleCard: View {
    let league: League

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Theme.accentSoft)
                BallCluster()
                    .padding(10)
            }
            .frame(width: 64, height: 64)

            VStack(alignment: .leading, spacing: 3) {
                Text("\(league.teams.count) teams \u{00B7} \(league.type.title)")
                    .font(Theme.rounded(.caption, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .textCase(.uppercase)
                Text(league.title)
                    .font(Theme.rounded(.title3, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(league.teams.prefix(3).map(\.name).joined(separator: " \u{00B7} ") + (league.teams.count > 3 ? " \u{2026}" : ""))
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
        .accessibilityHint("Opens the lottery")
    }
}

/// A saved league at a glance: name, size, format and the latest run.
struct LeagueCard: View {
    let league: League

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.accentSoft)
                Text("\(league.teams.count)")
                    .font(Theme.rounded(.title3, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(Theme.accent)
            }
            .frame(width: 48, height: 48)
            .accessibilityLabel("\(league.teams.count) teams")

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(league.title)
                        .font(Theme.rounded(.headline, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    if league.isSample {
                        Tag(text: "Sample", tint: Theme.caution)
                    }
                }
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                if let run = league.latestRun {
                    Text(runLine(run))
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
        guard league.teams.count >= Limits.minTeams else { return "Add teams to run the lottery" }
        switch league.type {
        case .pro: return "\(league.type.title) \u{00B7} worst \(league.lotteryTeams) in, top \(league.drawnPicks) drawn"
        case .longShot: return "\(league.type.title) \u{00B7} everyone's in"
        case .slotDraft: return "\(league.type.title) \u{00B7} draw, then choose slots"
        }
    }

    private func runLine(_ run: LotteryRun) -> String {
        let state = run.isComplete ? "order set" : run.isFullyRevealed ? "choosing slots" : "reveal in progress"
        return "Run #\(run.number) \u{00B7} \(state) \u{00B7} \(run.ranAt.formatted(.relative(presentation: .named)))"
    }
}
