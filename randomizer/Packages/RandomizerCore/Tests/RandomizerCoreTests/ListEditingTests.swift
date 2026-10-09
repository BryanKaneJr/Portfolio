import XCTest
@testable import RandomizerCore

final class ListEditingTests: XCTestCase {
    func testPasteSkipsBlankLinesAndTrims() {
        let text = "  Pizza \n\n\tTacos\r\n   \n- Burgers\n• Sushi\n* Ramen  \nMary   Jane\n"
        let parsed = NameRules.parsePaste(text, existingCount: 0)
        XCTAssertEqual(parsed.names, ["Pizza", "Tacos", "Burgers", "Sushi", "Ramen", "Mary Jane"])
        XCTAssertEqual(parsed.overLimit, 0)
    }

    func testPasteKeepsNumbersThatArePartOfANames() {
        let parsed = NameRules.parsePaste("1. FC Köln\n76ers", existingCount: 0)
        XCTAssertEqual(parsed.names, ["1. FC Köln", "76ers"])
    }

    func testPasteEnforcesTheEntryLimitWithFeedback() {
        let text = (1...250).map { "Name \($0)" }.joined(separator: "\n")
        let parsed = NameRules.parsePaste(text, existingCount: 0)
        XCTAssertEqual(parsed.names.count, 200)
        XCTAssertEqual(parsed.overLimit, 50)

        let partial = NameRules.parsePaste(text, existingCount: 190)
        XCTAssertEqual(partial.names.count, 10)
        XCTAssertEqual(partial.overLimit, 240)

        var list = Fixtures.list([])
        list.addEntries(named: parsed.names)
        XCTAssertEqual(list.entries.count, 200)
        XCTAssertTrue(list.isFull)
        XCTAssertThrowsError(try list.addEntry(named: "One more")) {
            XCTAssertEqual($0 as? ListEditError, .listFull)
        }
        XCTAssertTrue(list.addEntries(named: ["Overflow"]).isEmpty)
    }

    func testPasteDoesNotMergeDuplicates() {
        var list = Fixtures.list([])
        list.addEntries(named: NameRules.parsePaste("Alex\nAlex\nalex", existingCount: 0).names)
        XCTAssertEqual(list.entries.count, 3)
        XCTAssertEqual(Set(list.entries.map(\.id)).count, 3)
        XCTAssertEqual(list.duplicateNames, ["Alex"])
    }

    func testEmptyManualEntriesAreRejected() {
        var list = Fixtures.list([])
        XCTAssertThrowsError(try list.addEntry(named: "   \n ")) {
            XCTAssertEqual($0 as? ListEditError, .emptyName)
        }
        XCTAssertTrue(list.entries.isEmpty)
        let entry = try? list.addEntry(named: "  Zoe  ")
        XCTAssertEqual(entry?.name, "Zoe")
        XCTAssertEqual(entry?.weight, 1)
        XCTAssertThrowsError(try list.renameEntry(entry!.id, to: " "))
        XCTAssertThrowsError(try list.rename(to: ""))
    }

    func testLongNamesAreCapped() {
        let long = String(repeating: "x", count: 500)
        XCTAssertEqual(NameRules.clean(long)?.count, Limits.maxNameLength)
        XCTAssertEqual(NameRules.cleanTitle(long)?.count, Limits.maxTitleLength)
    }

    func testWeightsAreClampedToRange() {
        var list = Fixtures.list(["A"], mode: .customWeighted)
        let id = list.entries[0].id
        list.setWeight(5_000, for: id)
        XCTAssertEqual(list.entries[0].weight, 1_000)
        list.setWeight(-3, for: id)
        XCTAssertEqual(list.entries[0].weight, 0)
        XCTAssertEqual(DrawEntry(name: "B", weight: 9_999).weight, 1_000)
    }

    func testEditingAStandingsWeightSwitchesToCustomAndKeepsTheRanking() {
        var list = Fixtures.list((1...8).map { "Team \($0)" }, mode: .reverseStandings)
        let order = list.entries.map(\.id)
        list.setWeight(20, for: list.entries[7].id)
        XCTAssertEqual(list.oddsMode, .customWeighted)
        XCTAssertEqual(list.entries.map(\.id), order)
        XCTAssertEqual(list.entries.map(\.weight), [8, 7, 6, 5, 4, 3, 2, 20])
    }

    func testReorderingUpdatesStandingsWeights() {
        var list = Fixtures.list(["A", "B", "C", "D"], mode: .reverseStandings)
        let d = Fixtures.id("D", in: list)
        XCTAssertEqual(list.effectiveWeight(of: d), 1)
        list.moveEntries(fromOffsets: IndexSet(integer: 3), toOffset: 0)
        XCTAssertEqual(list.entries.map(\.name), ["D", "A", "B", "C"])
        XCTAssertEqual(list.effectiveWeight(of: d), 4)
    }

