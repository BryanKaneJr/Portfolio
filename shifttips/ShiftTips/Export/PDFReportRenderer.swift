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

        // The app's look, in print: ink, hairlines, monospaced figures and
        // the highlighter behind the line that proves the split.
        private static let ink = UIColor(hex: 0x0E0E0E)
        private static let gray = UIColor(hex: 0x5A5A56)
        private static let hairline = UIColor(hex: 0xD3D3CE)
        private static let highlight = UIColor(hex: 0xD4FF3A)

        private static func mono(_ size: CGFloat, _ weight: UIFont.Weight = .regular) -> UIFont {
            .monospacedSystemFont(ofSize: size, weight: weight)
        }

        mutating func draw() {
            newPage()
            drawHeader()
            drawTableHeader()
            for row in report.rows {
                if y + Layout.rowHeight > bottomLimit {
                    newPage()
                    drawTableHeader()
                }
                drawRow(row)
            }
            drawTotals()

            for section in report.sections where !section.lines.isEmpty {
                ensureSpace(44)
                y += 18
                y += text(section.title.uppercased(), at: y, font: Self.mono(8.5, .bold), color: Self.gray) + 3
                fill(CGRect(x: Layout.margin, y: y, width: Layout.contentWidth, height: 0.75), Self.ink)
                y += 6
                for line in section.lines {
                    let height = measure(line, font: .systemFont(ofSize: 9.5), width: Layout.contentWidth)
                    ensureSpace(height + 4)
                    y += text(line, at: y, font: .systemFont(ofSize: 9.5), color: Self.ink) + 4
                }
            }

            let note = PolicyCopy.allocationNote + " " + PolicyCopy.disclaimer
            let noteHeight = measure(note, font: .systemFont(ofSize: 8.5), width: Layout.contentWidth)
            ensureSpace(noteHeight + 24)
            y += 18
            dashedLine(at: y)
            y += 8
            text(note, at: y, font: .systemFont(ofSize: 8.5), color: Self.gray)
        }

        private mutating func newPage() {
            context.beginPage()
            pageNumber += 1
            y = Layout.margin
            // Masthead: the wordmark, and what this document is and isn't.
            let markFont = UIFont.systemFont(ofSize: 10, weight: .black, width: .expanded)
            let shift = NSAttributedString(string: "SHIFT", attributes: [.font: markFont, .foregroundColor: Self.ink])
            let tips = NSAttributedString(string: "TIPS", attributes: [.font: markFont, .foregroundColor: Self.ink])
            shift.draw(at: CGPoint(x: Layout.margin, y: y))
            let tipsX = Layout.margin + ceil(shift.size().width) + 1
            fill(CGRect(x: tipsX, y: y - 1, width: ceil(tips.size().width) + 4, height: markFont.lineHeight + 2), Self.highlight)
            tips.draw(at: CGPoint(x: tipsX + 2, y: y))
            text("ALLOCATION, NOT PAYMENT", at: y + 1, font: Self.mono(7.5, .semibold), color: Self.gray, alignment: .right, singleLine: true)
            y += 16
            fill(CGRect(x: Layout.margin, y: y, width: Layout.contentWidth, height: 1.5), Self.ink)
            y += 18
            fill(CGRect(x: Layout.margin, y: Layout.page.height - Layout.margin - 8, width: Layout.contentWidth, height: 0.5), Self.hairline)
            text("\(report.footer) \u{00B7} Page \(pageNumber)", at: Layout.page.height - Layout.margin, font: Self.mono(7.5), color: Self.gray)
        }

        private mutating func ensureSpace(_ height: CGFloat) {
            if y + height > bottomLimit { newPage() }
        }

        private mutating func drawHeader() {
            y += text(report.title, at: y, font: .systemFont(ofSize: 22, weight: .heavy, width: .expanded), color: Self.ink) + 2
            y += text(report.subtitle, at: y, font: .systemFont(ofSize: 11), color: Self.gray) + 14
            for (label, value) in report.facts {
                text(label.uppercased(), at: y + 1, font: Self.mono(8, .semibold), color: Self.gray)
                text(value, at: y, x: Layout.margin + 110, width: Layout.contentWidth - 110, font: Self.mono(10, .semibold), color: Self.ink)
                y += 15
            }
            y += 10
            let font = Self.mono(10, .bold)
            let width = min(Layout.contentWidth, ceil(NSAttributedString(string: report.reconciliation, attributes: [.font: font]).size().width) + 12)
            fill(CGRect(x: Layout.margin, y: y - 3, width: width, height: font.lineHeight + 6), report.reconciles ? Self.highlight : UIColor(hex: 0xFBE3D6))
            y += text(report.reconciliation, at: y, x: Layout.margin + 6, width: Layout.contentWidth - 6, font: font, color: report.reconciles ? Self.ink : UIColor(hex: 0x9E4300)) + 18
        }

        private mutating func drawTableHeader() {
            var x = Layout.margin
            for (column, width) in zip(report.columns, widths) {
                text(column.title.uppercased(), at: y, x: x + 4, width: width - 8, font: Self.mono(7.5, .bold), color: Self.gray, alignment: column.alignment)
                x += width
            }
            y += 13
            fill(CGRect(x: Layout.margin, y: y, width: Layout.contentWidth, height: 1), Self.ink)
            y += 4
        }

        private mutating func drawRow(_ row: [String]) {
            var x = Layout.margin
            for (index, value) in row.enumerated() where index < widths.count {
                let isLast = index == widths.count - 1
                let font: UIFont = isLast
                    ? Self.mono(9.5, .bold)
                    : (index == 0 ? .systemFont(ofSize: 10, weight: .medium) : Self.mono(9.5))
                text(value, at: y + 4, x: x + 4, width: widths[index] - 8, font: font, color: Self.ink, alignment: report.columns[index].alignment, singleLine: true)
                x += widths[index]
            }
            y += Layout.rowHeight
            fill(CGRect(x: Layout.margin, y: y - 1, width: Layout.contentWidth, height: 0.5), Self.hairline)
        }

        private mutating func drawTotals() {
            ensureSpace(Layout.rowHeight + 8)
            fill(CGRect(x: Layout.margin, y: y + 1, width: Layout.contentWidth, height: 1), Self.ink)
            fill(CGRect(x: Layout.margin, y: y + 4, width: Layout.contentWidth, height: 1), Self.ink)
            y += 9
            var x = Layout.margin
            for (index, value) in report.totals.enumerated() where index < widths.count {
                if !value.isEmpty {
                    text(index == 0 ? value.uppercased() : value, at: y, x: x + 4, width: widths[index] - 8, font: Self.mono(9.5, .bold), color: Self.ink, alignment: report.columns[index].alignment, singleLine: true)
                }
                x += widths[index]
            }
            y += Layout.rowHeight
        }

        private func fill(_ rect: CGRect, _ color: UIColor) {
            color.setFill()
            UIRectFill(rect)
        }

        private func dashedLine(at y: CGFloat) {
            let path = UIBezierPath()
            path.move(to: CGPoint(x: Layout.margin, y: y))
            path.addLine(to: CGPoint(x: Layout.margin + Layout.contentWidth, y: y))
            path.lineWidth = 0.75
            path.setLineDash([2, 3], count: 2, phase: 0)
            Self.gray.setStroke()
            path.stroke()
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
