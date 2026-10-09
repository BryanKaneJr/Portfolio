import Foundation

/// An entry as it stood in the pool when a draw was made. Reveal views draw
/// from this, so a wheel spins the pool the winner was actually drawn from
/// even though that winner has already been removed.
public struct PoolMember: Identifiable, Equatable, Hashable, Sendable {
    public let id: UUID
    public let name: String
    public let weight: Int
    /// Position in the list: a stable colour and ball number.
    public let listIndex: Int

    public init(id: UUID, name: String, weight: Int, listIndex: Int) {
        self.id = id
        self.name = name
        self.weight = weight
        self.listIndex = listIndex
    }
}

/// Everything one tap of Draw produced, already committed to the list.
public struct DrawOutcome: Equatable, Sendable {
    public let actionID: UUID
    public let kind: DrawKind
    public let results: [DrawResult]
    /// The pool before the first pick, in list order.
    public let poolBefore: [PoolMember]
    public let withReplacement: Bool

    public init(actionID: UUID, kind: DrawKind, results: [DrawResult], poolBefore: [PoolMember], withReplacement: Bool) {
        self.actionID = actionID
        self.kind = kind
        self.results = results
        self.poolBefore = poolBefore
        self.withReplacement = withReplacement
    }

    /// The pool the pick at `index` (0-based) was drawn from.
    public func pool(forPick index: Int) -> [PoolMember] {
        guard !withReplacement, index > 0 else { return poolBefore }
        let earlier = Set(results.prefix(index).map(\.entryID))
        return poolBefore.filter { !earlier.contains($0.id) }
    }
}

/// Whether "Generate unique order" can run, and why not.
public enum DraftOrderAvailability: Equatable, Sendable {
    case available
    case requiresRemoval
    case notEnoughEntries

    public var explanation: String? {
        switch self {
        case .available:
            return nil
        case .requiresRemoval:
            return "Turn on Remove to generate a unique draft order."
        case .notEnoughEntries:
            return "A draft order needs at least two eligible entries."
        }
    }
}

/// Session rules: drawing, removal, undo, restore and new sessions. Every
/// draw is applied to the list in one mutation (results, odds snapshot and
/// removal together); the app saves that list before any animation starts.
public extension DrawList {
    /// The pool the next draw is drawn from, with names for reveal views.
    var poolMembers: [PoolMember] {
        entries.enumerated().compactMap { index, entry in
            guard !removedEntryIDs.contains(entry.id) else { return nil }
            let weight = effectiveWeight(atIndex: index)
            guard weight > 0 else { return nil }
            return PoolMember(id: entry.id, name: entry.name, weight: weight, listIndex: index)
        }
    }

    /// Most winners one tap may ask for: the pool size when winners are
    /// removed, a fixed cap when repeats are possible.
    var maxBatchCount: Int {
        let eligible = eligibleCount
        guard eligible > 0 else { return 0 }
        return removeAfterSelection ? eligible : Limits.maxBatchWithRepeats
    }

    /// Draws `count` winners. With Remove after selection ON they are unique
    /// and leave the pool; OFF, the pool is untouched and repeats are possible.
    mutating func draw<R: RandomNumberGenerator>(
        count: Int = 1,
        now: Date = Date(),
        using rng: inout R
    ) throws -> DrawOutcome {
        guard count >= 1 else { throw DrawError.invalidCount }
        let candidates = eligibleCandidates
        guard !candidates.isEmpty else { throw DrawError.noEligibleEntries }
        let removing = removeAfterSelection
        if removing, count > candidates.count {
            throw DrawError.countExceedsPool(available: candidates.count)
        }
        if !removing, count > Limits.maxBatchWithRepeats {
            throw DrawError.countExceedsPool(available: Limits.maxBatchWithRepeats)
        }
        let pool = poolMembers
        let picks = try SelectionEngine.selectSequence(candidates, count: count, withReplacement: !removing, using: &rng)
        return commit(picks, kind: count == 1 ? .single : .batch, removing: removing, pool: pool, now: now)
    }

    mutating func draw(count: Int = 1, now: Date = Date()) throws -> DrawOutcome {
        var rng = SystemRandomNumberGenerator()
        return try draw(count: count, now: now, using: &rng)
    }

    var draftOrderAvailability: DraftOrderAvailability {
        guard removeAfterSelection else { return .requiresRemoval }
        guard eligibleCount >= 2 else { return .notEnoughEntries }
        return .available
    }

