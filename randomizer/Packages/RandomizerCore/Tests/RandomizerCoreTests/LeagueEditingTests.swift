import XCTest
@testable import RandomizerCore

final class LeagueEditingTests: XCTestCase {
    func testPasteSkipsBlankLinesBulletsAndStandingsNumbers() {
        let text = "  Sharks \n\n\tJets\r\n   \n- Bears\n• Owls\n* Hawks  \n1. Mary   Jane's Team\n12) Last Place\n"
        let parsed = NameRules.parsePaste(text, existingCount: 0)
        XCTAssertEqual(parsed.names, ["Sharks", "Jets", "Bears", "Owls", "Hawks", "Mary Jane's Team", "Last Place"])
        XCTAssertEqual(parsed.overLimit, 0)
    }

    func testPasteKeepsNumbersThatArePartOfAName() {
        let parsed = NameRules.parsePaste("76ers\n1.FC Fantasy\n4th & Long", existingCount: 0)
        XCTAssertEqual(parsed.names, ["76ers", "1.FC Fantasy", "4th & Long"])
    }

    func testPasteEnforcesTheTeamLimitWithFeedback() {
        let text = Fixtures.teams(40).joined(separator: "\n")
        let parsed = NameRules.parsePaste(text, existingCount: 0)
        XCTAssertEqual(parsed.names.count, 32)
        XCTAssertEqual(parsed.overLimit, 8)

        let partial = NameRules.parsePaste(text, existingCount: 30)
        XCTAssertEqual(partial.names.count, 2)
        XCTAssertEqual(partial.overLimit, 38)

        var league = Fixtures.league([])
        league.addTeams(named: parsed.names)
        XCTAssertEqual(league.teams.count, 32)
        XCTAssertTrue(league.isFull)
        XCTAssertThrowsError(try league.addTeam(named: "One more")) {
            XCTAssertEqual($0 as? LeagueEditError, .leagueFull)
        }
        XCTAssertTrue(league.addTeams(named: ["Overflow"]).isEmpty)
    }

    func testDuplicateNamesAreSeparateTeams() {
        var league = Fixtures.league([])
        league.addTeams(named: NameRules.parsePaste("Sharks\nSharks\nsharks", existingCount: 0).names)
        XCTAssertEqual(league.teams.count, 3)
        XCTAssertEqual(Set(league.teams.map(\.id)).count, 3)
        XCTAssertEqual(league.duplicateNames, ["Sharks"])
    }

    func testEmptyNamesAreRejected() throws {
        var league = Fixtures.league([])
        XCTAssertThrowsError(try league.addTeam(named: "   \n ")) {
            XCTAssertEqual($0 as? LeagueEditError, .emptyName)
        }
        XCTAssertTrue(league.teams.isEmpty)
        let team = try league.addTeam(named: "  Zoe's   Zebras  ")
        XCTAssertEqual(team.name, "Zoe's Zebras")
        XCTAssertEqual(team.weight, 1)
        XCTAssertThrowsError(try league.renameTeam(team.id, to: " "))
        XCTAssertThrowsError(try league.rename(to: ""))
    }

    func testLongNamesAreCapped() {
        let long = String(repeating: "x", count: 500)
        XCTAssertEqual(NameRules.clean(long)?.count, Limits.maxNameLength)
        XCTAssertEqual(NameRules.cleanTitle(long)?.count, Limits.maxTitleLength)
    }

    func testWeightsAreClampedToRange() {
        var league = Fixtures.league(["A", "B"], mode: .customWeighted)
        let id = league.teams[0].id
        league.setWeight(5_000, for: id)
        XCTAssertEqual(league.teams[0].weight, 1_000)
        league.setWeight(-3, for: id)
        XCTAssertEqual(league.teams[0].weight, 0)
        XCTAssertEqual(Team(name: "B", weight: 9_999).weight, 1_000)
    }

    func testEditingAStandingsWeightSwitchesToCustomAndKeepsTheOthers() {
        var league = Fixtures.league(Fixtures.teams(8), lotteryTeams: 6)
        let order = league.teams.map(\.id)
        league.setWeight(20, for: league.teams[5].id)
        XCTAssertEqual(league.oddsMode, .customWeighted)
        XCTAssertEqual(league.teams.map(\.id), order)
        XCTAssertEqual(OddsCalculator.rows(for: league).map(\.weight), [6, 5, 4, 3, 2, 20, 0, 0])
    }

    func testReorderingMovesStandingsOdds() {
        var league = Fixtures.league(["A", "B", "C", "D"], lotteryTeams: 3)
        let d = Fixtures.id("D", in: league)
        XCTAssertEqual(league.status(of: d), .notInLottery)
        league.moveTeams(fromOffsets: IndexSet(integer: 3), toOffset: 0)
        XCTAssertEqual(league.teams.map(\.name), ["D", "A", "B", "C"])
        XCTAssertEqual(league.effectiveWeight(atIndex: 0), 3)
        XCTAssertEqual(league.status(of: d), .inLottery)
        XCTAssertEqual(league.status(of: Fixtures.id("C", in: league)), .notInLottery)
    }

