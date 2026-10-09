/// Time worked is always whole minutes in an `Int64`.
public enum Hours {
    /// "7h 30m", "8h", "45m", "0h".
    public static func format(minutes: Int64) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if m == 0 { return "\(h)h" }
        if h == 0 { return "\(m)m" }
        return "\(h)h \(m)m"
    }

    /// "7:30", for CSV cells.
    public static func clock(minutes: Int64) -> String {
        let m = minutes % 60
        return "\(minutes / 60):" + (m < 10 ? "0\(m)" : "\(m)")
    }

    /// For VoiceOver: "7 hours 30 minutes".
    public static func spoken(minutes: Int64) -> String {
        let h = minutes / 60
        let m = minutes % 60
        let hours = h == 1 ? "1 hour" : "\(h) hours"
        let mins = m == 1 ? "1 minute" : "\(m) minutes"
        if m == 0 { return hours }
        if h == 0 { return mins }
        return "\(hours) \(mins)"
    }

    /// Text that parses back to exactly `minutes`, for prefilling a field:
    /// "7.5", "7.25", "8", or "7:20" when decimal hours would be inexact.
    public static func editable(minutes: Int64) -> String {
        let h = minutes / 60
        let m = minutes % 60
        switch m {
        case 0: return "\(h)"
        case 15: return "\(h).25"
        case 30: return "\(h).5"
        case 45: return "\(h).75"
        default:
            // Six-minute steps are exact tenths of an hour.
            if m % 6 == 0 { return "\(h).\(m / 6)" }
            return clock(minutes: minutes)
        }
    }

    /// Parses hours worked. Accepts decimal hours ("7.5", ".25", "8"), clock
    /// style ("7:30") and units ("7h 30m", "7h", "45m", "7 hrs 5 min").
    ///
    /// Decimal hours may have up to two decimals and are rounded to the
    /// nearest whole minute (half a minute rounds up): "7.33" is 7h 20m. The
    /// result is always shown back as "7h 20m", so nothing is hidden.
    public static func parse(_ text: String) -> Result<Int64, HoursInputError> {
        let s = text.trimmingSpaces().lowercased()
        if s.isEmpty { return .failure(.empty) }
        if s.hasPrefix("-") || s.hasPrefix("\u{2212}") { return .failure(.negative) }

        let minutes: Int64
        if s.contains(":") {
            guard let value = parseClock(s) else { return .failure(.invalid) }
            minutes = value
        } else if s.contains(where: \.isLetter) {
            guard let value = parseUnits(s) else { return .failure(.invalid) }
            minutes = value
        } else {
            switch parseDecimalHours(s) {
            case .success(let value): minutes = value
            case .failure(let error): return .failure(error)
            }
        }
        if minutes > Limits.maxMinutes { return .failure(.tooLarge) }
        return .success(minutes)
    }

    private static func parseDecimalHours(_ s: String) -> Result<Int64, HoursInputError> {
        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count <= 2 else { return .failure(.invalid) }
        let whole = parts[0]
        let fraction = parts.count == 2 ? parts[1] : ""
        if whole.isEmpty && fraction.isEmpty { return .failure(.invalid) }
        guard whole.allSatisfy(\.isASCIIDigit), fraction.allSatisfy(\.isASCIIDigit) else {
            return .failure(.invalid)
        }
        if fraction.count > 2 { return .failure(.tooManyDecimals) }
        let significant = whole.drop { $0 == "0" }
        if significant.count > 6 { return .failure(.tooLarge) }
        let h = Int64(significant.isEmpty ? "0" : String(significant))!
        // Hundredths of an hour, then to minutes rounding half up.
        var hundredths: Int64 = 0
        if fraction.count == 1 { hundredths = Int64(String(fraction))! * 10 }
        if fraction.count == 2 { hundredths = Int64(String(fraction))! }
        let m = (hundredths * 60 + 50) / 100
        return .success(h * 60 + m)
    }

    private static func parseClock(_ s: String) -> Int64? {
        let parts = s.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }
        let h = parts[0].trimmingCharacters(), m = parts[1].trimmingCharacters()
        guard !h.isEmpty, h.count <= 6, h.allSatisfy(\.isASCIIDigit) else { return nil }
        guard m.count == 2, m.allSatisfy(\.isASCIIDigit) else { return nil }
        let hours = Int64(h)!, mins = Int64(m)!
        guard mins < 60 else { return nil }
        return hours * 60 + mins
    }

    /// "7h 30m", "7h30m", "7 hrs", "45 min".
    private static func parseUnits(_ s: String) -> Int64? {
        var hours: Int64?
        var mins: Int64?
        var index = s.startIndex
        func skipSpaces() { while index < s.endIndex, s[index] == " " { index = s.index(after: index) } }
        skipSpaces()
        while index < s.endIndex {
            let numberStart = index
            while index < s.endIndex, s[index].isASCIIDigit { index = s.index(after: index) }
            let number = s[numberStart..<index]
            guard !number.isEmpty, number.count <= 6 else { return nil }
            skipSpaces()
            let unitStart = index
            while index < s.endIndex, s[index].isLetter { index = s.index(after: index) }
            let unit = s[unitStart..<index]
            skipSpaces()
            let value = Int64(number)!
            switch unit {
            case "h", "hr", "hrs", "hour", "hours":
                guard hours == nil, mins == nil else { return nil }
                hours = value
            case "m", "min", "mins", "minute", "minutes":
                guard mins == nil, value < 60 || hours == nil else { return nil }
                mins = value
            default:
                return nil
            }
        }
        guard hours != nil || mins != nil else { return nil }
        return (hours ?? 0) * 60 + (mins ?? 0)
    }
}

public enum HoursInputError: Error, Hashable, Sendable {
    case empty
    case invalid
    case negative
    case tooManyDecimals
    case tooLarge

    public var message: String {
        switch self {
        case .empty: "Enter hours worked."
        case .invalid: "Enter hours like 7.5 or 7:30."
        case .negative: "Hours can't be negative."
        case .tooManyDecimals: "Use at most two decimals, or h:mm."
        case .tooLarge: "Hours can be at most \(Limits.maxMinutes / 60)."
        }
    }
}

extension Substring {
    func trimmingCharacters() -> Substring {
        var s = self
        while s.first == " " { s = s.dropFirst() }
        while s.last == " " { s = s.dropLast() }
        return s
    }
}
