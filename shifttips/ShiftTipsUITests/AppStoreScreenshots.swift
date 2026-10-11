import XCTest

/// The App Store screenshots, on demo data (`-store-demo`, see
/// `StoreDemo`). The "ShiftTips App Store screenshots" workflow runs these
/// on a 6.9-inch iPhone with a clean status bar, then frames them with
/// headlines (`tools/frame_screenshots.py`). Attachment names become file
/// names and pick the headline, so keep them in step with that script.
final class AppStoreScreenshots: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-store-demo"] + extra
        app.launch()
        return app
    }

    /// New Shift, the receipt, the saved stamp, History and Totals.
    func testMainScreens() {
        let app = launch()
        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 10))
        XCTAssertEqual(review.label, "Review Split")
        snap(app, "store-02-new-shift")

        review.tap()
        XCTAssertTrue(element(in: app, labelContaining: "Allocated $472.38 of $472.38").waitForExistence(timeout: 5))
        snap(app, "store-01-review")

        app.buttons["saveShift"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "Saved to History").waitForExistence(timeout: 5))
        snap(app, "store-03-saved")

        app.buttons["startNextShift"].tap()
        app.buttons["historyButton"].tap()
        let totals = app.buttons["totalsByPerson"]
        XCTAssertTrue(totals.waitForExistence(timeout: 5))
        snap(app, "store-05-history")

        totals.tap()
        XCTAssertTrue(element(in: app, labelContaining: "Ava").waitForExistence(timeout: 5))
        snap(app, "store-04-totals")
    }

    func testTipOut() {
        let app = launch(["-advanced", "-store-demo-tipout"])
        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 10))
        review.tap()
        XCTAssertTrue(element(in: app, labelContaining: "Tipped out $183.96").waitForExistence(timeout: 5))
        snap(app, "store-06-tip-out")
    }

    func testTipStyles() {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-show-welcome"]
        app.launch()
        let advanced = app.buttons["experience-advanced"]
        XCTAssertTrue(advanced.waitForExistence(timeout: 10))
        advanced.tap()
        app.buttons["chooseMyStyle"].tap()
        XCTAssertTrue(app.buttons["style-pointsPool"].waitForExistence(timeout: 5))
        snap(app, "store-07-styles")
    }

    /// Advanced, Hours x Points: the method strip and people with points.
    func testPoints() {
        let app = launch(["-advanced", "-store-demo-points"])
        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["method-weightedHours"].exists)
        app.scrollViews.firstMatch.swipeUp(velocity: .slow)
        snap(app, "store-09-points")
    }

    /// First launch: Simple or Advanced.
    func testWelcome() {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-show-welcome"]
        app.launch()
        XCTAssertTrue(app.buttons["experience-advanced"].waitForExistence(timeout: 10))
        snap(app, "store-10-welcome")
    }

    func testDarkReview() {
        let app = launch(["-dark"])
        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 10))
        review.tap()
        XCTAssertTrue(element(in: app, labelContaining: "Allocated $472.38 of $472.38").waitForExistence(timeout: 5))
        snap(app, "store-08-dark")
    }

    private func element(in app: XCUIApplication, labelContaining text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    /// Lets transitions and the saved stamp settle, then keeps a screenshot.
    private func snap(_ app: XCUIApplication, _ name: String) {
        Thread.sleep(forTimeInterval: 1.2)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
