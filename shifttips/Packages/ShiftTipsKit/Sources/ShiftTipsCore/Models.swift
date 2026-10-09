import Foundation

/// How a pool is divided. Raw values are stored in saved data and backups;
/// never rename them.
public enum SplitMethod: String, Codable, CaseIterable, Hashable, Sendable {
    /// One equal share for each person in the pool.
    case equal
    /// Shares proportional to minutes worked.
    case hours
    /// Shares proportional to minutes worked times each person's points.
    case weightedHours

    public var title: String {
        switch self {
        case .equal: "Equal"
        case .hours: "By Hours"
        case .weightedHours: "Hours \u{00D7} Points"
        }
    }

    public var spokenTitle: String {
        switch self {
        case .equal: "Equal"
        case .hours: "By hours"
        case .weightedHours: "Hours times points"
        }
    }

    public var summary: String {
        switch self {
        case .equal: "Everyone in the pool gets the same share."
        case .hours: "Shares follow the hours each person worked."
        case .weightedHours: "Shares follow hours worked times each person's points."
        }
    }

    public var usesHours: Bool { self != .equal }
    public var usesPoints: Bool { self == .weightedHours }
}

/// Whether a person may take part in the pool. ShiftTips never infers this
/// from a role label, and it can't verify legal status; the person setting up
/// the crew decides. Raw values are stored; never rename them.
public enum Eligibility: String, Codable, CaseIterable, Hashable, Sendable {
    case eligible
    /// "Not eligible for pool", by the workplace's own policy.
    case notEligible
    /// Owner, manager or supervisor. Never takes part in a pool, with no
    /// override; only a deliberate edit back to `eligible` changes that.
    case managerSupervisorOwner

    public var title: String {
        switch self {
        case .eligible: "Eligible for pool"
        case .notEligible: "Not eligible for pool"
        case .managerSupervisorOwner: "Owner, manager or supervisor"
        }
    }

    public var canParticipate: Bool { self == .eligible }
}

/// A saved person on a crew.
public struct Employee: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var role: String?
    /// Default points for Hours x Points, in thousandths. Starts at 1.0.
    public var pointsUnits: Int64
    public var eligibility: Eligibility

    public init(
        id: UUID = UUID(),
        name: String,
        role: String? = nil,
        pointsUnits: Int64 = Limits.defaultPointsUnits,
        eligibility: Eligibility = .eligible
    ) {
        self.id = id
        self.name = name
        self.role = role
        self.pointsUnits = pointsUnits
        self.eligibility = eligibility
    }
}

/// A saved team that is loaded into a new shift. Array order is display
/// order, which is also the order pennies go in on an exact tie.
public struct Crew: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var employees: [Employee]
    /// The house's tip-out rules, used when a shift is in Tip Out mode.
    public var tipOutRules: [TipOutRule]

    public init(id: UUID = UUID(), name: String, employees: [Employee] = [], tipOutRules: [TipOutRule] = []) {
        self.id = id
        self.name = name
        self.employees = employees
        self.tipOutRules = tipOutRules
    }

    /// Each distinct role label on the crew, in crew order.
    public var roles: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for employee in employees {
            guard let role = employee.role, let key = TipOutRule.roleKey(role), !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(role.trimmingSpaces())
        }
        return result
    }

    public init(from decoder: Decoder) throws {
        enum Keys: String, CodingKey { case id, name, employees, tipOutRules }
        let c = try decoder.container(keyedBy: Keys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        employees = try c.decode([Employee].self, forKey: .employees)
        tipOutRules = try c.decodeIfPresent([TipOutRule].self, forKey: .tipOutRules) ?? []
    }
}

