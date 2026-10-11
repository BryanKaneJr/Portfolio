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

    /// Spots gained on the team's finish: 3 when the 4th-worst team lands
    /// pick 1, negative when a team falls.
    public var movement: Int {
        standing - pick
    }

    /// "up 3", "down 2" or "no change".
    public var movementText: String {
        if movement > 0 { return "up \(movement)" }
        if movement < 0 { return "down \(-movement)" }
        return "no change"
    }

    /// "Finished 4th".
    public var finishText: String {
        "Finished \(Ordinal.text(standing))"
    }
}

public enum Ordinal {
    /// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st.
    public static func text(_ number: Int) -> String {
        let suffix: String
        if (11...13).contains(number % 100) {
            suffix = "th"
        } else {
            switch number % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        return "\(number)\(suffix)"
    }
}

/// One slot of the final draft order. In a Slot Draft a slot is open
/// until a team chooses it.
public struct DraftPosition: Identifiable, Equatable, Sendable {
    public let slot: Int
    public let pick: LotteryPick?

    public var id: Int { slot }
}

/// A complete draw from one run of the lottery.
///
/// For the Pro Lottery and Long Shot, `picks` is the draft order, pick 1
/// first. For a Slot Draft it's the choosing order (`pick` = 1 for the team
/// that chooses first), and `slotChoices` records the draft slot each team
/// chose, in that order.
public struct LotteryRun: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    /// Run #N this season.
    public var number: Int
    public var ranAt: Date
    public var type: LotteryType
    /// Teams that were in the lottery (the worst finishers).
    public var lotteryTeams: Int
    /// Picks the lottery actually drew; the rest went by standings.
    public var drawnPicks: Int
    /// Every team exactly once, pick 1 first.
    public var picks: [LotteryPick]
    /// Lottery picks shown so far, counting down from the last lottery pick.
    /// Saved so leaving mid-reveal never shows anything early or twice.
    public var revealedCount: Int
    /// Slot Draft: the slot each team chose, in choosing order.
    public var slotChoices: [Int]

    public init(
        id: UUID = UUID(),
        number: Int,
        ranAt: Date,
        type: LotteryType,
        lotteryTeams: Int,
        drawnPicks: Int,
        picks: [LotteryPick],
        revealedCount: Int = 0,
        slotChoices: [Int] = []
    ) {
        self.id = id
        self.number = number
        self.ranAt = ranAt
        self.type = type
        self.lotteryTeams = lotteryTeams
        self.drawnPicks = drawnPicks
        self.picks = picks
        self.revealedCount = revealedCount
        self.slotChoices = slotChoices
    }

    private enum CodingKeys: String, CodingKey {
        case id, number, ranAt, type, lotteryTeams, drawnPicks, picks, revealedCount, slotChoices
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        number = try c.decodeIfPresent(Int.self, forKey: .number) ?? 1
        ranAt = try c.decodeIfPresent(Date.self, forKey: .ranAt) ?? Date()
        type = (try? c.decodeIfPresent(LotteryType.self, forKey: .type)) ?? .pro
        picks = try c.decode([LotteryPick].self, forKey: .picks)
        lotteryTeams = try c.decodeIfPresent(Int.self, forKey: .lotteryTeams) ?? picks.count
        drawnPicks = try c.decodeIfPresent(Int.self, forKey: .drawnPicks) ?? lotteryTeams
        revealedCount = try c.decodeIfPresent(Int.self, forKey: .revealedCount) ?? 0
        slotChoices = try c.decodeIfPresent([Int].self, forKey: .slotChoices) ?? []
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

    /// True for picks the lottery decides (drawn or not); false for teams
    /// that finished above the lottery.
    public func isLotteryPick(_ pick: LotteryPick) -> Bool {
        pick.pick <= lotteryTeams
    }

    public func isRevealed(_ pick: LotteryPick) -> Bool {
        pick.pick > lotteryTeams - revealedCount
    }

    // MARK: Slot Draft

    /// The team choosing its slot now, once the choosing order is revealed.
    public var nextChooser: LotteryPick? {
        guard type == .slotDraft, isFullyRevealed, picks.indices.contains(slotChoices.count) else { return nil }
        return picks[slotChoices.count]
    }

    /// Every pick revealed and, in a Slot Draft, every slot chosen.
    public var isComplete: Bool {
        guard isFullyRevealed else { return false }
        return type != .slotDraft || slotChoices.count >= picks.count
    }

    /// The slot a team chose, or nil before its turn.
    public func chosenSlot(of pick: LotteryPick) -> Int? {
        let index = pick.pick - 1
        return slotChoices.indices.contains(index) ? slotChoices[index] : nil
    }

    public var openSlots: [Int] {
        let taken = Set(slotChoices)
        return picks.indices.map { $0 + 1 }.filter { !taken.contains($0) }
    }

    /// The draft order, slot 1 first. In a Slot Draft, slots nobody has
    /// chosen yet are open.
    public var draftOrder: [DraftPosition] {
        guard type == .slotDraft else {
            return picks.map { DraftPosition(slot: $0.pick, pick: $0) }
        }
        var bySlot: [Int: LotteryPick] = [:]
        for (index, slot) in slotChoices.enumerated() where picks.indices.contains(index) {
            bySlot[slot] = picks[index]
        }
        return picks.indices.map { DraftPosition(slot: $0 + 1, pick: bySlot[$0 + 1]) }
    }
}
