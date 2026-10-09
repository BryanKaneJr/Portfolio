import Foundation

/// The New Shift screen as a value: exactly what the closer has typed, as
/// text. It parses into a `ShiftDraft` and a live calculation on demand, so
/// amounts on screen are always computed from the current text and can never
/// be stale. It is saved as-is, so a half-typed shift survives the app being
/// closed.
public struct ShiftForm: Codable, Hashable, Sendable {
    public struct Row: Codable, Hashable, Identifiable, Sendable {
        /// Becomes the participant id.
        public var id: UUID
        /// The saved crew member; nil for someone added for this shift only.
        public var employeeId: UUID?
        public var name: String
        public var role: String?
        public var eligibility: Eligibility
        public var included: Bool
        public var hoursText: String
        public var pointsText: String
        /// The crew member's saved points, so the form can tell whether
        /// `pointsText` was changed just for this shift.
        public var defaultPointsUnits: Int64
        /// Tip Out mode: the tips and sales this person collected.
        public var tipsText: String
        public var salesText: String
        public var foodSalesText: String
        public var barSalesText: String

        public var isOneOff: Bool { employeeId == nil }
        public var isInPool: Bool { included && eligibility.canParticipate }

        public init(employee: Employee) {
            self.init(
                employeeId: employee.id,
                name: employee.name,
                role: employee.role,
                eligibility: employee.eligibility,
                included: employee.eligibility.canParticipate,
                pointsText: Points.format(units: employee.pointsUnits),
                defaultPointsUnits: employee.pointsUnits
            )
        }

        public init(
            id: UUID = UUID(),
            employeeId: UUID? = nil,
            name: String,
            role: String? = nil,
            eligibility: Eligibility = .eligible,
            included: Bool = true,
            hoursText: String = "",
            pointsText: String = Points.format(units: Limits.defaultPointsUnits),
            defaultPointsUnits: Int64 = Limits.defaultPointsUnits,
            tipsText: String = "",
            salesText: String = "",
            foodSalesText: String = "",
            barSalesText: String = ""
        ) {
            self.id = id
            self.employeeId = employeeId
            self.name = name
            self.role = role
            self.eligibility = eligibility
            self.included = included && eligibility.canParticipate
            self.hoursText = hoursText
            self.pointsText = pointsText
            self.defaultPointsUnits = defaultPointsUnits
            self.tipsText = tipsText
            self.salesText = salesText
            self.foodSalesText = foodSalesText
            self.barSalesText = barSalesText
        }

        public init(from decoder: Decoder) throws {
            enum Keys: String, CodingKey {
                case id, employeeId, name, role, eligibility, included, hoursText, pointsText, defaultPointsUnits
                case tipsText, salesText, foodSalesText, barSalesText
            }
            let c = try decoder.container(keyedBy: Keys.self)
            id = try c.decode(UUID.self, forKey: .id)
            employeeId = try c.decodeIfPresent(UUID.self, forKey: .employeeId)
            name = try c.decode(String.self, forKey: .name)
            role = try c.decodeIfPresent(String.self, forKey: .role)
            eligibility = try c.decode(Eligibility.self, forKey: .eligibility)
            included = try c.decode(Bool.self, forKey: .included)
            hoursText = try c.decode(String.self, forKey: .hoursText)
            pointsText = try c.decode(String.self, forKey: .pointsText)
            defaultPointsUnits = try c.decode(Int64.self, forKey: .defaultPointsUnits)
            tipsText = try c.decodeIfPresent(String.self, forKey: .tipsText) ?? ""
            salesText = try c.decodeIfPresent(String.self, forKey: .salesText) ?? ""
            foodSalesText = try c.decodeIfPresent(String.self, forKey: .foodSalesText) ?? ""
            barSalesText = try c.decodeIfPresent(String.self, forKey: .barSalesText) ?? ""
        }

        public var minutes: Result<Int64, HoursInputError> { Hours.parse(hoursText) }
        public var points: Result<Int64, PointsInputError> { Points.parse(pointsText) }

        /// The text typed for a tip-out amount.
        public func text(for basis: TipOutBasis) -> String {
            switch basis {
            case .tips: tipsText
            case .sales: salesText
            case .foodSales: foodSalesText
            case .barSales: barSalesText
            }
        }