/// A calendar day with no time or time zone, so a shift dated Oct 8 stays
/// Oct 8 wherever and whenever it's read. Encoded as "2026-10-08".
public struct CalendarDay: Hashable, Comparable, Codable, Sendable, CustomStringConvertible {
    public var year: Int
    public var month: Int
    public var day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// The day `date` falls on in `calendar` (the device's, by default).
    public init(_ date: Date, calendar: Calendar = .current) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year!, month: parts.month!, day: parts.day!)
    }

    /// Noon on this day in `calendar`, for date pickers.
    public func date(in calendar: Calendar = .current) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    public init?(isoString: String) {
        let parts = isoString.split(separator: "-")
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              (1...12).contains(m), (1...31).contains(d) else { return nil }
        // Reject days that don't exist, like 2026-02-30.
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        guard let date = calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12)),
              CalendarDay(date, calendar: calendar) == CalendarDay(year: y, month: m, day: d) else { return nil }
        self.init(year: y, month: m, day: d)
    }

    public var isoString: String {
        func pad(_ value: Int, _ width: Int) -> String {
            var s = String(value)
            while s.count < width { s = "0" + s }
            return s
        }
        return "\(pad(year, 4))-\(pad(month, 2))-\(pad(day, 2))"
    }

    public var description: String { isoString }

    /// "Thu, Oct 8, 2026", the same on every device.
    public var mediumText: String { Self.text(for: self, format: "EEE, MMM d, yyyy") }
    /// "Thursday, October 8, 2026".
    public var longText: String { Self.text(for: self, format: "EEEE, MMMM d, yyyy") }
    /// "October 2026", for grouping history.
    public var monthText: String { Self.text(for: self, format: "MMMM yyyy") }

    private static func text(for day: CalendarDay, format: String) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = format
        return formatter.string(from: day.date(in: calendar))
    }

    public static func < (lhs: CalendarDay, rhs: CalendarDay) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let day = CalendarDay(isoString: text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected yyyy-MM-dd, got \(text)")
        }
        self = day
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(isoString)
    }
}

/// The money being divided. Either one combined amount, or separate cash and
/// card amounts that are each split on their own and together make the total.
public struct TipPool: Codable, Hashable, Sendable {
    public private(set) var cashCents: Int64?
    public private(set) var cardCents: Int64?
    public private(set) var totalCents: Int64

    public static func total(_ cents: Int64) -> TipPool {
        TipPool(cashCents: nil, cardCents: nil, totalCents: cents)
    }

    public static func cashAndCard(cash: Int64, card: Int64) -> TipPool {
        TipPool(cashCents: cash, cardCents: card, totalCents: cash + card)
    }

    public var isSplit: Bool { cashCents != nil }

    private init(cashCents: Int64?, cardCents: Int64?, totalCents: Int64) {
        self.cashCents = cashCents
        self.cardCents = cardCents
        self.totalCents = totalCents
    }

    public init(from decoder: Decoder) throws {
        enum Keys: String, CodingKey { case cashCents, cardCents, totalCents }
        let c = try decoder.container(keyedBy: Keys.self)
        let cash = try c.decodeIfPresent(Int64.self, forKey: .cashCents)
        let card = try c.decodeIfPresent(Int64.self, forKey: .cardCents)
        let total = try c.decode(Int64.self, forKey: .totalCents)
        switch (cash, card) {
        case (nil, nil):
            self = .total(total)
        case let (cash?, card?):
            let (sum, overflow) = cash.addingReportingOverflow(card)
            guard !overflow, sum == total else {
                throw DecodingError.dataCorruptedError(forKey: .totalCents, in: c, debugDescription: "Cash and card don't add up to the total.")
            }
            self = .cashAndCard(cash: cash, card: card)
        default:
            throw DecodingError.dataCorruptedError(forKey: .cashCents, in: c, debugDescription: "Cash and card must both be present or both absent.")
        }
    }
}

