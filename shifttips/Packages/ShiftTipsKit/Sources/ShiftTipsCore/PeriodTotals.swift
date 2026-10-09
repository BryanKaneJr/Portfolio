import Foundation

/// One person's tips across the saved shifts in a period, from the frozen
/// snapshots (never recalculated).
public struct PersonTotal: Hashable, Identifiable, Sendable {
    /// The crew member's id, or "one-off:<name>" for people added to a
    /// shift only (matched by name across shifts).
    public let id: String
    /// The name and role from their most recent shift in the period.
    public var name: String
    public var role: String?
    public var isOneOff: Bool
    /// Shifts where they shared the pool or took part in tip-outs.
    public var shiftCount: Int
    /// Tip Pool allocations.
    public var poolCents: Int64
    /// The cash and card parts of pool allocations, from pools split into
    /// cash and card.
    public var poolCashCents: Int64
    public var poolCardCents: Int64
    /// Tip Out: tips they collected themselves.
    public var tipsCollectedCents: Int64
    public var tippedOutCents: Int64
    /// Tip Out: their shares of pots.
    public var receivedCents: Int64

    /// Pool allocations plus, from tip-out shifts, tips kept and tip-outs
    /// received.
    public var totalCents: Int64 { poolCents + tipsCollectedCents - tippedOutCents + receivedCents }

    public var nameWithRole: String {
        if let role, !role.isEmpty { return "\(name) (\(role))" }
        return name
    }
}

public struct PeriodSummary: Hashable, Sendable {
    public let from: CalendarDay
    public let through: CalendarDay
    public let shiftCount: Int
    /// Sorted by name.
    public let people: [PersonTotal]

    public var totalCents: Int64 { people.reduce(0) { $0 + $1.totalCents } }
    public var poolCents: Int64 { people.reduce(0) { $0 + $1.poolCents } }
    public var tippedOutCents: Int64 { people.reduce(0) { $0 + $1.tippedOutCents } }

    /// "Oct 5, 2026 to Oct 11, 2026", or a single day.
    public var rangeText: String {
        let format: (CalendarDay) -> String = { $0.mediumText.split(separator: ",").dropFirst().joined(separator: ",").trimmingSpaces() }
        return from == through ? format(from) : "\(format(from)) to \(format(through))"
    }
}

/// Quick periods for pay periods.
public enum PeriodPreset: String, CaseIterable, Hashable, Sendable {
    case thisWeek, lastWeek, lastTwoWeeks, thisMonth, lastMonth

    public var title: String {
        switch self {
        case .thisWeek: "This week"
        case .lastWeek: "Last week"
        case .lastTwoWeeks: "Last 2 weeks"
        case .thisMonth: "This month"
        case .lastMonth: "Last month"
        }
    }

    /// `firstWeekday` is 1 for Sunday through 7 for Saturday, as in
    /// `Calendar.firstWeekday`.
    public func range(today: CalendarDay, firstWeekday: Int) -> (from: CalendarDay, through: CalendarDay) {
        let weekStart = today.startOfWeek(firstWeekday: firstWeekday)
        switch self {
        case .thisWeek: return (weekStart, weekStart.adding(days: 6))
        case .lastWeek: return (weekStart.adding(days: -7), weekStart.adding(days: -1))
        case .lastTwoWeeks: return (weekStart.adding(days: -14), weekStart.adding(days: -1))
        case .thisMonth: return (today.startOfMonth, today.endOfMonth)
        case .lastMonth:
            let previous = today.startOfMonth.adding(days: -1)
            return (previous.startOfMonth, previous.endOfMonth)
        }
    }
}

