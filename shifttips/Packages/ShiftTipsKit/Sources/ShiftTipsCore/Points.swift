/// Points are fixed-point integers: `Limits.pointsScale` (1000) units are one
/// point, so 1.25 points is 1250 units and 0.001 is the smallest step.
public enum Points {
    /// "1", "1.5", "0.75", "1.125".
    public static func format(units: Int64) -> String {
        let whole = units / Limits.pointsScale
        var fraction = units % Limits.pointsScale
        if fraction == 0 { return "\(whole)" }
        var digits = 3
        while fraction % 10 == 0 { fraction /= 10; digits -= 1 }
        var text = String(fraction)
        while text.count < digits { text = "0" + text }
        return "\(whole).\(text)"
    }

    /// Parses points like "1", "1.5", ".5" or "0.125" (at most three decimals).
    /// Zero is allowed here; whether zero can take part is the engine's call.
    public static func parse(_ text: String) -> Result<Int64, PointsInputError> {
        let s = text.trimmingSpaces()
        if s.isEmpty { return .failure(.empty) }
        if s.hasPrefix("-") || s.hasPrefix("\u{2212}") { return .failure(.negative) }
        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count <= 2 else { return .failure(.invalid) }
        let whole = parts[0]
        let fraction = parts.count == 2 ? parts[1] : ""
        if whole.isEmpty && fraction.isEmpty { return .failure(.invalid) }
        guard whole.allSatisfy(\.isASCIIDigit), fraction.allSatisfy(\.isASCIIDigit) else {
            return .failure(.invalid)
        }
        if fraction.count > 3 { return .failure(.tooManyDecimals) }
        let significant = whole.drop { $0 == "0" }
        if significant.count > 6 { return .failure(.tooLarge) }
        var units = Int64(significant.isEmpty ? "0" : String(significant))! * Limits.pointsScale
        if !fraction.isEmpty {
            var padded = String(fraction)
            while padded.count < 3 { padded += "0" }
            units += Int64(padded)!
        }
        if units > Limits.maxPointsUnits { return .failure(.tooLarge) }
        return .success(units)
    }
}

public enum PointsInputError: Error, Hashable, Sendable {
    case empty
    case invalid
    case negative
    case tooManyDecimals
    case tooLarge

    public var message: String {
        switch self {
        case .empty: "Enter points."
        case .invalid: "Enter points like 1 or 1.5."
        case .negative: "Points can't be negative."
        case .tooManyDecimals: "Use at most three decimal places."
        case .tooLarge: "Points can be at most \(Limits.maxPointsUnits / Limits.pointsScale)."
        }
    }
}
