import Foundation

/// A team as it stood in the lottery, for the reveal visuals.
public struct PoolMember: Identifiable, Equatable, Hashable, Sendable {
    public let id: UUID
    public let name: String
    public let weight: Int
    /// 0-based finish: a stable colour, and the ball shows `standing + 1`.
    public let listIndex: Int

    public init(id: UUID, name: String, weight: Int, listIndex: Int) {
        self.id = id
        self.name = name
        self.weight = weight
        self.listIndex = listIndex
    }
}

/// The odds tables behind each lottery type.
public enum LotteryOdds {
    /// The pro lottery's combinations out of 1,000 for its 14 teams, worst
    /// first: the three worst share the best odds (14% each at #1), then
    /// they fall away to 0.5%.
    public static let proTable = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]

    /// Pro weights for a lottery of `count` teams: the same combinations,
    /// for as many teams as are in (relative odds are what count, so a
    /// six-team lottery keeps the pros' ratios). Past 14 teams each extra
    /// team gets the smallest share.
    public static func proWeights(count: Int) -> [Int] {
        guard count > 0 else { return [] }
        return (0..<count).map { $0 < proTable.count ? proTable[$0] : proTable[proTable.count - 1] }
    }

    /// Long Shot weights out of 1,000: the best team (the champion) gets
    /// exactly 10, a 1% shot at #1, and each worse finish gets an equal
    /// step more. Rounding goes to the worst team so the total stays 1,000.
    public static func longShotWeights(count: Int) -> [Int] {
        guard count > 1 else { return count == 1 ? [1_000] : [] }
        let step = Double(1_000 - 10 * count) * 2 / Double(count * (count - 1))
        var weights = (0..<count).map { index in
            Int((10 + Double(count - 1 - index) * step).rounded())
        }
        weights[0] += 1_000 - weights.reduce(0, +)
        return weights
    }

    /// Pro Lottery default: the teams that usually miss the playoffs.
    /// 10 teams: 6 in; 12 teams: 6 in; 8 teams: 4 in.
    public static func defaultProLotteryTeams(teamCount: Int) -> Int {
        guard teamCount >= Limits.minTeams else { return teamCount }
        let playoffTeams: Int
        switch teamCount {
        case ...3: playoffTeams = teamCount - 2
        case 4...6: playoffTeams = teamCount / 2
        case 7...11: playoffTeams = 4
        case 12...14: playoffTeams = 6
        default: playoffTeams = teamCount / 2
        }
        return teamCount - playoffTeams
    }

    /// Pro Lottery default: the top 4 picks are drawn, like the pros.
    public static let defaultProDrawnPicks = 4
}

/// The lottery format and the run itself.
///
/// The worst `lotteryTeams` finishers are in the lottery. It draws picks 1
/// to `drawnPicks` from them by weight, without replacement. Every other
/// team then picks by standings, worst first: lottery teams that weren't
/// drawn, then the teams that finished above the lottery. Long Shot and
/// Slot Draft put every team in and draw every pick.
public extension League {
    /// Teams in the lottery: the worst finishers. At least two once the
    /// league has two teams.
    var lotteryTeams: Int {
        guard teams.count >= Limits.minTeams else { return teams.count }
        guard type == .pro else { return teams.count }
        let count = lotteryTeamCount ?? LotteryOdds.defaultProLotteryTeams(teamCount: teams.count)
        return min(max(count, Limits.minTeams), teams.count)
    }

    /// Teams that made the playoffs and skip the Pro Lottery.
    var playoffTeams: Int {
        teams.count - lotteryTeams
    }

    /// Picks the lottery draws, from 1 to `lotteryTeams`.
    var drawnPicks: Int {
        let lottery = lotteryTeams
        guard lottery > 0 else { return 0 }
        guard type == .pro else { return lottery }
        return min(max(drawnPickCount ?? LotteryOdds.defaultProDrawnPicks, 1), lottery)
    }

    func isInLottery(atIndex index: Int) -> Bool {
        teams.indices.contains(index) && index < lotteryTeams
    }

