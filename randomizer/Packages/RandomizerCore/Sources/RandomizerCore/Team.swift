import Foundation

/// One team. Identity is the UUID, never the name: two teams called
/// "Sharks" are two different teams with their own chances.
///
/// A team's position in `League.teams` is its finish (first = worst), so
/// there is no separate rank field to drift out of step with the screen.
public struct Team: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    public var name: String

    public init(id: UUID = UUID(), name: String) {
        self.id = id
        self.name = name
    }
}
