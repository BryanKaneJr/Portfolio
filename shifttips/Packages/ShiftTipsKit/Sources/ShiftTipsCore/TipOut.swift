import Foundation

/// How a shift's tips are shared. Raw values are stored; never rename them.
public enum ShiftMode: String, Codable, CaseIterable, Hashable, Sendable {
    /// Everyone's tips go into one pool, split by a method.
    case pool
    /// People keep their own tips and pay set percentages to support roles.
    case tipOut

    public var title: String {
        switch self {
        case .pool: "Tip Pool"
        case .tipOut: "Tip Out"
        }
    }

    public var summary: String {
        switch self {
        case .pool: "Everyone's tips go into one pool, split by your method."
        case .tipOut: "Each person keeps their own tips and pays set percentages to support staff."
        }
    }
}

/// What a tip-out percentage is taken from. Raw values are stored.
public enum TipOutBasis: String, Codable, CaseIterable, Hashable, Sendable {
    case tips
    case sales
    case foodSales
    case barSales

    public var title: String {
        switch self {
        case .tips: "Tips"
        case .sales: "Sales"
        case .foodSales: "Food sales"
        case .barSales: "Bar sales"
        }
    }

    /// For sentences: "2% of food sales".
    public var phrase: String { title.lowercased() }
}

/// Percentages are integer basis points: 10000 is 100%, 250 is 2.5%.
public enum Percent {
    public static let hundredPercent: Int64 = 10_000

    /// "2%", "2.5%", "1.25%".
    public static func format(basisPoints: Int64) -> String {
        let whole = basisPoints / 100
        let fraction = basisPoints % 100
        if fraction == 0 { return "\(whole)%" }
        if fraction % 10 == 0 { return "\(whole).\(fraction / 10)%" }
        return "\(whole).\(fraction < 10 ? "0" : "")\(fraction)%"
    }

    /// "2", "2.5", "1.25", ".5" or "2%". At most two decimals, at most 100.
    public static func parse(_ text: String) -> Result<Int64, PercentInputError> {
        var s = text.trimmingSpaces()
        if s.hasSuffix("%") { s = String(s.dropLast()).trimmingSpaces() }
        if s.isEmpty { return .failure(.empty) }
        if s.hasPrefix("-") || s.hasPrefix("\u{2212}") { return .failure(.negative) }
        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count <= 2 else { return .failure(.invalid) }
        let whole = parts[0]
        let fraction = parts.count == 2 ? parts[1] : ""
        if whole.isEmpty && fraction.isEmpty { return .failure(.invalid) }
        guard whole.allSatisfy(\.isASCIIDigit), fraction.allSatisfy(\.isASCIIDigit) else { return .failure(.invalid) }
        if fraction.count > 2 { return .failure(.tooManyDecimals) }
        let significant = whole.drop { $0 == "0" }
        if significant.count > 3 { return .failure(.tooLarge) }
        var points = Int64(significant.isEmpty ? "0" : String(significant))! * 100
        if fraction.count == 1 { points += Int64(String(fraction))! * 10 }
        if fraction.count == 2 { points += Int64(String(fraction))! }
        if points > hundredPercent { return .failure(.tooLarge) }
        return .success(points)
    }
}

public enum PercentInputError: Error, Hashable, Sendable {
    case empty, invalid, negative, tooManyDecimals, tooLarge

    public var message: String {
        switch self {
        case .empty: "Enter a percentage."
        case .invalid: "Enter a percentage like 2 or 2.5."
        case .negative: "Percentages can't be negative."
        case .tooManyDecimals: "Use at most two decimal places."
        case .tooLarge: "A tip-out can be at most 100%."
        }
    }
}

/// One house rule: everyone in `fromRole` pays `rate` of their own `basis`
/// to the people in `toRole`, who share it by hours worked.
public struct TipOutRule: Codable, Hashable, Identifiable, Sendable {
    public enum Problem: Hashable, Sendable {
        case missingFromRole, missingToRole, sameRole, zeroRate, rateTooHigh

