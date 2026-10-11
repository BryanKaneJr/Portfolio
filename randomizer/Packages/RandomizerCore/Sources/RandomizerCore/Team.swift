import Foundation

/// One team. Identity is the UUID, never the name: two teams called
/// "Sharks" are two different teams with their own chances.
///
/// A team's position in `League.teams` is its finish (first = worst), so
/// there is no separate rank field to drift out of step with the screen.
public struct Team: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    /// Custom Odds weight, 0 to 1,000. Kept while another mode is selected
    /// so switching back loses nothing.
    public var weight: Int

    public init(id: UUID = UUID(), name: String, weight: Int = Limits.defaultWeight) {
        self.id = id
        self.name = name
        self.weight = Team.clampWeight(weight)
    }

    public static func clampWeight(_ weight: Int) -> Int {
        min(max(weight, Limits.minWeight), Limits.maxWeight)
    }
}
