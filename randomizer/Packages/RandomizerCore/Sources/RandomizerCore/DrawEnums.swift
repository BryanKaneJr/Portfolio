import Foundation

/// How chances are worked out. Independent of how a result is revealed.
public enum OddsMode: String, Codable, CaseIterable, Sendable {
    /// Every eligible entry has the same chance.
    case equal
    /// Each entry has its own relative weight (0 to 1,000).
    case customWeighted
    /// Entries are ranked worst to best; weight = N - rank + 1.
    case reverseStandings

    public var title: String {
        switch self {
        case .equal: return "Equal Odds"
        case .customWeighted: return "Weighted"
        case .reverseStandings: return "Reverse Standings"
        }
    }

    public var shortTitle: String {
        switch self {
        case .equal: return "Equal"
        case .customWeighted: return "Weighted"
        case .reverseStandings: return "Standings"
        }
    }
}

/// How an already chosen result is shown. Never affects who wins.
public enum RevealStyle: String, Codable, CaseIterable, Sendable {
    case wheel
    case reel
    case lotteryBalls
    case mysteryCard

    public var title: String {
        switch self {
        case .wheel: return "Spin Wheel"
        case .reel: return "Name Reel"
        case .lotteryBalls: return "Lottery Balls"
        case .mysteryCard: return "Mystery Reveal"
        }
    }
}

/// What kind of tap produced a result.
public enum DrawKind: String, Codable, Sendable {
    /// One winner.
    case single
    /// Several winners from one tap ("Draw 3").
    case batch
    /// A complete unique order of everyone eligible.
    case draftOrder
}