        public var message: String {
            switch self {
            case .missingFromRole: "Choose who pays."
            case .missingToRole: "Choose who receives."
            case .sameRole: "A role can't tip out itself."
            case .zeroRate: "The percentage must be more than 0."
            case .rateTooHigh: "A tip-out can be at most 100%."
            }
        }
    }

    public var id: UUID
    public var fromRole: String
    public var toRole: String
    public var basis: TipOutBasis
    public var rateBasisPoints: Int64

    public init(id: UUID = UUID(), fromRole: String, toRole: String, basis: TipOutBasis, rateBasisPoints: Int64) {
        self.id = id
        self.fromRole = fromRole
        self.toRole = toRole
        self.basis = basis
        self.rateBasisPoints = rateBasisPoints
    }

    /// Roles match ignoring case and extra spaces: "Bar back" isn't
    /// "Barback", but "server" is "Server ".
    public static func roleKey(_ role: String?) -> String? {
        guard let role else { return nil }
        let words = role.lowercased().split(whereSeparator: { $0.isWhitespace })
        return words.isEmpty ? nil : words.joined(separator: " ")
    }

    public var fromKey: String? { Self.roleKey(fromRole) }
    public var toKey: String? { Self.roleKey(toRole) }

    public var problem: Problem? {
        guard let from = fromKey else { return .missingFromRole }
        guard let to = toKey else { return .missingToRole }
        if from == to { return .sameRole }
        if rateBasisPoints <= 0 { return .zeroRate }
        if rateBasisPoints > Percent.hundredPercent { return .rateTooHigh }
        return nil
    }

    public var isValid: Bool { problem == nil }

    /// "Server → Busser: 2% of sales".
    public var summary: String {
        "\(fromRole.trimmingSpaces()) \u{2192} \(toRole.trimmingSpaces()): \(Percent.format(basisPoints: rateBasisPoints)) of \(basis.phrase)"
    }
}

// MARK: - Results

/// Where someone stands in a tip-out shift. Stored; never rename raw values.
public enum TipOutStatus: String, Codable, Hashable, Sendable {
    case pays
    case receives
    case paysAndReceives
    /// Has a role, but no rule applies to it this shift.
    case noRule
    /// Has no role, so no rule can apply.
    case noRole
    case leftOut
    case notEligible
    case managerSupervisorOwner

    public var pays: Bool { self == .pays || self == .paysAndReceives }
    public var receives: Bool { self == .receives || self == .paysAndReceives }
    public var takesPart: Bool { pays || receives }

    public var shortText: String {
        switch self {
        case .pays: "Tips out"
        case .receives: "Receives"
        case .paysAndReceives: "Tips out and receives"
        case .noRule: "No rule for this role"
        case .noRole: "Needs a role"
        case .leftOut: "Not in this shift"
        case .notEligible: "Not eligible"
        case .managerSupervisorOwner: "Owner/manager"
        }
    }
}

/// One tip-out paid by one person under one rule.
public struct TipOutPayment: Codable, Hashable, Sendable {
    public var ruleId: UUID
    public var toRole: String
    public var basis: TipOutBasis
    /// The tips or sales the percentage is taken from.
    public var baseCents: Int64
    public var rateBasisPoints: Int64
    /// The percentage of the base, to the nearest cent, before any cap.
    public var fullCents: Int64
    /// What's actually tipped out (less than `fullCents` only when capped).
    public var cents: Int64
}

/// One person's share of one role's pot.
public struct TipOutReceipt: Codable, Hashable, Sendable {
    public var role: String
    public var potCents: Int64
    public var minutes: Int64
    public var potMinutes: Int64
    public var cents: Int64
    /// Cents added by the largest remainder step (0 or 1).
    public var roundingCents: Int64
}

public struct TipOutPerson: Codable, Hashable, Identifiable, Sendable {
    public var participantId: UUID
    public var status: TipOutStatus
    /// The tips they collected (for people who pay), as entered.
    public var tipsCents: Int64?
    public var payments: [TipOutPayment]
    public var receipts: [TipOutReceipt]
    /// Their tip-outs added up to more than their tips, so each was reduced
    /// in proportion until they equal the tips.
    public var capped: Bool

