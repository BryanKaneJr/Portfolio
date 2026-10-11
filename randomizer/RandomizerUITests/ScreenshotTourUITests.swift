import XCTest

/// Walks every main screen with one league of each lottery type and saves
/// phone-size screenshots (also the raw material for App Store images).
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

        // Pro Lottery: ten teams, the six non-playoff teams draw for the top four.
        app.leagueCard("Sunday Night League").tap()
        XCTAssertTrue(app.runButton.waitForExistence(timeout: 5))
        snap("02-pro-ready")
        app.buttons["lotteryOddsButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForExistence(timeout: 5))
        snap("03-pro-odds")
        app.buttons["oddsDoneButton"].tap()
        XCTAssertTrue(app.buttons["oddsDoneButton"].waitForNonExistence(timeout: 5))

        app.runLottery()
        snap("04-pro-drawn")
        revealNext(app)
        snap("05-standings-pick")
        revealNext(app)
        app.revealNextButton.tap()
        Thread.sleep(forTimeInterval: 0.9)
        snap("06-balls-drawing")
        waitForCount(app.revealedSlots, 7, timeout: 15)
        Thread.sleep(forTimeInterval: 0.6)
        snap("07-pick-revealed")
        revealNext(app)
        revealNext(app)
        snap("08-countdown")
        app.revealAllButton.tap()
        waitForCount(app.revealedSlots, 10)
        Thread.sleep(forTimeInterval: 0.6)
        snap("09-pro-order-set")

        app.openLotteryMenu()
        XCTAssertTrue(app.buttons["Presenter mode"].waitForExistence(timeout: 5))
        app.buttons["Presenter mode"].tap()
        XCTAssertTrue(app.buttons["exitPresenterButton"].waitForExistence(timeout: 5))
        snap("10-presenter")
        app.buttons["exitPresenterButton"].tap()

        app.tapToolbarButton("editLeagueButton")
        XCTAssertTrue(app.buttons["goToLotteryButton"].waitForExistence(timeout: 5))
        snap("11-editor")
        app.swipeUp()
        Thread.sleep(forTimeInterval: 0.5)
        snap("12-editor-types")
        app.goBack()
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        app.goBack()

        // Long Shot with card flips: everyone's in, the champ has 1%.
        app.leagueCard("Family Dynasty").tap()
        XCTAssertTrue(app.runButton.waitForExistence(timeout: 5))
        snap("13-longshot-ready")
        app.runLottery()
        app.revealNextButton.tap()
        Thread.sleep(forTimeInterval: 0.7)
        snap("14-card-flip")
        waitForCount(app.revealedSlots, 1, timeout: 15)
        Thread.sleep(forTimeInterval: 0.6)
        snap("15-card-revealed")
        app.goBack()

        // Slot Draft: draw the choosing order, then teams take their slots.
        app.leagueCard("Office League").tap()
        XCTAssertTrue(app.runButton.waitForExistence(timeout: 5))
        snap("16-slotdraft-ready")
        app.runLottery()
        app.revealAllButton.tap()
        XCTAssertTrue(app.descendants(matching: .any)["onTheClock"].waitForExistence(timeout: 5))
        Thread.sleep(forTimeInterval: 0.6)
        snap("17-on-the-clock")
        for slot in [12, 1, 6] {
            let open = app.openSlot(slot)
            XCTAssertTrue(open.waitForExistence(timeout: 5))
            open.tap()
        }
        waitForCount(app.takenSlots, 3)
        Thread.sleep(forTimeInterval: 0.4)
        snap("18-slots-filling")
        for slot in [2, 3, 4, 5, 7, 8, 9, 10] {
            let open = app.openSlot(slot)
            XCTAssertTrue(open.waitForExistence(timeout: 5))
            open.tap()
        }
        XCTAssertTrue(app.shareRunButton.waitForExistence(timeout: 5))
        Thread.sleep(forTimeInterval: 0.4)
        snap("19-slot-order-set")
        app.goBack()

        app.buttons["settingsButton"].tap()
        XCTAssertTrue(app.buttons["settingsDoneButton"].waitForExistence(timeout: 5))
        snap("20-settings")
        app.buttons["settingsDoneButton"].tap()
    }

    /// The lottery screen mid-reveal at a large Dynamic Type size.
    @MainActor
    func testLargeTextLottery() {
        let app = XCUIApplication.draftLottery(seed: "league", run: "hidden", open: "lottery")
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryXXXL"]
        app.launch()
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 10))
        XCTAssertTrue(app.revealNextButton.isHittable)
        XCTAssertTrue(app.revealAllButton.isHittable)
        snap("21-large-text")
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
