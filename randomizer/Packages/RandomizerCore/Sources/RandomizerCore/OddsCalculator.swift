import Foundation

/// Where a team stands for the next lottery.
public enum TeamStatus: String, Equatable, Sendable {
    /// In the lottery with a chance above zero.
    case inLottery
    /// In the lottery's range at a Custom Odds weight of 0: it can't be
    /// drawn, so it picks by standings after the drawn picks.
    case noChance
    /// Finished above the lottery: picks by standings after every
    /// lottery team.
    case notInLottery
}

/// One line of the odds table.
public struct OddsRow: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    /// 1-based finish, worst first.
    public let standing: Int
    /// The weight the engine uses in the current odds mode (0 outside the
    /// lottery).
    public let weight: Int
    public let status: TeamStatus
    /// #1 pick chance numerator (the weight when in the lottery, else 0).
    public let numerator: Int
    /// Total weight of every lottery team.
    public let denominator: Int
    /// Exact chance of landing one of the drawn picks, when the lottery
    /// draws fewer picks than it has teams with a chance. Nil when every
    /// such team is sure of a drawn pick, or the table is too large to
    /// work out exactly.
    public let drawnPickProbability: Double?

    public var probability: Double {
        guard denominator > 0 else { return 0 }
        return Double(numerator) / Double(denominator)
    }

    public var chanceText: String {
        OddsCalculator.formatPercent(numerator: numerator, denominator: denominator)
    }

    public var drawnPickChanceText: String? {
        guard let value = drawnPickProbability else { return nil }
        // Below certainty by construction, so never shown as 100%.
        if value >= 1 { return ">99.99%" }
        return OddsCalculator.formatPercent(value)
    }
}

public enum OddsCalculator {
    /// Weighted by Standings: L lottery teams ranked 1 (worst) to L weigh
    /// L, L-1, ... 1.
    public static func reverseStandingsWeights(count: Int) -> [Int] {
        guard count > 0 else { return [] }
        return (1...count).map { count - $0 + 1 }
    }

    /// Larger lotteries than this many partial draws are not tabulated
    /// exactly (the #1 chance is always exact).
    public static let defaultStateLimit = 60_000

    public static func rows(for league: League) -> [OddsRow] {
        let total = league.totalLotteryWeight
        let weights = league.teams.indices.map { league.effectiveWeight(atIndex: $0) }
        let drawn: [Double]? = league.drawnPicksAreContested
            ? topPickProbabilities(weights: weights, picks: league.drawnPicks)
            : nil
        return league.teams.enumerated().map { index, team in
            let weight = weights[index]
            let status = league.status(atIndex: index)
            return OddsRow(
                id: team.id,
                name: team.name,
                standing: index + 1,
                weight: weight,
                status: status,
                numerator: status == .inLottery ? weight : 0,
                denominator: total,
                drawnPickProbability: status == .inLottery ? drawn?[index] : nil
            )
        }
    }

    /// The exact chance of each team landing one of the first `picks`
    /// draws of a weighted draw without replacement (the same draw
    /// `League.runLottery` makes). Works through every possible sequence of
    /// earlier picks, so it's exact up to floating point. Returns nil when
    /// that's more than `stateLimit` partial draws.
    public static func topPickProbabilities(
        weights: [Int],
        picks: Int,
        stateLimit: Int = defaultStateLimit
    ) -> [Double]? {
        let n = weights.count
        var result = [Double](repeating: 0, count: n)
        let active = weights.indices.filter { weights[$0] > 0 }
        let draws = min(max(picks, 0), active.count)
        guard draws > 0 else { return result }
        if draws == active.count {
            for index in active { result[index] = 1 }
            return result
        }
        guard n <= 63 else { return nil }
        // Partial draws visited: subsets of 0 ..< draws teams.
        var states = 0.0
        var subsets = 1.0
        for k in 0..<draws {
            states += subsets
            subsets = subsets * Double(active.count - k) / Double(k + 1)
        }
        guard states <= Double(stateLimit) else { return nil }

        struct Partial {
            var probability: Double
            var takenWeight: Int
        }
        let total = active.reduce(0) { $0 + weights[$1] }
        var layer: [UInt64: Partial] = [0: Partial(probability: 1, takenWeight: 0)]
        for step in 0..<draws {
            let isLast = step == draws - 1
            var next: [UInt64: Partial] = [:]
            // Sorted so the sums add up in the same order every time: the
            // same league always shows exactly the same numbers.
            for mask in layer.keys.sorted() {
                guard let partial = layer[mask] else { continue }
                let remaining = Double(total - partial.takenWeight)
                for index in active where mask & (UInt64(1) << UInt64(index)) == 0 {
                    let chance = partial.probability * Double(weights[index]) / remaining
                    result[index] += chance
                    guard !isLast else { continue }
                    let key = mask | (UInt64(1) << UInt64(index))
                    next[key, default: Partial(probability: 0, takenWeight: partial.takenWeight + weights[index])].probability += chance
                }
            }
            layer = next
        }
        return result.map { min(max($0, 0), 1) }
    }

    public static func formatPercent(numerator: Int, denominator: Int) -> String {
        guard denominator > 0, numerator > 0 else { return "0%" }
        if numerator >= denominator { return "100%" }
        return formatPercent(Double(numerator) / Double(denominator))
    }

    /// Up to two decimals with trailing zeros dropped (25%, 33.33%). A small
    /// nonzero chance never reads as 0% and a chance below one never reads
    /// as 100%.
    public static func formatPercent(_ probability: Double) -> String {
        guard probability.isFinite, probability > 0 else { return "0%" }
        if probability >= 1 { return "100%" }
        let value = probability * 100
        if value < 0.1 { return "<0.1%" }
        let rounded = (value * 100).rounded() / 100
        if rounded >= 100 { return ">99.99%" }
        var text = String(format: "%.2f", rounded)
        while text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        return text + "%"
    }
}
