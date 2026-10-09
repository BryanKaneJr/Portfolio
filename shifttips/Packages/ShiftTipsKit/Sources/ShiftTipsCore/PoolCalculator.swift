import Foundation

/// Why a participant does or doesn't share in the pool. Stored in saved
/// shifts; never rename raw values.
public enum ParticipationStatus: String, Codable, Hashable, Sendable {
    /// In the pool with a positive weight.
    case receiving
    /// Left out of this shift by the closer.
    case leftOut
    /// Marked not eligible for the pool.
    case notEligible
    /// Marked owner, manager or supervisor; never in the pool.
    case managerSupervisorOwner
    /// In the pool, but hours are missing (By Hours, Hours x Points).
    case needsHours
    /// In the pool, but points are missing (Hours x Points).
    case needsPoints

    public var isReceiving: Bool { self == .receiving }

    /// Short reason shown in place of an amount.
    public var shortText: String {
        switch self {
        case .receiving: "In pool"
        case .leftOut: "Not in this shift"
        case .notEligible: "Not eligible"
        case .managerSupervisorOwner: "Owner/manager"
        case .needsHours: "Needs hours"
        case .needsPoints: "Needs points"
        }
    }
}

/// One participant's result. Every participant gets one, in display order;
/// people outside the pool get zero.
public struct Allocation: Codable, Hashable, Identifiable, Sendable {
    public var participantId: UUID
    public var status: ParticipationStatus
    /// Equal: 1. By Hours: minutes. Hours x Points: minutes x point units.
    /// Zero for anyone not receiving.
    public var weight: Int64
    /// Present only when the pool is split into cash and card.
    public var cashCents: Int64?
    public var cardCents: Int64?
    public var totalCents: Int64
    /// Cents added by the largest remainder step (0 or 1 per pool).
    public var roundingCents: Int64

    public var id: UUID { participantId }
}

/// The frozen arithmetic of a split: the inputs and every allocation. Used
/// live while editing, then stored as-is in a finished shift.
public struct SplitResult: Codable, Hashable, Sendable {
    public var draft: ShiftDraft
    /// One per participant, in the same order.
    public var allocations: [Allocation]
    /// Sum of all receiving weights. Zero if nobody is receiving.
    public var totalWeight: Int64

    public var allocatedCents: Int64 { allocations.reduce(0) { $0 + $1.totalCents } }
    public var allocatedCashCents: Int64 { allocations.reduce(0) { $0 + ($1.cashCents ?? 0) } }
    public var allocatedCardCents: Int64 { allocations.reduce(0) { $0 + ($1.cardCents ?? 0) } }
    public var remainingCents: Int64 { draft.pool.totalCents - allocatedCents }
    public var receivingCount: Int { allocations.filter { $0.status.isReceiving }.count }

    /// Cash, card and combined totals each match the pool to the cent, and
    /// each person's cash and card add up to their total.
    public var reconciles: Bool {
        let pool = draft.pool
        guard allocatedCents == pool.totalCents else { return false }
        if pool.isSplit {
            guard allocatedCashCents == pool.cashCents, allocatedCardCents == pool.cardCents else { return false }
            return allocations.allSatisfy { ($0.cashCents ?? 0) + ($0.cardCents ?? 0) == $0.totalCents }
        }
        return allocations.allSatisfy { $0.cashCents == nil && $0.cardCents == nil }
    }

    public func participant(for allocation: Allocation) -> ShiftParticipant? {
        draft.participants.first { $0.id == allocation.participantId }
    }

    /// Participants paired with their allocations, in display order.
    public var rows: [(participant: ShiftParticipant, allocation: Allocation)] {
        zip(draft.participants, allocations).map { ($0, $1) }
    }
}

/// Something that stops a split or needs a second look.
public enum CalculationIssue: Hashable, Sendable {
    /// Nobody is in the pool with a positive weight.
    case nobodyInPool
    case missingHours([UUID])
    case missingPoints([UUID])
    case tooManyParticipants
    /// A value is outside `Limits` (only reachable from damaged data).
    case valueOutOfRange
    /// The weights don't fit in 64 bits (only reachable from damaged data).
    case overflow
    /// The pool is $0.00. Allowed, but saving asks first.
    case zeroPool

    /// Blocking issues stop review and saving. Others are warnings.
    public var isBlocking: Bool { self != .zeroPool }
}

public struct ShiftCalculation: Hashable, Sendable {
    public var result: SplitResult
    public var issues: [CalculationIssue]

    public var isBlocked: Bool { issues.contains { $0.isBlocking } }
    public var draft: ShiftDraft { result.draft }
    public var allocations: [Allocation] { result.allocations }
}

public enum PoolCalculator {
    /// Bumped whenever the arithmetic or status rules change, and stored with
    /// each finished shift. Old shifts are shown from their stored numbers.
    public static let engineVersion = 1