        public mutating func setText(_ text: String, for basis: TipOutBasis) {
            switch basis {
            case .tips: tipsText = text
            case .sales: salesText = text
            case .foodSales: foodSalesText = text
            case .barSales: barSalesText = text
            }
        }

        public func amount(for basis: TipOutBasis) -> Result<Int64, MoneyInputError> {
            Money.parse(text(for: basis))
        }

        var pointsChangedForShift: Bool {
            (try? points.get()) != defaultPointsUnits
        }
    }

    /// A focusable input, in the order the keyboard's Next button visits.
    public enum Field: Hashable, Sendable {
        case tips, cash, card
        case hours(UUID)
        case points(UUID)
        /// Tip Out: a person's own tips or sales.
        case amount(UUID, TipOutBasis)
    }

    /// Problems with what was typed, before any arithmetic.
    public enum InputIssue: Error, Hashable, Sendable {
        case tipsMissing
        case tips(MoneyInputError)
        case cash(MoneyInputError)
        case card(MoneyInputError)
        case combinedTooLarge
        case hours(UUID, HoursInputError)
        case points(UUID, PointsInputError)
        case zeroPoints(UUID)
        case amount(UUID, TipOutBasis, MoneyInputError)
    }

    /// Whether the form can go to review, and if not, the one thing to fix
    /// next, phrased for the button area.
    public enum Readiness: Hashable, Sendable {
        case ready
        case blocked(String)

        public var isReady: Bool { self == .ready }
    }

    /// The live calculation for whichever mode the form is in.
    public enum Live: Hashable, Sendable {
        case pool(ShiftCalculation)
        case tipOut(TipOutCalculation)

        public var outcome: ShiftOutcome {
            switch self {
            case .pool(let calculation): .pool(calculation.result)
            case .tipOut(let calculation): .tipOut(calculation.result)
            }
        }

        public var isBlocked: Bool {
            switch self {
            case .pool(let calculation): calculation.isBlocked
            case .tipOut(let calculation): calculation.isBlocked
            }
        }
    }

    public var id: UUID
    public var day: CalendarDay
    public var label: String
    public var crewId: UUID?
    public var crewName: String?
    public var mode: ShiftMode
    public var method: SplitMethod
    public var splitCashAndCard: Bool
    public var tipsText: String
    public var cashText: String
    public var cardText: String
    public var rows: [Row]
    /// Tip Out: the rules for this shift, copied from the crew.
    public var tipOutRules: [TipOutRule]
    /// The saved shift this one was duplicated from.
    public var duplicatedFrom: UUID?
    /// Filled from Try Example rather than the closer's own crew.
    public var isExample: Bool

    public init(
        id: UUID = UUID(),
        day: CalendarDay,
        label: String = "",
        mode: ShiftMode = .pool,
        method: SplitMethod,
        splitCashAndCard: Bool = false,
        crew: Crew? = nil
    ) {
        self.id = id
        self.day = day
        self.label = label
        self.mode = mode
        self.method = method
        self.splitCashAndCard = splitCashAndCard
        tipsText = ""
        cashText = ""
        cardText = ""
        rows = []
        tipOutRules = []
        duplicatedFrom = nil
        isExample = false
        if let crew { apply(crew: crew) }
    }

    public init(from decoder: Decoder) throws {
        enum Keys: String, CodingKey {
            case id, day, label, crewId, crewName, mode, method, splitCashAndCard, tipsText, cashText, cardText
            case rows, tipOutRules, duplicatedFrom, isExample
        }
        let c = try decoder.container(keyedBy: Keys.self)
        id = try c.decode(UUID.self, forKey: .id)
        day = try c.decode(CalendarDay.self, forKey: .day)
        label = try c.decode(String.self, forKey: .label)
        crewId = try c.decodeIfPresent(UUID.self, forKey: .crewId)
        crewName = try c.decodeIfPresent(String.self, forKey: .crewName)
        mode = try c.decodeIfPresent(ShiftMode.self, forKey: .mode) ?? .pool
        method = try c.decode(SplitMethod.self, forKey: .method)
        splitCashAndCard = try c.decode(Bool.self, forKey: .splitCashAndCard)
        tipsText = try c.decode(String.self, forKey: .tipsText)
        cashText = try c.decode(String.self, forKey: .cashText)
        cardText = try c.decode(String.self, forKey: .cardText)
        rows = try c.decode([Row].self, forKey: .rows)
        tipOutRules = try c.decodeIfPresent([TipOutRule].self, forKey: .tipOutRules) ?? []
        duplicatedFrom = try c.decodeIfPresent(UUID.self, forKey: .duplicatedFrom)
        isExample = try c.decode(Bool.self, forKey: .isExample)
    }