    public var id: UUID { participantId }
    public var paidCents: Int64 { payments.reduce(0) { $0 + $1.cents } }
    public var receivedCents: Int64 { receipts.reduce(0) { $0 + $1.cents } }
    /// Their own tips after tipping out.
    public var keptCents: Int64 { (tipsCents ?? 0) - paidCents }
    /// Kept plus received.
    public var netCents: Int64 { keptCents + receivedCents }
}

/// All the tip-outs paid to one role, shared among its people by hours.
public struct TipOutPot: Codable, Hashable, Sendable {
    public var role: String
    public var cents: Int64
    public var recipientIds: [UUID]
    public var minutes: Int64
}

public struct TipOutRuleOutcome: Codable, Hashable, Sendable {
    public enum Status: String, Codable, Hashable, Sendable {
        case applied
        /// Nobody in the paying role is on this shift.
        case noPayers
        /// Nobody in the receiving role is on this shift, so it isn't taken.
        case noRecipients
        case invalid
    }

    public var ruleId: UUID
    public var status: Status
    /// Total tipped out under this rule.
    public var cents: Int64
}

/// The frozen arithmetic of a tip-out shift.
public struct TipOutResult: Codable, Hashable, Sendable {
    public var draft: ShiftDraft
    /// One per participant, in display order.
    public var people: [TipOutPerson]
    public var pots: [TipOutPot]
    /// One per rule, in rule order.
    public var rules: [TipOutRuleOutcome]

    public var collectedCents: Int64 { people.filter(\.status.pays).reduce(0) { $0 + ($1.tipsCents ?? 0) } }
    public var tippedOutCents: Int64 { people.reduce(0) { $0 + $1.paidCents } }
    public var receivedCents: Int64 { people.reduce(0) { $0 + $1.receivedCents } }
    public var leftOverCents: Int64 { tippedOutCents - receivedCents }
    public var takingPartCount: Int { people.filter(\.status.takesPart).count }

    /// Every cent tipped out reaches someone, each pot is fully shared, and
    /// nobody tips out more than they collected.
    public var reconciles: Bool {
        guard tippedOutCents == pots.reduce(0, { $0 + $1.cents }), receivedCents == tippedOutCents else { return false }
        for pot in pots {
            let shared = people.flatMap(\.receipts).filter { $0.role == pot.role }.reduce(0) { $0 + $1.cents }
            if shared != pot.cents { return false }
        }
        return people.allSatisfy { $0.keptCents >= 0 && $0.payments.allSatisfy { $0.cents >= 0 && $0.cents <= $0.fullCents } }
    }

    public struct Entry: Hashable, Identifiable, Sendable {
        public let participant: ShiftParticipant
        public let person: TipOutPerson
        public var id: UUID { participant.id }
    }

    public var entries: [Entry] {
        zip(draft.participants, people).map { Entry(participant: $0, person: $1) }
    }

    public func rule(_ id: UUID) -> TipOutRule? {
        draft.tipOutRules.first { $0.id == id }
    }
}

public enum TipOutIssue: Hashable, Sendable {
    case noRules
    case invalidRule(UUID)
    /// No rule has both a payer and a receiver on this shift.
    case nothingApplies
    case missingAmount(UUID, TipOutBasis)
    case missingHours(UUID)
    case tooManyParticipants
    case valueOutOfRange
    /// Warnings:
    case capped(UUID)
    case ruleSkipped(UUID)
    case zeroTipOut

    public var isBlocking: Bool {
        switch self {
        case .capped, .ruleSkipped, .zeroTipOut: false
        default: true
        }
    }
}

public struct TipOutCalculation: Hashable, Sendable {
    public var result: TipOutResult
    public var issues: [TipOutIssue]

    public var isBlocked: Bool { issues.contains { $0.isBlocking } }
}

// MARK: - Engine

