import Foundation

/// One winner, recorded the moment it was chosen and before any animation.
/// It is a snapshot: later edits to names or weights never rewrite it.
public struct DrawResult: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    public var entryID: UUID
    public var nameSnapshot: String
    public var drawnAt: Date
    /// 1-based position in the session's results.
    public var ordinal: Int
    /// True when this draw took the winner out of the pool.
    public var removedAfterDraw: Bool
    /// The winner's weight at the moment of the draw.
    public var numeratorWeight: Int
    /// The pool's total weight at the moment of the draw.
    public var totalEligibleWeight: Int
    public var sessionID: UUID
    /// Shared by every result from one tap of Draw. Undo works per action.
    public var actionID: UUID
    public var kind: DrawKind
    /// 1-based pick number within the action (draft position for orders).
    public var positionInAction: Int

    public init(
        id: UUID = UUID(),
        entryID: UUID,
        nameSnapshot: String,
        drawnAt: Date,
        ordinal: Int,
        removedAfterDraw: Bool,
        numeratorWeight: Int,
        totalEligibleWeight: Int,
        sessionID: UUID,
        actionID: UUID,
        kind: DrawKind,
        positionInAction: Int
    ) {
        self.id = id
        self.entryID = entryID
        self.nameSnapshot = nameSnapshot
        self.drawnAt = drawnAt
        self.ordinal = ordinal
        self.removedAfterDraw = removedAfterDraw
        self.numeratorWeight = numeratorWeight
        self.totalEligibleWeight = totalEligibleWeight
        self.sessionID = sessionID
        self.actionID = actionID
        self.kind = kind
        self.positionInAction = positionInAction
    }

    /// The winner's chance at the moment of the draw.
    public var probability: Double {
        guard totalEligibleWeight > 0 else { return 0 }
        return Double(numeratorWeight) / Double(totalEligibleWeight)
    }

    public var chanceText: String {
        OddsCalculator.formatPercent(numerator: numeratorWeight, denominator: totalEligibleWeight)
    }
}
