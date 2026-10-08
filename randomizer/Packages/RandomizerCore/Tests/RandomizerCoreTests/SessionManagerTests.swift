import XCTest
@testable import RandomizerCore

/// The Remove after selection rules. Tests named `testToggleN...` are the
/// release-blocking toggle tests from the build plan (section 15).
final class SessionManagerTests: XCTestCase {
    private var rng = SeededGenerator(seed: 42)

    func testNewListDefaultsToRemovalOn() {
        XCTAssertTrue(DrawList(title: "New").removeAfterSelection)
        XCTAssertTrue(SampleLists.dinner().removeAfterSelection)
    }

    func testToggle1_OffKeepsWinnerEligible() throws {
        var list = Fixtures.list(["A", "B", "C"], removeAfterSelection: false)
        let outcome = try list.draw(now: Fixtures.now, using: &rng)
        let winner = outcome.results[0]
        XCTAssertFalse(winner.removedAfterDraw)
        XCTAssertEqual(list.status(of: winner.entryID), .eligible)
        XCTAssertEqual(list.eligibleCount, 3)
        XCTAssertEqual(list.chanceText(of: winner.entryID), "33.33%")
    }

    func testToggle2_OnRemovesWinner() throws {
        var list = Fixtures.list(["A", "B", "C"])
        let outcome = try list.draw(now: Fixtures.now, using: &rng)
        let winner = outcome.results[0]
        XCTAssertTrue(winner.removedAfterDraw)
        XCTAssertEqual(list.status(of: winner.entryID), .removed)
        XCTAssertEqual(list.eligibleCount, 2)
        for candidate in list.eligibleCandidates {
            XCTAssertEqual(list.chanceText(of: candidate.id), "50%")
        }
        // The removed winner can never come up again this session.
        for _ in 0..<50 {
            var copy = list
            copy.removeAfterSelection = false
            XCTAssertNotEqual(try copy.draw(using: &rng).results[0].entryID, winner.entryID)
        }
    }

    func testToggle3_TurningOffKeepsEarlierRemovalsOut() throws {
        var list = Fixtures.list(["A", "B", "C"])
        let removed = try list.draw(using: &rng).results[0].entryID
        list.setRemoveAfterSelection(false)
        XCTAssertEqual(list.status(of: removed), .removed)
        XCTAssertEqual(list.eligibleCount, 2)
        let next = try list.draw(using: &rng).results[0]
        XCTAssertNotEqual(next.entryID, removed)
        XCTAssertFalse(next.removedAfterDraw)
        XCTAssertEqual(list.eligibleCount, 2)
    }

    func testToggle4_TurningOnDoesNotRetroactivelyRemove() throws {
        var list = Fixtures.list(["A", "B", "C"], removeAfterSelection: false)
        let earlier = try list.draw(count: 5, using: &rng).results.map(\.entryID)
        list.setRemoveAfterSelection(true)
        XCTAssertTrue(list.removedEntryIDs.isEmpty)
        for id in earlier {
            XCTAssertEqual(list.status(of: id), .eligible)
        }
        let next = try list.draw(using: &rng).results[0]
        XCTAssertTrue(next.removedAfterDraw)
        XCTAssertEqual(list.removedEntryIDs, [next.entryID])
    }

    func testToggle5_RestoreSelectedRemovedEntries() throws {
        var list = Fixtures.list(["A", "B", "C", "D"])
        let picks = try list.draw(count: 3, using: &rng).results.map(\.entryID)
        XCTAssertEqual(list.eligibleCount, 1)
        list.restore([picks[0]])
        XCTAssertEqual(list.status(of: picks[0]), .eligible)
        XCTAssertEqual(list.status(of: picks[1]), .removed)
        XCTAssertEqual(list.eligibleCount, 2)
        // History is a snapshot: it still says the draw removed them.
        XCTAssertTrue(list.activeResults.allSatisfy(\.removedAfterDraw))
        list.restoreAllRemoved()
        XCTAssertEqual(list.eligibleCount, 4)
        XCTAssertEqual(list.activeResults.count, 3)
    }

    func testToggle6_UndoADrawMadeWithRemovalOnRestoresTheEntry() throws {
        var list = Fixtures.list(["A", "B", "C"])
        _ = try list.draw(using: &rng)
        let second = try list.draw(using: &rng).results[0]
        XCTAssertEqual(list.status(of: second.entryID), .removed)
        let undone = list.undoLastDraw()
        XCTAssertEqual(undone.map(\.id), [second.id])
        XCTAssertEqual(list.status(of: second.entryID), .eligible)
        XCTAssertEqual(list.activeResults.count, 1)
        XCTAssertEqual(list.eligibleCount, 2)
        XCTAssertTrue(list.sessionEdited)
    }

