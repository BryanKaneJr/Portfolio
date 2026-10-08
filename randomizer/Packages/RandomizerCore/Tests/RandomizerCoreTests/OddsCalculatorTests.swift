import XCTest
@testable import RandomizerCore

final class OddsCalculatorTests: XCTestCase {
    func testEqualOddsWithFourEntriesAreExactlyAQuarter() {
        let list = Fixtures.list(["A", "B", "C", "D"])
        for entry in list.entries {
            XCTAssertEqual(list.probability(of: entry.id), 0.25)
            XCTAssertEqual(list.chanceText(of: entry.id), "25%")
        }
    }

    func testEqualModeIgnoresStoredWeights() {
        let list = Fixtures.list(["A", "B"], weights: [0, 900], mode: .equal)
        XCTAssertEqual(list.eligibleCount, 2)
        XCTAssertEqual(list.probability(of: list.entries[0].id), 0.5)
    }

    func testCustomWeightsGiveExactShares() {
        let list = Fixtures.list(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted)
        let rows = OddsCalculator.rows(for: list)
        XCTAssertEqual(rows.map(\.probability), [0.4, 0.3, 0.2, 0.1])
        XCTAssertEqual(rows.map(\.chanceText), ["40%", "30%", "20%", "10%"])
        XCTAssertEqual(rows.map(\.weight), [40, 30, 20, 10])
    }

    func testRemovingTheHeaviestEntryRenormalises() throws {
        var list = Fixtures.list(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted)
        list.removedEntryIDs.insert(Fixtures.id("A", in: list))
        let rows = OddsCalculator.rows(for: list)
        XCTAssertEqual(rows[0].status, .removed)
        XCTAssertEqual(rows[0].chanceText, "0%")
        XCTAssertEqual(rows[1].numerator, 30)
        XCTAssertEqual(rows[1].denominator, 60)
        XCTAssertEqual(rows.dropFirst().map(\.chanceText), ["50%", "33.33%", "16.67%"])
        XCTAssertEqual(rows[2].probability, 20.0 / 60.0, accuracy: 1e-12)
    }

    func testReverseStandingsForEightIsEightDownToOne() {
        XCTAssertEqual(OddsCalculator.reverseStandingsWeights(count: 8), [8, 7, 6, 5, 4, 3, 2, 1])
        XCTAssertEqual(OddsCalculator.reverseStandingsWeights(count: 0), [])
        let list = Fixtures.list((1...8).map { "Team \($0)" }, mode: .reverseStandings)
        let rows = OddsCalculator.rows(for: list)
        XCTAssertEqual(rows.map(\.weight), [8, 7, 6, 5, 4, 3, 2, 1])
        XCTAssertEqual(rows.map(\.rank), Array(1...8))
        XCTAssertEqual(rows[0].chanceText, "22.22%")
        XCTAssertEqual(rows[7].chanceText, "2.78%")
    }

    func testReverseStandingsWeightsStayFixedAfterRemoval() {
        var list = Fixtures.list((1...8).map { "Team \($0)" }, mode: .reverseStandings)
        list.removedEntryIDs.insert(list.entries[0].id)
        let rows = OddsCalculator.rows(for: list)
        // The worst team is out; the others keep their preset weights and
        // their chances renormalise over 28.
        XCTAssertEqual(rows.dropFirst().map(\.weight), [7, 6, 5, 4, 3, 2, 1])
        XCTAssertEqual(rows[1].denominator, 28)
        XCTAssertEqual(rows[1].chanceText, "25%")
    }

    func testWeightZeroIsExcludedNotRemoved() {
        let list = Fixtures.list(["A", "B", "C"], weights: [0, 1, 3], mode: .customWeighted)
        let rows = OddsCalculator.rows(for: list)
        XCTAssertEqual(rows[0].status, .excluded)
        XCTAssertEqual(rows[0].chanceText, "0%")
        XCTAssertEqual(list.excludedEntries.map(\.name), ["A"])
        XCTAssertEqual(list.eligibleCount, 2)
        XCTAssertTrue(list.removedEntryIDs.isEmpty)
    }

    func testOddsFollowEligibleEntriesNotAllSaved() {
        var list = Fixtures.list(["A", "B", "C", "D", "E"])
        list.removedEntryIDs = [list.entries[0].id, list.entries[1].id]
        XCTAssertEqual(list.eligibleCount, 3)
        XCTAssertEqual(list.chanceText(of: list.entries[4].id), "33.33%")
    }

    func testPercentFormatting() {
        XCTAssertEqual(OddsCalculator.formatPercent(0), "0%")
        XCTAssertEqual(OddsCalculator.formatPercent(1), "100%")
        XCTAssertEqual(OddsCalculator.formatPercent(0.5), "50%")
        XCTAssertEqual(OddsCalculator.formatPercent(0.125), "12.5%")
        XCTAssertEqual(OddsCalculator.formatPercent(1.0 / 3.0), "33.33%")
        XCTAssertEqual(OddsCalculator.formatPercent(2.0 / 3.0), "66.67%")
        // Tiny but nonzero never reads as 0%.
        XCTAssertEqual(OddsCalculator.formatPercent(1.0 / 200_000), "<0.1%")
        XCTAssertEqual(OddsCalculator.formatPercent(numerator: 1, denominator: 200_000), "<0.1%")
        // Nearly certain never reads as 100%.
        XCTAssertEqual(OddsCalculator.formatPercent(numerator: 199_999, denominator: 200_000), ">99.99%")
        XCTAssertEqual(OddsCalculator.formatPercent(numerator: 5, denominator: 5), "100%")
        XCTAssertEqual(OddsCalculator.formatPercent(numerator: 0, denominator: 5), "0%")
        XCTAssertEqual(OddsCalculator.formatPercent(numerator: 1, denominator: 0), "0%")
    }

    func testRevealStyleNeverChangesOddsOrPool() {
        var list = Fixtures.list(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted)
        list.removedEntryIDs.insert(list.entries[1].id)
        let before = OddsCalculator.rows(for: list)
        let pool = list.eligibleCandidates
        for style in RevealStyle.allCases {
            var copy = list
            copy.setRevealStyle(style, now: Fixtures.now)
            XCTAssertEqual(OddsCalculator.rows(for: copy), before)
            XCTAssertEqual(copy.eligibleCandidates, pool)
            XCTAssertEqual(copy.removeAfterSelection, list.removeAfterSelection)
            XCTAssertEqual(copy.removedEntryIDs, list.removedEntryIDs)
            XCTAssertEqual(copy.entries, list.entries)
            XCTAssertEqual(copy.oddsMode, list.oddsMode)
        }
    }

    func testMaximumConfigurationDoesNotOverflow() {
        let list = Fixtures.list(
            (1...Limits.maxEntries).map { "E\($0)" },
            weights: Array(repeating: Limits.maxWeight, count: Limits.maxEntries),
            mode: .customWeighted
        )
        XCTAssertEqual(list.totalEligibleWeight, 200_000)
        XCTAssertEqual(list.chanceText(of: list.entries[0].id), "0.5%")
    }
}
