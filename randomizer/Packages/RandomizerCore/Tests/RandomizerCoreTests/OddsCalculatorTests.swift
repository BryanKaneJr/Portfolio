import XCTest
@testable import RandomizerCore

final class OddsCalculatorTests: XCTestCase {
    // MARK: Pro Lottery

    /// A full 14-team pro lottery gets the pros' own combinations: 14% for
    /// each of the worst three at #1, down to 0.5%.
    func testProTableForFourteenTeams() {
        let league = Fixtures.league(Fixtures.teams(14), lotteryTeams: 14)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.weight), LotteryOdds.proTable)
        XCTAssertEqual(rows.map(\.chanceText), ["14%", "14%", "14%", "12.5%", "10.5%", "9%", "7.5%", "6%", "4.5%", "3%", "2%", "1.5%", "1%", "0.5%"])
    }

    /// The well-known 14-team table: the worst three each land a top-four
    /// pick 52.14% of the time, the 14th 2.41%.
    func testProTopFourChancesMatchTheProTable() throws {
        let chances = try XCTUnwrap(OddsCalculator.topPickProbabilities(weights: LotteryOdds.proTable, picks: 4))
        let percents = chances.map { ($0 * 10_000).rounded() / 100 }
        XCTAssertEqual(percents, [52.14, 52.14, 52.14, 48.08, 42.12, 37.23, 31.96, 26.31, 20.28, 13.88, 9.41, 7.12, 4.79, 2.41])
        XCTAssertEqual(chances.reduce(0, +), 4, accuracy: 1e-9)
    }

    /// A smaller lottery keeps the pros' ratios: the six worst teams'
    /// combinations, playoff teams at 0.
    func testProSixTeamLotteryInATenTeamLeague() {
        let league = Fixtures.league(Fixtures.teams(10))
        XCTAssertEqual(league.lotteryTeams, 6, "Four playoff teams by default in a ten-team league")
        XCTAssertEqual(league.drawnPicks, 4)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.map(\.weight), [140, 140, 140, 125, 105, 90, 0, 0, 0, 0])
        XCTAssertEqual(rows.prefix(6).map(\.chanceText), ["18.92%", "18.92%", "18.92%", "16.89%", "14.19%", "12.16%"])
        XCTAssertEqual(rows.prefix(6).compactMap(\.drawnPickChanceText), ["72%", "72%", "72%", "67.83%", "61.1%", "55.06%"])
        XCTAssertEqual(rows.suffix(4).map(\.status), Array(repeating: .notInLottery, count: 4))
        XCTAssertTrue(rows.suffix(4).allSatisfy { $0.drawnPickProbability == nil && $0.chanceText == "0%" })
    }

    func testProWeightsPastFourteenTeamsGetTheSmallestShare() {
        XCTAssertEqual(LotteryOdds.proWeights(count: 16).suffix(3), [5, 5, 5])
        XCTAssertEqual(LotteryOdds.proWeights(count: 3), [140, 140, 140])
        XCTAssertEqual(LotteryOdds.proWeights(count: 0), [])
    }

    func testProDefaultsFollowLeagueSize() {
        let expected = [2: 2, 3: 2, 4: 2, 6: 3, 8: 4, 10: 6, 12: 6, 14: 8, 16: 8, 32: 16]
        for (teams, lottery) in expected {
            XCTAssertEqual(LotteryOdds.defaultProLotteryTeams(teamCount: teams), lottery, "\(teams) teams")
        }
    }

    // MARK: Long Shot

    /// Everyone's in, and the champion (best finish) has exactly a 1% shot
    /// at #1, whatever the league size.
    func testLongShotGivesTheChampExactlyOnePercent() {
        for count in [2, 4, 8, 10, 12, 14, 16, 20, 32] {
            let weights = LotteryOdds.longShotWeights(count: count)
            XCTAssertEqual(weights.count, count)
            XCTAssertEqual(weights.reduce(0, +), 1_000, "\(count) teams")
            XCTAssertEqual(weights.last, 10, "\(count) teams")
            XCTAssertEqual(weights, weights.sorted(by: >), "Worse finish, better odds")
        }
        XCTAssertEqual(LotteryOdds.longShotWeights(count: 10), [190, 170, 150, 130, 110, 90, 70, 50, 30, 10])
        let league = Fixtures.league(Fixtures.teams(10), type: .longShot)
        let rows = OddsCalculator.rows(for: league)
        XCTAssertEqual(rows.first?.chanceText, "19%")
        XCTAssertEqual(rows.last?.chanceText, "1%")
        XCTAssertTrue(rows.allSatisfy { $0.status == .inLottery && $0.drawnPickProbability == nil })
    }

    // MARK: Slot Draft

    func testSlotDraftGivesEveryoneTheSameChanceToChooseFirst() {
        let league = Fixtures.league(Fixtures.teams(8), type: .slotDraft)
        XCTAssertEqual(OddsCalculator.rows(for: league).map(\.chanceText), Array(repeating: "12.5%", count: 8))
    }

    // MARK: Exact top-N chances

    func testTopPickChancesForThreeTeamsTakingTwo() throws {
        // A: 3/6 + 2/6 * 3/4 + 1/6 * 3/5 = 0.85, and so on.
        let chances = try XCTUnwrap(OddsCalculator.topPickProbabilities(weights: [3, 2, 1], picks: 2))
        XCTAssertEqual(chances[0], 0.85, accuracy: 1e-12)
        XCTAssertEqual(chances[1], 11.0 / 15.0, accuracy: 1e-12)
        XCTAssertEqual(chances[2], 5.0 / 12.0, accuracy: 1e-12)
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

    func testTopPickChancesAreTheSameEveryTime() {
        let first = OddsCalculator.topPickProbabilities(weights: LotteryOdds.proTable, picks: 4)
        for _ in 0..<5 {
            XCTAssertEqual(OddsCalculator.topPickProbabilities(weights: LotteryOdds.proTable, picks: 4), first)
        }
    }

    func testTopPickChancesCanDeclineHugeTables() {
        let weights = Array(repeating: 1, count: 32)
        XCTAssertNil(OddsCalculator.topPickProbabilities(weights: weights, picks: 16))
        XCTAssertNotNil(OddsCalculator.topPickProbabilities(weights: weights, picks: 3))
        XCTAssertEqual(OddsCalculator.topPickProbabilities(weights: weights, picks: 32), Array(repeating: 1, count: 32))
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
        let league = Fixtures.league(Fixtures.teams(8), lotteryTeams: 5, drawnPicks: 2)
        let before = OddsCalculator.rows(for: league)
        for style in RevealStyle.allCases {
            var copy = league
            copy.setRevealStyle(style, now: Fixtures.now)
            XCTAssertEqual(OddsCalculator.rows(for: copy), before)
            XCTAssertEqual(copy.lotteryCandidates, league.lotteryCandidates)
        }
    }

    func testMaximumLeagueDoesNotOverflow() {
        for type in LotteryType.allCases {
            let league = Fixtures.league(Fixtures.teams(Limits.maxTeams), type: type)
            XCTAssertGreaterThan(league.totalLotteryWeight, 0)
            XCTAssertNotEqual(league.firstPickChanceText(of: league.teams[0].id), "0%")
        }
    }
}