    /// Calculates allocations for every participant. Always returns a
    /// reconciled result: when there are blocking issues the people who can
    /// be paid still share the whole pool, so live amounts are never stale,
    /// but the issues say what must be fixed before the split can be saved.
    public static func calculate(_ draft: ShiftDraft) -> ShiftCalculation {
        var issues: [CalculationIssue] = []
        let statuses = draft.participants.map { status(of: $0, method: draft.method) }

        if draft.participants.count > Limits.maxParticipants { issues.append(.tooManyParticipants) }
        if !inRange(draft) { issues.append(.valueOutOfRange) }

        let missingHours = zip(draft.participants, statuses).filter { $1 == .needsHours }.map(\.0.id)
        let missingPoints = zip(draft.participants, statuses).filter { $1 == .needsPoints }.map(\.0.id)
        if !missingHours.isEmpty { issues.append(.missingHours(missingHours)) }
        if !missingPoints.isEmpty { issues.append(.missingPoints(missingPoints)) }

        var weights: [Int64] = []
        var overflowed = false
        for (participant, status) in zip(draft.participants, statuses) {
            guard status == .receiving else { weights.append(0); continue }
            switch weight(of: participant, method: draft.method) {
            case .some(let w): weights.append(w)
            case .none: weights.append(0); overflowed = true
            }
        }
        if overflowed { issues.append(.overflow) }

        let receiving = weights.contains { $0 > 0 }
        if !receiving { issues.append(.nobodyInPool) }
        if draft.pool.totalCents == 0 { issues.append(.zeroPool) }

        let pool = draft.pool
        let total = (try? LargestRemainder.totalWeight(weights))
        if total == nil && !overflowed { issues.append(.overflow) }
        guard let total, total > 0, !overflowed,
              pool.totalCents >= 0, (pool.cashCents ?? 0) >= 0, (pool.cardCents ?? 0) >= 0 else {
            return ShiftCalculation(result: unallocated(draft, statuses: statuses), issues: issues)
        }

        let allocations: [Allocation]
        if let cash = pool.cashCents, let card = pool.cardCents {
            let cashShares = try! LargestRemainder.allocate(pool: cash, weights: weights)
            let cardShares = try! LargestRemainder.allocate(pool: card, weights: weights)
            allocations = draft.participants.indices.map { i in
                Allocation(
                    participantId: draft.participants[i].id,
                    status: statuses[i],
                    weight: weights[i],
                    cashCents: cashShares[i].cents,
                    cardCents: cardShares[i].cents,
                    totalCents: cashShares[i].cents + cardShares[i].cents,
                    roundingCents: cashShares[i].roundingCents + cardShares[i].roundingCents
                )
            }
        } else {
            let shares = try! LargestRemainder.allocate(pool: pool.totalCents, weights: weights)
            allocations = draft.participants.indices.map { i in
                Allocation(
                    participantId: draft.participants[i].id,
                    status: statuses[i],
                    weight: weights[i],
                    cashCents: nil,
                    cardCents: nil,
                    totalCents: shares[i].cents,
                    roundingCents: shares[i].roundingCents
                )
            }
        }

        let result = SplitResult(draft: draft, allocations: allocations, totalWeight: total)
        precondition(result.reconciles, "Every split must reconcile to the cent")
        return ShiftCalculation(result: result, issues: issues)
    }

    /// Who is in the pool. Eligibility comes first and can't be overridden by
    /// `included`: an owner, manager or supervisor never receives.
    public static func status(of participant: ShiftParticipant, method: SplitMethod) -> ParticipationStatus {
        switch participant.eligibility {
        case .managerSupervisorOwner: return .managerSupervisorOwner
        case .notEligible: return .notEligible
        case .eligible: break
        }
        guard participant.included else { return .leftOut }
        if method.usesHours && participant.minutesWorked <= 0 { return .needsHours }
        if method.usesPoints && participant.pointsUnits <= 0 { return .needsPoints }
        return .receiving
    }

    /// The exact integer weight, or nil if it can't be represented.
    public static func weight(of participant: ShiftParticipant, method: SplitMethod) -> Int64? {
        switch method {
        case .equal:
            return 1
        case .hours:
            return participant.minutesWorked
        case .weightedHours:
            let (product, overflow) = participant.minutesWorked.multipliedReportingOverflow(by: participant.pointsUnits)
            return overflow ? nil : product
        }
    }

    private static func inRange(_ draft: ShiftDraft) -> Bool {
        let pool = draft.pool
        let amounts = [pool.totalCents, pool.cashCents ?? 0, pool.cardCents ?? 0]
        guard amounts.allSatisfy({ (0...Limits.maxPoolCents).contains($0) }) else { return false }
        return draft.participants.allSatisfy {
            (0...Limits.maxMinutes).contains($0.minutesWorked)
                && (0...Limits.maxPointsUnits).contains($0.pointsUnits)
        }
    }

    /// Everyone at zero, used when nobody can be paid yet.
    private static func unallocated(_ draft: ShiftDraft, statuses: [ParticipationStatus]) -> SplitResult {
        let split = draft.pool.isSplit
        let allocations = zip(draft.participants, statuses).map { participant, status in
            Allocation(
                participantId: participant.id,
                status: status,
                weight: 0,
                cashCents: split ? 0 : nil,
                cardCents: split ? 0 : nil,
                totalCents: 0,
                roundingCents: 0
            )
        }
        return SplitResult(draft: draft, allocations: allocations, totalWeight: 0)
    }
}
