import UIKit
import ShiftTipsCore

/// A US Letter breakdown: header, key facts, the reconciliation line, one
/// table row per person, notes, and the allocation note. Long crews continue
/// onto more pages with the table header repeated.
enum PDFReportRenderer {
    static func render(_ outcome: ShiftOutcome, savedAt: Date?) -> Data {
        let report: Report
        switch outcome {
        case .pool(let result): report = poolReport(result, savedAt: savedAt)
        case .tipOut(let result): report = tipOutReport(result, savedAt: savedAt)
        }
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: "ShiftTips breakdown \(outcome.draft.title)",
            kCGPDFContextCreator as String: "ShiftTips",
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: Layout.page, format: format)
        return renderer.pdfData { context in
            var drawer = Drawer(context: context, report: report)
            drawer.draw()
        }
    }

    // MARK: - Content

    struct Column {
        let title: String
        /// Zero for the person column, which takes the remaining width.
        let width: CGFloat
        let alignment: NSTextAlignment
    }

    struct Section {
        let title: String
        let lines: [String]
    }

    struct Report {
        var title: String
        var subtitle: String
        var facts: [(String, String)]
        var reconciliation: String
        var reconciles: Bool
        var columns: [Column]
        var rows: [[String]]
        /// One per column; empty strings are left blank.
        var totals: [String]
        var sections: [Section]
        var footer: String
    }

    static func poolReport(_ result: SplitResult, savedAt: Date?) -> Report {
        let draft = result.draft
        let pool = draft.pool
        let method = draft.method

        var facts: [(String, String)] = [("Pooled tips", Money.format(pool.totalCents))]
        if let cash = pool.cashCents, let card = pool.cardCents {
            facts.append(("Cash", Money.format(cash)))
            facts.append(("Card", Money.format(card)))
        }
        facts.append(("Split method", method.title))
        facts.append(("In the pool", "\(result.receivingCount)"))
        if let crew = draft.crewName { facts.append(("Crew", crew)) }
        if let savedAt { facts.append(("Saved", savedAt.formatted(date: .abbreviated, time: .shortened))) }

        var columns = [Column(title: "Person", width: 0, alignment: .left)]
        if method.usesHours { columns.append(Column(title: "Hours", width: 62, alignment: .right)) }
        if method.usesPoints { columns.append(Column(title: "Points", width: 50, alignment: .right)) }
        columns.append(Column(title: "Share", width: 54, alignment: .right))
        if pool.isSplit {
            columns.append(Column(title: "Cash", width: 72, alignment: .right))
            columns.append(Column(title: "Card", width: 72, alignment: .right))
        }
        columns.append(Column(title: "Allocated", width: 80, alignment: .right))

        let receiving = result.entries.filter { $0.allocation.status == .receiving }
        let rows: [[String]] = receiving.map { entry in
            var row = [entry.participant.nameWithRole]
            if method.usesHours { row.append(Hours.format(minutes: entry.participant.minutesWorked)) }
            if method.usesPoints { row.append(Points.format(units: entry.participant.pointsUnits)) }
            row.append(Explainer.percentText(weight: entry.allocation.weight, total: result.totalWeight))
            if pool.isSplit {
                row.append(Money.format(entry.allocation.cashCents ?? 0))
                row.append(Money.format(entry.allocation.cardCents ?? 0))
            }
            row.append(Money.format(entry.allocation.totalCents))
            return row
        }
        var totals = ["Total"] + Array(repeating: "", count: columns.count - 1)
        if pool.isSplit {
            totals[columns.count - 3] = Money.format(result.allocatedCashCents)
            totals[columns.count - 2] = Money.format(result.allocatedCardCents)
        }
        totals[columns.count - 1] = Money.format(result.allocatedCents)

        let outside = result.entries.filter { $0.allocation.status != .receiving }
        let sections = outside.isEmpty ? [] : [Section(
            title: "Not in this pool",
            lines: outside.map { "\($0.participant.nameWithRole): " + Explainer.reason(for: $0.allocation.status, name: $0.participant.name) }
        )]

        return Report(
            title: "Tip pool breakdown",
            subtitle: draft.day.longText + (draft.label.map { " \u{00B7} \($0)" } ?? ""),
            facts: facts,
            reconciliation: "Allocated \(Money.format(result.allocatedCents)) of \(Money.format(pool.totalCents)), \(Money.format(result.remainingCents)) remaining",
            reconciles: result.reconciles,
            columns: columns,
            rows: rows,
            totals: totals,
            sections: sections,
            footer: "ShiftTips \u{00B7} \(draft.title)"
        )
    }

    static func tipOutReport(_ result: TipOutResult, savedAt: Date?) -> Report {
        let draft = result.draft
        var facts: [(String, String)] = [
            ("Tipped out", Money.format(result.tippedOutCents)),
            ("Tips collected", Money.format(result.collectedCents)),
            ("Mode", ShiftMode.tipOut.title),
            ("Taking part", "\(result.takingPartCount)"),
        ]
        if let crew = draft.crewName { facts.append(("Crew", crew)) }
        if let savedAt { facts.append(("Saved", savedAt.formatted(date: .abbreviated, time: .shortened))) }

        let columns = [
            Column(title: "Person", width: 0, alignment: .left),
            Column(title: "Hours", width: 56, alignment: .right),
            Column(title: "Tips", width: 76, alignment: .right),
            Column(title: "Tipped out", width: 76, alignment: .right),
            Column(title: "Received", width: 76, alignment: .right),
            Column(title: "Net", width: 80, alignment: .right),
        ]
        let taking = result.entries.filter { $0.person.status.takesPart }
        let rows: [[String]] = taking.map { entry in
            let person = entry.person
            return [
                entry.participant.nameWithRole,
                person.status.receives ? Hours.format(minutes: entry.participant.minutesWorked) : "",
                person.status.pays ? Money.format(person.tipsCents ?? 0) : "",
                person.status.pays ? "-" + Money.format(person.paidCents) : "",
                person.status.receives ? "+" + Money.format(person.receivedCents) : "",
                Money.format(person.status.receives && !person.status.pays ? person.receivedCents : person.netCents),
            ]
        }
        let totals = ["Total", "", Money.format(result.collectedCents), "-" + Money.format(result.tippedOutCents), "+" + Money.format(result.receivedCents), ""]

        var sections: [Section] = []
        sections.append(Section(title: "Pots", lines: result.pots.map { pot in
            let people = pot.recipientIds.count == 1 ? "1 person" : "\(pot.recipientIds.count) people"
            return "\(pot.role): \(Money.format(pot.cents)), shared by \(people) over \(Hours.format(minutes: pot.minutes)) by hours worked"
        }))
        sections.append(Section(title: "Rules", lines: zip(draft.tipOutRules, result.rules).map { rule, outcome in
            rule.summary + (Explainer.skippedNote(for: rule, status: outcome.status).map { " (\($0))" } ?? "")
        }))
        let capped = result.entries.filter { $0.person.capped }
        if !capped.isEmpty {
            sections.append(Section(title: "Reduced to tips collected", lines: capped.map {
                "\($0.participant.name): tip-outs came to more than the \(Money.format($0.person.tipsCents ?? 0)) in tips collected, so each was reduced in proportion."
            }))
        }
        let outside = result.entries.filter { !$0.person.status.takesPart }
        if !outside.isEmpty {
            sections.append(Section(title: "Not in tip-outs", lines: outside.map {
                "\($0.participant.nameWithRole): " + Explainer.reason(for: $0.person.status, participant: $0.participant)
            }))
        }

        return Report(
            title: "Tip-out breakdown",
            subtitle: draft.day.longText + (draft.label.map { " \u{00B7} \($0)" } ?? ""),
            facts: facts,
            reconciliation: "Tipped out \(Money.format(result.tippedOutCents)), received \(Money.format(result.receivedCents)), \(Money.format(result.leftOverCents)) left over",
            reconciles: result.reconciles,
            columns: columns,
            rows: rows,
            totals: totals,
            sections: sections,
            footer: "ShiftTips \u{00B7} \(draft.title)"
        )
    }

    // MARK: - Drawing

    enum Layout {
        static let page = CGRect(x: 0, y: 0, width: 612, height: 792)
        static let margin: CGFloat = 48
        static let rowHeight: CGFloat = 22
        static let footerHeight: CGFloat = 40
        static var contentWidth: CGFloat { page.width - margin * 2 }
    }

    struct Drawer {
        let context: UIGraphicsPDFRendererContext
        let report: Report
        let widths: [CGFloat]
        var y: CGFloat = 0
        var pageNumber = 0

        init(context: UIGraphicsPDFRendererContext, report: Report) {
            self.context = context
            self.report = report
            let fixed = report.columns.reduce(0) { $0 + $1.width }
            widths = report.columns.map { $0.width == 0 ? Layout.contentWidth - fixed : $0.width }
        }

        private var bottomLimit: CGFloat { Layout.page.height - Layout.margin - Layout.footerHeight }

        mutating func draw() {
            newPage()
            drawHeader()
            drawTableHeader()
            for (index, row) in report.rows.enumerated() {
                if y + Layout.rowHeight > bottomLimit {
                    newPage()
                    drawTableHeader()
                }
                drawRow(row, shaded: index % 2 == 1)
            }
            drawTotals()

            for section in report.sections where !section.lines.isEmpty {
                ensureSpace(40)
                y += 14
                y += text(section.title, at: y, font: .systemFont(ofSize: 11, weight: .semibold))
                for line in section.lines {
                    let height = measure(line, font: .systemFont(ofSize: 9), width: Layout.contentWidth)
                    ensureSpace(height + 4)
                    y += text(line, at: y, font: .systemFont(ofSize: 9), color: .darkGray) + 3
                }
            }

            let note = PolicyCopy.allocationNote + " " + PolicyCopy.disclaimer
            let noteHeight = measure(note, font: .systemFont(ofSize: 8.5), width: Layout.contentWidth)
            ensureSpace(noteHeight + 20)
            y += 16
            text(note, at: y, font: .systemFont(ofSize: 8.5), color: .darkGray)
        }

        private mutating func newPage() {
            context.beginPage()
            pageNumber += 1
            y = Layout.margin
            text("\(report.footer) \u{00B7} Page \(pageNumber)", at: Layout.page.height - Layout.margin, font: .systemFont(ofSize: 8), color: .gray)
        }

        private mutating func ensureSpace(_ height: CGFloat) {
            if y + height > bottomLimit { newPage() }
        }

        private mutating func drawHeader() {
            y += text(report.title, at: y, font: .systemFont(ofSize: 20, weight: .bold))
            y += text(report.subtitle, at: y, font: .systemFont(ofSize: 12), color: .darkGray) + 10
            for (label, value) in report.facts {
                text(label, at: y, font: .systemFont(ofSize: 10), color: .darkGray)
                text(value, at: y, x: Layout.margin + 110, width: Layout.contentWidth - 110, font: .monospacedDigitSystemFont(ofSize: 10, weight: .semibold))
                y += 15
            }
            y += 6
            let color = report.reconciles ? UIColor(hex: 0x1E7A46) : UIColor(hex: 0x8F5300)
            y += text(report.reconciliation, at: y, font: .systemFont(ofSize: 11, weight: .semibold), color: color) + 14
        }

        private mutating func drawTableHeader() {
            var x = Layout.margin
            for (column, width) in zip(report.columns, widths) {
                text(column.title.uppercased(), at: y, x: x + 4, width: width - 8, font: .systemFont(ofSize: 8, weight: .semibold), color: .darkGray, alignment: column.alignment)
                x += width
            }
            y += 14
            line(at: y)
            y += 4
        }

        private mutating func drawRow(_ row: [String], shaded: Bool) {
            if shaded {
                UIColor(white: 0.96, alpha: 1).setFill()
                UIRectFill(CGRect(x: Layout.margin, y: y - 2, width: Layout.contentWidth, height: Layout.rowHeight))
            }
            var x = Layout.margin
            for (index, value) in row.enumerated() where index < widths.count {
                let isLast = index == widths.count - 1
                let font: UIFont = isLast
                    ? .monospacedDigitSystemFont(ofSize: 10, weight: .semibold)
                    : (index == 0 ? .systemFont(ofSize: 10) : .monospacedDigitSystemFont(ofSize: 10, weight: .regular))
                text(value, at: y + 3, x: x + 4, width: widths[index] - 8, font: font, alignment: report.columns[index].alignment, singleLine: true)
                x += widths[index]
            }
            y += Layout.rowHeight
        }

        private mutating func drawTotals() {
            ensureSpace(Layout.rowHeight + 6)
            line(at: y + 1)
            y += 5
            var x = Layout.margin
            for (index, value) in report.totals.enumerated() where index < widths.count {
                if !value.isEmpty {
                    let font: UIFont = index == 0 ? .systemFont(ofSize: 10, weight: .bold) : .monospacedDigitSystemFont(ofSize: 10, weight: .bold)
                    text(value, at: y, x: x + 4, width: widths[index] - 8, font: font, alignment: report.columns[index].alignment, singleLine: true)
                }
                x += widths[index]
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
