import Foundation

/// The three lotteries the app runs. Each is a complete format, so a
/// commissioner picks one and is done.
public enum LotteryType: String, Codable, CaseIterable, Sendable {
    /// The pro basketball format: teams that missed the playoffs are in,
    /// only the top picks are drawn, and the three worst share the best
    /// odds. Everyone else picks by standings.
    case pro
    /// Everyone is in and every pick is drawn. The worst team has the best
    /// odds, and even the champion has a 1% shot at #1.
    case longShot
    /// The draw decides the order in which teams choose their draft slot
    /// (Kentucky Derby style). Every team has the same chance to choose
    /// first.
    case slotDraft

    public var title: String {
        switch self {
        case .pro: return "Pro Lottery"
        case .longShot: return "Long Shot"
        case .slotDraft: return "Slot Draft"
        }
    }

    public var tagline: String {
        switch self {
        case .pro: return "Non-playoff teams draw for the top picks with pro-style odds."
        case .longShot: return "Everyone's in. Even the champ has a 1% shot at #1."
        case .slotDraft: return "Win the draw, then choose your own draft slot."
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