/// Who pays and who receives this shift, from the rules and who's working.
/// The engine and the New Shift screen both use it, so the fields shown
/// are exactly the ones the arithmetic needs.
public struct TipOutPlan: Hashable, Sendable {
    /// Valid rules with at least one payer and one receiver on the shift.
    public let applied: [TipOutRule]
    /// One per rule, in rule order.
    public let ruleStatuses: [TipOutRuleOutcome.Status]
    /// One per participant, in order.
    public let statuses: [TipOutStatus]

    public init(participants: [ShiftParticipant], rules: [TipOutRule]) {
        let keys = participants.map { TipOutRule.roleKey($0.role) }
        let active = participants.map { $0.included && $0.eligibility.canParticipate }
        func working(_ key: String?) -> Bool {
            guard let key else { return false }
            return participants.indices.contains { active[$0] && keys[$0] == key }
        }

        var applied: [TipOutRule] = []
        var ruleStatuses: [TipOutRuleOutcome.Status] = []
        for rule in rules {
            let status: TipOutRuleOutcome.Status
            if !rule.isValid {
                status = .invalid
            } else if !working(rule.fromKey) {
                status = .noPayers
            } else if !working(rule.toKey) {
                status = .noRecipients
            } else {
                status = .applied
                applied.append(rule)
            }
            ruleStatuses.append(status)
        }

        statuses = participants.indices.map { i in
            let p = participants[i]
            switch p.eligibility {
            case .managerSupervisorOwner: return .managerSupervisorOwner
            case .notEligible: return .notEligible
            case .eligible: break
            }
            guard p.included else { return .leftOut }
            guard let key = keys[i] else { return .noRole }
            let pays = applied.contains { $0.fromKey == key }
            let receives = applied.contains { $0.toKey == key }
            switch (pays, receives) {
            case (true, true): return .paysAndReceives
            case (true, false): return .pays
            case (false, true): return .receives
            case (false, false): return .noRule
            }
        }
        self.applied = applied
        self.ruleStatuses = ruleStatuses
    }

    /// The amounts someone in `role` must enter: their tips, then each
    /// kind of sales their rules use.
    public func bases(forRole role: String?) -> [TipOutBasis] {
        guard let key = TipOutRule.roleKey(role) else { return [] }
        let used = Set(applied.filter { $0.fromKey == key }.map(\.basis))
        guard !used.isEmpty else { return [] }
        return TipOutBasis.allCases.filter { $0 == .tips || used.contains($0) }
    }
}