    func testToggle7_UndoADrawMadeWithRemovalOffLeavesThePool() throws {
        var list = Fixtures.list(["A", "B", "C"])
        let removedEarlier = try list.draw(using: &rng).results[0].entryID
        list.setRemoveAfterSelection(false)
        let poolBefore = list.eligibleCandidates
        _ = try list.draw(using: &rng)
        list.undoLastDraw()
        XCTAssertEqual(list.eligibleCandidates, poolBefore)
        XCTAssertEqual(list.removedEntryIDs, [removedEarlier])
        XCTAssertEqual(list.activeResults.count, 1)
    }

    func testToggle11_OffDisablesUniqueOrderButNotDraws() throws {
        var list = Fixtures.list(["A", "B", "C"], removeAfterSelection: false)
        XCTAssertEqual(list.draftOrderAvailability, .requiresRemoval)
        XCTAssertEqual(
            list.draftOrderAvailability.explanation,
            "Turn on Remove after selection to generate a unique draft order."
        )
        XCTAssertThrowsError(try list.generateDraftOrder(using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .uniqueOrderRequiresRemoval)
        }
        // Never silently overridden.
        XCTAssertFalse(list.removeAfterSelection)
        XCTAssertTrue(list.activeResults.isEmpty)
        // Ordinary repeat-enabled draws still work.
        XCTAssertEqual(try list.draw(count: 5, using: &rng).results.count, 5)
    }

    func testToggle12_OnEnablesUniqueOrder() throws {
        var list = Fixtures.list(["A", "B", "C"], removeAfterSelection: false)
        list.setRemoveAfterSelection(true)
        XCTAssertEqual(list.draftOrderAvailability, .available)
        XCTAssertNil(list.draftOrderAvailability.explanation)
        XCTAssertEqual(try list.generateDraftOrder(using: &rng).results.count, 3)
    }

    func testBatchWithRemovalOnIsUniqueAndLimitedToPool() throws {
        var list = Fixtures.list(["A", "B", "C", "D", "E"])
        XCTAssertEqual(list.maxBatchCount, 5)
        XCTAssertThrowsError(try list.draw(count: 6, using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .countExceedsPool(available: 5))
        }
        XCTAssertTrue(list.activeResults.isEmpty, "A rejected batch commits nothing")
        let outcome = try list.draw(count: 3, using: &rng)
        XCTAssertEqual(outcome.kind, .batch)
        XCTAssertEqual(Set(outcome.results.map(\.entryID)).count, 3)
        XCTAssertEqual(outcome.results.map(\.totalEligibleWeight), [5, 4, 3])
        XCTAssertEqual(outcome.results.map(\.positionInAction), [1, 2, 3])
        XCTAssertEqual(list.eligibleCount, 2)
        XCTAssertEqual(list.maxBatchCount, 2)
        // Each pick's pool for the reveal excludes the earlier picks.
        XCTAssertEqual(outcome.pool(forPick: 0).count, 5)
        XCTAssertEqual(outcome.pool(forPick: 2).count, 3)
        XCTAssertFalse(outcome.pool(forPick: 2).contains { $0.id == outcome.results[0].entryID })
    }

    func testBatchWithRemovalOffAllowsRepeatsAndKeepsPool() throws {
        var list = Fixtures.list(["A", "B"], removeAfterSelection: false)
        let poolBefore = list.eligibleCandidates
        XCTAssertEqual(list.maxBatchCount, Limits.maxBatchWithRepeats)
        let outcome = try list.draw(count: 12, using: &rng)
        XCTAssertEqual(outcome.results.count, 12)
        XCTAssertLessThan(Set(outcome.results.map(\.entryID)).count, 12)
        XCTAssertEqual(list.eligibleCandidates, poolBefore)
        XCTAssertTrue(list.removedEntryIDs.isEmpty)
        XCTAssertEqual(outcome.pool(forPick: 11).count, 2)
        XCTAssertThrowsError(try list.draw(count: Limits.maxBatchWithRepeats + 1, using: &rng))
    }

    func testOneRemainingEntryIsDrawnAtCertainty() throws {
        var list = Fixtures.list(["A", "B"])
        _ = try list.draw(using: &rng)
        let last = try list.draw(using: &rng).results[0]
        XCTAssertEqual(last.numeratorWeight, last.totalEligibleWeight)
        XCTAssertEqual(last.chanceText, "100%")
        XCTAssertEqual(list.eligibleCount, 0)
    }

    func testEmptyPoolCannotDrawAndCommitsNothing() throws {
        var list = Fixtures.list(["A", "B"])
        _ = try list.draw(count: 2, using: &rng)
        let snapshot = list
        XCTAssertThrowsError(try list.draw(using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .noEligibleEntries)
        }
        XCTAssertEqual(list, snapshot)
        XCTAssertEqual(list.maxBatchCount, 0)
        XCTAssertEqual(list.draftOrderAvailability, .notEnoughEntries)
    }

