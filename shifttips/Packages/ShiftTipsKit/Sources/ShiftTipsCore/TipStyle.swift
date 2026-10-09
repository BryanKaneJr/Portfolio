import Foundation

/// How much of ShiftTips a person sees. Stored; never rename raw values.
public enum Experience: String, Codable, CaseIterable, Hashable, Sendable {
    /// People, hours, tips: shared by hours worked. Nothing else on screen.
    case simple
    /// A tipping style per crew, fully editable: pools, points, tip-outs,
    /// cash and card.
    case advanced

    public var title: String {
        switch self {
        case .simple: "Simple"
        case .advanced: "Advanced"
        }
    }

    public var summary: String {
        switch self {
        case .simple: "List who worked and their hours. Tips are shared by hours worked."
        case .advanced: "Pick the style closest to how your team works, then make every number match: pools by role points, tip-outs by percentage, cash and card."
        }
    }
}

/// Points for everyone in a role, for Hours x Points.
public struct RolePoints: Codable, Hashable, Sendable {
    public var role: String
    public var pointsUnits: Int64

    public init(role: String, pointsUnits: Int64) {
        self.role = role
        self.pointsUnits = pointsUnits
    }
}

/// The common ways restaurants and bars run tips, offered as starting points
/// in Advanced. Choosing one sets up a crew; every number can then be
/// changed. The numbers are typical, not recommendations. Stored; never
/// rename raw values.
public enum TipStyle: String, Codable, CaseIterable, Hashable, Identifiable, Sendable {
    case equalPool
    case hoursPool
    case pointsPool
    case tipOutOfTips
    case tipOutOfSales

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .equalPool: "Equal pool"
        case .hoursPool: "Hours pool"
        case .pointsPool: "Points pool"
        case .tipOutOfTips: "Tip-out, % of tips"
        case .tipOutOfSales: "Tip-out, % of sales"
        }
    }

    public var summary: String {
        switch self {
        case .equalPool: "All tips go in one pot and everyone on the shift gets the same share."
        case .hoursPool: "All tips go in one pot, shared by the hours each person worked."
        case .pointsPool: "All tips go in one pot. Each role has points, and shares follow hours worked times points."
        case .tipOutOfTips: "Servers keep their own tips and give a set percentage of them to the bussers, bar, runners and host."
        case .tipOutOfSales: "Servers keep their own tips and tip out support staff based on their sales, straight from the checkout report."
        }
    }

    /// "Sounds like you if ..."
    public var soundsLike: String {
        switch self {
        case .equalPool: "it's a small team where everyone does a bit of everything."
        case .hoursPool: "whoever works longer should get more, whatever their role."
        case .pointsPool: "roles share one pot, but some roles get a bigger share per hour."
        case .tipOutOfTips: "each server walks out with their own tips, minus what they give support."
        case .tipOutOfSales: "your tip-outs are a percentage of each server's sales."
        }
    }

    public var commonIn: String {
        switch self {
        case .equalPool: "Cafes, counters, food trucks"
        case .hoursPool: "Coffee shops, fast casual, bars"
        case .pointsPool: "Full-service restaurants with team service"
        case .tipOutOfTips: "Casual dining, bars"
        case .tipOutOfSales: "Full-service restaurants with POS checkouts"
        }
    }

    public var mode: ShiftMode {
        switch self {
        case .equalPool, .hoursPool, .pointsPool: .pool
        case .tipOutOfTips, .tipOutOfSales: .tipOut
        }
    }

    public var method: SplitMethod {
        switch self {
        case .equalPool: .equal
        case .hoursPool, .tipOutOfTips, .tipOutOfSales: .hours
        case .pointsPool: .weightedHours
        }
    }

    /// Typical tip-out rules for the tip-out styles, with fresh ids.
    public func startingRules() -> [TipOutRule] {
        switch self {
        case .equalPool, .hoursPool, .pointsPool:
            return []
        case .tipOutOfTips:
            return [
                TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 1000),
                TipOutRule(fromRole: "Server", toRole: "Bartender", basis: .tips, rateBasisPoints: 500),
                TipOutRule(fromRole: "Server", toRole: "Runner", basis: .tips, rateBasisPoints: 500),
                TipOutRule(fromRole: "Server", toRole: "Host", basis: .tips, rateBasisPoints: 300),
                TipOutRule(fromRole: "Bartender", toRole: "Barback", basis: .tips, rateBasisPoints: 1500),
            ]
        case .tipOutOfSales:
            return [
                TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 200),
                TipOutRule(fromRole: "Server", toRole: "Bartender", basis: .barSales, rateBasisPoints: 500),
                TipOutRule(fromRole: "Server", toRole: "Runner", basis: .foodSales, rateBasisPoints: 200),
                TipOutRule(fromRole: "Server", toRole: "Host", basis: .sales, rateBasisPoints: 100),
                TipOutRule(fromRole: "Bartender", toRole: "Barback", basis: .tips, rateBasisPoints: 1500),
            ]
        }
    }

    /// Typical points by role for the points style.
    public var startingRolePoints: [RolePoints] {
        guard self == .pointsPool else { return [] }
        return [
            RolePoints(role: "Server", pointsUnits: 1000),
            RolePoints(role: "Bartender", pointsUnits: 1000),
            RolePoints(role: "Busser", pointsUnits: 500),
            RolePoints(role: "Runner", pointsUnits: 500),
            RolePoints(role: "Host", pointsUnits: 500),
            RolePoints(role: "Barback", pointsUnits: 500),
        ]
    }

    /// What choosing this style sets up, in a few lines.
    public var setupLines: [String] {
        switch self {
        case .equalPool: return ["One pool, the same share for everyone"]
        case .hoursPool: return ["One pool, shared by hours worked"]
        case .pointsPool:
            let points = startingRolePoints.map { "\($0.role) \(Points.format(units: $0.pointsUnits))" }
            return ["One pool, shared by hours \u{00D7} points", "Points: " + points.joined(separator: ", ")]
        case .tipOutOfTips, .tipOutOfSales:
            return startingRules().map(\.summary)
        }
    }

    /// Role names the styles use, offered as quick picks when naming roles.
    public static let commonRoles = ["Server", "Bartender", "Busser", "Runner", "Host", "Barback", "Manager"]
}

