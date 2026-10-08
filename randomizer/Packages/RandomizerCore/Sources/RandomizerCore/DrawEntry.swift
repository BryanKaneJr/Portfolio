import Foundation

/// One participant. Identity is the UUID, never the name: two entries
/// called "Alex" are two different people with their own chances.
///
/// In Reverse Standings the entry's position in `DrawList.entries` is its
/// rank (first = worst finish), so there is no separate rank field to drift
/// out of step with the order on screen.
public struct DrawEntry: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    /// Stored custom weight, 0 to 1,000. Used in Weighted mode only; kept
    /// while another mode is selected so switching back loses nothing.
    public var weight: Int

    public init(id: UUID = UUID(), name: String, weight: Int = Limits.defaultWeight) {
        self.id = id
        self.name = name
        self.weight = DrawEntry.clampWeight(weight)
    }

    public static func clampWeight(_ weight: Int) -> Int {
        min(max(weight, Limits.minWeight), Limits.maxWeight)
    }
}