    // MARK: - Editing

    /// Loads `crew` into the shift, or refreshes it after the crew was edited.
    /// Hours, inclusion, per-shift points, tips and sales already typed for
    /// people still on the crew are kept; one-off people stay at the end. The
    /// crew's tip-out rules replace the shift's.
    public mutating func apply(crew: Crew) {
        var updated: [Row] = []
        for employee in crew.employees {
            if var row = rows.first(where: { $0.employeeId == employee.id }) {
                row.name = employee.name
                row.role = employee.role
                if row.eligibility != employee.eligibility {
                    row.eligibility = employee.eligibility
                    row.included = employee.eligibility.canParticipate
                }
                if !row.pointsChangedForShift {
                    row.pointsText = Points.format(units: employee.pointsUnits)
                }
                row.defaultPointsUnits = employee.pointsUnits
                updated.append(row)
            } else {
                updated.append(Row(employee: employee))
            }
        }
        rows = updated + rows.filter(\.isOneOff)
        tipOutRules = crew.tipOutRules
        crewId = crew.id
        crewName = crew.name
        isExample = false
    }

    /// Simple: one pool, shared by hours, one tips amount. Anything typed
    /// for other modes stays in the form, unused.
    public mutating func makeSimple() {
        mode = .pool
        method = .hours
        setSplitCashAndCard(false)
    }

    /// Advanced: start the way the crew is set up to work.
    public mutating func useSetup(of crew: Crew) {
        mode = crew.mode
        method = crew.method
    }

    /// Drops the crew's people (one-off people stay).
    public mutating func removeCrew() {
        rows.removeAll { !$0.isOneOff }
        crewId = nil
        crewName = nil
    }

    /// Adds someone for this shift only. They never join the saved crew.
    @discardableResult
    public mutating func addOneOff(name: String, role: String?, pointsUnits: Int64 = Limits.defaultPointsUnits) -> UUID {
        let row = Row(
            name: name.trimmingSpaces(),
            role: role.map { $0.trimmingSpaces() }.flatMap { $0.isEmpty ? nil : $0 },
            pointsText: Points.format(units: pointsUnits),
            defaultPointsUnits: pointsUnits
        )
        rows.append(row)
        return row.id
    }

    public mutating func removeRow(id: UUID) {
        rows.removeAll { $0.id == id }
    }

    /// Puts someone in or out of this shift. People who aren't eligible
    /// can't be put in; their eligibility has to be edited on the crew first.
    public mutating func setIncluded(_ included: Bool, rowId: UUID) {
        guard let index = rows.firstIndex(where: { $0.id == rowId }) else { return }
        rows[index].included = included && rows[index].eligibility.canParticipate
    }

    /// Turns separate cash and card fields on or off without losing the
    /// amount already typed.
    public mutating func setSplitCashAndCard(_ split: Bool) {
        guard split != splitCashAndCard else { return }
        if !split, tipsText.trimmingSpaces().isEmpty, case .success(let pool) = parsedPool() {
            tipsText = Money.editable(pool.totalCents)
        }
        splitCashAndCard = split
    }

    /// True once anything worth keeping has been typed.
    public var hasEnteredValues: Bool {
        var texts = [tipsText, cashText, cardText]
        for row in rows {
            texts += [row.hoursText, row.tipsText, row.salesText, row.foodSalesText, row.barSalesText]
        }
        return texts.contains { !$0.trimmingSpaces().isEmpty }
    }

    // MARK: - Parsing

