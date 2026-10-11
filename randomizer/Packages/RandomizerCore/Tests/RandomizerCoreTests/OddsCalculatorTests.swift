import XCTest
@testable import RandomizerCore

final class OddsCalculatorTests: XCTestCase {
    func testStandingsWeightsForEightAreEightDownToOne() {
        XCTAssertEqual(OddsCalculator.reverseStandingsWeights(count: 8), [8, 7, 6, 5, 4, 3, 2, 1])
        XCTAssertEqual(OddsCalculator.reverseStandingsWeights(count: 0), [])
        let league = Fixtures.league(Fixtures.teams(8))
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.weight), [8, 7, 6, 5, 4, 3, 2, 1])
        XCTAssertEqual(rows.map(\.standing), Array(1...8))
        XCTAssertEqual(rows[0].chanceText, "22.22%")
        XCTAssertEqual(rows[7].chanceText, "2.78%")
        XCTAssertTrue(rows.allSatisfy { $0.status == .inLottery })
    }

    /// Only the lottery's teams get weight, counted down from the size of
    /// the lottery, not the league.
    func testStandingsWeightsCountOnlyLotteryTeams() {
        let league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.weight), [6, 5, 4, 3, 2, 1, 0, 0, 0, 0])
        XCTAssertEqual(rows.prefix(6).map(\.status), Array(repeating: .inLottery, count: 6))
        XCTAssertEqual(rows.suffix(4).map(\.status), Array(repeating: .notInLottery, count: 4))
        XCTAssertEqual(rows[0].chanceText, "28.57%")
        XCTAssertEqual(rows[0].denominator, 21)
        XCTAssertEqual(rows[6].chanceText, "0%")
        XCTAssertEqual(league.totalLotteryWeight, 21)
    }

    func testEqualOddsIgnoreStoredWeights() {
        let league = Fixtures.league(["A", "B", "C", "D"], weights: [0, 900, 3, 3], mode: .equal)
        XCTAssertEqual(OddsCalculator.rows(for: league).map(\.chanceText), ["25%", "25%", "25%", "25%"])
        XCTAssertEqual(league.lotteryCandidates.count, 4)
    }

    func testCustomWeightsGiveExactShares() {
        let league = Fixtures.league(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.probability), [0.4, 0.3, 0.2, 0.1])
        XCTAssertEqual(rows.map(\.chanceText), ["40%", "30%", "20%", "10%"])
    }

    func testWeightZeroInsideTheLotteryHasNoChance() {
        let league = Fixtures.league(["A", "B", "C"], weights: [0, 1, 3], mode: .customWeighted)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows[0].status, .noChance)
        XCTAssertEqual(rows[0].chanceText, "0%")
        XCTAssertEqual(league.lotteryCandidates.count, 2)
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[2].id), "75%")
    }

    func testCustomWeightsOutsideTheLotteryDontCount() {
        let league = Fixtures.league(["A", "B", "C"], weights: [1, 1, 500], mode: .customWeighted, lotteryTeams: 2)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.chanceText), ["50%", "50%", "0%"])
        XCTAssertEqual(rows[2].status, .notInLottery)
    }

    // MARK: Top-N chances

    func testTopPickChancesForThreeTeamsTakingTwo() throws {
        // A: 3/6 + 2/6 * 3/4 + 1/6 * 3/5 = 0.85, and so on.
        let chances = try XCTUnwrap(OddsCalculator.topPickProbabilities(weights: [3, 2, 1], picks: 2))
        XCTAssertEqual(chances[0], 0.85, accuracy: 1e-12)
        XCTAssertEqual(chances[1], 11.0 / 15.0, accuracy: 1e-12)
        XCTAssertEqual(chances[2], 5.0 / 12.0, accuracy: 1e-12)
    }

    /// The well-known 14-team lottery that draws the top four picks with
    /// 140, 140, 140, 125 ... 5 combinations: the worst three each land a
    /// top-four pick 52.14% of the time, the 14th 2.41%.
    func testTopPickChancesMatchAWellKnownFourteenTeamTable() throws {
        let weights = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]
        let chances = try XCTUnwrap(OddsCalculator.topPickProbabilities(weights: weights, picks: 4))
        let percents = chances.map { ($0 * 10_000).rounded() / 100 }
        XCTAssertEqual(percents, [52.14, 52.14, 52.14, 48.08, 42.12, 37.23, 31.96, 26.31, 20.28, 13.88, 9.41, 7.12, 4.79, 2.41])
        XCTAssertEqual(chances.reduce(0, +), 4, accuracy: 1e-9)
    }

    func testTopPickChancesAlwaysSumToThePicksDrawn() throws {
        var rng = SeededGenerator(seed: 31)
        for _ in 0..<20 {
            let count = Int.random(in: 3...12, using: &rng)
            let weights = (0..<count).map { _ in Int.random(in: 0...50, using: &rng) }
            let active = weights.filter { $0 > 0 }.count
            let picks = Int.random(in: 1...count, using: &rng)
            let chances = try XCTUnwrap(OddsCalculator.topPickProbabilities(weights: weights, picks: picks))
            XCTAssertEqual(chances.reduce(0, +), Double(min(picks, active)), accuracy: 1e-9)
            for (weight, chance) in zip(weights, chances) where weight == 0 {
                XCTAssertEqual(chance, 0)
            }
        }
    }

    func testTopPickChancesCanDeclineHugeTables() {
        let weights = Array(repeating: 1, count: 32)
        XCTAssertNil(OddsCalculator.topPickProbabilities(weights: weights, picks: 16))
        XCTAssertNotNil(OddsCalculator.topPickProbabilities(weights: weights, picks: 3))
        // Every team drawn is certain, and needs no table.
        XCTAssertEqual(OddsCalculator.topPickProbabilities(weights: weights, picks: 32), Array(repeating: 1, count: 32))
    }

    func testRowsShowTopNChancesOnlyWhenContested() {
        let topFour = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6, drawnPicks: 4)
        let rows = OddsCalculator.rows(for: topFour)
        XCTAssertTrue(topFour.drawnPicksAreContested)
        XCTAssertEqual(rows.prefix(6).compactMap(\.drawnPickChanceText), ["88.76%", "84.56%", "78.19%", "68.11%", "51.66%", "28.72%"])
        XCTAssertTrue(rows.suffix(4).allSatisfy { $0.drawnPickProbability == nil })

        let everyPick = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6)
        XCTAssertFalse(everyPick.drawnPicksAreContested)
        XCTAssertTrue(OddsCalculator.rows(for: everyPick).allSatisfy { $0.drawnPickProbability == nil })
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

    func testRevealStyleNeverChangesOdds() {
        let league = Fixtures.league(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted, drawnPicks: 2)
        let before = OddsCalculator.rows(for: league)
        for style in RevealStyle.allCases {
            var copy = league
            copy.setRevealStyle(style, now: Fixtures.now)
            XCTAssertEqual(OddsCalculator.rows(for: copy), before)
            XCTAssertEqual(copy.lotteryCandidates, league.lotteryCandidates)
            XCTAssertEqual(copy.teams, league.teams)
        }
    }

    func testMaximumLeagueDoesNotOverflow() {
        let league = Fixtures.league(
            Fixtures.teams(Limits.maxTeams),
            weights: Array(repeating: Limits.maxWeight, count: Limits.maxTeams),
            mode: .customWeighted
        )
        XCTAssertEqual(league.totalLotteryWeight, 32_000)
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[0].id), "3.13%")
    }
}
