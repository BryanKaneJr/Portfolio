import Foundation
@testable import ShiftTipsCore

/// Small builders so each test reads like the scenario it checks.
enum Fixture {
    static let day = CalendarDay(year: 2026, month: 10, day: 8)

    static func person(
        _ name: String,
        hours: Double = 0,
        points: Int64 = 1000,
        included: Bool = true,
        eligibility: Eligibility = .eligible,
        id: UUID = UUID()
    ) -> ShiftParticipant {
        // Test fixtures only: hours are whole quarter hours, so this is exact.
        ShiftParticipant(
            id: id,
            name: name,
            included: included,
            eligibility: eligibility,
            minutesWorked: Int64(hours * 60),
            pointsUnits: points
        )
    }

    static func draft(_ method: SplitMethod, pool: TipPool, _ people: [ShiftParticipant]) -> ShiftDraft {
        ShiftDraft(day: day, method: method, pool: pool, participants: people)
    }

    static func cents(_ calculation: ShiftCalculation) -> [Int64] {
        calculation.allocations.map(\.totalCents)
    }
}

/// A seeded generator so randomized tests are repeatable.
struct SplitMix64: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
