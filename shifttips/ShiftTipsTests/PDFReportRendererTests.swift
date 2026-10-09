import PDFKit
import XCTest
import ShiftTipsCore
@testable import ShiftTips

/// The PDF is the one export that can only be built on iOS, so it's tested
/// here; everything else is tested in ShiftTipsKit.
final class PDFReportRendererTests: XCTestCase {
    private let day = CalendarDay(year: 2026, month: 10, day: 8)

    func testExampleShiftFitsOnePageAndReconciles() throws {
        let result = ShiftForm.example(day: day, method: .hours).calculation.result
        let document = try XCTUnwrap(PDFDocument(data: PDFReportRenderer.render(result, savedAt: nil)))
        XCTAssertEqual(document.pageCount, 1)
        let text = try XCTUnwrap(document.string)
        XCTAssertTrue(text.contains("Tip pool breakdown"))
        XCTAssertTrue(text.contains("$472.38"))
        XCTAssertTrue(text.contains("Allocated $472.38 of $472.38, $0.00 remaining"))
        XCTAssertTrue(text.contains("Ava (Server)"))
        XCTAssertTrue(text.contains("$113.37"))
        XCTAssertTrue(text.contains("not a record") || text.contains("isn't a record"))
    }

    func testCashAndCardColumnsAppear() throws {
        var form = ShiftForm.example(day: day, method: .equal)
        form.setSplitCashAndCard(true)
        form.cashText = "100.01"
        form.cardText = "50.02"
        let result = form.calculation.result
        XCTAssertTrue(result.reconciles)
        let text = try XCTUnwrap(PDFDocument(data: PDFReportRenderer.render(result, savedAt: Date()))?.string)
        XCTAssertTrue(text.contains("CASH"))
        XCTAssertTrue(text.contains("CARD"))
        XCTAssertTrue(text.contains("$150.03"))
    }

    func testLongCrewsContinueOnMorePages() throws {
        var form = ShiftForm(day: day, method: .hours)
        form.tipsText = "5000"
        for index in 1...80 {
            form.addOneOff(name: "Person \(index)", role: "Server")
            form.rows[form.rows.count - 1].hoursText = "\(4 + index % 5)"
        }
        let result = form.calculation.result
        XCTAssertTrue(result.reconciles)
        let document = try XCTUnwrap(PDFDocument(data: PDFReportRenderer.render(result, savedAt: nil)))
        XCTAssertGreaterThan(document.pageCount, 1)
        let text = try XCTUnwrap(document.string)
        XCTAssertTrue(text.contains("Person 80"))
        XCTAssertTrue(text.contains("Page 2"))
    }
}