public enum PeriodTotals {
    /// Adds up every saved shift dated `from` through `through` (inclusive)
    /// by person. Crew members are matched by their saved id, so a renamed
    /// person stays one row; one-off people are matched by name.
    public static func summarize(_ shifts: [FinishedShift], from: CalendarDay, through: CalendarDay) -> PeriodSummary {
        let inRange = shifts
            .filter { $0.day >= from && $0.day <= through }
            .sorted { $0.day != $1.day ? $0.day < $1.day : $0.finishedAt < $1.finishedAt }

        var totals: [String: PersonTotal] = [:]
        func record(_ participant: ShiftParticipant, _ change: (inout PersonTotal) -> Void) {
            let key = participant.employeeId?.uuidString ?? "one-off:" + (TipOutRule.roleKey(participant.name) ?? "")
            var total = totals[key] ?? PersonTotal(
                id: key, name: participant.name, role: participant.role, isOneOff: participant.employeeId == nil,
                shiftCount: 0, poolCents: 0, poolCashCents: 0, poolCardCents: 0,
                tipsCollectedCents: 0, tippedOutCents: 0, receivedCents: 0
            )
            total.name = participant.name
            total.role = participant.role
            total.shiftCount += 1
            change(&total)
            totals[key] = total
        }

        for shift in inRange {
            switch shift.outcome {
            case .pool(let result):
                for (participant, allocation) in result.rows where allocation.status == .receiving {
                    record(participant) { total in
                        total.poolCents += allocation.totalCents
                        total.poolCashCents += allocation.cashCents ?? 0
                        total.poolCardCents += allocation.cardCents ?? 0
                    }
                }
            case .tipOut(let result):
                for entry in result.entries where entry.person.status.takesPart {
                    let person = entry.person
                    record(entry.participant) { total in
                        if person.status.pays {
                            total.tipsCollectedCents += person.tipsCents ?? 0
                            total.tippedOutCents += person.paidCents
                        }
                        total.receivedCents += person.receivedCents
                    }
                }
            }
        }

        let people = totals.values.sorted {
            let a = $0.name.lowercased(), b = $1.name.lowercased()
            return a != b ? a < b : $0.id < $1.id
        }
        return PeriodSummary(from: from, through: through, shiftCount: inRange.count, people: people)
    }

    public static let csvHeaders = [
        "Person", "Role", "One-off", "Shifts",
        "Pool allocations (USD)", "Pool cash (USD)", "Pool card (USD)",
        "Tips collected (USD)", "Tipped out (USD)", "Tip-outs received (USD)", "Total (USD)",
        "From", "Through",
    ]

    public static func csv(_ summary: PeriodSummary) -> String {
        var lines = [csvHeaders.map(CSVExporter.escape).joined(separator: ",")]
        for person in summary.people {
            let fields: [String] = [
                person.name, person.role ?? "", person.isOneOff ? "Yes" : "No", String(person.shiftCount),
                Money.plain(person.poolCents), Money.plain(person.poolCashCents), Money.plain(person.poolCardCents),
                Money.plain(person.tipsCollectedCents), Money.plain(person.tippedOutCents), Money.plain(person.receivedCents),
                Money.plain(person.totalCents),
                summary.from.isoString, summary.through.isoString,
            ]
            lines.append(fields.map(CSVExporter.escape).joined(separator: ","))
        }
        return lines.joined(separator: "\r\n") + "\r\n"
    }

    public static func text(_ summary: PeriodSummary) -> String {
        var lines: [String] = []
        lines.append("ShiftTips: tips by person")
        lines.append("\(summary.rangeText) \u{00B7} \(summary.shiftCount == 1 ? "1 shift" : "\(summary.shiftCount) shifts")")
        lines.append("")
        for person in summary.people {
            var line = "\(person.nameWithRole): \(Money.format(person.totalCents))"
            line += person.shiftCount == 1 ? " (1 shift)" : " (\(person.shiftCount) shifts)"
            let parts = breakdown(person)
            if parts.count > 1 { line += ": " + parts.joined(separator: ", ") }
            lines.append(line)
        }
        lines.append("")
        lines.append("Total: \(Money.format(summary.totalCents))")
        lines.append("Totals of saved ShiftTips calculations, not a record of payment.")
        return lines.joined(separator: "\n")
    }

    /// "pool $800.00", "tips $500.00", "tipped out -$65.44", "received $40.00".
    public static func breakdown(_ person: PersonTotal) -> [String] {
        var parts: [String] = []
        if person.poolCents != 0 { parts.append("pool \(Money.format(person.poolCents))") }
        if person.tipsCollectedCents != 0 { parts.append("tips \(Money.format(person.tipsCollectedCents))") }
        if person.tippedOutCents != 0 { parts.append("tipped out -\(Money.format(person.tippedOutCents))") }
        if person.receivedCents != 0 { parts.append("received \(Money.format(person.receivedCents))") }
        return parts
    }
}

extension CalendarDay {
    private static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    public func adding(days: Int) -> CalendarDay {
        let calendar = Self.utc
        let date = calendar.date(byAdding: .day, value: days, to: self.date(in: calendar))!
        return CalendarDay(date, calendar: calendar)
    }

    /// 1 for Sunday through 7 for Saturday.
    public var weekday: Int {
        Self.utc.component(.weekday, from: date(in: Self.utc))
    }

    public func startOfWeek(firstWeekday: Int) -> CalendarDay {
        adding(days: -((weekday - firstWeekday + 7) % 7))
    }

    public var startOfMonth: CalendarDay { CalendarDay(year: year, month: month, day: 1) }

    public var endOfMonth: CalendarDay {
        let next = month == 12 ? CalendarDay(year: year + 1, month: 1, day: 1) : CalendarDay(year: year, month: month + 1, day: 1)
        return next.adding(days: -1)
    }
}
