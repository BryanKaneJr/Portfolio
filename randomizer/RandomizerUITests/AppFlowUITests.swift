import XCTest

final class AppFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// A first-time user draws from the sample within 15 seconds.
    func testFirstRunSampleDrawsWithinSeconds() {
        let app = XCUIApplication.randomizer()
        app.launch()
        let start = Date()
        XCTAssertTrue(app.buttons["tryDrawButton"].waitForExistence(timeout: 10))
        app.buttons["tryDrawButton"].tap()
        app.drawButton.tap()
        waitForResult(app)
        XCTAssertLessThan(Date().timeIntervalSince(start), 15)
        XCTAssertTrue(app.buttons["keepSampleButton"].exists, "Offer to keep or replace the sample")
    }

    /// Phase 2 and release blocker 8: a new list, its toggle, pool and
    /// results survive the app being quit and reopened.
    func testNewListSurvivesRelaunch() {
        let store = UUID().uuidString
        var app = XCUIApplication.randomizer(store: store)
        app.launch()

        app.buttons["newListButton"].tap()
        let title = app.textFields["listTitleField"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        title.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 12) + "Period 3\n")

        let add = app.textFields["addEntryField"]
        for name in ["Ava", "Ben", "Chloe"] {
            add.tap()
            add.typeText("\(name)\n")
        }
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

    func testPasteNamesShowsAPreviewFirst() {
        let app = XCUIApplication.randomizer()
        app.launch()
        app.buttons["newListButton"].tap()
        app.buttons["pasteNamesButton"].tap()
        let editor = app.textViews["pasteTextEditor"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.tap()
        editor.typeText("Pizza\n\n  Tacos  \nSushi\nPizza")
        XCTAssertEqual(app.staticTexts["pastePreviewCount"].label, "4 names will be added")
        app.buttons["confirmPasteButton"].tap()
        XCTAssertTrue(app.staticTexts["4/200"].waitForExistence(timeout: 5))
    }
}
