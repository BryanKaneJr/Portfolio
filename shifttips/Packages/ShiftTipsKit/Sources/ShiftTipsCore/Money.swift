/// Money is always whole US cents in an `Int64`. Nothing here touches
/// `Double`, `Float` or `Decimal`: parsing and formatting are digit by digit.
public enum Money {
    /// "$1,234.56". Negative values (never produced by the engine) get a
    /// leading minus so a bug can't hide behind a positive-looking string.
    public static func format(_ cents: Int64) -> String {
        let negative = cents < 0
        let magnitude = cents.magnitude
        let dollars = magnitude / 100
        let remainder = magnitude % 100
        let body = "$" + groupThousands(String(dollars)) + "." + twoDigits(remainder)
        return negative ? "-" + body : body
    }

    /// "1234.56": no symbol or grouping, for CSV cells and editable fields.
    public static func plain(_ cents: Int64) -> String {
        let negative = cents < 0
        let magnitude = cents.magnitude
        let body = String(magnitude / 100) + "." + twoDigits(magnitude % 100)
        return negative ? "-" + body : body
    }

    /// The shortest text that parses back to `cents`, for prefilling a
    /// field: "472", "472.5", "472.38".
    public static func editable(_ cents: Int64) -> String {
        let magnitude = cents.magnitude
        let dollars = String(magnitude / 100)
        let fraction = magnitude % 100
        if fraction == 0 { return dollars }
        if fraction % 10 == 0 { return dollars + "." + String(fraction / 10) }
        return dollars + "." + twoDigits(fraction)
    }

    /// For VoiceOver: "472 dollars and 38 cents".
    public static func spoken(_ cents: Int64) -> String {
        let magnitude = cents.magnitude
        let dollars = magnitude / 100
        let fraction = magnitude % 100
        let dollarWord = dollars == 1 ? "dollar" : "dollars"
        let centWord = fraction == 1 ? "cent" : "cents"
        let sign = cents < 0 ? "minus " : ""
        if fraction == 0 { return "\(sign)\(dollars) \(dollarWord)" }
        return "\(sign)\(dollars) \(dollarWord) and \(fraction) \(centWord)"
    }

    /// Parses what a person types into a money field. Accepts "$472.38",
    /// "472.38", "472", "472.", ".5", "1,234.56" and surrounding spaces.
    /// Rejects negatives, more than two decimals, misplaced commas, other
    /// text, and anything above `maximum`.
    public static func parse(_ text: String, maximum: Int64 = Limits.maxPoolCents) -> Result<Int64, MoneyInputError> {
        var s = Substring(text.trimmingSpaces())
        if s.isEmpty { return .failure(.empty) }
        if s.first == "-" || s.first == "\u{2212}" { return .failure(.negative) }
        if s.first == "$" {
            s = s.dropFirst()
            while s.first == " " { s = s.dropFirst() }
            if s.first == "-" || s.first == "\u{2212}" { return .failure(.negative) }
        }
        if s.isEmpty { return .failure(.invalid) }

        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count <= 2 else { return .failure(.invalid) }
        let integerPart = parts[0]
        let fractionPart = parts.count == 2 ? parts[1] : ""
        if integerPart.isEmpty && fractionPart.isEmpty { return .failure(.invalid) }

        guard let integerDigits = digitsRemovingGrouping(integerPart) else { return .failure(.invalid) }
        guard fractionPart.allSatisfy(\.isASCIIDigit) else { return .failure(.invalid) }
        if fractionPart.count > 2 { return .failure(.tooManyDecimals) }

        // Strip leading zeros, then refuse anything longer than the bound
        // could ever be before converting, so the conversion can't overflow.
        let significant = integerDigits.drop { $0 == "0" }
        if significant.count > 15 { return .failure(.tooLarge) }
        let dollars = Int64(significant.isEmpty ? "0" : String(significant))!
        var cents = dollars * 100
        if fractionPart.count == 1 { cents += Int64(String(fractionPart))! * 10 }
        if fractionPart.count == 2 { cents += Int64(String(fractionPart))! }
        if cents > maximum { return .failure(.tooLarge) }
        return .success(cents)
    }

    /// The integer digits with any valid thousands separators removed, or nil
    /// when the text has non-digits or commas in the wrong places.
    private static func digitsRemovingGrouping(_ text: Substring) -> Substring? {
        if !text.contains(",") {
            return text.allSatisfy(\.isASCIIDigit) ? text : nil
        }
        let groups = text.split(separator: ",", omittingEmptySubsequences: false)
        guard let first = groups.first, (1...3).contains(first.count) else { return nil }
        for group in groups.dropFirst() where group.count != 3 { return nil }
        guard groups.allSatisfy({ $0.allSatisfy(\.isASCIIDigit) }) else { return nil }
        return Substring(groups.joined())
    }

    static func groupThousands(_ digits: String) -> String {
        var result = ""
        for (offset, character) in digits.enumerated() {
            if offset > 0 && (digits.count - offset) % 3 == 0 { result.append(",") }
            result.append(character)
        }
        return result
    }

    static func twoDigits(_ value: UInt64) -> String {
        value < 10 ? "0" + String(value) : String(value)
    }
}

public enum MoneyInputError: Error, Hashable, Sendable {
    case empty
    case invalid
    case negative
    case tooManyDecimals
    case tooLarge

    public var message: String {
        switch self {
        case .empty: "Enter an amount."
        case .invalid: "Enter an amount like 472.38."
        case .negative: "Amounts can't be negative."
        case .tooManyDecimals: "Use at most two decimal places."
        case .tooLarge: "That's more than \(Money.format(Limits.maxPoolCents))."
        }
    }
}

extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}

extension String {
    /// Trims spaces, tabs and newlines without pulling in locale-aware APIs.
    func trimmingSpaces() -> String {
        let isSpace: (Character) -> Bool = { $0.isWhitespace }
        guard let start = firstIndex(where: { !isSpace($0) }) else { return "" }
        let end = lastIndex(where: { !isSpace($0) })!
        return String(self[start...end])
    }
}