extension Crew {
    /// Sets the crew up the way `style` works: mode, split method, and the
    /// style's starting rules or role points. Everyone whose role has
    /// points gets those points.
    public mutating func adopt(_ style: TipStyle) {
        self.style = style
        mode = style.mode
        method = style.method
        if style.mode == .tipOut {
            tipOutRules = style.startingRules()
        }
        if style == .pointsPool {
            rolePoints = style.startingRolePoints
            for index in employees.indices {
                if let units = points(forRole: employees[index].role) {
                    employees[index].pointsUnits = units
                }
            }
        }
    }

    /// The crew's points for `role`, matched ignoring case and spacing.
    public func points(forRole role: String?) -> Int64? {
        guard let key = TipOutRule.roleKey(role) else { return nil }
        return rolePoints.first { TipOutRule.roleKey($0.role) == key }?.pointsUnits
    }

    /// Sets the points for a role and gives them to everyone in it.
    public mutating func setPoints(_ units: Int64, forRole role: String) {
        guard let key = TipOutRule.roleKey(role) else { return }
        if let index = rolePoints.firstIndex(where: { TipOutRule.roleKey($0.role) == key }) {
            rolePoints[index].pointsUnits = units
        } else {
            rolePoints.append(RolePoints(role: role.trimmingSpaces(), pointsUnits: units))
        }
        for index in employees.indices where TipOutRule.roleKey(employees[index].role) == key {
            employees[index].pointsUnits = units
        }
    }

    /// Every role on the crew or in its role points, each once.
    public var pointRoles: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for role in roles + rolePoints.map(\.role) {
            guard let key = TipOutRule.roleKey(role), !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(role.trimmingSpaces())
        }
        return result
    }
}

extension FinishedShift {
    /// Saved shifts that Simple can show and duplicate: one pool, split by
    /// hours, without separate cash and card.
    public var isSimpleCompatible: Bool {
        guard let pool = outcome.pool else { return false }
        return pool.draft.method == .hours && !pool.draft.pool.isSplit
    }
}
