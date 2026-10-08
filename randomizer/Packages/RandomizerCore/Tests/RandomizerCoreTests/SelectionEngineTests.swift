import XCTest
@testable import RandomizerCore

final class SelectionEngineTests: XCTestCase {
    private func candidates(_ weights: [Int]) -> [DrawCandidate] {
        weights.map { DrawCandidate(id: UUID(), weight: $0) }
    }

    func testTicketMapsToCandidateSlices() {
        let pool = candidates([40, 30, 20, 10])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 0, in: pool), pool[0])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 39, in: pool), pool[0])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 40, in: pool), pool[1])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 69, in: pool), pool[1])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 70, in: pool), pool[2])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 89, in: pool), pool[2])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 90, in: pool), pool[3])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 99, in: pool), pool[3])
        XCTAssertNil(SelectionEngine.candidate(forTicket: 100, in: pool))
        XCTAssertNil(SelectionEngine.candidate(forTicket: -1, in: pool))
    }

    func testZeroWeightSlicesAreSkipped() {
        let pool = candidates([0, 5, 0, 5])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 0, in: pool), pool[1])
        XCTAssertEqual(SelectionEngine.candidate(forTicket: 5, in: pool), pool[3])
    }

    func testPickReportsDrawTimeOdds() throws {
        var rng = SeededGenerator(seed: 1)
        let pool = candidates([40, 30, 20, 10])
        let pick = try SelectionEngine.selectWinner(pool, using: &rng)
        let winner = pool.first { $0.id == pick.id }!
        XCTAssertEqual(pick.numeratorWeight, winner.weight)
        XCTAssertEqual(pick.totalEligibleWeight, 100)
    }

    func testWeightZeroIsNeverDrawn() throws {
        var rng = SeededGenerator(seed: 7)
        let pool = candidates([0, 1, 1])
        for _ in 0..<5_000 {
            XCTAssertNotEqual(try SelectionEngine.selectWinner(pool, using: &rng).id, pool[0].id)
        }
    }

    func testNoEligibleEntriesThrows() {
        var rng = SeededGenerator(seed: 2)
        XCTAssertThrowsError(try SelectionEngine.selectWinner([], using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .noEligibleEntries)
        }
        XCTAssertThrowsError(try SelectionEngine.selectWinner(candidates([0, 0]), using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .noEligibleEntries)
        }
    }

    func testSingleEligibleEntryAlwaysWins() throws {
        var rng = SeededGenerator(seed: 3)
        let pool = candidates([0, 7, 0])
        for _ in 0..<200 {
            let pick = try SelectionEngine.selectWinner(pool, using: &rng)
            XCTAssertEqual(pick.id, pool[1].id)
            XCTAssertEqual(pick.numeratorWeight, pick.totalEligibleWeight)
        }
    }

    func testSequenceWithoutReplacementIsUnique() throws {
        var rng = SeededGenerator(seed: 4)
        let pool = candidates(Array(repeating: 1, count: 10))
        for _ in 0..<200 {
            let picks = try SelectionEngine.selectSequence(pool, count: 6, withReplacement: false, using: &rng)
            XCTAssertEqual(Set(picks.map(\.id)).count, 6)
            // Each pick's denominator shrinks as the pool does.
            XCTAssertEqual(picks.map(\.totalEligibleWeight), [10, 9, 8, 7, 6, 5])
        }
    }

    func testSequenceWithoutReplacementCannotExceedPool() {
        var rng = SeededGenerator(seed: 5)
        XCTAssertThrowsError(try SelectionEngine.selectSequence(candidates([1, 1, 0]), count: 3, withReplacement: false, using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .countExceedsPool(available: 2))
        }
        XCTAssertThrowsError(try SelectionEngine.selectSequence(candidates([1]), count: 0, withReplacement: true, using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .invalidCount)
        }
    }

    func testSequenceWithReplacementAllowsRepeats() throws {
        var rng = SeededGenerator(seed: 6)
        let pool = candidates([1, 1])
        let picks = try SelectionEngine.selectSequence(pool, count: 20, withReplacement: true, using: &rng)
        XCTAssertEqual(picks.count, 20)
        XCTAssertLessThan(Set(picks.map(\.id)).count, picks.count, "20 picks from 2 entries must repeat")
        XCTAssertTrue(picks.allSatisfy { $0.totalEligibleWeight == 2 })
    }

    func testUniqueOrderIsAPermutationOfPositiveWeights() throws {
        var rng = SeededGenerator(seed: 8)
        let pool = candidates([8, 7, 6, 5, 4, 3, 2, 1, 0])
        let expected = Set(pool.filter { $0.weight > 0 }.map(\.id))
        for _ in 0..<500 {
            let order = try SelectionEngine.uniqueOrder(pool, using: &rng)
            XCTAssertEqual(order.count, 8)
            XCTAssertEqual(Set(order.map(\.id)), expected)
        }
    }

    /// Sanity check, not a proof: 120,000 draws at 40/30/20/10 land within
    /// 1 percentage point of the configured shares (about 6.6 standard
    /// errors for the 40% entry), and pass a chi-square test at p = 0.001.
    func testObservedFrequenciesMatchWeights() throws {
        var rng = SystemRandomNumberGenerator()
        let weights = [40, 30, 20, 10]
        let pool = candidates(weights)
        let draws = 120_000
        var counts: [UUID: Int] = [:]
        for _ in 0..<draws {
            counts[try SelectionEngine.selectWinner(pool, using: &rng).id, default: 0] += 1
        }
        var chiSquare = 0.0
        for candidate in pool {
            let expected = Double(draws) * Double(candidate.weight) / 100
            let observed = Double(counts[candidate.id, default: 0])
            XCTAssertEqual(observed / Double(draws), Double(candidate.weight) / 100, accuracy: 0.01)
            chiSquare += (observed - expected) * (observed - expected) / expected
        }
        // Critical value for 3 degrees of freedom at p = 0.001.
        XCTAssertLessThan(chiSquare, 16.27)
    }

    func testSystemGeneratorConvenienceWorks() throws {
        let pool = candidates([1, 2, 3])
        let pick = try SelectionEngine.selectWinner(pool)
        XCTAssertTrue(pool.contains { $0.id == pick.id })
        XCTAssertEqual(try SelectionEngine.selectSequence(pool, count: 3, withReplacement: false).count, 3)
    }
}