    /// A complete weighted order of everyone eligible, each exactly once.
    /// Requires Remove after selection ON and never turns it on itself.
    mutating func generateDraftOrder<R: RandomNumberGenerator>(
        now: Date = Date(),
        using rng: inout R
    ) throws -> DrawOutcome {
        guard removeAfterSelection else { throw DrawError.uniqueOrderRequiresRemoval }
        let candidates = eligibleCandidates
        guard candidates.count >= 2 else { throw DrawError.notEnoughForOrder }
        let pool = poolMembers
        let picks = try SelectionEngine.uniqueOrder(candidates, using: &rng)
        return commit(picks, kind: .draftOrder, removing: true, pool: pool, now: now)
    }

    mutating func generateDraftOrder(now: Date = Date()) throws -> DrawOutcome {
        var rng = SystemRandomNumberGenerator()
        return try generateDraftOrder(now: now, using: &rng)
    }

    private mutating func commit(
        _ picks: [WeightedPick],
        kind: DrawKind,
        removing: Bool,
        pool: [PoolMember],
        now: Date
    ) -> DrawOutcome {
        let actionID = UUID()
        let firstOrdinal = activeResults.count + 1
        let results = picks.enumerated().map { offset, pick in
            DrawResult(
                entryID: pick.id,
                nameSnapshot: entry(pick.id)?.name ?? "",
                drawnAt: now,
                ordinal: firstOrdinal + offset,
                removedAfterDraw: removing,
                numeratorWeight: pick.numeratorWeight,
                totalEligibleWeight: pick.totalEligibleWeight,
                sessionID: activeSessionID,
                actionID: actionID,
                kind: kind,
                positionInAction: offset + 1
            )
        }
        if removing {
            removedEntryIDs.formUnion(picks.map(\.id))
        }
        activeResults.append(contentsOf: results)
        updatedAt = now
        lastUsedAt = now
        return DrawOutcome(actionID: actionID, kind: kind, results: results, poolBefore: pool, withReplacement: !removing)
    }

    /// Results of the most recent tap of Draw.
    var lastActionResults: [DrawResult] {
        guard let last = activeResults.last else { return [] }
        return activeResults.filter { $0.actionID == last.actionID }
    }

    /// The session's results grouped by tap, oldest first.
    var actions: [[DrawResult]] {
        var groups: [[DrawResult]] = []
        for result in activeResults {
            if let last = groups.last?.last, last.actionID == result.actionID {
                groups[groups.count - 1].append(result)
            } else {
                groups.append([result])
            }
        }
        return groups
    }

    /// The most recent unique order generated this session, pick 1 first.
    var latestDraftOrder: [DrawResult]? {
        actions.last { $0.first?.kind == .draftOrder }
    }

    var canUndo: Bool { !activeResults.isEmpty }

    /// Takes back the last tap of Draw (one winner, a batch or an order).
    /// Entries that draw removed come back; nothing is redrawn.
    @discardableResult
    mutating func undoLastDraw(now: Date = Date()) -> [DrawResult] {
        let undone = lastActionResults
        guard let actionID = undone.first?.actionID else { return [] }
        activeResults.removeAll { $0.actionID == actionID }
        for result in undone where result.removedAfterDraw {
            removedEntryIDs.remove(result.entryID)
        }
        sessionEdited = true
        updatedAt = now
        return undone
    }

    /// Returns every removed entry to the pool. History is untouched.
    mutating func restoreAllRemoved(now: Date = Date()) {
        guard !removedEntryIDs.isEmpty else { return }
        removedEntryIDs.removeAll()
        updatedAt = now
    }

    /// Returns the chosen removed entries to the pool.
    mutating func restore(_ ids: Set<UUID>, now: Date = Date()) {
        guard !removedEntryIDs.isDisjoint(with: ids) else { return }
        removedEntryIDs.subtract(ids)
        updatedAt = now
    }

    /// Fresh pool and empty history. Entries, weights, odds mode, reveal
    /// style and the removal toggle all stay as they are.
    mutating func startNewSession(now: Date = Date()) {
        removedEntryIDs.removeAll()
        activeResults.removeAll()
        activeSessionID = UUID()
        sessionEdited = false
        updatedAt = now
    }

    /// Affects future draws only: nobody is removed or restored by flipping it.
    mutating func setRemoveAfterSelection(_ isOn: Bool, now: Date = Date()) {
        guard removeAfterSelection != isOn else { return }
        removeAfterSelection = isOn
        updatedAt = now
    }

    /// Presentation only. Pool, weights, odds and the toggle are untouched.
    mutating func setRevealStyle(_ style: RevealStyle, now: Date = Date()) {
        guard revealStyle != style else { return }
        revealStyle = style
        updatedAt = now
    }
}
