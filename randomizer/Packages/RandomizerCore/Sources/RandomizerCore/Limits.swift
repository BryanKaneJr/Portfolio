import Foundation

/// Input limits. 32 teams x 1,000 weight keeps every total far inside
/// `Int` range; if these grow, re-check the engine's running sums.
public enum Limits {
    /// Teams in a league.
    public static let maxTeams = 32
    public static let minTeams = 2
    public static let maxWeight = 1_000
    public static let minWeight = 0
    public static let defaultWeight = 1
    public static let maxNameLength = 60
    public static let maxTitleLength = 60
}