    /// The pool as typed. In cash and card mode an empty field counts as
    /// $0.00 as long as the other one has an amount.
    public func parsedPool() -> Result<TipPool, InputIssue> {
        if !splitCashAndCard {
            switch Money.parse(tipsText) {
            case .success(let cents): return .success(.total(cents))
            case .failure(.empty): return .failure(.tipsMissing)
            case .failure(let error): return .failure(.tips(error))
            }
        }
        let cashEmpty = cashText.trimmingSpaces().isEmpty
        let cardEmpty = cardText.trimmingSpaces().isEmpty
        if cashEmpty && cardEmpty { return .failure(.tipsMissing) }
        let cash: Int64
        let card: Int64
        switch cashEmpty ? .success(0) : Money.parse(cashText) {
        case .success(let value): cash = value
        case .failure(let error): return .failure(.cash(error))
        }
        switch cardEmpty ? .success(0) : Money.parse(cardText) {
        case .success(let value): card = value
        case .failure(let error): return .failure(.card(error))
        }
        if cash + card > Limits.maxPoolCents { return .failure(.combinedTooLarge) }
        return .success(.cashAndCard(cash: cash, card: card))
    }

    /// Everything wrong with the typed text, in screen order.
    public var inputIssues: [InputIssue] {
        var issues: [InputIssue] = []
        switch mode {
        case .pool:
            if case .failure(let issue) = parsedPool() { issues.append(issue) }
            for row in rows where row.isInPool {
                if method.usesHours, case .failure(let error) = row.minutes, error != .empty {
                    issues.append(.hours(row.id, error))
                }
                if method.usesPoints {
                    switch row.points {
                    case .failure(let error) where error != .empty: issues.append(.points(row.id, error))
                    case .success(0): issues.append(.zeroPoints(row.id))
                    default: break
                    }
                }
            }
        case .tipOut:
            let plan = tipOutPlan
            for (row, status) in zip(rows, plan.statuses) {
                for basis in plan.bases(forRole: row.role) {
                    if case .failure(let error) = row.amount(for: basis), error != .empty {
                        issues.append(.amount(row.id, basis, error))
                    }
                }
                if status.receives, case .failure(let error) = row.minutes, error != .empty {
                    issues.append(.hours(row.id, error))
                }
            }
        }
        return issues
    }

    /// The draft the engine sees. Unparseable or empty values count as zero
    /// or missing (so they show up as missing), and an empty pool counts as
    /// $0.00 until tips are entered.
    public var draft: ShiftDraft {
        let pool: TipPool = mode == .tipOut
            ? .total(0)
            : (try? parsedPool().get()) ?? (splitCashAndCard ? .cashAndCard(cash: 0, card: 0) : .total(0))
        let trimmedLabel = label.trimmingSpaces()
        return ShiftDraft(
            id: id,
            day: day,
            label: trimmedLabel.isEmpty ? nil : trimmedLabel,
            crewId: crewId,
            crewName: crewName,
            mode: mode,
            method: method,
            pool: pool,
            participants: participants,
            tipOutRules: mode == .tipOut ? tipOutRules : []
        )
    }

    private var participants: [ShiftParticipant] {
        rows.map { row in
            var participant = ShiftParticipant(
                id: row.id,
                employeeId: row.employeeId,
                name: row.name,
                role: row.role,
                included: row.isInPool,
                eligibility: row.eligibility,
                minutesWorked: (try? row.minutes.get()) ?? 0,
                pointsUnits: (try? row.points.get()) ?? 0
            )
            if mode == .tipOut {
                participant.tipsCents = try? row.amount(for: .tips).get()
                participant.salesCents = try? row.amount(for: .sales).get()
                participant.foodSalesCents = try? row.amount(for: .foodSales).get()
                participant.barSalesCents = try? row.amount(for: .barSales).get()
            }
            return participant
        }
    }

    /// Tip Pool's live calculation.
    public var calculation: ShiftCalculation { PoolCalculator.calculate(draft) }

    /// Tip Out's live calculation.
    public var tipOutCalculation: TipOutCalculation { TipOutCalculator.calculate(draft) }

    public var live: Live {
        mode == .pool ? .pool(calculation) : .tipOut(tipOutCalculation)
    }

    /// Who pays and who receives, from the rules and who's working.
    public var tipOutPlan: TipOutPlan {
        TipOutPlan(participants: participants, rules: tipOutRules)
    }

    public func readiness(_ live: Live) -> Readiness {
        switch live {
        case .pool(let calculation): readiness(calculation)
        case .tipOut(let calculation): readiness(calculation)
        }
    }

