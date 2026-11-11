import Foundation

/// Input limits. Lottery weights total at most a few thousand, far inside
/// `Int` range.
public enum Limits {
    /// Teams in a league.
    public static let maxTeams = 32
    public static let minTeams = 2
    public static let maxNameLength = 60
    public static let maxTitleLength = 60
}