    /// The weight the engine uses for the team at `index`; 0 outside the
    /// lottery.
    func effectiveWeight(atIndex index: Int) -> Int {
        guard isInLottery(atIndex: index) else { return 0 }
        return lotteryWeights[index]
    }

    /// Weights of the lottery teams, worst first.
    var lotteryWeights: [Int] {
        switch type {
        case .pro: return LotteryOdds.proWeights(count: lotteryTeams)
        case .longShot: return LotteryOdds.longShotWeights(count: lotteryTeams)
        case .slotDraft: return Array(repeating: 1, count: lotteryTeams)
        }
    }

    func status(atIndex index: Int) -> TeamStatus {
        isInLottery(atIndex: index) ? .inLottery : .notInLottery
    }

    func status(of id: UUID) -> TeamStatus {
        guard let index = index(of: id) else { return .notInLottery }
        return status(atIndex: index)
    }

    /// Exactly what the lottery draws from, worst finish first.
    var lotteryCandidates: [DrawCandidate] {
        let weights = lotteryWeights
        return teams.prefix(lotteryTeams).enumerated().map { index, team in
            DrawCandidate(id: team.id, weight: weights[index])
        }
    }

    var totalLotteryWeight: Int {
        lotteryWeights.reduce(0, +)
    }

    /// The lottery's balls before any pick, worst finish first.
    var lotteryPool: [PoolMember] {
        let weights = lotteryWeights
        return teams.prefix(lotteryTeams).enumerated().map { index, team in
            PoolMember(id: team.id, name: team.name, weight: weights[index], listIndex: index)
        }
    }

    /// True when not every lottery team is sure of a drawn pick, so a
    /// "top N" chance means something.
    var drawnPicksAreContested: Bool {
        drawnPicks < lotteryTeams
    }

    /// The #1 pick (or first choice) chance for one team, formatted.
    func firstPickChanceText(of id: UUID) -> String {
        guard let index = index(of: id), isInLottery(atIndex: index) else { return "0%" }
        return OddsCalculator.formatPercent(numerator: effectiveWeight(atIndex: index), denominator: totalLotteryWeight)
    }

    /// Why the lottery can't run yet, or nil when it can.
    var runProblem: String? {
        teams.count < Limits.minTeams ? "Add at least two teams to run the lottery." : nil
    }

    /// Draws the lottery and records the whole order as the latest run
    /// (Run #N), in one mutation. The app saves the league before any
    /// reveal plays.
    @discardableResult
    mutating func runLottery<R: RandomNumberGenerator>(
        now: Date = Date(),
        using rng: inout R
    ) throws -> LotteryRun {
        guard teams.count >= Limits.minTeams else { throw DrawError.notEnoughTeams }
        let candidates = lotteryCandidates
        guard !candidates.isEmpty else { throw DrawError.noLotteryChances }
        let draws = min(drawnPicks, candidates.count)
        let drawn = try SelectionEngine.selectSequence(candidates, count: draws, using: &rng)

        var picks: [LotteryPick] = []
        picks.reserveCapacity(teams.count)
        for result in drawn {
            guard let index = index(of: result.id) else { throw DrawError.internalInvariantFailure }
            picks.append(LotteryPick(
                pick: picks.count + 1,
                teamID: result.id,
                teamName: teams[index].name,
                standing: index + 1,
                wasDrawn: true,
                numeratorWeight: result.numeratorWeight,
                totalWeight: result.totalEligibleWeight
            ))
        }
        let drawnIDs = Set(drawn.map(\.id))
        for (index, team) in teams.enumerated() where !drawnIDs.contains(team.id) {
            picks.append(LotteryPick(
                pick: picks.count + 1,
                teamID: team.id,
                teamName: team.name,
                standing: index + 1,
                wasDrawn: false
            ))
        }

        runCount += 1
        let run = LotteryRun(
            number: runCount,
            ranAt: now,
            type: type,
            lotteryTeams: lotteryTeams,
            drawnPicks: draws,
            picks: picks
        )
        latestRun = run
        updatedAt = now
        lastUsedAt = now
        return run
    }

