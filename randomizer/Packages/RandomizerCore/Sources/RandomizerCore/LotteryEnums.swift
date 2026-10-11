import Foundation

/// How lottery chances are worked out. Independent of how picks are revealed.
public enum OddsMode: String, Codable, CaseIterable, Sendable {
    /// The worst finish gets the most chances: with L lottery teams the
    /// worst weighs L, the next L - 1, down to 1.
    case reverseStandings
    /// Every lottery team has the same chance.
    case equal
    /// Each lottery team has its own relative weight (0 to 1,000).
    case customWeighted

    public var title: String {
        switch self {
        case .reverseStandings: return "Weighted by Standings"
        case .equal: return "Equal Odds"
        case .customWeighted: return "Custom Odds"
        }
    }

    public var shortTitle: String {
        switch self {
        case .reverseStandings: return "Standings"
        case .equal: return "Equal"
        case .customWeighted: return "Custom"
        }
    }
}

/// How a pick that was already drawn is shown. Never affects who gets it.
public enum RevealStyle: String, Codable, CaseIterable, Sendable {
    case lotteryBalls
    case cardFlip

    public var title: String {
        switch self {
        case .lotteryBalls: return "Lottery Balls"
        case .cardFlip: return "Card Flip"
        }
    }
}