    func testAllWeightsZeroCannotDraw() {
        var list = Fixtures.list(["A", "B"], weights: [0, 0], mode: .customWeighted)
        XCTAssertThrowsError(try list.draw(using: &rng)) {
            XCTAssertEqual($0 as? DrawError, .noEligibleEntries)
        }
        XCTAssertEqual(list.startProblem, "Give at least one entry a weight above 0.")
    }

    func testWeightZeroEntryIsNotDrawnUntilWeightIncreased() throws {
        var list = Fixtures.list(["A", "B"], weights: [0, 1], mode: .customWeighted, removeAfterSelection: false)
        let a = Fixtures.id("A", in: list)
        for _ in 0..<200 {
            XCTAssertNotEqual(try list.draw(using: &rng).results[0].entryID, a)
        }
        list.setWeight(1_000, for: a)
        let winners = try (0..<200).map { _ in try list.draw(using: &rng).results[0].entryID }
        XCTAssertTrue(winners.contains(a))
    }

    func testResultSnapshotsTheOddsAtDrawTime() throws {
        var list = Fixtures.list(["A", "B", "C", "D"], weights: [40, 30, 20, 10], mode: .customWeighted, removeAfterSelection: false)
        let result = try list.draw(now: Fixtures.now, using: &rng).results[0]
        let winnerWeight = list.entry(result.entryID)!.weight
        XCTAssertEqual(result.numeratorWeight, winnerWeight)
        XCTAssertEqual(result.totalEligibleWeight, 100)
        XCTAssertEqual(result.drawnAt, Fixtures.now)
        XCTAssertEqual(result.ordinal, 1)
        XCTAssertEqual(result.sessionID, list.activeSessionID)
        // Changing weights later never rewrites history.
        list.setWeight(1, for: result.entryID)
        try list.renameEntry(result.entryID, to: "Renamed")
        XCTAssertEqual(list.activeResults[0].numeratorWeight, winnerWeight)
        XCTAssertEqual(list.activeResults[0].totalEligibleWeight, 100)
        XCTAssertNotEqual(list.activeResults[0].nameSnapshot, "Renamed")
    }

    func testDeletedEntryKeepsItsHistory() throws {
        var list = Fixtures.list(["A", "B", "C"])
        let result = try list.draw(using: &rng).results[0]
        list.deleteEntries([result.entryID])
        XCTAssertNil(list.entry(result.entryID))
        XCTAssertFalse(list.removedEntryIDs.contains(result.entryID))
        XCTAssertEqual(list.activeResults.first?.nameSnapshot, result.nameSnapshot)
        XCTAssertEqual(list.eligibleCount, 2)
    }

    func testNewEntryJoinsFutureDrawsOnly() throws {
        var list = Fixtures.list(["A", "B", "C"])
        _ = try list.draw(using: &rng)
        let added = try list.addEntry(named: "D")
        XCTAssertEqual(list.status(of: added.id), .eligible)
        XCTAssertEqual(list.eligibleCount, 3)
        XCTAssertEqual(list.activeResults.count, 1)
    }

    func testDuplicateNamesAreDistinctParticipants() throws {
        var list = Fixtures.list(["Alex", "Alex", "Sam"])
        XCTAssertEqual(list.duplicateNames, ["Alex"])
        XCTAssertEqual(Set(list.entries.map(\.id)).count, 3)
        let alexes = list.entries.filter { $0.name == "Alex" }.map(\.id)
        list.removedEntryIDs.insert(alexes[0])
        XCTAssertEqual(list.status(of: alexes[1]), .eligible)
        XCTAssertEqual(list.eligibleCount, 2)
        let order = try list.generateDraftOrder(using: &rng)
        XCTAssertEqual(Set(order.results.map(\.entryID)), [alexes[1], Fixtures.id("Sam", in: list)])
    }

    func testDraftOrderIsAPermutationOfEligibleEntries() throws {
        for seed in 0..<200 {
            var generator = SeededGenerator(seed: UInt64(seed))
            var list = Fixtures.list((1...8).map { "Team \($0)" }, mode: .reverseStandings)
            let expected = Set(list.eligibleCandidates.map(\.id))
            let outcome = try list.generateDraftOrder(now: Fixtures.now, using: &generator)
            XCTAssertEqual(outcome.kind, .draftOrder)
            XCTAssertEqual(outcome.results.count, 8)
            XCTAssertEqual(Set(outcome.results.map(\.entryID)), expected)
            XCTAssertEqual(outcome.results.map(\.positionInAction), Array(1...8))
            XCTAssertEqual(list.latestDraftOrder, outcome.results)
            XCTAssertEqual(list.eligibleCount, 0)
        }
    }

