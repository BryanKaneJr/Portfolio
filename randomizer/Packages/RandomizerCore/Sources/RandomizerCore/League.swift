import Foundation

/// A fantasy league: its teams in last season's finish (worst first), the
/// lottery type, and the latest lottery run. Everything the lottery screen
/// needs to resume after a force quit lives here.
public struct League: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var title: String
    /// Standings, worst finish first. This order is the ranking.
    public var teams: [Team]
    public var type: LotteryType
    public var revealStyle: RevealStyle
    /// Pro Lottery: how many of the worst teams are in the lottery (the
    /// teams that missed the playoffs); nil = the default for the league's
    /// size.
    public var lotteryTeamCount: Int?
    /// Pro Lottery: how many picks the lottery draws; nil = the top 4.
    public var drawnPickCount: Int?
    /// The draft order from the most recent run, kept until the next run
    /// or a new season.
    public var latestRun: LotteryRun?
    /// Runs this season, so a re-run is never invisible (Run #2).
    public var runCount: Int
    /// The built-in sample until the person keeps it.
    public var isSample: Bool
    public var createdAt: Date
    public var updatedAt: Date
    public var lastUsedAt: Date?

    public init(
        id: UUID = UUID(),
        title: String,
        teams: [Team] = [],
        type: LotteryType = .pro,
        revealStyle: RevealStyle = .lotteryBalls,
        lotteryTeamCount: Int? = nil,
        drawnPickCount: Int? = nil,
        latestRun: LotteryRun? = nil,
        runCount: Int = 0,
        isSample: Bool = false,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        lastUsedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.teams = teams
        self.type = type
        self.revealStyle = revealStyle
        self.lotteryTeamCount = lotteryTeamCount
        self.drawnPickCount = drawnPickCount
        self.latestRun = latestRun
        self.runCount = runCount
        self.isSample = isSample
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
        self.lastUsedAt = lastUsedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, teams, type, revealStyle, lotteryTeamCount, drawnPickCount
        case latestRun, runCount, isSample, createdAt, updatedAt, lastUsedAt
    }

    // Lenient decoding: a field added in a later version must not make an
    // older file unreadable, so everything but identity has a default.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled league"
        teams = try c.decodeIfPresent([Team].self, forKey: .teams) ?? []
        type = (try? c.decodeIfPresent(LotteryType.self, forKey: .type)) ?? .pro
        revealStyle = (try? c.decodeIfPresent(RevealStyle.self, forKey: .revealStyle)) ?? .lotteryBalls
        lotteryTeamCount = try c.decodeIfPresent(Int.self, forKey: .lotteryTeamCount)
        drawnPickCount = try c.decodeIfPresent(Int.self, forKey: .drawnPickCount)
        latestRun = try? c.decodeIfPresent(LotteryRun.self, forKey: .latestRun)
        runCount = try c.decodeIfPresent(Int.self, forKey: .runCount) ?? (latestRun?.number ?? 0)
        isSample = try c.decodeIfPresent(Bool.self, forKey: .isSample) ?? false
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
        lastUsedAt = try c.decodeIfPresent(Date.self, forKey: .lastUsedAt)
    }

    public func team(_ id: UUID) -> Team? {
        teams.first { $0.id == id }
    }

    public func index(of id: UUID) -> Int? {
        teams.firstIndex { $0.id == id }
    }
}
