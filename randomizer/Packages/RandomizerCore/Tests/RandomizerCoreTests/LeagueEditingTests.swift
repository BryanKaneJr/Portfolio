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
        XCTAssertThrowsError(try league.renameTeam(team.id, to: " "))
        XCTAssertThrowsError(try league.rename(to: ""))
    }

    func testLongNamesAreCapped() {
        let long = String(repeating: "x", count: 500)
        XCTAssertEqual(NameRules.clean(long)?.count, Limits.maxNameLength)
        XCTAssertEqual(NameRules.cleanTitle(long)?.count, Limits.maxTitleLength)
    }

    func testReorderingMovesTeamsInAndOutOfTheLottery() {
        var league = Fixtures.league(["A", "B", "C", "D"], lotteryTeams: 3)
        let d = Fixtures.id("D", in: league)
        XCTAssertEqual(league.status(of: d), .notInLottery)
        league.moveTeams(fromOffsets: IndexSet(integer: 3), toOffset: 0)
        XCTAssertEqual(league.teams.map(\.name), ["D", "A", "B", "C"])
        XCTAssertEqual(league.effectiveWeight(atIndex: 0), 140)
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

    func testSwitchingTypesKeepsTheProSettings() {
        var league = Fixtures.league(Fixtures.teams(10))
        league.setPlayoffTeams(6)
        league.setDrawnPicks(3)
        league.setType(.longShot)
        XCTAssertEqual(league.lotteryTeams, 10)
        XCTAssertEqual(league.firstPickChanceText(of: league.teams[9].id), "1%")
        league.setType(.pro)
        XCTAssertEqual(league.lotteryTeams, 4)
        XCTAssertEqual(league.drawnPicks, 3)
    }

    func testSettingPlayoffTeams() {
        var league = Fixtures.league(Fixtures.teams(10))
        league.setPlayoffTeams(2)
        XCTAssertEqual(league.lotteryTeams, 8)
        XCTAssertEqual(league.lotteryTeamCount, 8)
        league.setPlayoffTeams(9)
        XCTAssertEqual(league.lotteryTeams, 2, "At least two teams stay in the lottery")
        league.setPlayoffTeams(4)
        XCTAssertNil(league.lotteryTeamCount, "The default is stored as default")
        try? league.addTeam(named: "Expansion")
        XCTAssertEqual(league.lotteryTeams, 7, "The default follows the league's size")
    }

    func testDrawnPicks() {
        var league = Fixtures.league(Fixtures.teams(10), lotteryTeams: 8)
        league.setDrawnPicks(2)
        XCTAssertEqual(league.drawnPicks, 2)
        league.setPlayoffTeams(7)
        XCTAssertEqual(league.drawnPicks, 2)
        league.setDrawnPicks(9)
        XCTAssertEqual(league.drawnPicks, 3, "No more than the lottery's teams")
        league.setPlayoffTeams(2)
        league.setDrawnPicks(4)
        XCTAssertNil(league.drawnPickCount, "Top 4 is the default")
        XCTAssertEqual(league.drawnPicks, 4)
        league.setDrawnPicks(0)
        XCTAssertEqual(league.drawnPicks, 1)
    }

    func testDeletingTeamsKeepsTheFormatMeaningful() {
        var league = Fixtures.league(Fixtures.teams(6), lotteryTeams: 4, drawnPicks: 3)
        league.deleteTeams(Set(league.teams.suffix(3).map(\.id)))
        XCTAssertEqual(league.teams.count, 3)
        XCTAssertNil(league.lotteryTeamCount)
        XCTAssertEqual(league.lotteryTeams, 2)
        XCTAssertEqual(league.drawnPicks, 2)
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
        var league = Fixtures.league(["A", "B", "C"], type: .slotDraft, lotteryTeams: 2, drawnPicks: 1)
        league.isSample = true
        league.setRevealStyle(.cardFlip)
        var rng = SeededGenerator(seed: 11)
        try league.runLottery(using: &rng)
        let copy = league.duplicated(title: "Copy")
        XCTAssertNotEqual(copy.id, league.id)
        XCTAssertTrue(Set(copy.teams.map(\.id)).isDisjoint(with: league.teams.map(\.id)))
        XCTAssertEqual(copy.teams.map(\.name), ["A", "B", "C"])
        XCTAssertEqual(copy.type, .slotDraft)
        XCTAssertEqual(copy.revealStyle, .cardFlip)
        XCTAssertEqual(copy.lotteryTeamCount, 2)
        XCTAssertEqual(copy.drawnPickCount, 1)
        XCTAssertNil(copy.latestRun)
        XCTAssertEqual(copy.runCount, 0)
        XCTAssertFalse(copy.isSample)
        XCTAssertEqual(copy.title, "Copy")
    }
}
