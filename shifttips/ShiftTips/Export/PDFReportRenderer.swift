import UIKit
import ShiftTipsCore

/// A US Letter breakdown: header, totals, one line per person, who's not in
/// the pool, the reconciliation line and the allocation note. Long crews
/// continue onto more pages with the table header repeated.
enum PDFReportRenderer {
    static func render(_ result: SplitResult, savedAt: Date?) -> Data {
        let layout = Layout(result: result)
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: "ShiftTips breakdown \(result.draft.title)",
            kCGPDFContextCreator as String: "ShiftTips",
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: Layout.page, format: format)
        return renderer.pdfData { context in
            var drawer = Drawer(context: context, layout: layout, result: result, savedAt: savedAt)
            drawer.draw()
        }
    }

    struct Column {
        let title: String
        let width: CGFloat
        let alignment: NSTextAlignment
        let value: (SplitResult.Entry) -> String
    }

    struct Layout {
        static let page = CGRect(x: 0, y: 0, width: 612, height: 792)
        static let margin: CGFloat = 48
        static let rowHeight: CGFloat = 22
        static let footerHeight: CGFloat = 40
        static var contentWidth: CGFloat { page.width - margin * 2 }

        let columns: [Column]

        init(result: SplitResult) {
            let method = result.draft.method
            let split = result.draft.pool.isSplit
            var fixed: [Column] = []
            if method.usesHours {
                fixed.append(Column(title: "Hours", width: 62, alignment: .right) { Hours.format(minutes: $0.participant.minutesWorked) })
            }
            if method.usesPoints {
                fixed.append(Column(title: "Points", width: 50, alignment: .right) { Points.format(units: $0.participant.pointsUnits) })
            }
            fixed.append(Column(title: "Share", width: 54, alignment: .right) {
                Explainer.percentText(weight: $0.allocation.weight, total: result.totalWeight)
            })
            if split {
                fixed.append(Column(title: "Cash", width: 72, alignment: .right) { Money.format($0.allocation.cashCents ?? 0) })
                fixed.append(Column(title: "Card", width: 72, alignment: .right) { Money.format($0.allocation.cardCents ?? 0) })
            }
            fixed.append(Column(title: "Allocated", width: 80, alignment: .right) { Money.format($0.allocation.totalCents) })
            let used = fixed.reduce(0) { $0 + $1.width }
            let person = Column(title: "Person", width: Layout.contentWidth - used, alignment: .left) { entry in
                entry.participant.nameWithRole
            }
            columns = [person] + fixed
        }
    }

    struct Drawer {
        let context: UIGraphicsPDFRendererContext
        let layout: Layout
        let result: SplitResult
        let savedAt: Date?
        var y: CGFloat = 0
        var pageNumber = 0

        init(context: UIGraphicsPDFRendererContext, layout: Layout, result: SplitResult, savedAt: Date?) {
            self.context = context
            self.layout = layout
            self.result = result
            self.savedAt = savedAt
        }

        private var bottomLimit: CGFloat { Layout.page.height - Layout.margin - Layout.footerHeight }

        mutating func draw() {
            newPage()
            drawHeader()
            drawTableHeader()
            let entries = result.entries
            for (index, entry) in entries.enumerated() where entry.allocation.status == .receiving {
                if y + Layout.rowHeight > bottomLimit {
                    newPage()
                    drawTableHeader()
                }
                drawRow(entry, shaded: index % 2 == 1)
            }
            drawTotalsRow()

            let outside = entries.filter { $0.allocation.status != .receiving }
            if !outside.isEmpty {
                ensureSpace(40)
                y += 14
                y += text("Not in this pool", at: y, font: .systemFont(ofSize: 11, weight: .semibold))
                for entry in outside {
                    let line = "\(entry.participant.nameWithRole): " + Explainer.reason(for: entry.allocation.status, name: entry.participant.name)
                    let height = measure(line, font: .systemFont(ofSize: 9), width: Layout.contentWidth)
                    ensureSpace(height + 4)
                    y += text(line, at: y, font: .systemFont(ofSize: 9), color: .darkGray) + 3
                }
            }

            let note = PolicyCopy.allocationNote + " " + PolicyCopy.disclaimer
            let noteHeight = measure(note, font: .systemFont(ofSize: 8.5), width: Layout.contentWidth)
            ensureSpace(noteHeight + 20)
            y += 16
            _ = text(note, at: y, font: .systemFont(ofSize: 8.5), color: .darkGray)
        }

        private mutating func newPage() {
            context.beginPage()
            pageNumber += 1
            y = Layout.margin
            let footer = "ShiftTips \u{00B7} \(result.draft.title) \u{00B7} Page \(pageNumber)"
            _ = text(footer, at: Layout.page.height - Layout.margin, font: .systemFont(ofSize: 8), color: .gray)
        }

        private mutating func ensureSpace(_ height: CGFloat) {
            if y + height > bottomLimit { newPage() }
        }

        private mutating func drawHeader() {
            let draft = result.draft
            y += text("Tip pool breakdown", at: y, font: .systemFont(ofSize: 20, weight: .bold))
            y += text(draft.day.longText + (draft.label.map { " \u{00B7} \($0)" } ?? ""), at: y, font: .systemFont(ofSize: 12), color: .darkGray) + 10

            var facts: [(String, String)] = [("Pooled tips", Money.format(draft.pool.totalCents))]
            if let cash = draft.pool.cashCents, let card = draft.pool.cardCents {
                facts.append(("Cash", Money.format(cash)))
                facts.append(("Card", Money.format(card)))
            }
            facts.append(("Split method", draft.method.title))
            facts.append(("In the pool", "\(result.receivingCount)"))
            if let crew = draft.crewName { facts.append(("Crew", crew)) }
            if let savedAt {
                facts.append(("Saved", savedAt.formatted(date: .abbreviated, time: .shortened)))
            }
            for (label, value) in facts {
                _ = text(label, at: y, font: .systemFont(ofSize: 10), color: .darkGray)
                _ = text(value, at: y, x: Layout.margin + 110, width: Layout.contentWidth - 110, font: .monospacedDigitSystemFont(ofSize: 10, weight: .semibold))
                y += 15
            }
            y += 6
            let reconciled = "Allocated \(Money.format(result.allocatedCents)) of \(Money.format(draft.pool.totalCents)), \(Money.format(result.remainingCents)) remaining"
            y += text(reconciled, at: y, font: .systemFont(ofSize: 11, weight: .semibold), color: UIColor(hex: 0x1E7A46)) + 14
        }

        private mutating func drawTableHeader() {
            var x = Layout.margin
            for column in layout.columns {
                _ = text(column.title.uppercased(), at: y, x: x + 4, width: column.width - 8, font: .systemFont(ofSize: 8, weight: .semibold), color: .darkGray, alignment: column.alignment)
                x += column.width
            }
            y += 14
            line(at: y)
            y += 4
        }

        private mutating func drawRow(_ entry: SplitResult.Entry, shaded: Bool) {
            if shaded {
                UIColor(white: 0.96, alpha: 1).setFill()
                UIRectFill(CGRect(x: Layout.margin, y: y - 2, width: Layout.contentWidth, height: Layout.rowHeight))
            }
            var x = Layout.margin
            for (index, column) in layout.columns.enumerated() {
                let isLast = index == layout.columns.count - 1
                let font: UIFont = isLast
                    ? .monospacedDigitSystemFont(ofSize: 10, weight: .semibold)
                    : (index == 0 ? .systemFont(ofSize: 10) : .monospacedDigitSystemFont(ofSize: 10, weight: .regular))
                _ = text(column.value(entry), at: y + 3, x: x + 4, width: column.width - 8, font: font, alignment: column.alignment, singleLine: true)
                x += column.width
            }
            y += Layout.rowHeight
        }

        private mutating func drawTotalsRow() {
            ensureSpace(Layout.rowHeight + 6)
            line(at: y + 1)
            y += 5
            _ = text("Total", at: y, x: Layout.margin + 4, width: 200, font: .systemFont(ofSize: 10, weight: .bold))
            var x = Layout.margin
            for (index, column) in layout.columns.enumerated() {
                var value: String?
                switch column.title {
                case "Cash": value = Money.format(result.allocatedCashCents)
                case "Card": value = Money.format(result.allocatedCardCents)
                case "Allocated": value = Money.format(result.allocatedCents)
                default: value = nil
                }
                if let value, index > 0 {
                    _ = text(value, at: y, x: x + 4, width: column.width - 8, font: .monospacedDigitSystemFont(ofSize: 10, weight: .bold), alignment: .right)
                }
                x += column.width
            }
            y += Layout.rowHeight
        }

        private func line(at y: CGFloat) {
            UIColor(white: 0.8, alpha: 1).setFill()
            UIRectFill(CGRect(x: Layout.margin, y: y, width: Layout.contentWidth, height: 0.75))
        }

        /// Draws text and returns its height.
        @discardableResult
        private func text(
            _ string: String,
            at y: CGFloat,
            x: CGFloat = Layout.margin,
            width: CGFloat = Layout.contentWidth,
            font: UIFont,
            color: UIColor = .black,
            alignment: NSTextAlignment = .left,
            singleLine: Bool = false
        ) -> CGFloat {
            let style = NSMutableParagraphStyle()
            style.alignment = alignment
            style.lineBreakMode = singleLine ? .byTruncatingTail : .byWordWrapping
            let attributed = NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: color, .paragraphStyle: style])
            let height = singleLine ? ceil(font.lineHeight) : measure(string, font: font, width: width)
            attributed.draw(with: CGRect(x: x, y: y, width: width, height: height), options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
            return height
        }

        private func measure(_ string: String, font: UIFont, width: CGFloat) -> CGFloat {
            let bounds = NSAttributedString(string: string, attributes: [.font: font]).boundingRect(
                with: CGSize(width: width, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                context: nil
            )
            return ceil(bounds.height)
        }
    }
}