/// Tip Out mode. Each person who pays keeps their own tips minus a set
/// percentage of their own tips or sales per rule. Each percentage is
/// rounded to the nearest cent (half a cent rounds up). Tip-outs are
/// always taken from what someone collected themselves, never from
/// tip-outs they received, and never add up to more than the tips they
/// collected: if they would, each is reduced in proportion (largest
/// remainder) until they equal the tips. Everything paid to a role forms
/// one pot, shared among that role's people by minutes worked with the
/// same largest-remainder split as Tip Pool.
public enum TipOutCalculator {
    public static func calculate(_ draft: ShiftDraft) -> TipOutCalculation {
        var issues: [TipOutIssue] = []
        func note(_ issue: TipOutIssue) { if !issues.contains(issue) { issues.append(issue) } }

        let participants = draft.participants
        let rules = draft.tipOutRules
        if participants.count > Limits.maxParticipants { note(.tooManyParticipants) }
        if !inRange(participants) { note(.valueOutOfRange) }
        if rules.isEmpty { note(.noRules) }

        let plan = TipOutPlan(participants: participants, rules: rules)
        let applied = plan.applied
        let statuses = plan.statuses
        let keys = participants.map { TipOutRule.roleKey($0.role) }
        var outcomes: [TipOutRuleOutcome] = []
        for (rule, status) in zip(rules, plan.ruleStatuses) {
            if status == .invalid { note(.invalidRule(rule.id)) }
            if status == .noPayers || status == .noRecipients { note(.ruleSkipped(rule.id)) }
            outcomes.append(TipOutRuleOutcome(ruleId: rule.id, status: status, cents: 0))
        }
        if !rules.isEmpty && applied.isEmpty { note(.nothingApplies) }

        // What each payer tips out, capped at their tips.
        var people: [TipOutPerson] = participants.indices.map { i in
            TipOutPerson(participantId: participants[i].id, status: statuses[i], tipsCents: nil, payments: [], receipts: [], capped: false)
        }
        for i in participants.indices where statuses[i].pays {
            let p = participants[i]
            if p.tipsCents == nil { note(.missingAmount(p.id, .tips)) }
            var payments: [TipOutPayment] = []
            for rule in applied where rule.fromKey == keys[i] {
                let base = p.amount(for: rule.basis)
                if base == nil { note(.missingAmount(p.id, rule.basis)) }
                let full = percentOf(max(0, base ?? 0), basisPoints: rule.rateBasisPoints)
                payments.append(TipOutPayment(
                    ruleId: rule.id, toRole: rule.toRole.trimmingSpaces(), basis: rule.basis,
                    baseCents: base ?? 0, rateBasisPoints: rule.rateBasisPoints, fullCents: full, cents: full
                ))
            }
            let tips = max(0, p.tipsCents ?? 0)
            let total = payments.reduce(0) { $0 + $1.fullCents }
            if total > tips {
                let shares = try! LargestRemainder.allocate(pool: tips, weights: payments.map(\.fullCents))
                for k in payments.indices { payments[k].cents = shares[k].cents }
                people[i].capped = true
                note(.capped(p.id))
            }
            people[i].tipsCents = p.tipsCents
            people[i].payments = payments
        }

        // One pot per receiving role, in rule order.
        var pots: [TipOutPot] = []
        for rule in applied {
            guard let key = rule.toKey, !pots.contains(where: { TipOutRule.roleKey($0.role) == key }) else { continue }
            let cents = people.flatMap(\.payments).filter { TipOutRule.roleKey($0.toRole) == key }.reduce(0) { $0 + $1.cents }
            let recipients = participants.indices.filter { statuses[$0].receives && keys[$0] == key }
            for i in recipients where participants[i].minutesWorked <= 0 {
                note(.missingHours(participants[i].id))
            }
            let minutes = recipients.map { max(0, participants[$0].minutesWorked) }
            let potMinutes = minutes.reduce(0, +)
            let role = rule.toRole.trimmingSpaces()
            let shares: [LargestRemainder.Share]? = potMinutes > 0 ? (try? LargestRemainder.allocate(pool: cents, weights: minutes)) : nil
            for (k, i) in recipients.enumerated() {
                let share = shares?[k]
                people[i].receipts.append(TipOutReceipt(
                    role: role, potCents: cents, minutes: minutes[k], potMinutes: potMinutes,
                    cents: share?.cents ?? 0, roundingCents: share?.roundingCents ?? 0
                ))
            }
            pots.append(TipOutPot(role: role, cents: cents, recipientIds: recipients.map { participants[$0].id }, minutes: potMinutes))
        }

        for k in outcomes.indices where outcomes[k].status == .applied {
            let id = outcomes[k].ruleId
            outcomes[k].cents = people.flatMap(\.payments).filter { $0.ruleId == id }.reduce(0) { $0 + $1.cents }
        }

        let result = TipOutResult(draft: draft, people: people, pots: pots, rules: outcomes)
        if !applied.isEmpty && result.tippedOutCents == 0 { note(.zeroTipOut) }
        return TipOutCalculation(result: result, issues: issues)
    }

    /// `base x basisPoints / 10000`, to the nearest cent, half a cent up.
    public static func percentOf(_ base: Int64, basisPoints: Int64) -> Int64 {
        let (quotient, remainder) = LargestRemainder.divide(base, times: basisPoints, by: Percent.hundredPercent)
        return remainder >= Percent.hundredPercent - remainder ? quotient + 1 : quotient
    }

    private static func inRange(_ participants: [ShiftParticipant]) -> Bool {
        participants.allSatisfy { p in
            let amounts: [Int64?] = [p.tipsCents, p.salesCents, p.foodSalesCents, p.barSalesCents]
            return (0...Limits.maxMinutes).contains(p.minutesWorked)
                && amounts.allSatisfy { amount in amount.map { (0...Limits.maxPoolCents).contains($0) } ?? true }
        }
    }
}
