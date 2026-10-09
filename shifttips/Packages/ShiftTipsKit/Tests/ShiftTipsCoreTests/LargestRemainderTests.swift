import Testing
@testable import ShiftTipsCore

@Suite struct LargestRemainderTests {
    @Test func equalThreeWayGivesTheLeftoverCentToTheFirst() throws {
        let shares = try LargestRemainder.allocate(pool: 1000, weights: [1, 1, 1])
        #expect(shares.map(\.cents) == [334, 333, 333])
        #expect(shares.map(\.roundingCents) == [1, 0, 0])
    }

    @Test func largestRemainderWinsBeforeOrder() throws {
        // 100 cents by 1:2:3 is 16.67, 33.33, 50.00: the first has the
        // largest remainder and gets the leftover cent.
        let shares = try LargestRemainder.allocate(pool: 100, weights: [1, 2, 3])
        #expect(shares.map(\.cents) == [17, 33, 50])
    }

    @Test func tiesGoInArrayOrder() throws {
        let shares = try LargestRemainder.allocate(pool: 5, weights: [1, 1, 1, 1, 1, 1, 1])
        #expect(shares.map(\.cents) == [1, 1, 1, 1, 1, 0, 0])
    }

    @Test func zeroWeightsNeverGetACent() throws {
        let shares = try LargestRemainder.allocate(pool: 1001, weights: [0, 3, 0, 7, 0])
        #expect(shares[0].cents == 0 && shares[2].cents == 0 && shares[4].cents == 0)
        #expect(shares.map(\.cents).reduce(0, +) == 1001)
    }

    @Test func zeroPoolWithNoWeightIsAllZero() throws {
        let shares = try LargestRemainder.allocate(pool: 0, weights: [0, 0])
        #expect(shares.map(\.cents) == [0, 0])
    }

    @Test func positivePoolWithNoWeightThrows() {
        #expect(throws: LargestRemainder.Failure.zeroTotalWeight) {
            try LargestRemainder.allocate(pool: 1, weights: [0, 0])
        }
    }

    @Test func negativeInputsThrow() {
        #expect(throws: LargestRemainder.Failure.negativePool) {
            try LargestRemainder.allocate(pool: -1, weights: [1])
        }
        #expect(throws: LargestRemainder.Failure.negativeWeight) {
            try LargestRemainder.allocate(pool: 1, weights: [1, -1])
        }
    }

    @Test func weightSumOverflowThrows() {
        #expect(throws: LargestRemainder.Failure.weightOverflow) {
            try LargestRemainder.allocate(pool: 100, weights: [Int64.max, 1])
        }
    }

    @Test func hugeValuesDontOverflow() throws {
        // P * w is far beyond Int64 here; full-width arithmetic handles it.
        let half = Int64.max / 2
        let shares = try LargestRemainder.allocate(pool: Int64.max, weights: [half, half - 7, 3])
        #expect(shares.map(\.cents).reduce(0, +) == Int64.max)
        let limits = try LargestRemainder.allocate(
            pool: Limits.maxPoolCents,
            weights: Array(repeating: Limits.maxMinutes * Limits.maxPointsUnits, count: Limits.maxParticipants)
        )
        #expect(limits.map(\.cents).reduce(0, +) == Limits.maxPoolCents)
    }

    @Test func randomSplitsAlwaysReconcileAndStayWithinACent() throws {
        var rng = SplitMix64(seed: 2026_10_08)
        for _ in 0..<3000 {
            let count = Int.random(in: 1...40, using: &rng)
            let pool = Int64.random(in: 0...Limits.maxPoolCents, using: &rng)
            var weights = (0..<count).map { _ in Int64.random(in: 0...6_000_000, using: &rng) }
            if weights.allSatisfy({ $0 == 0 }) { weights[0] = 1 }
            let total = weights.reduce(0, +)
            let shares = try LargestRemainder.allocate(pool: pool, weights: weights)

            #expect(shares.map(\.cents).reduce(0, +) == pool)
            for (share, weight) in zip(shares, weights) {
                // floor(exact) <= cents <= floor(exact) + 1
                let exactFloor = Int64((Double(pool) * Double(weight) / Double(total)).rounded(.down))
                #expect(abs(share.floorCents - exactFloor) <= 1) // Double is only a cross-check here
                #expect(share.cents == share.floorCents || share.cents == share.floorCents + 1)
                if weight == 0 { #expect(share.cents == 0) }
            }
            // A bigger weight never gets fewer cents.
            let byWeight = weights.indices.sorted { weights[$0] < weights[$1] }
            let monotonic = zip(byWeight, byWeight.dropFirst()).allSatisfy { a, b in
                weights[a] == weights[b] || shares[a].cents <= shares[b].cents
            }
            #expect(monotonic)
            // Same inputs, same answer.
            #expect(try LargestRemainder.allocate(pool: pool, weights: weights) == shares)
        }
    }
}