    func testDraftOrderLeavesOutRemovedAndZeroWeightEntries() throws {
        var list = Fixtures.list(["A", "B", "C", "D", "E"], weights: [1, 1, 1, 1, 0], mode: .customWeighted)
        let removed = try list.draw(using: &rng).results[0].entryID
        let order = try list.generateDraftOrder(using: &rng).results.map(\.entryID)
        XCTAssertEqual(order.count, 3)
        XCTAssertFalse(order.contains(removed))
        XCTAssertFalse(order.contains(Fixtures.id("E", in: list)))
    }

    func testWorseStandingsTendToPickEarlier() throws {
        var firstPickCounts = [Int](repeating: 0, count: 8)
        for seed in 0..<4_000 {
            var generator = SeededGenerator(seed: UInt64(seed) &* 7919)
            var list = Fixtures.list((1...8).map { "Team \($0)" }, mode: .reverseStandings)
            let first = try list.generateDraftOrder(using: &generator).results[0].entryID
            firstPickCounts[list.index(of: first)!] += 1
        }
        // 8/36 vs 1/36: the worst team gets pick 1 far more often than the best.
        XCTAssertGreaterThan(firstPickCounts[0], firstPickCounts[7] * 4)
    }

    func testUndoTakesBackAWholeBatchOrOrder() throws {
        var list = Fixtures.list(["A", "B", "C", "D"])
        _ = try list.draw(using: &rng)
        _ = try list.draw(count: 2, using: &rng)
        XCTAssertEqual(list.eligibleCount, 1)
        XCTAssertEqual(list.lastActionResults.count, 2)
        list.undoLastDraw()
        XCTAssertEqual(list.activeResults.count, 1)
        XCTAssertEqual(list.eligibleCount, 3)

        list.restoreAllRemoved()
        _ = try list.generateDraftOrder(using: &rng)
        XCTAssertEqual(list.eligibleCount, 0)
        list.undoLastDraw()
        XCTAssertEqual(list.eligibleCount, 4)
        XCTAssertNil(list.latestDraftOrder)
    }

    func testUndoDoesNotTouchAnEntryRestoredSinceItsDraw() throws {
        var list = Fixtures.list(["A", "B", "C"])
        let first = try list.draw(using: &rng).results[0].entryID
        list.restore([first])
        list.setRemoveAfterSelection(false)
        _ = try list.draw(using: &rng)
        list.undoLastDraw()
        XCTAssertEqual(list.status(of: first), .eligible)
        XCTAssertEqual(list.activeResults.count, 1)
    }

    func testUndoWithNothingToUndoDoesNothing() {
        var list = Fixtures.list(["A", "B"])
        XCTAssertFalse(list.canUndo)
        XCTAssertTrue(list.undoLastDraw().isEmpty)
        XCTAssertFalse(list.sessionEdited)
    }

    func testNewSessionResetsPoolAndHistoryButKeepsSettings() throws {
        var list = Fixtures.list(["A", "B", "C"], weights: [5, 3, 1], mode: .customWeighted)
        list.setRevealStyle(.reel)
        _ = try list.draw(count: 2, using: &rng)
        list.undoLastDraw()
        _ = try list.draw(using: &rng)
        let oldSession = list.activeSessionID
        list.startNewSession()
        XCTAssertNotEqual(list.activeSessionID, oldSession)
        XCTAssertTrue(list.activeResults.isEmpty)
        XCTAssertTrue(list.removedEntryIDs.isEmpty)
        XCTAssertFalse(list.sessionEdited)
        XCTAssertEqual(list.entries.map(\.weight), [5, 3, 1])
        XCTAssertEqual(list.oddsMode, .customWeighted)
        XCTAssertEqual(list.revealStyle, .reel)
        XCTAssertTrue(list.removeAfterSelection)
    }

    func testOrdinalsAndActionsFollowDrawOrder() throws {
        var list = Fixtures.list(["A", "B", "C", "D", "E"], removeAfterSelection: false)
        _ = try list.draw(using: &rng)
        _ = try list.draw(count: 3, using: &rng)
        _ = try list.draw(using: &rng)
        XCTAssertEqual(list.activeResults.map(\.ordinal), [1, 2, 3, 4, 5])
        XCTAssertEqual(list.actions.map(\.count), [1, 3, 1])
        XCTAssertEqual(list.actions.map { $0[0].kind }, [.single, .batch, .single])
    }

    func testDrawStampsLastUsed() throws {
        var list = Fixtures.list(["A", "B"])
        XCTAssertNil(list.lastUsedAt)
        _ = try list.draw(now: Fixtures.now, using: &rng)
        XCTAssertEqual(list.lastUsedAt, Fixtures.now)
    }
}