/// One person in one shift. Everything about them is copied in (a snapshot),
/// so later crew edits never change a saved shift.
public struct ShiftParticipant: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    /// The saved crew member this came from; nil for a one-off person.
    public var employeeId: UUID?
    public var name: String
    public var role: String?
    /// Whether the closer put this person in this shift's pool.
    public var included: Bool
    public var eligibility: Eligibility
    public var minutesWorked: Int64
    public var pointsUnits: Int64
    /// Tip Out mode: the tips this person collected themselves. Nil when
    /// not entered.
    public var tipsCents: Int64?
    /// Tip Out mode: this person's own sales, for sales-based rules.
    public var salesCents: Int64?
    public var foodSalesCents: Int64?
    public var barSalesCents: Int64?

    public init(
        id: UUID = UUID(),
        employeeId: UUID? = nil,
        name: String,
        role: String? = nil,
        included: Bool = true,
        eligibility: Eligibility = .eligible,
        minutesWorked: Int64 = 0,
        pointsUnits: Int64 = Limits.defaultPointsUnits,
        tipsCents: Int64? = nil,
        salesCents: Int64? = nil,
        foodSalesCents: Int64? = nil,
        barSalesCents: Int64? = nil
    ) {
        self.id = id
        self.employeeId = employeeId
        self.name = name
        self.role = role
        self.included = included
        self.eligibility = eligibility
        self.minutesWorked = minutesWorked
        self.pointsUnits = pointsUnits
        self.tipsCents = tipsCents
        self.salesCents = salesCents
        self.foodSalesCents = foodSalesCents
        self.barSalesCents = barSalesCents
    }

    /// The amount a tip-out rule is a percentage of.
    public func amount(for basis: TipOutBasis) -> Int64? {
        switch basis {
        case .tips: tipsCents
        case .sales: salesCents
        case .foodSales: foodSalesCents
        case .barSales: barSalesCents
        }
    }

    /// "Ava (Server)" or "Ava".
    public var nameWithRole: String {
        if let role, !role.isEmpty { return "\(name) (\(role))" }
        return name
    }
}

/// Everything the engine needs for one shift. Participant order is the
/// frozen display order used to break exact ties.
public struct ShiftDraft: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var day: CalendarDay
    public var label: String?
    public var crewId: UUID?
    public var crewName: String?
    /// Tip Pool or Tip Out.
    public var mode: ShiftMode
    /// Tip Pool: how the pool is divided.
    public var method: SplitMethod
    /// Tip Pool: the money being divided.
    public var pool: TipPool
    public var participants: [ShiftParticipant]
    /// Tip Out: the rules in force for this shift (a copy of the crew's).
    public var tipOutRules: [TipOutRule]

    public init(
        id: UUID = UUID(),
        day: CalendarDay,
        label: String? = nil,
        crewId: UUID? = nil,
        crewName: String? = nil,
        mode: ShiftMode = .pool,
        method: SplitMethod,
        pool: TipPool,
        participants: [ShiftParticipant],
        tipOutRules: [TipOutRule] = []
    ) {
        self.id = id
        self.day = day
        self.label = label
        self.crewId = crewId
        self.crewName = crewName
        self.mode = mode
        self.method = method
        self.pool = pool
        self.participants = participants
        self.tipOutRules = tipOutRules
    }

    public init(from decoder: Decoder) throws {
        enum Keys: String, CodingKey { case id, day, label, crewId, crewName, mode, method, pool, participants, tipOutRules }
        let c = try decoder.container(keyedBy: Keys.self)
        id = try c.decode(UUID.self, forKey: .id)
        day = try c.decode(CalendarDay.self, forKey: .day)
        label = try c.decodeIfPresent(String.self, forKey: .label)
        crewId = try c.decodeIfPresent(UUID.self, forKey: .crewId)
        crewName = try c.decodeIfPresent(String.self, forKey: .crewName)
        mode = try c.decodeIfPresent(ShiftMode.self, forKey: .mode) ?? .pool
        method = try c.decode(SplitMethod.self, forKey: .method)
        pool = try c.decode(TipPool.self, forKey: .pool)
        participants = try c.decode([ShiftParticipant].self, forKey: .participants)
        tipOutRules = try c.decodeIfPresent([TipOutRule].self, forKey: .tipOutRules) ?? []
    }

    /// "Thu, Oct 8, 2026 · Dinner".
    public var title: String {
        if let label, !label.isEmpty { return "\(day.mediumText) \u{00B7} \(label)" }
        return day.mediumText
    }
}
