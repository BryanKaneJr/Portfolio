import Foundation

/// One row per person per shift, with headings that say their units. Money
/// is written from integer cents ("472.38"), never through floating point.
/// Pool and tip-out shifts share one layout; columns that don't apply to a
/// shift's mode are left empty.
public enum CSVExporter {
    public static let headers = [
        "Shift ID", "Shift date", "Shift label", "Mode", "Split method",
        "Person", "Role", "Takes part", "Status", "Eligibility",
        "Hours (h:mm)", "Minutes", "Points", "Share of pool (%)",
        "Cash allocated (USD)", "Card allocated (USD)", "Total allocated (USD)",
        "Pool cash (USD)", "Pool card (USD)", "Pool total (USD)",
        "Tips collected (USD)", "Sales (USD)", "Food sales (USD)", "Bar sales (USD)",
        "Tipped out (USD)", "Received from tip-outs (USD)", "Net (USD)",
        "Saved at (UTC)",
    ]

    public static func csv(for shifts: [FinishedShift]) -> String {
        var lines = [headers.map(escape).joined(separator: ",")]
        for shift in shifts {
            switch shift.outcome {
            case .pool(let result): lines += poolRows(shift, result)
            case .tipOut(let result): lines += tipOutRows(shift, result)
            }
        }
        return lines.joined(separator: "\r\n") + "\r\n"
    }

    private static func poolRows(_ shift: FinishedShift, _ result: SplitResult) -> [String] {
        let draft = result.draft
        let pool = draft.pool
        return result.rows.map { participant, allocation in
            let receiving = allocation.status == .receiving
            let fields: [String] = [
                shift.id.uuidString, draft.day.isoString, draft.label ?? "", ShiftMode.pool.title, draft.method.title,
                participant.name, participant.role ?? "", receiving ? "Yes" : "No", allocation.status.shortText, participant.eligibility.title,
                Hours.clock(minutes: participant.minutesWorked), String(participant.minutesWorked), Points.format(units: participant.pointsUnits),
                receiving ? Explainer.percentText(weight: allocation.weight, total: result.totalWeight).replacingOccurrences(of: "%", with: "") : "0",
                allocation.cashCents.map(Money.plain) ?? "", allocation.cardCents.map(Money.plain) ?? "", Money.plain(allocation.totalCents),
                pool.cashCents.map(Money.plain) ?? "", pool.cardCents.map(Money.plain) ?? "", Money.plain(pool.totalCents),
                "", "", "", "", "", "", "",
                timestamp(shift.finishedAt),
            ]
            return fields.map(escape).joined(separator: ",")
        }
    }

    private static func tipOutRows(_ shift: FinishedShift, _ result: TipOutResult) -> [String] {
        let draft = result.draft
        return result.entries.map { entry in
            let participant = entry.participant
            let person = entry.person
            let takesPart = person.status.takesPart
            let fields: [String] = [
                shift.id.uuidString, draft.day.isoString, draft.label ?? "", ShiftMode.tipOut.title, "",
                participant.name, participant.role ?? "", takesPart ? "Yes" : "No", person.status.shortText, participant.eligibility.title,
                person.status.receives ? Hours.clock(minutes: participant.minutesWorked) : "",
                person.status.receives ? String(participant.minutesWorked) : "",
                "", "", "", "", "", "", "", "",
                person.status.pays ? Money.plain(person.tipsCents ?? 0) : "",
                participant.salesCents.map(Money.plain) ?? "",
                participant.foodSalesCents.map(Money.plain) ?? "",
                participant.barSalesCents.map(Money.plain) ?? "",
                takesPart ? Money.plain(person.paidCents) : "",
                takesPart ? Money.plain(person.receivedCents) : "",
                takesPart ? Money.plain(person.status.pays ? person.netCents : person.receivedCents) : "",
                timestamp(shift.finishedAt),
            ]
            return fields.map(escape).joined(separator: ",")
        }
    }

    /// RFC 4180 quoting, plus a leading apostrophe on text that a
    /// spreadsheet would otherwise run as a formula.
    static func escape(_ field: String) -> String {
        var value = field
        if let first = value.first, "=+-@\t\r".contains(first), Double(value) == nil {
            value = "'" + value
        }
        if value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) {
            return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return value
    }

    static func timestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return formatter.string(from: date)
    }

    /// "ShiftTips 2026-10-08 Dinner.csv"-style names, safe for Files.
    public static func fileName(for shifts: [FinishedShift], ext: String = "csv") -> String {
        if shifts.count == 1, let shift = shifts.first {
            return BackupCodec.safeFileName("ShiftTips \(shift.day.isoString) \(shift.draft.label ?? "")", ext: ext)
        }
        return BackupCodec.safeFileName("ShiftTips history", ext: ext)
    }
}
