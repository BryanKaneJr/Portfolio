import Foundation

/// A team offered to the engine with the weight it draws at.
public struct DrawCandidate: Equatable, Hashable, Sendable {
    public let id: UUID
    public let weight: Int

    public init(id: UUID, weight: Int) {
        self.id = id
        self.weight = weight
    }
}

/// A drawn team and the odds it was drawn at.
public struct WeightedPick: Equatable, Hashable, Sendable {
    public let id: UUID
    public let numeratorWeight: Int
    public let totalEligibleWeight: Int

    public init(id: UUID, numeratorWeight: Int, totalEligibleWeight: Int) {
        self.id = id
        self.numeratorWeight = numeratorWeight
        self.totalEligibleWeight = totalEligibleWeight
    }
}

public enum DrawError: Error, Equatable, Sendable {
    /// A league needs at least two teams.
    case notEnoughTeams
    /// No lottery team has a chance above zero.
    case noLotteryChances
    /// Asked for fewer than one pick.
    case invalidCount
    /// More picks requested than teams left to draw.
    case countExceedsPool(available: Int)
    /// The ticket fell outside every candidate. Should be impossible.
    case internalInvariantFailure
}

/// The one draw engine. Lottery balls and card flips both reveal picks
/// chosen here; nothing on screen ever decides who gets a pick.
public enum SelectionEngine {
    /// Weighted pick of one candidate. Candidates with weight 0 or less
    /// never win. Uses `Int.random(in:using:)`, which is unbiased.
    public static func selectWinner<R: RandomNumberGenerator>(
        _ candidates: [DrawCandidate],
        using rng: inout R
    ) throws -> WeightedPick {
        let active = candidates.filter { $0.weight > 0 }
        guard !active.isEmpty else { throw DrawError.noLotteryChances }
        let total = active.reduce(0) { $0 + $1.weight }
        let ticket = Int.random(in: 0..<total, using: &rng)
        guard let winner = candidate(forTicket: ticket, in: active) else {
            throw DrawError.internalInvariantFailure
        }
        return WeightedPick(id: winner.id, numeratorWeight: winner.weight, totalEligibleWeight: total)
    }

    /// Maps a ticket in `0..<total` to the candidate whose slice holds it.
    /// Separate from the random call so the mapping can be tested exactly.
    public static func candidate(forTicket ticket: Int, in candidates: [DrawCandidate]) -> DrawCandidate? {
        guard ticket >= 0 else { return nil }
        var running = 0
        for candidate in candidates where candidate.weight > 0 {
            running += candidate.weight
            if ticket < running { return candidate }
        }
        return nil
    }

    /// `count` picks in a row from one pool: each drawn team leaves the
    /// pool before the next pick, so every pick's odds are its own.
    public static func selectSequence<R: RandomNumberGenerator>(
        _ candidates: [DrawCandidate],
        count: Int,
        using rng: inout R
    ) throws -> [WeightedPick] {
        guard count >= 1 else { throw DrawError.invalidCount }
        var pool = candidates.filter { $0.weight > 0 }
        guard !pool.isEmpty else { throw DrawError.noLotteryChances }
        guard count <= pool.count else { throw DrawError.countExceedsPool(available: pool.count) }
        var picks: [WeightedPick] = []
        picks.reserveCapacity(count)
        for _ in 0..<count {
            let pick = try selectWinner(pool, using: &rng)
            picks.append(pick)
            pool.removeAll { $0.id == pick.id }
        }
        return picks
    }
}
