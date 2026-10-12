import XCTest
@testable import RandomizerCore

final class LotteryTests: XCTestCase {
    // MARK: Format

    func testProDefaultsToNonPlayoffTeamsAndTheTopFourPicks() {
        let league = Fixtures.league(Fixtures.teams(10))
        XCTAssertEqual(league.type, .pro)
        XCTAssertEqual(league.lotteryTeams, 6)
        XCTAssertEqual(league.playoffTeams, 4)
        XCTAssertEqual(league.drawnPicks, 4)
        XCTAssertEqual(league.lotteryTeamsText, "Worst 6 of 10 teams in the lottery")
        XCTAssertEqual(league.drawnPicksText, "Top 4 picks drawn")
        XCTAssertEqual(league.standingsPicksText, "Picks 5\u{2013}10 by standings")
    }

    func testLongShotAndSlotDraftPutEveryoneInAndDrawEveryPick() {
        for type in [LotteryType.longShot, .slotDraft] {
            let league = Fixtures.league(Fixtures.teams(10), type: type, lotteryTeams: 4, drawnPicks: 2)
            XCTAssertEqual(league.lotteryTeams, 10, "\(type) ignores the pro settings")
            XCTAssertEqual(league.drawnPicks, 10)
            XCTAssertNil(league.standingsPicksText)
        }
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), type: .longShot).lotteryTeamsText, "All 10 teams in the lottery")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), type: .slotDraft).lotteryTeamsText, "All 10 teams draw, equal odds")
    }

    func testProFormatIsClampedToTheLeague() {
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 1).lotteryTeams, 2)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), lotteryTeams: 40).lotteryTeams, 10)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), drawnPicks: 0).drawnPicks, 1)
        XCTAssertEqual(Fixtures.league(Fixtures.teams(10), drawnPicks: 9).drawnPicks, 6)
        XCTAssertEqual(Fixtures.league(["Solo"]).lotteryTeams, 1)
        XCTAssertEqual(Fixtures.league([]).drawnPicks, 0)
    }

    func testProFormatWording() {
        let lotteryOnly = Fixtures.league(Fixtures.teams(10), drawnPicks: 6)
        XCTAssertEqual(lotteryOnly.drawnPicksText, "Picks 1\u{2013}6 drawn")
        XCTAssertEqual(lotteryOnly.standingsPicksText, "Picks 7\u{2013}10 by standings")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(3), lotteryTeams: 3, drawnPicks: 1).drawnPicksText, "Only pick 1 drawn")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(3), lotteryTeams: 3, drawnPicks: 2).standingsPicksText, "Pick 3 by standings")
        XCTAssertEqual(Fixtures.league(Fixtures.teams(4), lotteryTeams: 4, drawnPicks: 4).drawnPicksText, "Every pick drawn")
    }

    // MARK: Running

    func testLongShotDrawsAWeightedPermutation() throws {
        var rng = SeededGenerator(seed: 1)
        let weights = LotteryOdds.longShotWeights(count: 8)
        for _ in 0..<200 {
            var league = Fixtures.league(Fixtures.teams(8), type: .longShot)
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(run.picks.map(\.pick), Array(1...8))
            XCTAssertEqual(Set(run.picks.map(\.teamID)), Set(league.teams.map(\.id)))
            XCTAssertTrue(run.picks.allSatisfy(\.wasDrawn))
            // The drum loses each drawn team's weight.
            var remaining = 1_000
            for pick in run.picks {
                XCTAssertEqual(pick.totalWeight, remaining)
                XCTAssertEqual(pick.numeratorWeight, weights[pick.standing - 1])
                remaining -= pick.numeratorWeight
            }
        }
    }

    /// Pro, ten teams: the six non-playoff teams draw for picks 1 to 4, the
    /// two not drawn pick 5 and 6 worst first, and the playoff teams pick
    /// 7 to 10 in standings order, every time.
    func testProPlacesEveryoneTheDrawDidntReachByStandings() throws {
        var rng = SeededGenerator(seed: 2)
        for _ in 0..<300 {
            var league = Fixtures.league(Fixtures.teams(10))
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            XCTAssertEqual(run.type, .pro)
            XCTAssertEqual(run.drawnPicks, 4)
            XCTAssertTrue(run.picks.prefix(4).allSatisfy(\.wasDrawn))
            let undrawn = run.picks[4...5]
            XCTAssertTrue(undrawn.allSatisfy { !$0.wasDrawn })
            XCTAssertLessThan(undrawn.first!.standing, undrawn.last!.standing)
            XCTAssertEqual(Set(run.lotteryPicks.map(\.standing)), Set(1...6))
            XCTAssertEqual(run.standingsPicks.map(\.standing), [7, 8, 9, 10])
            XCTAssertEqual(run.standingsPicks.map(\.pick), [7, 8, 9, 10])
            // Like the pros: the worst team can fall no further than 5th.
            XCTAssertLessThanOrEqual(run.picks.first { $0.standing == 1 }!.pick, 5)
        }
    }

    func testRunErrors() {
        var rng = SeededGenerator(seed: 5)
        var solo = Fixtures.league(["Only"])
        XCTAssertThrowsError(try solo.runLottery(using: &rng)) { XCTAssertEqual($0 as? DrawError, .notEnoughTeams) }
        XCTAssertEqual(solo.runProblem, "Add at least two teams to run the lottery.")
        XCTAssertNil(solo.latestRun)
        XCTAssertEqual(solo.runCount, 0)
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
        league.setType(.longShot)
        league.deleteTeams([league.teams[1].id])
        XCTAssertEqual(league.latestRun, run)
        XCTAssertEqual(run.picks[2].teamName, "C")
        XCTAssertEqual(run.type, .pro)
    }

    // MARK: Reveal

    func testRevealCountsDownThroughTheLotteryPicks() throws {
        var rng = SeededGenerator(seed: 8)
        var league = Fixtures.league(Fixtures.teams(8), lotteryTeams: 5, drawnPicks: 3)
        var run = try league.runLottery(now: Fixtures.now, using: &rng)
        XCTAssertEqual(run.revealOrder.map(\.pick), [5, 4, 3, 2, 1])
        XCTAssertEqual(run.nextToReveal?.pick, 5)
        XCTAssertEqual(run.picks.filter(run.isRevealed).map(\.pick), [6, 7, 8], "Playoff teams are never hidden")

        league.revealNextPick()
        league.revealNextPick()
        run = try XCTUnwrap(league.latestRun)
        XCTAssertEqual(run.revealedCount, 2)
        XCTAssertEqual(run.nextToReveal?.pick, 3)
        XCTAssertEqual(run.picks.filter(run.isRevealed).map(\.pick), [4, 5, 6, 7, 8])

        league.revealAllPicks()
        run = try XCTUnwrap(league.latestRun)
        XCTAssertTrue(run.isFullyRevealed)
        XCTAssertTrue(run.isComplete)
        XCTAssertNil(run.nextToReveal)
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

    // MARK: Slot Draft

    func testSlotDraftTeamsChooseTheirSlotsInDrawOrder() throws {
        var rng = SeededGenerator(seed: 12)
        var league = Fixtures.league(Fixtures.teams(4), type: .slotDraft)
        var run = try league.runLottery(now: Fixtures.now, using: &rng)
        XCTAssertEqual(run.type, .slotDraft)
        XCTAssertEqual(run.picks.map(\.totalWeight), [4, 3, 2, 1], "Equal odds to choose first")
        XCTAssertNil(run.nextChooser, "Nobody chooses until the order is revealed")
        league.chooseSlot(1)
        XCTAssertEqual(league.latestRun?.slotChoices, [])

        league.revealAllPicks()
        run = try XCTUnwrap(league.latestRun)
        XCTAssertEqual(run.nextChooser, run.picks[0])
        XCTAssertFalse(run.isComplete)
        XCTAssertEqual(run.draftOrder.map(\.slot), [1, 2, 3, 4])
        XCTAssertTrue(run.draftOrder.allSatisfy { $0.pick == nil })

        // First choice takes the last slot (the turn), second takes slot 1.
        league.chooseSlot(4)
        league.chooseSlot(4)
        XCTAssertEqual(league.latestRun?.slotChoices, [4], "A taken slot can't be chosen again")
        league.chooseSlot(1)
        league.chooseSlot(3)
        run = try XCTUnwrap(league.latestRun)
        XCTAssertEqual(run.slotChoices, [4, 1, 3, 2], "The last team gets the last open slot")
        XCTAssertTrue(run.isComplete)
        XCTAssertNil(run.nextChooser)
        XCTAssertEqual(run.draftOrder.map { $0.pick?.teamID }, [run.picks[1].teamID, run.picks[3].teamID, run.picks[2].teamID, run.picks[0].teamID])
        XCTAssertEqual(run.chosenSlot(of: run.picks[0]), 4)

        league.replayReveal()
        XCTAssertTrue(league.latestRun?.isFullyRevealed == true, "No replay once teams have chosen")

        league.undoSlotChoice()
        XCTAssertEqual(league.latestRun?.slotChoices, [4, 1], "Undo takes back the choice and the automatic last slot")
        league.undoSlotChoice()
        league.undoSlotChoice()
        league.undoSlotChoice()
        XCTAssertEqual(league.latestRun?.slotChoices, [])
    }

    func testSlotDraftShareTextListsTheChosenOrder() throws {
        var rng = SeededGenerator(seed: 13)
        var league = Fixtures.league(["A", "B", "C"], type: .slotDraft)
        try league.runLottery(now: Fixtures.now, using: &rng)
        league.revealAllPicks()
        league.chooseSlot(2)
        let partial = try XCTUnwrap(league.latestRun)
        XCTAssertTrue(ResultsExporter.runText(title: "L", run: partial, dateText: "Today").contains("(open)"))
        league.chooseSlot(3)
        let run = try XCTUnwrap(league.latestRun)
        let lines = ResultsExporter.runText(title: "L", run: run, dateText: "Today").components(separatedBy: "\n")
        XCTAssertEqual(lines[1], "Slot Draft run #1 \u{00B7} Today")
        XCTAssertEqual(lines[2], "All 3 teams drew for the choosing order with equal odds, then chose their draft slots.")
        XCTAssertEqual(lines[4], "1. \(run.picks[2].teamName) (chose 3rd)")
        XCTAssertEqual(lines[5], "2. \(run.picks[0].teamName) (chose 1st)")
        XCTAssertEqual(lines[6], "3. \(run.picks[1].teamName) (chose 2nd)")
    }

    // MARK: Fairness

    /// Sanity check, not a proof: over 60,000 seeded Pro runs each lottery
    /// team's share of the #1 pick and of a top-four pick matches the
    /// exact table within a point.
    func testObservedProSharesMatchTheOddsTable() throws {
        var rng = SeededGenerator(seed: 10)
        var league = Fixtures.league(Fixtures.teams(10))
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

    /// The champion really does win the Long Shot about 1 time in 100.
    func testLongShotChampWinsAboutOnePercentOfTheTime() throws {
        var rng = SeededGenerator(seed: 14)
        var league = Fixtures.league(Fixtures.teams(10), type: .longShot)
        let runs = 60_000
        var champFirst = 0
        var worstFirst = 0
        for _ in 0..<runs {
            let run = try league.runLottery(now: Fixtures.now, using: &rng)
            if run.picks[0].standing == 10 { champFirst += 1 }
            if run.picks[0].standing == 1 { worstFirst += 1 }
        }
        XCTAssertEqual(Double(champFirst) / Double(runs), 0.01, accuracy: 0.002)
        XCTAssertEqual(Double(worstFirst) / Double(runs), 0.19, accuracy: 0.01)
    }

    // MARK: Sample and sharing

    func testSampleLeague() {
        let sample = SampleLeague.make(now: Fixtures.now)
        XCTAssertTrue(sample.isSample)
        XCTAssertEqual(sample.teams.map(\.name), SampleLeague.teams)
        XCTAssertEqual(sample.type, .pro)
        XCTAssertEqual(sample.lotteryTeamsText, "Worst 6 of 10 teams in the lottery")
        XCTAssertEqual(sample.drawnPicksText, "Top 4 picks drawn")
        XCTAssertEqual(sample.standingsPicksText, "Picks 5\u{2013}10 by standings")
        XCTAssertNil(sample.runProblem)
        XCTAssertEqual(sample.firstPickChanceText(of: sample.teams[0].id), "18.92%")
    }

    func testShareTextNamesTheRunAndHowEachPickWasDecided() throws {
        var rng = SeededGenerator(seed: 11)
        var league = Fixtures.league(Fixtures.teams(6), lotteryTeams: 4, drawnPicks: 2)
        try league.runLottery(now: Fixtures.now, using: &rng)
        let run = try league.runLottery(now: Fixtures.now, using: &rng)
        let text = ResultsExporter.runText(title: "Sunday League", run: run, dateText: "Oct 11")
        let lines = text.components(separatedBy: "\n")
        XCTAssertEqual(lines[0], "Sunday League: draft order")
        XCTAssertEqual(lines[1], "Pro Lottery run #2 \u{00B7} Oct 11")
        XCTAssertEqual(lines[2], "Worst 4 of 6 teams in the lottery, pro-style odds. Picks 1\u{2013}2 drawn.")
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
