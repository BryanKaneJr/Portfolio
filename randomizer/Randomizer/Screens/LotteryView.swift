import SwiftUI
import RandomizerCore

/// The heart of the app: the odds before the lottery, Run the Lottery, the
/// countdown reveal from the last lottery pick to #1, and the final order.
/// The whole order is drawn and saved before the first reveal; revealing
/// only shows it.
struct LotteryView: View {
    let leagueID: UUID
    @Binding var path: [Route]
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var driver = RevealDriver()
    /// The pick on stage (animating or just landed), by draft position.
    @State private var stagePick: Int?
    @State private var presenting = false
    @State private var showingOdds = false
    @State private var confirmRun = false
    @State private var confirmRunAgain = false
    @State private var confirmNewSeason = false
    @State private var errorMessage: String?
    @State private var shareImage: Image?
    @State private var lastTapAt = Date.distantPast

    var body: some View {
        if let league = appState.league(leagueID) {
            screen(league)
        } else {
            ContentUnavailableView("League not found", systemImage: "questionmark.folder")
        }
    }

    private func screen(_ league: League) -> some View {
        VStack(spacing: 0) {
            if presenting {
                presenterHeader(league)
            }
            FormatHeader(league: league, onShowOdds: { showingOdds = true })
                .padding(.horizontal, 16)
                .padding(.top, presenting ? 4 : 8)
            if league.isSample, league.latestRun != nil, !presenting {
                sampleBanner
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
            }
            stage(league)
                .frame(maxWidth: .infinity)
                .frame(height: presenting ? 260 : 200)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            stageCaption(league)
                .frame(maxWidth: .infinity, minHeight: 64)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 16)
                .layoutPriority(1)
            board(league)
        }
        .background(Theme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            footer(league)
        }
        .navigationTitle(league.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(presenting ? .hidden : .visible, for: .navigationBar)
        .toolbarBackground(Theme.background, for: .navigationBar)
        .statusBarHidden(presenting)
        .persistentSystemOverlays(presenting ? .hidden : .automatic)
        .toolbar { toolbarContent(league) }
        .sheet(isPresented: $showingOdds) {
            OddsView(leagueID: leagueID)
        }
        .confirmationDialog("Run the lottery?", isPresented: $confirmRun, titleVisibility: .visible) {
            Button("Run Now") { runLottery() }
            Button("View odds first") { showingOdds = true }
        } message: {
            Text("\(league.lotteryTeamsText). \(league.drawnPicksText). The whole draft order is drawn and saved now, then revealed pick by pick.")
        }
        .alert("Run the lottery again?", isPresented: $confirmRunAgain) {
            Button("Cancel", role: .cancel) {}
            Button("Run Again", role: .destructive) { runLottery() }
        } message: {
            Text("Run #\(league.runCount) is replaced by Run #\(league.runCount + 1). The run number shows everywhere the order is shared.")
        }
        .confirmationDialog("Start a new season?", isPresented: $confirmNewSeason, titleVisibility: .visible) {
            Button("New Season", role: .destructive) {
                resetStage()
                appState.update(leagueID) { $0.startNewSeason() }
            }
        } message: {
            Text("Clears this season's draft order and starts the run count over. Teams, standings and the lottery format stay.")
        }
        .alert("Can't run the lottery", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .task(id: league.latestRun?.id) {
            guard let run = league.latestRun else {
                shareImage = nil
                return
            }
            shareImage = ShareRenderer.runImage(title: league.title, run: run)
        }
        .onChange(of: driver.landings) { _, _ in announceLanding(league) }
        .onDisappear { resetStage() }
    }

    // MARK: Header

    private func presenterHeader(_ league: League) -> some View {
        HStack(alignment: .center) {
            Text(league.title)
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

    private var sampleBanner: some View {
        HStack(spacing: 10) {
            Text("This is a sample league.")
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            Spacer(minLength: 0)
            Button("Keep it") { appState.keepSample(leagueID) }
                .buttonStyle(ChipButtonStyle())
                .accessibilityIdentifier("keepSampleButton")
            Button("Make my own") {
                let league = appState.createLeague()
                path = [.editor(league.id)]
            }
            .buttonStyle(ChipButtonStyle(tint: Theme.textPrimary))
            .accessibilityIdentifier("makeMyOwnButton")
        }
    }

    // MARK: Stage

    @ViewBuilder
    private func stage(_ league: League) -> some View {
        Group {
            if let run = league.latestRun, let number = stagePick, let pick = run.picks.first(where: { $0.pick == number }) {
                if pick.wasDrawn {
                    RevealStage(
                        style: league.revealStyle,
                        pool: Self.pool(run, through: number),
                        winnerID: pick.teamID,
                        phase: driver.phase,
                        token: driver.token
                    )
                } else {
                    StandingsPickCard(pick: pick)
                        .transition(.opacity)
                }
            } else if let run = league.latestRun, run.isFullyRevealed, let first = run.picks.first {
                // Coming back to a finished lottery: the #1 pick.
                if first.wasDrawn {
                    RevealStage(style: league.revealStyle, pool: Self.pool(run, through: 1), winnerID: first.teamID, phase: .landed, token: driver.token)
                } else {
                    StandingsPickCard(pick: first)
                }
            } else {
                RevealStage(style: league.revealStyle, pool: idlePool(league), winnerID: nil, phase: .idle, token: driver.token)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { driver.skip() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(stageLabel(league))
        .accessibilityAddTraits(driver.phase.isAnimating ? .isButton : [])
        .accessibilityAction(named: "Skip animation") { driver.skip() }
        .accessibilityIdentifier("revealStage")
    }

    /// Drawn teams that could still be at `pick` or above: the balls in the
    /// drum for that reveal.
    static func pool(_ run: LotteryRun, through pick: Int) -> [PoolMember] {
        run.picks
            .filter { $0.wasDrawn && $0.pick <= pick }
            .map { PoolMember(id: $0.teamID, name: $0.teamName, weight: $0.numeratorWeight, listIndex: $0.standing - 1) }
            .sorted { $0.listIndex < $1.listIndex }
    }

    /// Before the lottery: every team with a chance. Mid-reveal: the lottery
    /// teams whose picks are still hidden, so nothing shows early.
    private func idlePool(_ league: League) -> [PoolMember] {
        guard let run = league.latestRun else { return league.lotteryPool }
        return run.lotteryPicks
            .filter { !run.isRevealed($0) }
            .map { PoolMember(id: $0.teamID, name: $0.teamName, weight: $0.numeratorWeight, listIndex: $0.standing - 1) }
            .sorted { $0.listIndex < $1.listIndex }
    }

    private func stageLabel(_ league: League) -> String {
        guard let run = league.latestRun else {
            return "\(league.lotteryCandidates.count) teams in the lottery."
        }
        if let number = stagePick, let pick = run.picks.first(where: { $0.pick == number }) {
            if driver.phase.isAnimating { return "Revealing pick \(number). Double tap to skip." }
            return "Pick \(number): \(pick.teamName)."
        }
        return run.isFullyRevealed ? "The draft order is set." : "Draft order drawn. \(run.lotteryTeams - run.revealedCount) lottery picks still hidden."
    }

    @ViewBuilder
    private func stageCaption(_ league: League) -> some View {
        if let run = league.latestRun, let number = stagePick, let pick = run.picks.first(where: { $0.pick == number }) {
            if driver.phase.isAnimating {
                VStack(spacing: 2) {
                    Text("Pick \(number)")
                        .font(Theme.rounded(.caption, weight: .bold))
                        .foregroundStyle(Theme.accent)
                        .textCase(.uppercase)
                    Text("Drawing\u{2026}")
                        .font(Theme.rounded(.title3, weight: .bold))
                        .foregroundStyle(Theme.textSecondary)
                }
                .accessibilityIdentifier("drawingInProgress")
            } else {
                PickBanner(pick: pick, inLottery: run.isLotteryPick(pick), presenting: presenting)
                    .id(pick.id)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.85).combined(with: .opacity))
            }
        } else if let run = league.latestRun {
            VStack(spacing: 2) {
                Text(run.isFullyRevealed ? "The draft order is set" : "The draft order is drawn and saved")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Text(run.isFullyRevealed ? "Share it with your league." : "Reveal it pick by pick, counting down to #1.")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
        } else {
            Text(league.runProblem ?? "Odds are set. Run the lottery when everyone's watching.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: Board

    @ViewBuilder
    private func board(_ league: League) -> some View {
        if let run = league.latestRun {
            RunBoard(run: run, hiddenPick: driver.phase.isAnimating ? stagePick : nil, latestPick: stagePick)
                .mask(BoardFade())
        } else {
            OddsPreviewBoard(league: league)
                .mask(BoardFade())
        }
    }

    // MARK: Footer

    private func footer(_ league: League) -> some View {
        VStack(spacing: 10) {
            if let run = league.latestRun {
                if !run.isFullyRevealed || driver.phase.isAnimating {
                    Button {
                        revealNext(league)
                    } label: {
                        Label(revealButtonTitle(run), systemImage: "sparkles")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(driver.phase.isAnimating)
                    .accessibilityIdentifier("revealNextPickButton")
                    HStack {
                        Button("Reveal all") { revealAll() }
                            .buttonStyle(ChipButtonStyle())
                            .disabled(driver.phase.isAnimating)
                            .accessibilityIdentifier("revealAllButton")
                        Spacer(minLength: 0)
                        Text("\(hiddenCount(run)) of \(run.lotteryTeams) lottery picks hidden")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .accessibilityIdentifier("hiddenCountLabel")
                    }
                } else {
                    finishedControls(league, run: run)
                }
            } else {
                Button {
                    confirmRun = true
                } label: {
                    Label("Run the Lottery", systemImage: "sparkles")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(league.runProblem != nil)
                .accessibilityIdentifier("runLotteryButton")
            }
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

    /// While a pick is being drawn on stage it still counts as hidden.
    private func revealButtonTitle(_ run: LotteryRun) -> String {
        if driver.phase.isAnimating, let stagePick { return "Revealing pick #\(stagePick)\u{2026}" }
        return "Reveal pick #\(run.nextToReveal?.pick ?? 1)"
    }

    private func hiddenCount(_ run: LotteryRun) -> Int {
        run.lotteryTeams - run.revealedCount + (driver.phase.isAnimating ? 1 : 0)
    }

    private func finishedControls(_ league: League, run: LotteryRun) -> some View {
        VStack(spacing: 10) {
            ShareLink(item: shareText(league, run: run)) {
                Label("Share Draft Order", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(PrimaryButtonStyle())
            .accessibilityIdentifier("shareRunButton")
            HStack(spacing: 8) {
                Button {
                    replay()
                } label: {
                    Label("Replay", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(ChipButtonStyle())
                .accessibilityLabel("Replay the reveal")
                .accessibilityIdentifier("replayRevealButton")
                Spacer(minLength: 0)
                Button {
                    confirmRunAgain = true
                } label: {
                    Label("Run Again", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(ChipButtonStyle(tint: Theme.caution))
                .accessibilityIdentifier("runAgainButton")
            }
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private func toolbarContent(_ league: League) -> some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                path.showEditor(leagueID)
            } label: {
                Image(systemName: "pencil")
            }
            .accessibilityLabel("Edit league")
            .accessibilityIdentifier("editLeagueButton")

            Menu {
                Button {
                    showingOdds = true
                } label: {
                    Label("Odds", systemImage: "chart.bar.xaxis")
                }
                Picker("Reveal style", selection: Binding(
                    get: { league.revealStyle },
                    set: { style in appState.update(leagueID) { $0.setRevealStyle(style) } }
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
                if let run = league.latestRun {
                    ShareLink(item: shareText(league, run: run)) {
                        Label("Share as text", systemImage: "text.alignleft")
                    }
                    if let shareImage {
                        ShareLink(item: shareImage, preview: SharePreview("\(league.title) draft order", image: shareImage)) {
                            Label("Share as image", systemImage: "photo")
                        }
                    }
                    Divider()
                    Button(role: .destructive) {
                        confirmNewSeason = true
                    } label: {
                        Label("New season", systemImage: "calendar.badge.plus")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More")
            .accessibilityIdentifier("lotteryMenu")
        }
    }

    // MARK: Actions

    private func shareText(_ league: League, run: LotteryRun) -> String {
        ResultsExporter.runText(
            title: league.title,
            run: run,
            dateText: run.ranAt.formatted(date: .abbreviated, time: .shortened)
        )
    }

    /// One tap, one action: ignore taps while a reveal plays or right after.
    private func acceptTap() -> Bool {
        guard !driver.phase.isAnimating, Date().timeIntervalSince(lastTapAt) > 0.4 else { return false }
        lastTapAt = Date()
        return true
    }

    private func runLottery() {
        guard acceptTap() else { return }
        resetStage()
        do {
            try appState.runLottery(leagueID)
            Haptics.success()
        } catch let error as DrawError {
            errorMessage = error.message
        } catch {
            errorMessage = "Nothing was drawn."
        }
    }

    private func revealNext(_ league: League) {
        guard acceptTap(), let run = league.latestRun, let next = run.nextToReveal else { return }
        // Saved first: leaving mid-reveal never shows a pick twice.
        appState.update(leagueID) { $0.revealNextPick() }
        withAnimation(.easeOut(duration: 0.2)) { stagePick = next.pick }
        if next.wasDrawn {
            driver.start(style: league.revealStyle, poolCount: Self.pool(run, through: next.pick).count, reduceMotion: reduceMotion)
        } else {
            driver.showLanded()
            SoundPlayer.shared.play(.tick)
        }
    }

    private func revealAll() {
        guard acceptTap() else { return }
        appState.update(leagueID) { $0.revealAllPicks() }
        stagePick = 1
        driver.showLanded()
    }

    private func replay() {
        resetStage()
        appState.update(leagueID) { $0.replayReveal() }
    }

    private func resetStage() {
        driver.reset()
        stagePick = nil
    }

    private func announceLanding(_ league: League) {
        guard let run = league.latestRun, let number = stagePick, let pick = run.picks.first(where: { $0.pick == number }) else { return }
        AccessibilityNotification.Announcement("Pick \(number): \(pick.teamName), \(ResultsExporter.detail(pick, in: run)).").post()
    }
}

// MARK: - Pieces

/// The odds mode and lottery format at a glance, with the odds table.
private struct FormatHeader: View {
    let league: League
    let onShowOdds: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Tag(text: league.oddsMode.title, systemImage: league.oddsMode.systemImage, tint: Theme.accent)
                Button("Odds", action: onShowOdds)
                    .font(Theme.rounded(.footnote, weight: .semibold))
                    .accessibilityIdentifier("lotteryOddsButton")
            }
            VStack(spacing: 1) {
                Text(league.lotteryTeamsText)
                Text(Self.unbroken([league.drawnPicksText, league.standingsPicksText].compactMap { $0 }.joined(separator: " \u{00B7} ")))
            }
            .font(.caption)
            .foregroundStyle(Theme.textSecondary)
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("formatSummary")
        }
        .frame(maxWidth: .infinity)
    }

    /// Keeps a range like "5–12" on one line.
    static func unbroken(_ text: String) -> String {
        text.replacingOccurrences(of: "\u{2013}", with: "\u{2060}\u{2013}\u{2060}")
    }
}

/// Fades the board's top edge so a half-scrolled row doesn't butt against
/// the caption above it.
private struct BoardFade: View {
    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)
                .frame(height: 14)
            Color.black
        }
    }
}

/// How far a lottery team moved from its finish: ▲3, ▼2 or a dash.
struct MovementBadge: View {
    let movement: Int

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: movement > 0 ? "arrowtriangle.up.fill" : movement < 0 ? "arrowtriangle.down.fill" : "minus")
                .imageScale(.small)
            if movement != 0 {
                Text("\(abs(movement))")
                    .monospacedDigit()
            }
        }
        .font(Theme.rounded(.caption, weight: .heavy))
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(tint.opacity(0.14)))
        .accessibilityHidden(true)
    }

    private var tint: Color {
        movement > 0 ? Theme.positive : movement < 0 ? Theme.danger : Theme.textTertiary
    }
}

/// The pick that just landed: who, and how they got it.
private struct PickBanner: View {
    let pick: LotteryPick
    let inLottery: Bool
    let presenting: Bool

    var body: some View {
        VStack(spacing: 2) {
            Text("Pick \(pick.pick)")
                .font(Theme.rounded(.caption, weight: .bold))
                .foregroundStyle(Theme.accent)
                .textCase(.uppercase)
            Text(pick.teamName)
                .font(.system(size: presenting ? 40 : 28, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .accessibilityIdentifier("pickName")
            HStack(spacing: 6) {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                if inLottery {
                    MovementBadge(movement: pick.movement)
                }
            }
        }
    }

    private var subtitle: String {
        guard inLottery else { return "By standings" }
        return "\(pick.wasDrawn ? "Drawn" : "Not drawn") \u{00B7} \(pick.finishText.lowercased())"
    }
}

/// A lottery team that wasn't drawn: no balls, just its card.
private struct StandingsPickCard: View {
    let pick: LotteryPick

    var body: some View {
        VStack(spacing: 10) {
            StandingBadge(standing: pick.standing, size: 56)
            Text(pick.teamName)
                .font(Theme.rounded(.title2, weight: .heavy))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
            Tag(text: "By standings", systemImage: "list.number", tint: Theme.textSecondary)
        }
        .padding(20)
        .frame(maxWidth: 320, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.stroke))
        .frame(maxWidth: .infinity)
    }
}

/// Before the lottery: each team's chance at #1 (and at a drawn pick when
/// that's in doubt), and the fixed picks of the teams outside it.
private struct OddsPreviewBoard: View {
    let league: League

    var body: some View {
        let rows = OddsCalculator.rows(for: league)
        let lottery = rows.filter { $0.status != .notInLottery }
        let outside = rows.filter { $0.status == .notInLottery }
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if !lottery.isEmpty {
                    BoardHeader(
                        title: "In the lottery",
                        detail: league.drawnPicksAreContested ? "#1 pick \u{00B7} top \(league.drawnPicks)" : "#1 pick"
                    )
                    ForEach(lottery) { row in
                        OddsPreviewRow(row: row)
                    }
                }
                if !outside.isEmpty {
                    BoardHeader(title: "By standings", detail: "Pick")
                        .padding(.top, 8)
                    ForEach(Array(outside.enumerated()), id: \.element.id) { offset, row in
                        OddsPreviewRow(row: row, fixedPick: league.lotteryTeams + offset + 1)
                    }
                }
                if league.teams.isEmpty {
                    Text("Add teams to this league to run its lottery.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}

private struct BoardHeader: View {
    let title: String
    let detail: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(detail)
        }
        .font(Theme.rounded(.caption, weight: .bold))
        .foregroundStyle(Theme.textTertiary)
        .textCase(.uppercase)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct OddsPreviewRow: View {
    let row: OddsRow
    var fixedPick: Int?

    var body: some View {
        HStack(spacing: 12) {
            StandingBadge(standing: row.standing)
            Text(row.name)
                .font(Theme.rounded(.headline, weight: .semibold))
                .foregroundStyle(row.status == .inLottery ? Theme.textPrimary : Theme.textSecondary)
                .lineLimit(1)
            Spacer(minLength: 4)
            if let fixedPick {
                Text("#\(fixedPick)")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.textSecondary)
            } else if row.status == .noChance {
                Text("By standings")
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            } else {
                HStack(spacing: 10) {
                    Text(row.chanceText)
                        .font(Theme.rounded(.subheadline, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    if let top = row.drawnPickChanceText {
                        Text(top)
                            .font(Theme.rounded(.subheadline, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(minWidth: 58, alignment: .trailing)
                    }
                }
                .monospacedDigit()
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 46)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.surface))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("oddsPreviewRow")
    }
}

/// After the lottery: every pick, lottery picks hidden until revealed.
private struct RunBoard: View {
    let run: LotteryRun
    /// The pick being animated, kept hidden until it lands.
    let hiddenPick: Int?
    let latestPick: Int?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Run #\(run.number)")
                            .font(Theme.rounded(.subheadline, weight: .heavy))
                            .foregroundStyle(Theme.accent)
                        Spacer()
                        Text(run.ranAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("runNumberLabel")
                    BoardHeader(title: "Lottery", detail: "Picks 1\u{2013}\(run.lotteryTeams)")
                    ForEach(run.lotteryPicks) { pick in
                        DraftSlot(pick: pick, inLottery: true, isRevealed: isShown(pick), isLatest: pick.pick == latestPick && isShown(pick))
                            .id(pick.pick)
                    }
                    if !run.standingsPicks.isEmpty {
                        BoardHeader(title: "By standings", detail: "Picks \(run.lotteryTeams + 1)\u{2013}\(run.picks.count)")
                            .padding(.top, 8)
                        ForEach(run.standingsPicks) { pick in
                            DraftSlot(pick: pick, inLottery: false, isRevealed: true, isLatest: false)
                                .id(pick.pick)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: latestPick) { _, pick in
                guard let pick else { return }
                withAnimation { proxy.scrollTo(pick, anchor: .center) }
            }
        }
    }

    private func isShown(_ pick: LotteryPick) -> Bool {
        run.isRevealed(pick) && pick.pick != hiddenPick
    }
}

private struct DraftSlot: View {
    let pick: LotteryPick
    let inLottery: Bool
    let isRevealed: Bool
    let isLatest: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text("\(pick.pick)")
                .font(Theme.rounded(.headline, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(Theme.accent)
                .frame(minWidth: 26, alignment: .leading)
            if isRevealed {
                StandingBadge(standing: pick.standing, size: 26)
                Text(pick.teamName)
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if inLottery {
                    MovementBadge(movement: pick.movement)
                }
            } else {
                Text("? ? ?")
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textTertiary)
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 46)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isLatest ? Theme.accentSoft : Theme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(isLatest ? Theme.accent : Theme.stroke, lineWidth: isLatest ? 2 : 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier(isRevealed ? "draftSlotRevealed" : "draftSlotHidden")
    }

    private var accessibilityText: String {
        guard isRevealed else { return "Pick \(pick.pick): not revealed yet" }
        guard inLottery else { return "Pick \(pick.pick): \(pick.teamName), by standings" }
        let how = pick.wasDrawn ? "drawn" : "by standings"
        return "Pick \(pick.pick): \(pick.teamName), \(how), \(pick.finishText.lowercased()), \(pick.movementText)"
    }
}
