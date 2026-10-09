import Foundation

/// The New Shift screen as a value: exactly what the closer has typed, as
/// text. It parses into a `ShiftDraft` and a live `ShiftCalculation` on
/// demand, so amounts on screen are always computed from the current text
/// and can never be stale. It is saved as-is, so a half-typed shift survives
/// the app being closed.
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

        public var isOneOff: Bool { employeeId == nil }
        public var isInPool: Bool { included && eligibility.canParticipate }

        public init(employee: Employee) {
            id = UUID()
            employeeId = employee.id
            name = employee.name
            role = employee.role
            eligibility = employee.eligibility
            included = employee.eligibility.canParticipate
            hoursText = ""
            pointsText = Points.format(units: employee.pointsUnits)
            defaultPointsUnits = employee.pointsUnits
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
            defaultPointsUnits: Int64 = Limits.defaultPointsUnits
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
        }

        public var minutes: Result<Int64, HoursInputError> { Hours.parse(hoursText) }
        public var points: Result<Int64, PointsInputError> { Points.parse(pointsText) }

        var pointsChangedForShift: Bool {
            (try? points.get()) != defaultPointsUnits
        }
    }

    /// A focusable input, in the order the keyboard's Next button visits.
    public enum Field: Hashable, Sendable {
        case tips, cash, card
        case hours(UUID)
        case points(UUID)
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
    }

    /// Whether the form can go to review, and if not, the one thing to fix
    /// next, phrased for the button area.
    public enum Readiness: Hashable, Sendable {
        case ready
        case blocked(String)

        public var isReady: Bool { self == .ready }
    }

    public var id: UUID
    public var day: CalendarDay
    public var label: String
    public var crewId: UUID?
    public var crewName: String?
    public var method: SplitMethod
    public var splitCashAndCard: Bool
    public var tipsText: String
    public var cashText: String
    public var cardText: String
    public var rows: [Row]
    /// The saved shift this one was duplicated from.
    public var duplicatedFrom: UUID?
    /// Filled from Try Example rather than the closer's own crew.
    public var isExample: Bool

    public init(
        id: UUID = UUID(),
        day: CalendarDay,
        label: String = "",
        method: SplitMethod,
        splitCashAndCard: Bool = false,
        crew: Crew? = nil
    ) {
        self.id = id
        self.day = day
        self.label = label
        self.method = method
        self.splitCashAndCard = splitCashAndCard
        tipsText = ""
        cashText = ""
        cardText = ""
        rows = []
        duplicatedFrom = nil
        isExample = false
        if let crew { apply(crew: crew) }
    }

    // MARK: - Editing

    /// Loads `crew` into the shift, or refreshes it after the crew was edited.
    /// Hours, inclusion and per-shift points already typed for people still on
    /// the crew are kept; one-off people stay at the end.
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
        crewId = crew.id
        crewName = crew.name
        isExample = false
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

    /// Puts someone in or out of this shift's pool. People who aren't
    /// eligible can't be put in; their eligibility has to be edited on the
    /// crew first.
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
        let texts = [tipsText, cashText, cardText] + rows.map(\.hoursText)
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
        return issues
    }

    /// The draft the engine sees. Unparseable or empty values count as zero
    /// (so they show up as missing), and an empty pool counts as $0.00 until
    /// tips are entered.
    public var draft: ShiftDraft {
        let pool = (try? parsedPool().get()) ?? (splitCashAndCard ? .cashAndCard(cash: 0, card: 0) : .total(0))
        let trimmedLabel = label.trimmingSpaces()
        return ShiftDraft(
            id: id,
            day: day,
            label: trimmedLabel.isEmpty ? nil : trimmedLabel,
            crewId: crewId,
            crewName: crewName,
            method: method,
            pool: pool,
            participants: rows.map { row in
                ShiftParticipant(
                    id: row.id,
                    employeeId: row.employeeId,
                    name: row.name,
                    role: row.role,
                    included: row.isInPool,
                    eligibility: row.eligibility,
                    minutesWorked: (try? row.minutes.get()) ?? 0,
                    pointsUnits: (try? row.points.get()) ?? 0
                )
            }
        )
    }

    public var calculation: ShiftCalculation { PoolCalculator.calculate(draft) }

    /// Whether the split can be reviewed and saved. The message names the
    /// first thing to fix.
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

    /// The next input still needing a value, after `current`, in screen
    /// order. Powers the keyboard's Next button.
    public func nextMissingField(after current: Field?) -> Field? {
        let order = fieldOrder
        let start = current.flatMap { order.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
        let candidates = order[start...] + order[..<start]
        return candidates.first { isMissing($0) && $0 != current }
    }

    public var fieldOrder: [Field] {
        var fields: [Field] = splitCashAndCard ? [.cash, .card] : [.tips]
        for row in rows where row.isInPool {
            if method.usesHours { fields.append(.hours(row.id)) }
            if method.usesPoints { fields.append(.points(row.id)) }
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
        }
    }

    private func name(of rowId: UUID) -> String {
        rows.first { $0.id == rowId }?.name ?? "someone"
    }
}

// MARK: - Starting points

extension ShiftForm {
    /// A new form for duplicating a saved shift: same people, hours, points,
    /// method and amounts, as a brand-new shift (the original never changes).
    public static func duplicating(_ shift: FinishedShift, day: CalendarDay) -> ShiftForm {
        let draft = shift.draft
        var form = ShiftForm(day: day, label: draft.label ?? "", method: draft.method, splitCashAndCard: draft.pool.isSplit)
        form.crewId = draft.crewId
        form.crewName = draft.crewName
        form.duplicatedFrom = shift.id
        if let cash = draft.pool.cashCents, let card = draft.pool.cardCents {
            form.cashText = Money.editable(cash)
            form.cardText = Money.editable(card)
        } else {
            form.tipsText = Money.editable(draft.pool.totalCents)
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
                defaultPointsUnits: p.pointsUnits
            )
        }
        return form
    }

    /// The Try Example shift: made-up people for this shift only. Nothing
    /// is added to the saved crews.
    public static func example(day: CalendarDay, method: SplitMethod) -> ShiftForm {
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
}
