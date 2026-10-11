import XCTest
@testable import RandomizerCore

final class LotteryTests: XCTestCase {
    // MARK: Format

    func testFormatDefaultsToEveryTeamAndEveryPick() {
        let league = Fixtures.league(Fixtures.teams(10))
        XCTAssertEqual(league.lotteryTeams, 10)
        XCTAssertEqual(league.drawnPicks, 10)
        XCTAssertEqual(league.lotteryTeamsText, "All 10 teams in the lottery")
        XCTAssertEqual(league.drawnPicksText, "Every pick drawn")
        XCTAssertNil(league.standingsPicksText)
    }

    func testFormatIsClampedToTheLeague() {
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 1).lotteryTeams, 2)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 40).lotteryTeams, 10)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 6, drawnPicks: 0).drawnPicks, 1)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 6, drawnPicks: 9).drawnPicks, 6)
        XCTAssertEqual(Fixtures.league(["Solo"]).lotteryTeams, 1)
        XCTAssertEqual(Fixtures.league([]).drawnPicks, 0)
    }

    func testFormatWording() {
        let league = Fixtures.league(Fixtures.teams(14), lotteryTeams: 6, drawnPicks: 4)
        XCTAssertEqual(league.lotteryTeamsText, "Worst 6 of 14 teams in the lottery")
        XCTAssertEqual(league.drawnPicksText, "Top 4 picks drawn")
        XCTAssertEqual(league.standingsPicksText, "Picks 5\u{2013}14 by standings")
        let lotteryOnly = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6)
        XCTAssertEqual(lotteryOnly.drawnPicksText, "Picks 1\u{2013}6 drawn")
        XCTAssertEqual(lotteryOnly.standingsPicksText, "Picks 7\u{2013}10 by standings")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(3), drawnPicks: 1).drawnPicksText, "Only pick 1 drawn")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(3), drawnPicks: 2).standingsPicksText, "Pick 3 by standings")
    }

    // MARK: Running

    func testEveryPickDrawnIsAWeightedPermutation() throws {
        var rng = SeededGenerator(seed: 1)
        for _ in 0..<200 {
            var league = Fixtures.league(Fixtures.teams(8))
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(run.picks.map(\.pick), Array(1...8))
            XCTAssertEqual(Set(run.picks.map(\.teamID)), Set(league.teams.map(\.id)))
            XCTAssertTrue(run.picks.allSatisfy(\.wasDrawn))
            XCTAssertEqual(run.drawnPicks, 8)
            // The pool shrinks by each drawn team's weight.
            var remaining = 36
            for pick in run.picks {
                XCTAssertEqual(pick.totalWeight, remaining)
                XCTAssertEqual(pick.numeratorWeight, 9 - pick.standing)
                remaining -= pick.numeratorWeight
            }
        }
    }

    /// The worst six are in the lottery for picks 1 to 6; the four teams
    /// above them pick 7 to 10 in standings order, every time.
    func testTeamsOutsideTheLotteryPickInStandingsOrder() throws {
        var rng = SeededGenerator(seed: 2)
        for _ in 0..<200 {
            var league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6)
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(Set(run.lotteryPicks.map(\.standing)), Set(1...6))
            XCTAssertTrue(run.lotteryPicks.allSatisfy(\.wasDrawn))
            XCTAssertEqual(run.standingsPicks.map(\.standing), [7, 8, 9, 10])
            XCTAssertEqual(run.standingsPicks.map(\.pick), [7, 8, 9, 10])
            XCTAssertTrue(run.standingsPicks.allSatisfy { !$0.wasDrawn && $0.chanceText == "By standings" })
        }
    }

    /// Top four drawn from six: the two lottery teams not drawn pick 5 and
    /// 6, worst first, ahead of everyone outside the lottery.
    func testUndrawnLotteryTeamsFollowTheDrawnPicksByStandings() throws {
        var rng = SeededGenerator(seed: 3)
        for _ in 0..<300 {
            var league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6, drawnPicks: 4)
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(run.drawnPicks, 4)
            XCTAssertTrue(run.picks.prefix(4).allSatisfy(\.wasDrawn))
            let undrawn = run.picks[4...5]
            XCTAssertTrue(undrawn.allSatisfy { !$0.wasDrawn })
            XCTAssertLessThan(undrawn.first!.standing, undrawn.last!.standing)
            XCTAssertEqual(Set(run.picks.prefix(6).map(\.standing)), Set(1...6))
            XCTAssertEqual(run.picks.suffix(4).map(\.standing), [7, 8, 9, 10])
        }
    }

    func testZeroWeightLotteryTeamIsNeverDrawnButStaysAheadOfNonLotteryTeams() throws {
        var rng = SeededGenerator(seed: 4)
        for _ in 0..<200 {
            var league = Fixtures.league(["A", "B", "C", "D", "E"], weights: [0, 5, 5, 9, 9], mode: .customWeighted, lotteryTeams: 3)
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(run.drawnPicks, 2, "Only two lottery teams have a chance")
            XCTAssertEqual(Set(run.picks.prefix(2).map(\.teamName)), ["B", "C"])
            XCTAssertEqual(run.picks.dropFirst(2).map(\.teamName), ["A", "D", "E"])
        }
    }

    func testRunErrors() {
        var rng = SeededGenerator(seed: 5)
        var solo = Fixtures.league(["Only"])
        XCTAssertThrowsError(try solo.runLottery(using: &rng)) { XCTAssertEqual($0 as? DrawError, .notEnoughTeams) }
        XCTAssertEqual(solo.runProblem, "Add at least two teams to run the lottery.")

        var zeros = Fixtures.league(["A", "B", "C"], weights: [0, 0, 7], mode: .customWeighted, lotteryTeams: 2)
        XCTAssertThrowsError(try zeros.runLottery(using: &rng)) { XCTAssertEqual($0 as? DrawError, .noLotteryChances) }
        XCTAssertEqual(zeros.runProblem, "Give at least one lottery team a weight above 0.")
        XCTAssertNil(zeros.latestRun)
        XCTAssertEqual(zeros.runCount, 0)
        XCTAssertNil(Fixtures.league(["A", "B"]).runProblem)
    }

    /// Re-running is always visible: the number goes up and the new order
    /// replaces the old one.
    func testRunNumbersCountEveryRunUntilANewSeason() throws {
        var rng = SeededGenerator(seed: 6)
        var league = Fixtures.league(Fixtures.teams(6))
        let first = try league.runLottery(now: Fixtures.now, using: &rng)
        XCTAssertEqual(first.number, 1)
        let second = try league.runLottery(now: Fixtures.now.addingTimeInterval(60), using: &rng)
        XCTAssertEqual(second.number, 2)
        XCTAssertEqual(league.latestRun, second)
        XCTAssertEqual(league.runCount, 2)
        XCTAssertEqual(league.lastUsedAt, Fixtures.now.addingTimeInterval(60))

        league.startNewSeason(now: Fixtures.now)
        XCTAssertNil(league.latestRun)
        XCTAssertEqual(league.runCount, 0)
        XCTAssertEqual(league.teams.count, 6, "Teams and standings stay for next season")
        XCTAssertEqual(try league.runLottery(using: &rng).number, 1)
    }

    func testRunIsASnapshot() throws {
        var rng = SeededGenerator(seed: 7)
        var league = Fixtures.league(["A", "B", "C"], lotteryTeams: 2)
        let run = try league.runLottery(now: Fixtures.now, using: &rng)
        try league.renameTeam(league.teams[2].id, to: "Renamed")
        league.moveTeams(fromOffsets: IndexSet(integer: 2), toOffset: 0)
        league.setOddsMode(.equal)
        league.deleteTeams([league.teams[1].id])
        XCTAssertEqual(league.latestRun, run)
        XCTAssertEqual(run.picks[2].teamName, "C")
        XCTAssertEqual(run.oddsMode, .reverseStandings)
    }

    // MARK: Reveal

    func testRevealCountsDownThroughTheLotteryPicks() throws {
        var rng = SeededGenerator(seed: 8)
        var league = Fixtures.league(Fixtures.teams(8), lotteryTeams: 5, drawnPicks: 3)
        var run = try league.runLottery(now: Fixtures.now, using: &rng)
        XCTAssertEqual(run.revealOrder.map(\.pick), [5, 4, 3, 2, 1])
        XCTAssertEqual(run.nextToReveal?.pick, 5)
        XCTAssertEqual(run.picks.filter(run.isRevealed).map(\.pick), [6, 7, 8], "Teams outside the lottery are never hidden")

        league.revealNextPick()
        league.revealNextPick()
        run = try XCTUnwrap(league.latestRun)
        XCTAssertEqual(run.revealedCount, 2)
        XCTAssertEqual(run.nextToReveal?.pick, 3)
        XCTAssertEqual(run.picks.filter(run.isRevealed).map(\.pick), [4, 5, 6, 7, 8])

        league.revealAllPicks()
        run = try XCTUnwrap(league.latestRun)
        XCTAssertTrue(run.isFullyRevealed)
        XCTAssertNil(run.nextToReveal)
        XCTAssertEqual(run.picks.filter(run.isRevealed).count, 8)
        league.revealNextPick()
        XCTAssertEqual(league.latestRun?.revealedCount, 5)

        let order = run.picks
        league.replayReveal()
        XCTAssertEqual(league.latestRun?.revealedCount, 0)
        XCTAssertEqual(league.latestRun?.picks, order, "Replaying never changes the order")
    }

    func testANewRunStartsHidden() throws {
        var rng = SeededGenerator(seed: 9)
        var league = Fixtures.league(Fixtures.teams(4))
        try league.runLottery(using: &rng)
        league.revealAllPicks()
        try league.runLottery(using: &rng)
        XCTAssertEqual(league.latestRun?.revealedCount, 0)
    }

    // MARK: Fairness

    /// Sanity check, not a proof: over 60,000 seeded runs each lottery
    /// team's share of the #1 pick is within a point of weight / 21, and
    /// its share of a top-four pick matches the exact table.
    func testObservedPickSharesMatchTheOddsTable() throws {
        var rng = SeededGenerator(seed: 10)
        var league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 6, drawnPicks: 4)
        let rows = OddsCalculator.rows(for: league)
        let runs = 60_000
        var firsts = [Int](repeating: 0, count: 10)
        var topFour = [Int](repeating: 0, count: 10)
        for _ in 0..<runs {
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            firsts[run.picks[0].standing - 1] += 1
            for pick in run.picks.prefix(4) { topFour[pick.standing - 1] += 1 }
        }
        for row in rows {
            let index = row.standing - 1
            XCTAssertEqual(Double(firsts[index]) / Double(runs), row.probability, accuracy: 0.01)
            XCTAssertEqual(Double(topFour[index]) / Double(runs), row.drawnPickProbability ?? 0, accuracy: 0.01)
        }
    }

    // MARK: Sample and sharing

    func testSampleLeague() {
        let sample = SampleLeague.make(now: Fixtures.now)
        XCTAssertTrue(sample.isSample)
        XCTAssertEqual(sample.teams.map(\.name), SampleLeague.teams)
        XCTAssertEqual(sample.teams.count, 10)
        XCTAssertEqual(sample.oddsMode, .reverseStandings)
        XCTAssertEqual(sample.lotteryTeamsText, "Worst 6 of 10 teams in the lottery")
        XCTAssertEqual(sample.drawnPicksText, "Picks 1\u{2013}6 drawn")
        XCTAssertEqual(sample.standingsPicksText, "Picks 7\u{2013}10 by standings")
        XCTAssertNil(sample.runProblem)
        XCTAssertEqual(sample.firstPickChanceText(of: sample.teams[0].id), "28.57%")
    }

    func testShareTextNamesTheRunAndHowEachPickWasDecided() throws {
        var rng = SeededGenerator(seed: 11)
        var league = Fixtures.league(Fixtures.teams(6), lotteryTeams: 4, drawnPicks: 2)
        try league.runLottery(now: Fixtures.now, using: &rng)
        let run = try league.runLottery(now: Fixtures.now, using: &rng)
        let text = ResultsExporter.runText(title: "Sunday League", run: run, dateText: "Oct 11")
        let lines = text.components(separatedBy: "\n")
        XCTAssertEqual(lines[0], "Sunday League: draft order")
        XCTAssertEqual(lines[1], "Lottery run #2 \u{00B7} Oct 11")
        XCTAssertEqual(lines[2], "Worst 4 of 6 teams, weighted by standings. Picks 1\u{2013}2 drawn.")
        let first = run.picks[0]
        XCTAssertEqual(lines[4], "1. \(first.teamName) (drawn, finished \(Ordinal.text(first.standing)), \(first.movementText))")
        let third = run.picks[2]
        XCTAssertEqual(lines[6], "3. \(third.teamName) (by standings, finished \(Ordinal.text(third.standing)), \(third.movementText))")
        XCTAssertEqual(lines[9], "6. Team 6 (by standings)")
        XCTAssertEqual(lines.last, "Drawn with Draft Lottery")
        XCTAssertFalse(text.contains("%"), "Per-pick chances read as odds of the whole lottery, so they're left out")
    }

    func testMovementAgainstTheFinish() {
        let jump = LotteryPick(pick: 1, teamID: UUID(), teamName: "A", standing: 4, wasDrawn: true)
        XCTAssertEqual(jump.movement, 3)
        XCTAssertEqual(jump.movementText, "up 3")
        XCTAssertEqual(jump.finishText, "Finished 4th")
        let fall = LotteryPick(pick: 5, teamID: UUID(), teamName: "B", standing: 1, wasDrawn: false)
        XCTAssertEqual(fall.movementText, "down 4")
        XCTAssertEqual(LotteryPick(pick: 2, teamID: UUID(), teamName: "C", standing: 2, wasDrawn: true).movementText, "no change")
        XCTAssertEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32].map(Ordinal.text), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "32nd"])
    }
}
