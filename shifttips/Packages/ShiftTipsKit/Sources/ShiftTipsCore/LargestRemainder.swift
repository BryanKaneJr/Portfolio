/// Exact proportional division of whole cents (the largest remainder, or
/// Hamilton, method).
///
/// For a pool of `P` cents and non-negative integer weights `w[i]` with total
/// `W > 0`, each entry's exact entitlement is `P * w[i] / W`. Everyone first
/// gets the floor of it. The few cents left over (always fewer than the
/// number of entries) go one each to the entries with the largest remainders
/// `P * w[i] % W`. Equal remainders go to the earlier entry, so callers pass
/// entries in frozen display order. The shares always add up to exactly `P`.
///
/// Overflow: `P * w[i]` is computed at full 128-bit width
/// (`multipliedFullWidth`) and divided back down with `dividingFullWidth`.
/// The quotient is at most `P` because `w[i] <= W`, so it always fits. The
/// only sum that could overflow, `W`, is checked. No input can overflow
/// silently.
public enum LargestRemainder {
    public struct Share: Hashable, Sendable {
        /// Final cents for this entry.
        public let cents: Int64
        /// `floor(P * w / W)`, before any leftover cent.
        public let floorCents: Int64
        /// `P * w % W`: how far past the floor the exact share is, in units
        /// of `1/W` cent.
        public let remainder: Int64
        /// 1 when this entry received a leftover cent, else 0.
        public var roundingCents: Int64 { cents - floorCents }
    }

    public enum Failure: Error, Hashable, Sendable {
        case negativePool
        case negativeWeight
        /// Every weight is zero but there is money to divide.
        case zeroTotalWeight
        /// The weights add up to more than `Int64.max`.
        case weightOverflow
    }

    public static func allocate(pool: Int64, weights: [Int64]) throws(Failure) -> [Share] {
        guard pool >= 0 else { throw .negativePool }
        let total = try totalWeight(weights)
        if total == 0 {
            guard pool == 0 else { throw .zeroTotalWeight }
            return weights.map { _ in Share(cents: 0, floorCents: 0, remainder: 0) }
        }

        var floors: [Int64] = []
        var remainders: [Int64] = []
        floors.reserveCapacity(weights.count)
        remainders.reserveCapacity(weights.count)
        for weight in weights {
            let (q, r) = divide(pool, times: weight, by: total)
            floors.append(q)
            remainders.append(r)
        }

        let leftover = pool - floors.reduce(0, +)
        let order = weights.indices.sorted { a, b in
            remainders[a] != remainders[b] ? remainders[a] > remainders[b] : a < b
        }
        var cents = floors
        for index in order.prefix(Int(leftover)) {
            cents[index] += 1
        }

        let shares = weights.indices.map { Share(cents: cents[$0], floorCents: floors[$0], remainder: remainders[$0]) }
        precondition(shares.reduce(0) { $0 + $1.cents } == pool, "Largest remainder must reconcile exactly")
        return shares
    }

    public static func totalWeight(_ weights: [Int64]) throws(Failure) -> Int64 {
        var total: Int64 = 0
        for weight in weights {
            guard weight >= 0 else { throw .negativeWeight }
            let (sum, overflow) = total.addingReportingOverflow(weight)
            guard !overflow else { throw .weightOverflow }
            total = sum
        }
        return total
    }

    /// `(a * b / c, a * b % c)` for non-negative `a`, `b` and positive `c`
    /// with `b <= c`, computed without overflow.
    static func divide(_ a: Int64, times b: Int64, by c: Int64) -> (quotient: Int64, remainder: Int64) {
        let product = UInt64(a).multipliedFullWidth(by: UInt64(b))
        let (q, r) = UInt64(c).dividingFullWidth(product)
        return (Int64(q), Int64(r))
    }
}
