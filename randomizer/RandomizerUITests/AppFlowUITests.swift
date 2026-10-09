import XCTest

final class AppFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// A first-time user sees three examples and draws from one within
    /// 15 seconds.
    @MainActor
    func testFirstRunExampleDrawsWithinSeconds() {
        let app = XCUIApplication.randomizer()
        app.launch()
        let start = Date()
        let dinner = app.exampleCard("What's for Dinner?")
        XCTAssertTrue(dinner.waitForExistence(timeout: 10))
        XCTAssertTrue(app.exampleCard("Fantasy Draft Lottery").exists)
        XCTAssertTrue(app.exampleCard("Next Contestant").exists)
        dinner.tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        app.drawButton.tap()
        waitForResult(app)
        XCTAssertLessThan(Date().timeIntervalSince(start), 15)
        XCTAssertEqual(app.eligibleSummary, "8 eligible of 8 entries", "Dinner allows repeats")
        XCTAssertTrue(app.buttons["keepSampleButton"].exists, "Offer to keep the example or make your own")
    }

    /// Phase 2 and release blocker 8: a new list, its toggle, pool and
    /// results survive the app being quit and reopened.
    @MainActor
    func testNewListSurvivesRelaunch() {
        let store = UUID().uuidString
        var app = XCUIApplication.randomizer(store: store)
        app.launch()

        app.buttons["newListButton"].tap()
        let title = app.textFields["listTitleField"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("Period 3\n")

        let add = app.textFields["addEntryField"]
        for name in ["Ava", "Ben", "Chloe"] {
            add.tap()
            add.typeText("\(name)\n")
        }
        // Start Drawing steps aside while the keyboard is up.
        XCTAssertFalse(app.buttons["startDrawingButton"].exists)
        app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(app.buttons["startDrawingButton"].waitForExistence(timeout: 5))
        app.buttons["startDrawingButton"].tap()

        XCTAssertTrue(app.removalToggle.waitForExistence(timeout: 5))
        XCTAssertEqual(app.eligibleSummary, "3 eligible of 3 entries")
        flip(app.removalToggle)
        app.drawButton.tap()
        waitForResult(app)
        app.terminate()

        app = XCUIApplication.randomizer(store: store)
        app.launch()
        let card = app.listCard("Period 3")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.tap()
        XCTAssertTrue(app.removalToggle.waitForExistence(timeout: 5))
        XCTAssertEqual(app.removalToggle.value as? String, "0")
        XCTAssertEqual(app.eligibleSummary, "3 eligible of 3 entries")
        XCTAssertTrue(app.staticTexts["lastDrawName"].exists, "The last result is still there")
    }

    @MainActor
    func testPasteNamesShowsAPreviewFirst() {
        let app = XCUIApplication.randomizer()
        app.launch()
        app.buttons["newListButton"].tap()
        // An empty list focuses "Add a name"; let the keyboard finish rising
        // so the button isn't tapped mid-layout.
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["pasteNamesButton"].waitForExistence(timeout: 10))
        app.buttons["pasteNamesButton"].tap()
        let editor = app.textViews["pasteTextEditor"]
        if !editor.waitForExistence(timeout: 5) {
            snap("debug-paste-sheet-missing")
            XCTFail("Paste sheet didn't open:\n\(app.debugDescription)")
            return
        }
        editor.tap()
        editor.typeText("Pizza\n\n  Tacos  \nSushi\nPizza")
        XCTAssertEqual(app.staticTexts["pastePreviewCount"].label, "4 names will be added")
        app.buttons["confirmPasteButton"].tap()
        XCTAssertTrue(app.staticTexts["4/200"].waitForExistence(timeout: 5))
    }
}
