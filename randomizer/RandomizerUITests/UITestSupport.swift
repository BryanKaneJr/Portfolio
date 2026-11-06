import XCTest

/// Launch helpers. The app reads `-ui-testing` and the UITEST_* variables in
/// `UITestSeeds` to start from a known league in a throwaway store.
extension XCUIApplication {
    static func draftLottery(
        seed: String? = nil,
        style: String? = nil,
        type: String? = nil,
        lotteryTeams: Int? = nil,
        drawnPicks: Int? = nil,
        run: String? = nil,
        open: String? = nil,
        speed: String = "fast",
        store: String? = nil
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-soundOn", "NO", "-hapticsOn", "NO", "-animationSpeed", speed]
        var environment: [String: String] = [:]
        environment["UITEST_SEED"] = seed
        environment["UITEST_STYLE"] = style
        environment["UITEST_TYPE"] = type
        environment["UITEST_LOTTERY"] = lotteryTeams.map(String.init)
        environment["UITEST_DRAWN"] = drawnPicks.map(String.init)
        environment["UITEST_RUN"] = run
        environment["UITEST_OPEN"] = open
        environment["UITEST_STORE"] = store
        app.launchEnvironment = environment
        return app
    }

    var runButton: XCUIElement { buttons["runLotteryButton"] }
    var revealNextButton: XCUIElement { buttons["revealNextPickButton"] }
    var revealAllButton: XCUIElement { buttons["revealAllButton"] }
    var shareRunButton: XCUIElement { buttons["shareRunButton"] }
    var runNumber: XCUIElement { descendants(matching: .any)["runNumberLabel"] }
    var revealedSlots: XCUIElementQuery { descendants(matching: .any).matching(identifier: "draftSlotRevealed") }
    var hiddenSlots: XCUIElementQuery { descendants(matching: .any).matching(identifier: "draftSlotHidden") }

    var takenSlots: XCUIElementQuery { descendants(matching: .any).matching(identifier: "takenSlot") }

    func openSlot(_ slot: Int) -> XCUIElement {
        buttons["openSlot-\(slot)"]
    }

    func leagueCard(_ title: String) -> XCUIElement {
        buttons.matching(NSPredicate(format: "identifier == 'leagueCard' AND label CONTAINS %@", title)).firstMatch
    }

    /// A revealed draft slot by its spoken label, such as
    /// "Pick 5: Hail Marys, by standings".
    func slot(_ label: String) -> XCUIElement {
        descendants(matching: .any).matching(NSPredicate(format: "identifier == 'draftSlotRevealed' AND label == %@", label)).firstMatch
    }

    /// Taps Run the Lottery and confirms.
    func runLottery(file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(runButton.waitForExistence(timeout: 10), file: file, line: line)
        runButton.tap()
        let confirm = buttons["Run Now"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "No confirmation", file: file, line: line)
        confirm.tap()
        XCTAssertTrue(revealNextButton.waitForExistence(timeout: 10), "The run didn't start", file: file, line: line)
    }

    /// Taps the navigation bar's back button by coordinate (iOS 26 nav bar
    /// buttons can refuse XCUITest's scroll-to-visible).
    func goBack() {
        let back = navigationBars.buttons.element(boundBy: 0)
        XCTAssertTrue(back.waitForExistence(timeout: 5))
        back.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    /// Opens the lottery screen's toolbar menu. iOS 26 groups toolbar items
    /// in a way XCUITest can't scroll to, so tap its centre directly.
    func openLotteryMenu() {
        let menu = buttons["lotteryMenu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        menu.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func tapToolbarButton(_ identifier: String) {
        let button = buttons[identifier]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
}

@MainActor
extension XCTestCase {
    /// Waits until `query` has exactly `count` elements.
    func waitForCount(_ query: XCUIElementQuery, _ count: Int, timeout: TimeInterval = 10, file: StaticString = #filePath, line: UInt = #line) {
        let reached = expectation(for: NSPredicate(format: "count == %d", count), evaluatedWith: query)
        let result = XCTWaiter().wait(for: [reached], timeout: timeout)
        XCTAssertEqual(result, .completed, "Expected \(count), found \(query.count)", file: file, line: line)
    }

    /// Reveals the next pick and waits for it to land.
    func revealNext(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let before = app.revealedSlots.count
        XCTAssertTrue(app.revealNextButton.waitForExistence(timeout: 5), file: file, line: line)
        app.revealNextButton.tap()
        waitForCount(app.revealedSlots, before + 1, timeout: 15, file: file, line: line)
        // Let the landing transition finish so screenshots aren't mid-fade.
        Thread.sleep(forTimeInterval: 0.6)
    }

    /// Saves a screenshot to the test report and, when SCREENSHOT_DIR is set
    /// (CI passes TEST_RUNNER_SCREENSHOT_DIR), as a PNG.
    func snap(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let directory = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"], !directory.isEmpty {
            let url = URL(fileURLWithPath: directory).appendingPathComponent("\(name).png")
            try? screenshot.pngRepresentation.write(to: url)
        }
    }
}
