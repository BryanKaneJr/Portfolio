import XCTest

/// Launch helpers. The app reads `-ui-testing` and the UITEST_* variables in
/// `UITestSeeds` to start from a known list in a throwaway store.
extension XCUIApplication {
    static func randomizer(
        seed: String? = nil,
        style: String? = nil,
        mode: String? = nil,
        removal: String? = nil,
        open: String? = nil,
        speed: String = "fast",
        store: String? = nil
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-soundOn", "NO", "-hapticsOn", "NO", "-animationSpeed", speed]
        var environment: [String: String] = [:]
        environment["UITEST_SEED"] = seed
        environment["UITEST_STYLE"] = style
        environment["UITEST_MODE"] = mode
        environment["UITEST_REMOVAL"] = removal
        environment["UITEST_OPEN"] = open
        environment["UITEST_STORE"] = store
        app.launchEnvironment = environment
        return app
    }

    var removalToggle: XCUIElement { switches["removeAfterSelectionToggle"] }
    var drawButton: XCUIElement { buttons["drawButton"] }
    var eligibleSummary: String { staticTexts["eligibleSummary"].label }

    func listCard(_ title: String) -> XCUIElement {
        buttons.matching(NSPredicate(format: "identifier == 'listCard' AND label CONTAINS %@", title)).firstMatch
    }

    func goBack() {
        navigationBars.buttons.element(boundBy: 0).tap()
    }
}

extension XCTestCase {
    /// Flips a SwiftUI toggle by tapping the switch at its trailing edge.
    func flip(_ toggle: XCUIElement) {
        toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.96, dy: 0.5)).tap()
    }

    /// Waits for the reveal to land and the result to show.
    func waitForResult(_ app: XCUIApplication, timeout: TimeInterval = 15, file: StaticString = #filePath, line: UInt = #line) {
        let drawing = app.staticTexts.matching(identifier: "drawingInProgress").firstMatch
        let gone = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: drawing)
        wait(for: [gone], timeout: timeout)
        XCTAssertTrue(app.staticTexts["resultName"].waitForExistence(timeout: timeout), "No result shown", file: file, line: line)
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
