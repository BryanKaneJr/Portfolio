import XCTest

/// Drives the real app with throwaway in-memory storage (`-ui-testing`).
final class ShiftTipsUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"] + extra
        app.launch()
        return app
    }

    /// The happy path: example shift, review the reconciled split, save it,
    /// and find it in History.
    func testExampleShiftReviewSaveAndHistory() {
        let app = launch()

        app.buttons["tryExample"].tap()
        attachScreenshot(app, "1 New Shift (example)")

        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 5))
        XCTAssertEqual(review.label, "Review Split")
        review.tap()

        let reconciliation = element(in: app, labelContaining: "Allocated $472.38 of $472.38")
        XCTAssertTrue(reconciliation.waitForExistence(timeout: 5))
        XCTAssertTrue(reconciliation.label.contains("$0.00 remaining"))
        attachScreenshot(app, "2 Review Split")

        app.buttons["saveShift"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "Saved to History").waitForExistence(timeout: 5))
        attachScreenshot(app, "3 Saved")

        app.buttons["startNextShift"].tap()
        app.buttons["historyButton"].tap()
        // Amounts are read to VoiceOver as words.
        XCTAssertTrue(element(in: app, labelContaining: "472 dollars and 38 cents").waitForExistence(timeout: 5))
        attachScreenshot(app, "4 History")

        // This week's totals include today's example shift.
        app.buttons["totalsByPerson"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "113 dollars and 37 cents").waitForExistence(timeout: 5))
        attachScreenshot(app, "7 Totals by Person")
    }

    /// Tip Out: the example chain of rules, reviewed and saved.
    func testTipOutExampleReviewAndSave() {
        let app = launch(["-advanced"])
        app.buttons["mode-tipOut"].tap()
        app.buttons["tryExample"].tap()
        attachScreenshot(app, "5 Tip Out (example)")

        let review = app.buttons["reviewSplit"]
        XCTAssertTrue(review.waitForExistence(timeout: 5))
        XCTAssertEqual(review.label, "Review Tip-Outs")
        review.tap()

        let reconciliation = element(in: app, labelContaining: "Tipped out $183.96")
        XCTAssertTrue(reconciliation.waitForExistence(timeout: 5))
        XCTAssertTrue(reconciliation.label.contains("$0.00 left over"))
        attachScreenshot(app, "6 Review Tip-Outs")

        app.buttons["saveShift"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "Saved to History").waitForExistence(timeout: 5))
    }

    /// Simple shows tips, people and hours only.
    func testSimpleHidesAdvancedControls() {
        let app = launch()
        app.buttons["tryExample"].tap()
        XCTAssertTrue(app.buttons["reviewSplit"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["mode-tipOut"].exists)
        XCTAssertFalse(app.buttons["method-equal"].exists)
        XCTAssertFalse(app.descendants(matching: .any)["splitCashCardToggle"].exists)
    }

    /// Advanced shows the mode, method and cash-and-card controls.
    func testAdvancedShowsItsControls() {
        let app = launch(["-advanced"])
        app.buttons["tryExample"].tap()
        XCTAssertTrue(app.buttons["reviewSplit"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["mode-tipOut"].exists)
        XCTAssertTrue(app.buttons["method-equal"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["splitCashCardToggle"].exists)
        app.buttons["method-weightedHours"].tap()
        attachScreenshot(app, "10 Advanced, Hours x Points")
    }

    /// Dark mode, for design review: New Shift, Review and the saved slip.
    func testDarkModeScreens() {
        let app = launch(["-advanced", "-dark"])
        app.buttons["tryExample"].tap()
        XCTAssertTrue(app.buttons["reviewSplit"].waitForExistence(timeout: 5))
        attachScreenshot(app, "11 Dark New Shift")
        app.buttons["reviewSplit"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "Allocated $472.38 of $472.38").waitForExistence(timeout: 5))
        attachScreenshot(app, "12 Dark Review")
        app.buttons["saveShift"].tap()
        XCTAssertTrue(element(in: app, labelContaining: "Saved to History").waitForExistence(timeout: 5))
        attachScreenshot(app, "13 Dark Saved")
    }

    /// The largest accessibility text size wraps rather than truncates.
    func testLargeTextNewShift() {
        let app = launch(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityL"])
        app.buttons["tryExample"].tap()
        XCTAssertTrue(app.buttons["reviewSplit"].waitForExistence(timeout: 5))
        attachScreenshot(app, "14 Large Text New Shift")
    }

    func testSettings() {
        let app = launch(["-advanced"])
        app.buttons["settingsButton"].tap()
        XCTAssertTrue(app.buttons["Add Crew"].waitForExistence(timeout: 5))
        attachScreenshot(app, "15 Settings")
        app.buttons["Add Crew"].tap()
        XCTAssertTrue(app.textFields["crewName"].waitForExistence(timeout: 5))
        attachScreenshot(app, "16 New Crew")
    }

    /// Advanced from the welcome: pick a style, land in the crew editor
    /// set up that way.
    func testAdvancedWelcomeLeadsToStyles() {
        let app = launch(["-show-welcome"])
        let advanced = app.buttons["experience-advanced"]
        XCTAssertTrue(advanced.waitForExistence(timeout: 5))
        advanced.tap()
        app.buttons["chooseMyStyle"].tap()
        let points = app.buttons["style-pointsPool"]
        XCTAssertTrue(points.waitForExistence(timeout: 5))
        attachScreenshot(app, "8 Tip Styles")
        points.tap()
        XCTAssertTrue(app.textFields["crewName"].waitForExistence(timeout: 5))
        XCTAssertTrue(element(in: app, labelContaining: "Points pool").exists)
        attachScreenshot(app, "9 New Crew, Points pool")
    }

    /// The Review button explains what's missing instead of letting a
    /// broken split through.
    func testMissingTipsBlocksReview() {
        let app = launch()
        app.buttons["tryExample"].tap()

        let tips = app.textFields["tipsField"]
        XCTAssertTrue(tips.waitForExistence(timeout: 5))
        // The amount is centered, so tapping the far right puts the cursor at the end.
        tips.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
        tips.clearText()

        let review = app.buttons["reviewSplit"]
        XCTAssertEqual(review.label, "Enter the pooled tips")

        tips.typeText("4.567")
        XCTAssertEqual(review.label, "Use at most two decimal places.")
    }

    func testWelcomeShowsOnFirstLaunch() {
        let app = launch(["-show-welcome"])
        XCTAssertTrue(app.buttons["Set Up My Crew"].waitForExistence(timeout: 5))
        attachScreenshot(app, "0 Welcome")
        app.buttons["Not Now"].tap()
        XCTAssertTrue(app.buttons["tryExample"].waitForExistence(timeout: 5))
    }

    private func element(in app: XCUIApplication, labelContaining text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func attachScreenshot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

private extension XCUIElement {
    func clearText() {
        guard let value = value as? String, !value.isEmpty else { return }
        let deletes = String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count)
        typeText(deletes)
    }
}
