import Foundation
@testable import RandomizerCore

/// Deterministic generator (SplitMix64) so engine tests are repeatable.
/// The app itself always uses SystemRandomNumberGenerator.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

enum Fixtures {
    static let now = Date(timeIntervalSinceReferenceDate: 800_000_000)

    /// Teams in standings order, worst first.
    static func league(
        _ names: [String],
        type: LotteryType = .pro,
        lotteryTeams: Int? = nil,
        drawnPicks: Int? = nil
    ) -> League {
        League(
            title: "Test League",
            teams: names.map { Team(name: $0) },
            type: type,
            lotteryTeamCount: lotteryTeams,
            drawnPickCount: drawnPicks,
            createdAt: now
        )
    }

    static func teams(_ count: Int) -> [String] {
        (1...count).map { "Team \($0)" }
    }

    static func id(_ name: String, in league: League) -> UUID {
        league.teams.first { $0.name == name }!.id
    }

    static func temporaryDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("DraftLotteryCoreTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