    /// Whether the pool split can be reviewed and saved. The message names
    /// the first thing to fix.
    public func readiness(_ calculation: ShiftCalculation) -> Readiness {
        let inputs = inputIssues
        for issue in inputs {
            switch issue {
            case .tipsMissing: return .blocked("Enter the pooled tips")
            case .tips(let error), .cash(let error), .card(let error): return .blocked(error.message)
            case .combinedTooLarge: return .blocked(MoneyInputError.tooLarge.message)
            default: continue
            }
        }
        if calculation.issues.contains(.tooManyParticipants) {
            return .blocked("A shift can have up to \(Limits.maxParticipants) people")
        }
        if let issue = inputs.first {
            switch issue {
            case .hours(let id, _): return .blocked("Check hours for \(name(of: id))")
            case .points(let id, _), .zeroPoints(let id): return .blocked("Check points for \(name(of: id))")
            default: break
            }
        }
        for issue in calculation.issues {
            switch issue {
            case .missingHours(let ids): return .blocked(ids.count == 1 ? "Enter hours for \(name(of: ids[0]))" : "Enter hours for \(ids.count) people")
            case .missingPoints(let ids): return .blocked(ids.count == 1 ? "Enter points for \(name(of: ids[0]))" : "Enter points for \(ids.count) people")
            default: continue
            }
        }
        if calculation.issues.contains(.nobodyInPool) {
            return .blocked(rows.isEmpty ? "Add people to split the tips" : "Put at least one person in the pool")
        }
        if calculation.isBlocked { return .blocked("Check the numbers entered") }
        return .ready
    }

    /// Whether the tip-out can be reviewed and saved.
    public func readiness(_ calculation: TipOutCalculation) -> Readiness {
        let issues = calculation.issues
        if issues.contains(.tooManyParticipants) {
            return .blocked("A shift can have up to \(Limits.maxParticipants) people")
        }
        if tipOutRules.isEmpty { return .blocked("Add your tip-out rules") }
        if issues.contains(where: { if case .invalidRule = $0 { return true } else { return false } }) {
            return .blocked("Fix your tip-out rules")
        }
        if rows.isEmpty { return .blocked("Add people to tip out") }
        if issues.contains(.nothingApplies) { return .blocked("No tip-out rule matches who's working") }
        if let issue = inputIssues.first {
            switch issue {
            case .amount(let id, let basis, _): return .blocked("Check \(basis.phrase) for \(name(of: id))")
            case .hours(let id, _): return .blocked("Check hours for \(name(of: id))")
            default: break
            }
        }
        if let field = nextMissingField(after: nil) {
            switch field {
            case .amount(let id, let basis): return .blocked("Enter \(basis.phrase) for \(name(of: id))")
            case .hours(let id): return .blocked("Enter hours for \(name(of: id))")
            default: break
            }
        }
        if calculation.isBlocked { return .blocked("Check the numbers entered") }
        return .ready
    }

