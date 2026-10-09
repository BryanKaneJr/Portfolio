import Foundation

/// One row per person per shift, with headings that say their units. Money
/// is written from integer cents ("472.38"), never through floating point.
public enum CSVExporter {
    public static let headers = [
        "Shift ID", "Shift date", "Shift label", "Split method",
        "Person", "Role", "In pool", "Status", "Eligibility",
        "Hours (h:mm)", "Minutes", "Points", "Share of pool (%)",
        "Cash allocated (USD)", "Card allocated (USD)", "Total allocated (USD)",
        "Pool cash (USD)", "Pool card (USD)", "Pool total (USD)", "Saved at (UTC)",
    ]

    public static func csv(for shifts: [FinishedShift]) -> String {
        var lines = [headers.map(escape).joined(separator: ",")]
        for shift in shifts {
            let result = shift.result
            let draft = result.draft
            let pool = draft.pool
            for (participant, allocation) in result.rows {
                let receiving = allocation.status == .receiving
                let fields: [String] = [
                    shift.id.uuidString,
                    draft.day.isoString,
                    draft.label ?? "",
                    draft.method.title,
                    participant.name,
                    participant.role ?? "",
                    receiving ? "Yes" : "No",
                    allocation.status.shortText,
                    participant.eligibility.title,
                    Hours.clock(minutes: participant.minutesWorked),
                    String(participant.minutesWorked),
                    Points.format(units: participant.pointsUnits),
                    receiving ? Explainer.percentText(weight: allocation.weight, total: result.totalWeight).replacingOccurrences(of: "%", with: "") : "0",
                    allocation.cashCents.map(Money.plain) ?? "",
                    allocation.cardCents.map(Money.plain) ?? "",
                    Money.plain(allocation.totalCents),
                    pool.cashCents.map(Money.plain) ?? "",
                    pool.cardCents.map(Money.plain) ?? "",
                    Money.plain(pool.totalCents),
                    timestamp(shift.finishedAt),
                ]
                lines.append(fields.map(escape).joined(separator: ","))
            }
        }
        return lines.joined(separator: "\r\n") + "\r\n"
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
