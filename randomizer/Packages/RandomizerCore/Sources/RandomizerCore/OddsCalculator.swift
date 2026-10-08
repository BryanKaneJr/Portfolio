import Foundation

/// Where an entry stands for the next draw.
public enum EntryStatus: String, Equatable, Sendable {
    /// In the pool with a chance above zero.
    case eligible
    /// Taken out by Remove after selection this session.
    case removed
    /// Weight 0: kept in the list but cannot be drawn. Not the same as removed.
    case excluded
}

/// One line of the odds sheet: weight and chance shown separately.
public struct OddsRow: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    /// 1-based position in the list (the standing in Reverse Standings).
    public let rank: Int
    /// The weight the engine uses in the current odds mode.
    public let weight: Int
    public let status: EntryStatus
    /// Chance numerator (the weight when eligible, otherwise 0).
    public let numerator: Int
    /// Total weight of every eligible entry.
    public let denominator: Int

    public var probability: Double {
        guard denominator > 0 else { return 0 }
        return Double(numerator) / Double(denominator)
    }

    public var chanceText: String {
        OddsCalculator.formatPercent(numerator: numerator, denominator: denominator)
    }
}

public enum OddsCalculator {
    /// Reverse Standings preset: N entries ranked 1 (worst) to N (best)
    /// weigh N, N-1, ... 1.
    public static func reverseStandingsWeights(count: Int) -> [Int] {
        guard count > 0 else { return [] }
        return (1...count).map { count - $0 + 1 }
    }

    public static func rows(for list: DrawList) -> [OddsRow] {
        let total = list.totalEligibleWeight
        return list.entries.enumerated().map { index, entry in
            let weight = list.effectiveWeight(atIndex: index)
            let status = list.status(of: entry.id)
            return OddsRow(
                id: entry.id,
                name: entry.name,
                rank: index + 1,
                weight: weight,
                status: status,
                numerator: status == .eligible ? weight : 0,
                denominator: total
            )
        }
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

public extension DrawList {
    /// The weight the engine uses for the entry at `index` in the current
    /// odds mode, ignoring whether it has been removed.
    func effectiveWeight(atIndex index: Int) -> Int {
        guard entries.indices.contains(index) else { return 0 }
        switch oddsMode {
        case .equal:
            return 1
        case .customWeighted:
            return entries[index].weight
        case .reverseStandings:
            return entries.count - index
        }
    }

    func effectiveWeight(of id: UUID) -> Int {
        guard let index = index(of: id) else { return 0 }
        return effectiveWeight(atIndex: index)
    }

    func status(of id: UUID) -> EntryStatus {
        if removedEntryIDs.contains(id) { return .removed }
        return effectiveWeight(of: id) > 0 ? .eligible : .excluded
    }

    /// Exactly what the next draw will be drawn from, in list order.
    var eligibleCandidates: [DrawCandidate] {
        entries.enumerated().compactMap { index, entry in
            guard !removedEntryIDs.contains(entry.id) else { return nil }
            let weight = effectiveWeight(atIndex: index)
            return weight > 0 ? DrawCandidate(id: entry.id, weight: weight) : nil
        }
    }

    var eligibleCount: Int { eligibleCandidates.count }

    var totalEligibleWeight: Int {
        eligibleCandidates.reduce(0) { $0 + $1.weight }
    }

    /// Entries held out by a weight of 0 (and not also removed).
    var excludedEntries: [DrawEntry] {
        entries.filter { status(of: $0.id) == .excluded }
    }

    /// Chance the entry wins the next single draw. 0 when not eligible.
    func probability(of id: UUID) -> Double {
        guard status(of: id) == .eligible else { return 0 }
        let total = totalEligibleWeight
        guard total > 0 else { return 0 }
        return Double(effectiveWeight(of: id)) / Double(total)
    }

    func chanceText(of id: UUID) -> String {
        guard status(of: id) == .eligible else { return "0%" }
        return OddsCalculator.formatPercent(numerator: effectiveWeight(of: id), denominator: totalEligibleWeight)
    }
}