    func testMoveMatchesSwiftUISemantics() {
        var league = Fixtures.league(["A", "B", "C", "D"])
        league.moveTeams(fromOffsets: IndexSet(integer: 0), toOffset: 3)
        XCTAssertEqual(league.teams.map(\.name), ["B", "C", "A", "D"])
        league.moveTeams(fromOffsets: IndexSet(integer: 0), toOffset: 4)
        XCTAssertEqual(league.teams.map(\.name), ["C", "A", "D", "B"])
        league.moveTeams(fromOffsets: IndexSet([1, 3]), toOffset: 0)
        XCTAssertEqual(league.teams.map(\.name), ["A", "B", "C", "D"])
    }

    func testSwitchingOddsModesKeepsStoredWeights() {
        var league = Fixtures.league(["A", "B"], weights: [7, 3], mode: .customWeighted)
        league.setOddsMode(.equal)
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[0].id), "50%")
        league.setOddsMode(.reverseStandings)
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[0].id), "66.67%")
        league.setOddsMode(.customWeighted)
        XCTAssertEqual(league.teams.map(\.weight), [7, 3])
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[0].id), "70%")
    }

    func testSettingLotteryTeams() {
        var league = Fixtures.league(Fixtures.teams(10))
        league.setLotteryTeams(6)
        XCTAssertEqual(league.lotteryTeamCount, 6)
        league.setLotteryTeams(1)
        XCTAssertEqual(league.lotteryTeams, 2)
        league.setLotteryTeams(10)
        XCTAssertNil(league.lotteryTeamCount, "Every team is stored as all")
        _ = try? league.addTeam(named: "Expansion")
        XCTAssertEqual(league.lotteryTeams, 11, "A new team joins an every-team lottery")
    }

    func testDrawnPicksFollowTheLottery() {
        var league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 8)
        league.setDrawnPicks(4)
        XCTAssertEqual(league.drawnPicks, 4)
        league.setLotteryTeams(6)
        XCTAssertEqual(league.drawnPicks, 4, "Top 4 still fits")
        league.setLotteryTeams(3)
        XCTAssertEqual(league.drawnPicks, 3)
        XCTAssertNil(league.drawnPickCount, "Top 3 of 3 is every lottery pick")
        league.setLotteryTeams(8)
        XCTAssertEqual(league.drawnPicks, 8, "Every lottery pick follows the lottery")
        league.setDrawnPicks(8)
        XCTAssertNil(league.drawnPickCount)
        league.setDrawnPicks(0)
        XCTAssertEqual(league.drawnPicks, 1)
    }

    func testDeletingTeamsKeepsTheFormatMeaningful() {
        var league = Fixtures.league(Fixtures.teams(6), lotteryTeams: 4, drawnPicks: 3)
        league.deleteTeams(Set(league.teams.suffix(3).map(\.id)))
        XCTAssertEqual(league.teams.count, 3)
        XCTAssertNil(league.lotteryTeamCount)
        XCTAssertNil(league.drawnPickCount)
        XCTAssertEqual(league.drawnPicks, 3)
    }

    func testClearTeamsKeepsTheLatestRun() throws {
        var league = Fixtures.league(["A", "B"], lotteryTeams: 2)
        var rng = SeededGenerator(seed: 10)
        let run = try league.runLottery(using: &rng)
        league.clearTeams()
        XCTAssertTrue(league.teams.isEmpty)
        XCTAssertEqual(league.latestRun, run)
    }

    func testDuplicateLeagueGetsNewIdentitiesAndNoRuns() throws {
        var league = Fixtures.league(["A", "B", "C"], weights: [3, 2, 1], mode: .customWeighted, lotteryTeams: 2, drawnPicks: 1)
        league.isSample = true
        league.setRevealStyle(.cardFlip)
        var rng = SeededGenerator(seed: 11)
        try league.runLottery(using: &rng)
        let copy = league.duplicated(title: "Copy")
        XCTAssertNotEqual(copy.id, league.id)
        XCTAssertTrue(Set(copy.teams.map(\.id)).isDisjoint(with: league.teams.map(\.id)))
        XCTAssertEqual(copy.teams.map(\.name), ["A", "B", "C"])
        XCTAssertEqual(copy.teams.map(\.weight), [3, 2, 1])
        XCTAssertEqual(copy.oddsMode, .customWeighted)
        XCTAssertEqual(copy.revealStyle, .cardFlip)
        XCTAssertEqual(copy.lotteryTeams, 2)
        XCTAssertEqual(copy.drawnPicks, 1)
        XCTAssertNil(copy.latestRun)
        XCTAssertEqual(copy.runCount, 0)
        XCTAssertFalse(copy.isSample)
        XCTAssertEqual(copy.title, "Copy")
    }
}
