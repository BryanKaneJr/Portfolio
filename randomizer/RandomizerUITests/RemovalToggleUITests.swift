import XCTest

/// The release-blocking Remove after selection checks that need the real
/// UI (the rest run as unit tests in RandomizerCore).
final class RemovalToggleUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// Release blockers 9 and 10: every reveal style and odds mode shows the
    /// toggle before a draw, during the reveal and on the result, and it works.
    @MainActor
    func testToggleIsVisibleAndWorksInEveryRevealStyleAndOddsMode() {
        for style in ["wheel", "reel", "lotteryBalls", "mysteryCard"] {
            for mode in ["equal", "customWeighted", "reverseStandings"] {
                let context = "\(style) / \(mode)"
                let app = XCUIApplication.randomizer(seed: "league", style: style, mode: mode, open: "draw")
                app.launch()

                let toggle = app.removalToggle
                XCTAssertTrue(toggle.waitForExistence(timeout: 10), "Toggle before the draw: \(context)")
                XCTAssertTrue(toggle.isHittable, "Toggle hittable before the draw: \(context)")
                XCTAssertEqual(toggle.value as? String, "1", "New lists start ON: \(context)")
                XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries", context)

                app.drawButton.tap()
                XCTAssertTrue(toggle.exists, "Toggle while revealing: \(context)")
                waitForResult(app)
                XCTAssertTrue(toggle.isHittable, "Toggle on the result: \(context)")
                XCTAssertEqual(app.eligibleSummary, "7 eligible of 8 entries", "ON removes the winner: \(context)")

                flip(toggle)
                XCTAssertEqual(toggle.value as? String, "0", "Toggle operational: \(context)")
                XCTAssertTrue(app.staticTexts["Repeats possible"].exists, context)
                app.drawButton.tap()
                waitForResult(app)
                XCTAssertEqual(app.eligibleSummary, "7 eligible of 8 entries", "OFF keeps the winner: \(context)")
                app.terminate()
            }
        }
    }

    /// Release blocker 10: presenter (full-screen) mode keeps the toggle.
    @MainActor
    func testToggleStaysVisibleInPresenterMode() {
        let app = XCUIApplication.randomizer(seed: "league", style: "wheel", mode: "equal", open: "draw")
        app.launch()
        XCTAssertTrue(app.buttons["drawMenu"].waitForExistence(timeout: 10))
        app.buttons["drawMenu"].tap()
        app.buttons["Presenter mode"].tap()
        XCTAssertTrue(app.buttons["exitPresenterButton"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.removalToggle.isHittable)

        app.drawButton.tap()
        waitForResult(app)
        XCTAssertTrue(app.removalToggle.isHittable)
        flip(app.removalToggle)
        XCTAssertEqual(app.removalToggle.value as? String, "0")

        app.buttons["exitPresenterButton"].tap()
        XCTAssertTrue(app.buttons["drawMenu"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.removalToggle.value as? String, "0")
    }

    /// Release blockers 11 and 12: OFF disables the unique order with an
    /// explanation while normal draws work; ON enables it, and the order
    /// holds every entry exactly once.
    @MainActor
    func testUniqueDraftOrderNeedsRemovalOn() {
        let app = XCUIApplication.randomizer(seed: "league", style: "mysteryCard", mode: "reverseStandings", removal: "off", open: "draw")
        app.launch()

        let draftOrder = app.buttons["draftOrderButton"]
        XCTAssertTrue(draftOrder.waitForExistence(timeout: 10))
        XCTAssertFalse(draftOrder.isEnabled)
        XCTAssertTrue(app.staticTexts["Turn on Remove after selection to generate a unique draft order."].exists)

        app.drawButton.tap()
        waitForResult(app)
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries")
        XCTAssertEqual(app.removalToggle.value as? String, "0", "Never switched on behind your back")

        flip(app.removalToggle)
        XCTAssertTrue(draftOrder.isEnabled)
        XCTAssertFalse(app.staticTexts["Turn on Remove after selection to generate a unique draft order."].exists)

        draftOrder.tap()
        app.buttons["Generate unique order"].tap()
        XCTAssertTrue(app.buttons["revealNextPickButton"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.removalToggle.exists, "The draft reveal keeps the toggle")

        app.buttons["revealNextPickButton"].tap()
        let revealed = app.descendants(matching: .any).matching(identifier: "draftSlotRevealed")
        let oneRevealed = expectation(for: NSPredicate(format: "count == 1"), evaluatedWith: revealed)
        wait(for: [oneRevealed], timeout: 10)

        app.buttons["revealAllButton"].tap()
        XCTAssertTrue(app.staticTexts["allPicksRevealed"].waitForExistence(timeout: 10))
        XCTAssertEqual(revealed.count, 8)
        let labels = (0..<revealed.count).map { revealed.element(boundBy: $0).label }
        for team in ["Gridiron Ghosts", "Turf Burners", "Blitz Brigade", "Fourth & Long",
                     "Hail Marys", "End Zone Elite", "Pocket Passers", "Red Zone Royals"] {
            XCTAssertEqual(labels.filter { $0.hasSuffix(": \(team)") }.count, 1, "\(team) appears exactly once")
        }
        for pick in 1...8 {
            XCTAssertEqual(labels.filter { $0.hasPrefix("Pick \(pick):") }.count, 1, "Pick \(pick) filled once")
        }
    }

    /// Release blockers 5, 6 and 7 through the footer buttons.
    @MainActor
    func testUndoAndRestoreFromTheFooter() {
        let app = XCUIApplication.randomizer(seed: "league", style: "reel", mode: "equal", open: "draw", speed: "instant")
        app.launch()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))

        app.drawButton.tap()
        waitForResult(app)
        XCTAssertEqual(app.eligibleSummary, "7 eligible of 8 entries")
        app.buttons["undoLastDrawButton"].tap()
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries", "Undo restores a removed winner")

        app.drawButton.tap()
        waitForResult(app)
        sleep(1)
        app.drawButton.tap()
        waitForResult(app)
        XCTAssertEqual(app.eligibleSummary, "6 eligible of 8 entries")
        app.buttons["restoreRemovedButton"].tap()
        app.buttons["Restore all 2"].tap()
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries")

        flip(app.removalToggle)
        app.drawButton.tap()
        waitForResult(app)
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries")
        app.buttons["undoLastDrawButton"].tap()
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries", "Undo of an OFF draw leaves the pool")
    }

    /// Rapid taps make one draw, never extra winners.
    @MainActor
    func testDoubleTapDrawsOnce() {
        let app = XCUIApplication.randomizer(seed: "league", style: "wheel", mode: "equal", open: "draw", speed: "standard")
        app.launch()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        app.drawButton.doubleTap()
        waitForResult(app)
        XCTAssertEqual(app.eligibleSummary, "7 eligible of 8 entries")
        app.buttons["historyButton"].tap()
        let rows = app.descendants(matching: .any).matching(identifier: "historyRow")
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(rows.count, 1)
    }

    /// Drawing every entry leads to restore and new-session choices, not a dead button.
    @MainActor
    func testEmptyPoolOffersRestoreAndNewSession() {
        let app = XCUIApplication.randomizer(seed: "league", style: "lotteryBalls", mode: "equal", open: "draw", speed: "instant")
        app.launch()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        for _ in 0..<7 { app.buttons["batchIncrement"].tap() }
        XCTAssertTrue(app.drawButton.label.contains("Draw 8"), app.drawButton.label)
        app.drawButton.tap()
        XCTAssertTrue(app.buttons["showAllPicksButton"].waitForExistence(timeout: 10))
        app.buttons["showAllPicksButton"].tap()
        XCTAssertTrue(app.staticTexts["allSelectedMessage"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.drawButton.exists)
        XCTAssertTrue(app.removalToggle.isHittable)
        app.buttons["exhaustedRestoreButton"].tap()
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries")
        XCTAssertTrue(app.drawButton.exists)
    }
}