    @discardableResult
    mutating func runLottery(now: Date = Date()) throws -> LotteryRun {
        var rng = SystemRandomNumberGenerator()
        return try runLottery(now: now, using: &rng)
    }

    /// Shows the next lottery pick of the latest run (counting down).
    mutating func revealNextPick(now: Date = Date()) {
        guard var run = latestRun, !run.isFullyRevealed else { return }
        run.revealedCount += 1
        latestRun = run
        updatedAt = now
    }

    /// Shows every pick of the latest run.
    mutating func revealAllPicks(now: Date = Date()) {
        guard var run = latestRun, !run.isFullyRevealed else { return }
        run.revealedCount = run.lotteryTeams
        latestRun = run
        updatedAt = now
    }

    /// Hides the picks again to replay the reveal. The order itself never
    /// changes. A Slot Draft whose teams have started choosing can't be
    /// replayed.
    mutating func replayReveal(now: Date = Date()) {
        guard var run = latestRun, run.revealedCount > 0, run.slotChoices.isEmpty else { return }
        run.revealedCount = 0
        latestRun = run
        updatedAt = now
    }

    /// Slot Draft: the team on the clock takes `slot`. When one team is
    /// left it gets the last open slot without having to choose.
    mutating func chooseSlot(_ slot: Int, now: Date = Date()) {
        guard var run = latestRun, run.nextChooser != nil, run.openSlots.contains(slot) else { return }
        run.slotChoices.append(slot)
        if run.openSlots.count == 1, let last = run.openSlots.first, run.nextChooser != nil {
            run.slotChoices.append(last)
        }
        latestRun = run
        updatedAt = now
    }

    /// Slot Draft: takes back the last choice (both, if the last team was
    /// placed automatically).
    mutating func undoSlotChoice(now: Date = Date()) {
        guard var run = latestRun, run.type == .slotDraft, !run.slotChoices.isEmpty else { return }
        if run.slotChoices.count == run.picks.count, run.picks.count > 1 {
            run.slotChoices.removeLast()
        }
        run.slotChoices.removeLast()
        latestRun = run
        updatedAt = now
    }

    /// Clears the latest run and starts the run count over, for next
    /// season. Teams, standings and format stay.
    mutating func startNewSeason(now: Date = Date()) {
        guard latestRun != nil || runCount > 0 else { return }
        latestRun = nil
        runCount = 0
        updatedAt = now
    }

    // MARK: Format wording

    /// "All 10 teams in the lottery" or "Worst 6 of 10 teams in the lottery".
    var lotteryTeamsText: String {
        let lottery = lotteryTeams
        if type == .slotDraft { return "All \(teams.count) teams draw, equal odds" }
        if lottery == teams.count { return "All \(teams.count) teams in the lottery" }
        return "Worst \(lottery) of \(teams.count) teams in the lottery"
    }

    /// "Top 4 picks drawn", "Picks 1–6 drawn", "Every pick drawn", or for
    /// a Slot Draft how the slots are chosen.
    var drawnPicksText: String {
        let drawn = drawnPicks
        switch type {
        case .slotDraft:
            return "Draw order chooses draft slots"
        case .longShot:
            return "Every pick drawn \u{00B7} the champ has 1% at #1"
        case .pro:
            if drawn == lotteryTeams {
                return lotteryTeams == teams.count ? "Every pick drawn" : "Picks 1\u{2013}\(drawn) drawn"
            }
            return drawn == 1 ? "Only pick 1 drawn" : "Top \(drawn) picks drawn"
        }
    }

    /// "Picks 5–10 by standings", or nil when every pick is drawn.
    var standingsPicksText: String? {
        let first = drawnPicks + 1
        let last = teams.count
        guard first <= last else { return nil }
        return first == last ? "Pick \(last) by standings" : "Picks \(first)\u{2013}\(last) by standings"
    }
}