    /// The next input still needing a value, after `current`, in screen
    /// order. Powers the keyboard's Next button.
    public func nextMissingField(after current: Field?) -> Field? {
        let order = fieldOrder
        let start = current.flatMap { order.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
        let candidates = order[start...] + order[..<start]
        return candidates.first { isMissing($0) && $0 != current }
    }

    public var fieldOrder: [Field] {
        var fields: [Field] = []
        switch mode {
        case .pool:
            fields = splitCashAndCard ? [.cash, .card] : [.tips]
            for row in rows where row.isInPool {
                if method.usesHours { fields.append(.hours(row.id)) }
                if method.usesPoints { fields.append(.points(row.id)) }
            }
        case .tipOut:
            let plan = tipOutPlan
            for (row, status) in zip(rows, plan.statuses) {
                for basis in plan.bases(forRole: row.role) { fields.append(.amount(row.id, basis)) }
                if status.receives { fields.append(.hours(row.id)) }
            }
        }
        return fields
    }

    private func isMissing(_ field: Field) -> Bool {
        switch field {
        case .tips: return (try? Money.parse(tipsText).get()) == nil
        case .cash, .card:
            if case .success = parsedPool() { return false }
            return field == .cash ? (try? Money.parse(cashText).get()) == nil : (try? Money.parse(cardText).get()) == nil
        case .hours(let id):
            guard let row = rows.first(where: { $0.id == id }) else { return false }
            return ((try? row.minutes.get()) ?? 0) <= 0
        case .points(let id):
            guard let row = rows.first(where: { $0.id == id }) else { return false }
            return ((try? row.points.get()) ?? 0) <= 0
        case .amount(let id, let basis):
            guard let row = rows.first(where: { $0.id == id }) else { return false }
            return (try? row.amount(for: basis).get()) == nil
        }
    }

    private func name(of rowId: UUID) -> String {
        rows.first { $0.id == rowId }?.name ?? "someone"
    }
}

// MARK: - Starting points

extension ShiftForm {
    /// A new form for duplicating a saved shift: same people, hours, points,
    /// amounts, method and rules, as a brand-new shift (the original never
    /// changes).
    public static func duplicating(_ shift: FinishedShift, day: CalendarDay) -> ShiftForm {
        let draft = shift.draft
        var form = ShiftForm(day: day, label: draft.label ?? "", mode: draft.mode, method: draft.method, splitCashAndCard: draft.pool.isSplit)
        form.crewId = draft.crewId
        form.crewName = draft.crewName
        form.duplicatedFrom = shift.id
        form.tipOutRules = draft.tipOutRules
        if draft.mode == .pool {
            if let cash = draft.pool.cashCents, let card = draft.pool.cardCents {
                form.cashText = Money.editable(cash)
                form.cardText = Money.editable(card)
            } else {
                form.tipsText = Money.editable(draft.pool.totalCents)
            }
        }
        form.rows = draft.participants.map { p in
            Row(
                employeeId: p.employeeId,
                name: p.name,
                role: p.role,
                eligibility: p.eligibility,
                included: p.included,
                hoursText: p.minutesWorked > 0 ? Hours.editable(minutes: p.minutesWorked) : "",
                pointsText: Points.format(units: p.pointsUnits),
                defaultPointsUnits: p.pointsUnits,
                tipsText: p.tipsCents.map(Money.editable) ?? "",
                salesText: p.salesCents.map(Money.editable) ?? "",
                foodSalesText: p.foodSalesCents.map(Money.editable) ?? "",
                barSalesText: p.barSalesCents.map(Money.editable) ?? ""
            )
        }
        return form
    }

    /// The Try Example shift: made-up people for this shift only. Nothing
    /// is added to the saved crews.
    public static func example(day: CalendarDay, mode: ShiftMode = .pool, method: SplitMethod) -> ShiftForm {
        if mode == .tipOut { return tipOutExample(day: day, method: method) }
        var form = ShiftForm(day: day, label: "Example", method: method)
        form.isExample = true
        form.tipsText = "472.38"
        form.rows = [
            Row(name: "Ava", role: "Server", hoursText: "7.5"),
            Row(name: "Marco", role: "Server", hoursText: "6.25"),
            Row(name: "Priya", role: "Bartender", hoursText: "8"),
            Row(name: "Jordan", role: "Barback", hoursText: "5"),
            Row(name: "Sam", role: "Host", hoursText: "4.5"),
            Row(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner, included: false, hoursText: "9"),
        ]
        return form
    }

    /// Made-up rules and people, so the example shows a real chain: servers
    /// tip out bussers, the bar and the host, and the bartender tips out the
    /// barback. The rules are an illustration, not a recommendation.
    private static func tipOutExample(day: CalendarDay, method: SplitMethod) -> ShiftForm {
        var form = ShiftForm(day: day, label: "Example", mode: .tipOut, method: method)
        form.isExample = true
        form.tipOutRules = [
            TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 200),
            TipOutRule(fromRole: "Server", toRole: "Bartender", basis: .barSales, rateBasisPoints: 500),
            TipOutRule(fromRole: "Server", toRole: "Host", basis: .sales, rateBasisPoints: 100),
            TipOutRule(fromRole: "Bartender", toRole: "Barback", basis: .tips, rateBasisPoints: 1000),
        ]
        form.rows = [
            Row(name: "Ava", role: "Server", tipsText: "412.50", salesText: "2140", barSalesText: "520"),
            Row(name: "Marco", role: "Server", tipsText: "318.75", salesText: "1655.40", barSalesText: "310"),
            Row(name: "Priya", role: "Bartender", hoursText: "8", tipsText: "286"),
            Row(name: "Jordan", role: "Busser", hoursText: "6"),
            Row(name: "Kim", role: "Busser", hoursText: "4"),
            Row(name: "Sam", role: "Host", hoursText: "5"),
            Row(name: "Dee", role: "Barback", hoursText: "6"),
            Row(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner, included: false),
        ]
        return form
    }
}
