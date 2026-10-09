import XCTest

/// Walks every main screen with realistic lists and saves phone-size
/// screenshots (also the raw material for App Store images).
final class ScreenshotTourUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    @MainActor
    func testScreenshotTour() {
        let app = XCUIApplication.randomizer(seed: "tour", speed: "fast")
        app.launch()
        XCTAssertTrue(app.buttons["newListButton"].waitForExistence(timeout: 10))
        snap("01-home")

        // Spin Wheel, repeats allowed.
        app.listCard("Dinner Choices").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        snap("02-wheel-ready")
        app.drawButton.tap()
        waitForResult(app)
        snap("03-wheel-result")
        app.goBack()

        // Name Reel, classroom with no repeats.
        app.listCard("Period 3").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        app.drawButton.tap()
        waitForResult(app)
        snap("04-reel-result")
        app.goBack()

        // Lottery Balls with custom weights, and the odds sheet.
        app.listCard("Team Raffle").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        app.drawButton.tap()
        waitForResult(app)
        snap("05-balls-result")
        app.buttons["drawViewOddsButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForExistence(timeout: 5))
        snap("06-odds")
        app.buttons["oddsDoneButton"].tap()
        app.goBack()

        // Mystery Reveal with Reverse Standings, then a unique draft order.
        app.listCard("Friday Fantasy Draft").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        snap("07-mystery-ready")
        app.buttons["draftOrderButton"].tap()
        XCTAssertTrue(app.buttons["Generate unique order"].waitForExistence(timeout: 5))
        app.buttons["Generate unique order"].tap()
        XCTAssertTrue(app.buttons["revealNextPickButton"].waitForExistence(timeout: 10))
        app.buttons["revealNextPickButton"].tap()
        let revealed = app.descendants(matching: .any).matching(identifier: "draftSlotRevealed")
        wait(for: [expectation(for: NSPredicate(format: "count == 1"), evaluatedWith: revealed)], timeout: 10)
        app.buttons["revealNextPickButton"].tap()
        wait(for: [expectation(for: NSPredicate(format: "count == 2"), evaluatedWith: revealed)], timeout: 10)
        snap("08-draft-reveal")
        app.buttons["revealAllButton"].tap()
        XCTAssertTrue(app.staticTexts["allPicksRevealed"].waitForExistence(timeout: 5))
        snap("09-draft-complete")
        app.goBack()

        XCTAssertTrue(app.staticTexts["allSelectedMessage"].waitForExistence(timeout: 5))
        snap("10-all-selected")
        app.buttons["historyButton"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["historyDoneButton"].waitForExistence(timeout: 5))
        snap("11-history")
        app.buttons["historyDoneButton"].tap()

        app.buttons["exhaustedRestoreButton"].tap()
        app.openDrawMenu()
        XCTAssertTrue(app.buttons["Presenter mode"].waitForExistence(timeout: 5))
        app.buttons["Presenter mode"].tap()
        XCTAssertTrue(app.buttons["exitPresenterButton"].waitForExistence(timeout: 5))
        app.drawButton.tap()
        waitForResult(app)
        snap("12-presenter")
        app.buttons["exitPresenterButton"].tap()

        app.buttons["editListButton"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["startDrawingButton"].waitForExistence(timeout: 5))
        snap("13-editor")
        app.goBack()
        app.goBack()

        app.buttons["settingsButton"].tap()
        XCTAssertTrue(app.buttons["settingsDoneButton"].waitForExistence(timeout: 5))
        snap("14-settings")
        app.buttons["settingsDoneButton"].tap()
    }

    /// The draw screen with repeats allowed at a large Dynamic Type size.
    @MainActor
    func testLargeTextDrawScreen() {
        let app = XCUIApplication.randomizer(seed: "league", style: "wheel", mode: "customWeighted", removal: "off", open: "draw")
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryXXXL"]
        app.launch()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        XCTAssertTrue(app.removalToggle.isHittable)
        snap("15-large-text-draw")
    }

    /// The first-run screen a new customer sees.
    @MainActor
    func testFirstRunScreens() {
        let app = XCUIApplication.randomizer(speed: "fast")
        app.launch()
        XCTAssertTrue(app.buttons["tryDrawButton"].waitForExistence(timeout: 10))
        snap("00-first-run")
        app.buttons["tryDrawButton"].tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        app.drawButton.tap()
        waitForResult(app)
        snap("00-first-run-result")
    }
}
