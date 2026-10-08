import Foundation

/// An entry offered to the engine with the weight it draws at.
public struct DrawCandidate: Equatable, Hashable, Sendable {
    public let id: UUID
    public let weight: Int

    public init(id: UUID, weight: Int) {
        self.id = id
        self.weight = weight
    }
}

/// A chosen entry and the odds it was chosen at.
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
    /// Nobody left with a chance above zero.
    case noEligibleEntries
    /// Asked for fewer than one winner.
    case invalidCount
    /// Unique winners requested beyond the pool size.
    case countExceedsPool(available: Int)
    /// A unique order needs Remove after selection ON.
    case uniqueOrderRequiresRemoval
    /// A unique order needs at least two eligible entries.
    case notEnoughForOrder
    /// The ticket fell outside every candidate. Should be impossible.
    case internalInvariantFailure
}

/// The one draw engine. Wheel, reel, balls and mystery card all reveal
/// outcomes chosen here; nothing on screen ever decides a winner.
public enum SelectionEngine {
    /// Weighted pick of one candidate. Candidates with weight 0 or less
    /// never win. Uses `Int.random(in:using:)`, which is unbiased.
    public static func selectWinner<R: RandomNumberGenerator>(
        _ candidates: [DrawCandidate],
        using rng: inout R
    ) throws -> WeightedPick {
        let active = candidates.filter { $0.weight > 0 }
        guard !active.isEmpty else { throw DrawError.noEligibleEntries }
        let total = active.reduce(0) { $0 + $1.weight }
        let ticket = Int.random(in: 0..<total, using: &rng)
        guard let winner = candidate(forTicket: ticket, in: active) else {
            throw DrawError.internalInvariantFailure
        }
        return WeightedPick(id: winner.id, numeratorWeight: winner.weight, totalEligibleWeight: total)
    }

    /// Weighted pick using the system's secure generator.
    public static func selectWinner(_ candidates: [DrawCandidate]) throws -> WeightedPick {
        var rng = SystemRandomNumberGenerator()
        return try selectWinner(candidates, using: &rng)
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

    /// Several picks from one pool. Without replacement each winner leaves
    /// the pool before the next pick, so every pick's odds are its own.
    /// With replacement the pool never changes and repeats are possible.
    public static func selectSequence<R: RandomNumberGenerator>(
        _ candidates: [DrawCandidate],
        count: Int,
        withReplacement: Bool,
        using rng: inout R
    ) throws -> [WeightedPick] {
        guard count >= 1 else { throw DrawError.invalidCount }
        var pool = candidates.filter { $0.weight > 0 }
        guard !pool.isEmpty else { throw DrawError.noEligibleEntries }
        if !withReplacement && count > pool.count {
            throw DrawError.countExceedsPool(available: pool.count)
        }
        var picks: [WeightedPick] = []
        picks.reserveCapacity(count)
        for _ in 0..<count {
            let pick = try selectWinner(pool, using: &rng)
            picks.append(pick)
            if !withReplacement {
                pool.removeAll { $0.id == pick.id }
            }
        }
        return picks
    }

    public static func selectSequence(
        _ candidates: [DrawCandidate],
        count: Int,
        withReplacement: Bool
    ) throws -> [WeightedPick] {
        var rng = SystemRandomNumberGenerator()
        return try selectSequence(candidates, count: count, withReplacement: withReplacement, using: &rng)
    }

    /// A complete weighted permutation of every candidate with a positive
    /// weight: pick, remove, repeat. Higher weights tend to land earlier
    /// without any guarantee.
    public static func uniqueOrder<R: RandomNumberGenerator>(
        _ candidates: [DrawCandidate],
        using rng: inout R
    ) throws -> [WeightedPick] {
        let active = candidates.filter { $0.weight > 0 }
        return try selectSequence(active, count: max(active.count, 1), withReplacement: false, using: &rng)
    }
}
