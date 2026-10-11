import XCTest

/// Walks every main screen with realistic leagues and saves phone-size
/// screenshots (also the raw material for App Store images).
final class ScreenshotTourUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    @MainActor
    func testScreenshotTour() {
        let app = XCUIApplication.draftLottery(seed: "tour", speed: "fast")
        app.launch()
        XCTAssertTrue(app.buttons["newLeagueButton"].waitForExistence(timeout: 10))
        snap("01-home")

        // The ten-team league: six in the lottery, weighted by standings.
        app.leagueCard("Sunday Night League").tap()
        XCTAssertTrue(app.runButton.waitForExistence(timeout: 5))
        snap("02-lottery-ready")
        app.buttons["lotteryOddsButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForExistence(timeout: 5))
        snap("03-odds")
        app.buttons["oddsDoneButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForNonExistence(timeout: 5))

        app.runLottery()
        snap("04-order-drawn")
        app.revealNextButton.tap()
        Thread.sleep(forTimeInterval: 0.9)
        snap("05-balls-drawing")
        waitForCount(app.revealedSlots, 5, timeout: 15)
        Thread.sleep(forTimeInterval: 0.6)
        snap("06-pick-revealed")
        revealNext(app)
        revealNext(app)
        revealNext(app)
        snap("07-countdown")
        app.revealAllButton.tap()
        waitForCount(app.revealedSlots, 10)
        Thread.sleep(forTimeInterval: 0.6)
        snap("08-order-set")

        app.openLotteryMenu()
        XCTAssertTrue(app.buttons["Presenter mode"].waitForExistence(timeout: 5))
        app.buttons["Presenter mode"].tap()
        XCTAssertTrue(app.buttons["exitPresenterButton"].waitForExistence(timeout: 5))
        snap("09-presenter")
        app.buttons["exitPresenterButton"].tap()

        app.tapToolbarButton("editLeagueButton")
        XCTAssertTrue(app.buttons["goToLotteryButton"].waitForExistence(timeout: 5))
        snap("10-editor")
        app.swipeUp()
        snap("11-editor-format")
        app.goBack()
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        app.goBack()

        // Twelve teams, card flip, top four drawn from the worst six.
        app.leagueCard("Office League").tap()
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        snap("12-office-order")
        app.buttons["replayRevealButton"].tap()
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 5))
        revealNext(app)
        snap("13-standings-pick")
        revealNext(app)
        app.revealNextButton.tap()
        Thread.sleep(forTimeInterval: 0.7)
        snap("14-card-flip")
        waitForCount(app.revealedSlots, 9, timeout: 15)
        Thread.sleep(forTimeInterval: 0.6)
        snap("15-card-revealed")
        app.goBack()

        app.buttons["settingsButton"].tap()
        XCTAssertTrue(app.buttons["settingsDoneButton"].waitForExistence(timeout: 5))
        snap("16-settings")
        app.buttons["settingsDoneButton"].tap()
    }

    /// The lottery screen mid-reveal at a large Dynamic Type size.
    @MainActor
    func testLargeTextLottery() {
        let app = XCUIApplication.draftLottery(seed: "league", lotteryTeams: 6, drawnPicks: 4, run: "hidden", open: "lottery")
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryXXXL"]
        app.launch()
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 10))
        XCTAssertTrue(app.revealNextButton.isHittable)
        XCTAssertTrue(app.revealAllButton.isHittable)
        snap("17-large-text")
    }

    /// The first-run screens a new customer sees.
    @MainActor
    func testFirstRunScreens() {
        let app = XCUIApplication.draftLottery(speed: "fast")
        app.launch()
        XCTAssertTrue(app.buttons["sampleLeagueCard"].waitForExistence(timeout: 10))
        snap("00-first-run")
        app.buttons["sampleLeagueCard"].tap()
        app.runLottery()
        revealNext(app)
        snap("00-first-pick")
    }
}
