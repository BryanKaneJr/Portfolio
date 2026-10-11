import Foundation

/// One slot in a draft order, recorded when the lottery ran and before any
/// reveal. It is a snapshot: later edits to names, standings or odds never
/// rewrite it.
public struct LotteryPick: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    /// Draft position, 1 first.
    public var pick: Int
    public var teamID: UUID
    public var teamName: String
    /// The team's finish when the lottery ran (1 = worst). Also its ball
    /// number.
    public var standing: Int
    /// True when the lottery drew this pick; false when it went by
    /// standings.
    public var wasDrawn: Bool
    /// The team's weight at the moment its pick was drawn (0 by standings).
    public var numeratorWeight: Int
    /// Total weight left in the lottery at that moment (0 by standings).
    public var totalWeight: Int

    public init(
        id: UUID = UUID(),
        pick: Int,
        teamID: UUID,
        teamName: String,
        standing: Int,
        wasDrawn: Bool,
        numeratorWeight: Int = 0,
        totalWeight: Int = 0
    ) {
        self.id = id
        self.pick = pick
        self.teamID = teamID
        self.teamName = teamName
        self.standing = standing
        self.wasDrawn = wasDrawn
        self.numeratorWeight = numeratorWeight
        self.totalWeight = totalWeight
    }

    /// The chance this team had at this pick when it was drawn.
    public var probability: Double {
        guard wasDrawn, totalWeight > 0 else { return 0 }
        return Double(numeratorWeight) / Double(totalWeight)
    }

    /// "23.81%" for a drawn pick, "By standings" otherwise.
    public var chanceText: String {
        guard wasDrawn else { return "By standings" }
        return OddsCalculator.formatPercent(numerator: numeratorWeight, denominator: totalWeight)
    }
}

/// A complete draft order from one run of the lottery.
public struct LotteryRun: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    /// Run #N this season.
    public var number: Int
    public var ranAt: Date
    public var oddsMode: OddsMode
    /// Teams that were in the lottery (the worst finishers).
    public var lotteryTeams: Int
    /// Picks the lottery actually drew; the rest went by standings.
    public var drawnPicks: Int
    /// Every team exactly once, pick 1 first.
    public var picks: [LotteryPick]
    /// Lottery picks shown so far, counting down from the last lottery pick.
    /// Saved so leaving mid-reveal never shows anything early or twice.
    public var revealedCount: Int

    public init(
        id: UUID = UUID(),
        number: Int,
        ranAt: Date,
        oddsMode: OddsMode,
        lotteryTeams: Int,
        drawnPicks: Int,
        picks: [LotteryPick],
        revealedCount: Int = 0
    ) {
        self.id = id
        self.number = number
        self.ranAt = ranAt
        self.oddsMode = oddsMode
        self.lotteryTeams = lotteryTeams
        self.drawnPicks = drawnPicks
        self.picks = picks
        self.revealedCount = revealedCount
    }

    /// Picks the lottery decides (drawn, then undrawn lottery teams by
    /// standings), pick 1 first. These are revealed.
    public var lotteryPicks: [LotteryPick] {
        Array(picks.prefix(lotteryTeams))
    }

    /// Teams outside the lottery, by standings. Known before the lottery
    /// runs, so they're never hidden.
    public var standingsPicks: [LotteryPick] {
        Array(picks.dropFirst(lotteryTeams))
    }

    /// Lottery picks in reveal order: last lottery pick first, #1 last.
    public var revealOrder: [LotteryPick] {
        lotteryPicks.reversed()
    }

    public var isFullyRevealed: Bool {
        revealedCount >= lotteryTeams
    }

    /// The next pick to reveal, or nil once everything is shown.
    public var nextToReveal: LotteryPick? {
        let order = revealOrder
        return order.indices.contains(revealedCount) ? order[revealedCount] : nil
    }

    public func isRevealed(_ pick: LotteryPick) -> Bool {
        pick.pick > lotteryTeams - revealedCount
    }
}
