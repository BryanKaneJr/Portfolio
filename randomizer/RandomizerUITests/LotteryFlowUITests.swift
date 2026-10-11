import XCTest

final class LotteryFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// A first-time user runs the sample league's lottery and sees the
    /// first pick within seconds.
    @MainActor
    func testSampleLeagueRunsWithinSeconds() {
        let app = XCUIApplication.draftLottery()
        app.launch()
        let start = Date()
        let sample = app.buttons["sampleLeagueCard"]
        XCTAssertTrue(sample.waitForExistence(timeout: 10))
        sample.tap()
        XCTAssertTrue(app.descendants(matching: .any)["formatSummary"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["formatSummary"].label.contains("Worst 6 of 10 teams in the lottery"))
        app.runLottery()

        // Teams outside the lottery are never hidden; the six lottery picks are.
        waitForCount(app.revealedSlots, 4)
        waitForCount(app.hiddenSlots, 6)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #6")
        XCTAssertTrue(app.runNumber.label.contains("Run #1"))

        revealNext(app)
        XCTAssertTrue(app.staticTexts["pickName"].exists)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #5")
        XCTAssertLessThan(Date().timeIntervalSince(start), 20)

        app.revealAllButton.tap()
        waitForCount(app.revealedSlots, 10)
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["keepSampleButton"].exists, "Offer to keep the sample or make your own")
    }

    /// Running again is confirmed and always shows: Run #2, hidden again.
    @MainActor
    func testRunAgainIsConfirmedAndCounted() {
        let app = XCUIApplication.draftLottery(seed: "league", run: "revealed", open: "lottery")
        app.launch()
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 10))
        XCTAssertTrue(app.runNumber.label.contains("Run #1"))

        app.buttons["runAgainButton"].tap()
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.staticTexts.containing(NSPredicate(format: "label CONTAINS 'Run #2'")).firstMatch.exists)
        alert.buttons["Cancel"].tap()
        XCTAssertTrue(app.runNumber.label.contains("Run #1"), "Cancel keeps the order")

        app.buttons["runAgainButton"].tap()
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        alert.buttons["Run Again"].tap()
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 5))
        XCTAssertTrue(app.runNumber.label.contains("Run #2"))
        waitForCount(app.hiddenSlots, 8)
    }

    /// Worst 4 of 8 in the lottery, top 2 drawn: picks 3 and 4 go to the
    /// lottery teams that weren't drawn, and picks 5 to 8 to the rest, in
    /// standings order.
    @MainActor
    func testTeamsOutsideTheDrawPickByStandings() {
        let app = XCUIApplication.draftLottery(seed: "league", lotteryTeams: 4, drawnPicks: 2, open: "lottery")
        app.launch()
        let summary = app.descendants(matching: .any)["formatSummary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 10))
        XCTAssertTrue(summary.label.contains("Worst 4 of 8 teams in the lottery"))
        XCTAssertTrue(summary.label.contains("Top 2 picks drawn"))

        app.runLottery()
        waitForCount(app.revealedSlots, 4)
        XCTAssertTrue(app.slot("Pick 5: Hail Marys, by standings").exists)
        XCTAssertTrue(app.slot("Pick 8: Red Zone Royals, by standings").exists)

        // Counting down: picks 4 and 3 are by standings, then the draw.
        revealNext(app)
        revealNext(app)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #2")
        app.revealAllButton.tap()
        waitForCount(app.revealedSlots, 8)
        let standings = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'draftSlotRevealed' AND label CONTAINS 'by standings'"))
        XCTAssertEqual(standings.count, 6)
        let drawn = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'draftSlotRevealed' AND label CONTAINS 'drawn'"))
        XCTAssertEqual(drawn.count, 2)
    }

    /// A new league with its own format survives the app being quit,
    /// including the run and how far the reveal got.
    @MainActor
    func testNewLeagueSurvivesRelaunch() {
        let store = UUID().uuidString
        var app = XCUIApplication.draftLottery(store: store)
        app.launch()

        app.buttons["newLeagueButton"].tap()
        let title = app.textFields["leagueTitleField"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("Sunday League\n")

        let add = app.textFields["addTeamField"]
        for name in ["Last Place Larry", "Bench Mob", "Waiver Wire", "Champs"] {
            add.tap()
            add.typeText("\(name)\n")
        }
        // Go to Lottery steps aside while the keyboard is up.
        XCTAssertFalse(app.buttons["goToLotteryButton"].exists)
        app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(app.buttons["goToLotteryButton"].waitForExistence(timeout: 5))

        let stepper = app.steppers["lotteryTeamsStepper"]
        XCTAssertTrue(stepper.waitForExistence(timeout: 5))
        stepper.buttons.element(boundBy: 0).tap()
        let worstThree = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'Worst 3'")).firstMatch
        XCTAssertTrue(worstThree.waitForExistence(timeout: 5))
        app.buttons["goToLotteryButton"].tap()

        app.runLottery()
        revealNext(app)
        app.terminate()

        app = XCUIApplication.draftLottery(store: store)
        app.launch()
        let card = app.leagueCard("Sunday League")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.tap()
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 5))
        XCTAssertTrue(app.runNumber.label.contains("Run #1"))
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #2", "The revealed pick stays revealed")
        XCTAssertTrue(app.slot("Pick 4: Champs, by standings").exists)
        XCTAssertTrue(app.descendants(matching: .any)["formatSummary"].label.contains("Worst 3 of 4 teams in the lottery"))
    }

    @MainActor
    func testPasteTeamsShowsAPreviewFirst() {
        let app = XCUIApplication.draftLottery()
        app.launch()
        app.buttons["newLeagueButton"].tap()
        // An empty league focuses "Add a team"; let the keyboard finish
        // rising so the button isn't tapped mid-layout.
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["pasteTeamsButton"].waitForExistence(timeout: 10))
        app.buttons["pasteTeamsButton"].tap()
        let editor = app.textViews["pasteTextEditor"]
        if !editor.waitForExistence(timeout: 5) {
            snap("debug-paste-sheet-missing")
            XCTFail("Paste sheet didn't open:\n\(app.debugDescription)")
            return
        }
        editor.tap()
        editor.typeText("1. Sharks\n\n  Jets  \n- Bears\nSharks")
        XCTAssertEqual(app.staticTexts["pastePreviewCount"].label, "4 teams will be added")
        app.buttons["confirmPasteButton"].tap()
        XCTAssertTrue(app.staticTexts["4/32"].waitForExistence(timeout: 5))
    }

    /// The odds table and the card flip reveal.
    @MainActor
    func testOddsTableAndCardFlipReveal() {
        let app = XCUIApplication.draftLottery(seed: "league", style: "cardFlip", lotteryTeams: 6, drawnPicks: 4, open: "lottery")
        app.launch()
        XCTAssertTrue(app.buttons["lotteryOddsButton"].waitForExistence(timeout: 10))
        app.buttons["lotteryOddsButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["top 4: 88.76%"].waitForExistence(timeout: 5), "The worst team's exact top-4 chance")
        app.buttons["oddsDoneButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForNonExistence(timeout: 5))

        app.runLottery()
        revealNext(app)
        revealNext(app)
        revealNext(app)
        XCTAssertTrue(app.staticTexts["pickName"].exists)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #3")
    }
}
