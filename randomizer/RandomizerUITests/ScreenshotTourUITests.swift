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

        // Spin Wheel: what's for dinner, repeats allowed.
        app.listCard("What's for Dinner?").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        snap("02-wheel-ready")
        app.drawButton.tap()
        waitForResult(app)
        snap("03-wheel-result")
        app.goBack()

        // Name Reel: the next contestant, nobody called twice.
        app.listCard("Next Contestant").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        app.drawButton.tap()
        waitForResult(app)
        snap("04-reel-result")
        app.goBack()

        // Lottery Balls: the fantasy draft lottery, its odds and a unique order.
        app.listCard("Fantasy Draft Lottery").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        snap("05-balls-ready")
        app.buttons["drawViewOddsButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForExistence(timeout: 5))
        snap("06-odds")
        app.buttons["oddsDoneButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForNonExistence(timeout: 5))
        app.buttons["draftOrderButton"].tap()
        XCTAssertTrue(app.buttons["Generate unique order"].waitForExistence(timeout: 5))
        app.buttons["Generate unique order"].tap()
        XCTAssertTrue(app.buttons["revealNextPickButton"].waitForExistence(timeout: 10))
        let revealed = app.descendants(matching: .any).matching(identifier: "draftSlotRevealed")
        app.buttons["revealNextPickButton"].tap()
        wait(for: [expectation(for: NSPredicate(format: "count == 1"), evaluatedWith: revealed)], timeout: 10)
        app.buttons["revealNextPickButton"].tap()
        wait(for: [expectation(for: NSPredicate(format: "count == 2"), evaluatedWith: revealed)], timeout: 10)
        snap("07-draft-reveal")
        app.buttons["revealAllButton"].tap()
        XCTAssertTrue(app.staticTexts["allPicksRevealed"].waitForExistence(timeout: 5))
        snap("08-draft-complete")
        app.goBack()

        XCTAssertTrue(app.staticTexts["allSelectedMessage"].waitForExistence(timeout: 5))
        snap("09-all-selected")
        app.buttons["historyButton"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["historyDoneButton"].waitForExistence(timeout: 5))
        snap("10-history")
        app.buttons["historyDoneButton"].tap()
        XCTAssertTrue(app.buttons["historyDoneButton"].waitForNonExistence(timeout: 5))

        app.buttons["exhaustedRestoreButton"].tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        app.drawButton.tap()
        waitForResult(app)
        snap("11-balls-result")
        sleep(1)
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

        // Mystery Reveal with custom weights.
        app.listCard("Prize Raffle").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 5))
        snap("14-mystery-ready")
        app.drawButton.tap()
        waitForResult(app)
        snap("15-mystery-result")
        app.goBack()

        app.buttons["settingsButton"].tap()
        XCTAssertTrue(app.buttons["settingsDoneButton"].waitForExistence(timeout: 5))
        snap("16-settings")
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
        snap("17-large-text-draw")
    }

    /// The first-run screen a new customer sees.
    @MainActor
    func testFirstRunScreens() {
        let app = XCUIApplication.randomizer(speed: "fast")
        app.launch()
        XCTAssertTrue(app.exampleCard("What's for Dinner?").waitForExistence(timeout: 10))
        snap("00-first-run")
        app.exampleCard("What's for Dinner?").tap()
        XCTAssertTrue(app.drawButton.waitForExistence(timeout: 10))
        app.drawButton.tap()
        waitForResult(app)
        snap("00-first-run-result")
    }
}
