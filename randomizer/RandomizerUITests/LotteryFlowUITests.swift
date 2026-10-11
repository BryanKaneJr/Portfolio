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
        let app = XCUIApplication.draftLottery(seed: "league", type: "longShot", run: "revealed", open: "lottery")
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

        // Pro Lottery is the default; one playoff team fewer puts three of
        // the four teams in the lottery.
        let stepper = app.steppers["playoffTeamsStepper"]
        for _ in 0..<3 where !stepper.exists {
            app.swipeUp()
        }
        XCTAssertTrue(stepper.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["lotteryType-pro"].isSelected)
        stepper.buttons.element(boundBy: 0).tap()
        app.buttons["goToLotteryButton"].tap()
        let summary = app.descendants(matching: .any)["formatSummary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 5))
        XCTAssertTrue(summary.label.contains("Worst 3 of 4 teams in the lottery"), summary.label)

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
        XCTAssertTrue(app.staticTexts["top 4: 72%"].waitForExistence(timeout: 5), "The worst team's exact top-4 chance with pro odds")
        app.buttons["oddsDoneButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForNonExistence(timeout: 5))

        app.runLottery()
        revealNext(app)
        revealNext(app)
        revealNext(app)
        XCTAssertTrue(app.staticTexts["pickName"].exists)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #3")
    }

    /// Long Shot: everyone's in, and the champion still has a 1% shot.
    @MainActor
    func testLongShotGivesTheChampOnePercent() {
        let app = XCUIApplication.draftLottery(seed: "league", type: "longShot", open: "lottery")
        app.launch()
        let champ = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'oddsPreviewRow' AND label CONTAINS 'Red Zone Royals'")).firstMatch
        XCTAssertTrue(champ.waitForExistence(timeout: 10))
        XCTAssertTrue(champ.label.contains("1%"), champ.label)
        app.runLottery()
        waitForCount(app.hiddenSlots, 8)
        XCTAssertEqual(app.revealNextButton.label, "Reveal pick #8")
        app.revealAllButton.tap()
        waitForCount(app.revealedSlots, 8)
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
    }

    /// Slot Draft: the draw sets the choosing order, then each team takes
    /// an open slot; the last team gets the last slot, and Undo fixes a
    /// mis-tap.
    @MainActor
    func testSlotDraftTeamsChooseTheirSlots() {
        let app = XCUIApplication.draftLottery(seed: "league", type: "slotDraft", open: "lottery")
        app.launch()
        app.runLottery()
        XCTAssertEqual(app.revealNextButton.label, "Reveal 8th choice")
        app.revealAllButton.tap()
        XCTAssertTrue(app.descendants(matching: .any)["onTheClock"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.openSlot(1).waitForExistence(timeout: 5))

        app.openSlot(1).tap()
        waitForCount(app.takenSlots, 1)
        app.buttons["undoSlotButton"].tap()
        waitForCount(app.takenSlots, 0)

        for slot in 1...7 {
            let open = app.openSlot(slot)
            XCTAssertTrue(open.waitForExistence(timeout: 5), "Slot \(slot) should be open")
            open.tap()
            waitForCount(app.takenSlots, slot == 7 ? 8 : slot)
        }
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["replayRevealButton"].exists, "No replay once teams have chosen")
    }
}