    func testMoveMatchesSwiftUISemantics() {
        var list = Fixtures.list(["A", "B", "C", "D"])
        list.moveEntries(fromOffsets: IndexSet(integer: 0), toOffset: 3)
        XCTAssertEqual(list.entries.map(\.name), ["B", "C", "A", "D"])
        list.moveEntries(fromOffsets: IndexSet(integer: 0), toOffset: 4)
        XCTAssertEqual(list.entries.map(\.name), ["C", "A", "D", "B"])
        list.moveEntries(fromOffsets: IndexSet([1, 3]), toOffset: 0)
        XCTAssertEqual(list.entries.map(\.name), ["A", "B", "C", "D"])
    }

    func testSwitchingOddsModesKeepsStoredWeights() {
        var list = Fixtures.list(["A", "B"], weights: [7, 3], mode: .customWeighted)
        list.setOddsMode(.equal)
        XCTAssertEqual(list.chanceText(of: list.entries[0].id), "50%")
        list.setOddsMode(.reverseStandings)
        XCTAssertEqual(list.chanceText(of: list.entries[0].id), "66.67%")
        list.setOddsMode(.customWeighted)
        XCTAssertEqual(list.entries.map(\.weight), [7, 3])
        XCTAssertEqual(list.chanceText(of: list.entries[0].id), "70%")
    }

    func testStartValidation() throws {
        XCTAssertEqual(Fixtures.list(["A"]).startProblem, "Add at least two entries to start drawing.")
        XCTAssertNil(Fixtures.list(["A", "B"]).startProblem)
        var drained = Fixtures.list(["A", "B"])
        var rng = SeededGenerator(seed: 9)
        _ = try drained.draw(count: 2, using: &rng)
        XCTAssertNil(drained.startProblem, "An emptied pool opens the draw screen with Restore removed")
    }

    func testClearEntriesKeepsHistory() throws {
        var list = Fixtures.list(["A", "B"])
        var rng = SeededGenerator(seed: 10)
        _ = try list.draw(using: &rng)
        list.clearEntries()
        XCTAssertTrue(list.entries.isEmpty)
        XCTAssertTrue(list.removedEntryIDs.isEmpty)
        XCTAssertEqual(list.activeResults.count, 1)
    }

    func testDuplicateListGetsNewIdentitiesAndAFreshSession() throws {
        var list = Fixtures.list(["A", "B", "C"], weights: [3, 2, 1], mode: .customWeighted, removeAfterSelection: false)
        list.isSample = true
        list.setRevealStyle(.lotteryBalls)
        var rng = SeededGenerator(seed: 11)
        _ = try list.draw(using: &rng)
        let copy = list.duplicated(title: "Copy")
        XCTAssertNotEqual(copy.id, list.id)
        XCTAssertTrue(Set(copy.entries.map(\.id)).isDisjoint(with: list.entries.map(\.id)))
        XCTAssertEqual(copy.entries.map(\.name), ["A", "B", "C"])
        XCTAssertEqual(copy.entries.map(\.weight), [3, 2, 1])
        XCTAssertEqual(copy.oddsMode, .customWeighted)
        XCTAssertEqual(copy.revealStyle, .lotteryBalls)
        XCTAssertFalse(copy.removeAfterSelection)
        XCTAssertTrue(copy.activeResults.isEmpty)
        XCTAssertFalse(copy.isSample)
        XCTAssertEqual(copy.title, "Copy")
    }

    func testExporterText() throws {
        var list = Fixtures.list(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted)
        var rng = SeededGenerator(seed: 12)
        let outcome = try list.generateDraftOrder(using: &rng)
        let text = ResultsExporter.draftOrderText(title: "League", picks: outcome.results.reversed())
        let lines = text.components(separatedBy: "\n")
        XCTAssertEqual(lines[0], "League: draft order")
        XCTAssertEqual(lines[1], "Pick 1: \(outcome.results[0].nameSnapshot) (\(outcome.results[0].chanceText) chance at that pick)")
        XCTAssertTrue(text.hasSuffix("Drawn with Randomizer: Spin & Reveal"))

        let results = ResultsExporter.resultsText(title: "League", results: list.activeResults, sessionEdited: true, includeChances: false)
        XCTAssertTrue(results.contains("1. \(outcome.results[0].nameSnapshot)\n"))
        XCTAssertTrue(results.contains("Edited session: a draw was undone."))
        XCTAssertFalse(results.contains("chance"))
    }
}
