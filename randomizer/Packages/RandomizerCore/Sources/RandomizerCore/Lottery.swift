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

/// The lottery format and the run itself.
///
/// The worst `lotteryTeams` finishers are in the lottery. The lottery draws
/// picks 1 to `drawnPicks` from them by weight, without replacement. Every
/// other team then picks by standings, worst first: lottery teams that
/// weren't drawn, then the teams that finished above the lottery.
public extension League {
    /// Teams in the lottery: the worst finishers. At least two once the
    /// league has two teams.
    var lotteryTeams: Int {
        guard teams.count >= Limits.minTeams else { return teams.count }
        return min(max(lotteryTeamCount ?? teams.count, Limits.minTeams), teams.count)
    }

    /// Picks the lottery draws, from 1 to `lotteryTeams`.
    var drawnPicks: Int {
        let lottery = lotteryTeams
        guard lottery > 0 else { return 0 }
        return min(max(drawnPickCount ?? lottery, 1), lottery)
    }

    func isInLottery(atIndex index: Int) -> Bool {
        teams.indices.contains(index) && index < lotteryTeams
    }

    /// The weight the engine uses for the team at `index`; 0 outside the
    /// lottery.
    func effectiveWeight(atIndex index: Int) -> Int {
        guard isInLottery(atIndex: index) else { return 0 }
        switch oddsMode {
        case .equal:
            return 1
        case .customWeighted:
            return teams[index].weight
        case .reverseStandings:
            return lotteryTeams - index
        }
    }

    func status(atIndex index: Int) -> TeamStatus {
        guard isInLottery(atIndex: index) else { return .notInLottery }
        return effectiveWeight(atIndex: index) > 0 ? .inLottery : .noChance
    }

    func status(of id: UUID) -> TeamStatus {
        guard let index = index(of: id) else { return .notInLottery }
        return status(atIndex: index)
    }

    /// Exactly what the lottery draws from, worst finish first.
    var lotteryCandidates: [DrawCandidate] {
        teams.indices.compactMap { index in
            let weight = effectiveWeight(atIndex: index)
            return weight > 0 ? DrawCandidate(id: teams[index].id, weight: weight) : nil
        }
    }

    var totalLotteryWeight: Int {
        lotteryCandidates.reduce(0) { $0 + $1.weight }
    }

    /// The lottery's balls before any pick, worst finish first.
    var lotteryPool: [PoolMember] {
        teams.indices.compactMap { index in
            let weight = effectiveWeight(atIndex: index)
            guard weight > 0 else { return nil }
            return PoolMember(id: teams[index].id, name: teams[index].name, weight: weight, listIndex: index)
        }
    }

    /// True when not every team with a chance is sure of a drawn pick, so
    /// a "top N" chance means something.
    var drawnPicksAreContested: Bool {
        drawnPicks < lotteryCandidates.count
    }

    /// The #1 pick chance for one team, formatted.
    func firstPickChanceText(of id: UUID) -> String {
        guard let index = index(of: id), status(atIndex: index) == .inLottery else { return "0%" }
        return OddsCalculator.formatPercent(numerator: effectiveWeight(atIndex: index), denominator: totalLotteryWeight)
    }

    /// Why the lottery can't run yet, or nil when it can.
    var runProblem: String? {
        if teams.count < Limits.minTeams { return "Add at least two teams to run the lottery." }
        if lotteryCandidates.isEmpty { return "Give at least one lottery team a weight above 0." }
        return nil
    }

    /// Draws the lottery and records the whole draft order as the latest
    /// run (Run #N), in one mutation. The app saves the league before any
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
            oddsMode: oddsMode,
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
    /// changes.
    mutating func replayReveal(now: Date = Date()) {
        guard var run = latestRun, run.revealedCount > 0 else { return }
        run.revealedCount = 0
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
        if lottery == teams.count { return "All \(teams.count) teams in the lottery" }
        return "Worst \(lottery) of \(teams.count) teams in the lottery"
    }

    /// "Every pick drawn", "Picks 1–6 drawn" or "Top 4 picks drawn".
    var drawnPicksText: String {
        let drawn = drawnPicks
        if drawn == lotteryTeams {
            return lotteryTeams == teams.count ? "Every pick drawn" : "Picks 1\u{2013}\(drawn) drawn"
        }
        return drawn == 1 ? "Only pick 1 drawn" : "Top \(drawn) picks drawn"
    }

    /// "Picks 5–10 by standings", or nil when every pick is drawn.
    var standingsPicksText: String? {
        let first = drawnPicks + 1
        let last = teams.count
        guard first <= last else { return nil }
        return first == last ? "Pick \(last) by standings" : "Picks \(first)\u{2013}\(last) by standings"
    }
}
