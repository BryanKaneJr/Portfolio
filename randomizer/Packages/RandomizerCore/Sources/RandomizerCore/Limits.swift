import Foundation

/// Input limits. 200 entries x 1,000 weight keeps every total far inside
/// `Int` range; if these grow, re-check the engine's running sums.
public enum Limits {
    public static let maxEntries = 200
    public static let maxWeight = 1_000
    public static let minWeight = 0
    public static let defaultWeight = 1
    public static let maxNameLength = 80
    public static let maxTitleLength = 60
    /// Most winners one tap can draw when repeats are possible.
    public static let maxBatchWithRepeats = 50
}
