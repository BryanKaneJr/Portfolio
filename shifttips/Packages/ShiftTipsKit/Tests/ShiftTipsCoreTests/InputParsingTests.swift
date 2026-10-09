import Testing
@testable import ShiftTipsCore

@Suite struct MoneyTests {
    @Test(arguments: [
        ("$472.38", 47238), ("472.38", 47238), ("472", 47200), ("  472  ", 47200),
        ("472.", 47200), ("472.3", 47230), (".5", 50), ("0.", 0), ("0", 0), ("$0.07", 7),
        ("1,234.56", 123_456), ("$ 12", 1200), ("$1,000,000", nil), ("999,999.99", 99_999_999),
        ("007.10", 710),
    ] as [(String, Int64?)])
    func parsesSensibleInput(text: String, cents: Int64?) {
        if let cents {
            #expect(Money.parse(text) == .success(cents))
        } else {
            #expect(Money.parse(text) == .failure(.tooLarge))
        }
    }

    @Test(arguments: [
        ("", MoneyInputError.empty), ("   ", .empty), (".", .invalid), ("$", .invalid),
        ("-5", .negative), ("$-5", .negative), ("\u{2212}5", .negative), ("4.567", .tooManyDecimals),
        ("12a", .invalid), ("1.2.3", .invalid), ("1,23", .invalid), ("12,3456", .invalid),
        (",123", .invalid), ("1e5", .invalid), ("\u{0661}\u{0662}", .invalid),
        ("99999999999999999999999", .tooLarge), ("1000000.00", .tooLarge),
    ])
    func rejectsBadInput(text: String, error: MoneyInputError) {
        #expect(Money.parse(text) == .failure(error))
    }

    @Test func formats() {
        #expect(Money.format(0) == "$0.00")
        #expect(Money.format(7) == "$0.07")
        #expect(Money.format(47238) == "$472.38")
        #expect(Money.format(123_456_789) == "$1,234,567.89")
        #expect(Money.format(-150) == "-$1.50")
        #expect(Money.plain(123_456_789) == "1234567.89")
        #expect(Money.editable(47200) == "472")
        #expect(Money.editable(47230) == "472.3")
        #expect(Money.editable(47238) == "472.38")
        #expect(Money.spoken(10201) == "102 dollars and 1 cent")
    }

    @Test func formatAndParseRoundTrip() {
        var rng = SplitMix64(seed: 7)
        for _ in 0..<2000 {
            let cents = Int64.random(in: 0...Limits.maxPoolCents, using: &rng)
            #expect(Money.parse(Money.format(cents)) == .success(cents))
            #expect(Money.parse(Money.editable(cents)) == .success(cents))
        }
    }
}

@Suite struct HoursTests {
    @Test(arguments: [
        ("7.5", 450), ("7", 420), (".25", 15), ("7.25", 435), ("7.33", 440), ("7.67", 460),
        ("0.01", 1), ("7:30", 450), ("0:05", 5), ("7h 30m", 450), ("7h30m", 450), ("7 hrs", 420),
        ("45m", 45), ("90 min", 90), ("8H", 480), ("1000", 60_000), ("0", 0),
    ] as [(String, Int64)])
    func parses(text: String, minutes: Int64) {
        #expect(Hours.parse(text) == .success(minutes))
    }

    @Test(arguments: [
        ("", HoursInputError.empty), (".", .invalid), ("-1", .negative), ("7.333", .tooManyDecimals),
        ("7:5", .invalid), ("7:60", .invalid), ("7h 90m", .invalid), ("7x", .invalid), ("1000.5", .tooLarge),
        ("h", .invalid), ("7h 7h", .invalid),
    ])
    func rejects(text: String, error: HoursInputError) {
        #expect(Hours.parse(text) == .failure(error))
    }

    @Test func formats() {
        #expect(Hours.format(minutes: 450) == "7h 30m")
        #expect(Hours.format(minutes: 480) == "8h")
        #expect(Hours.format(minutes: 45) == "45m")
        #expect(Hours.format(minutes: 0) == "0h")
        #expect(Hours.clock(minutes: 425) == "7:05")
        #expect(Hours.spoken(minutes: 61) == "1 hour 1 minute")
    }

    @Test func editableTextParsesBackExactly() {
        for minutes in Int64(0)...Int64(24 * 60) {
            #expect(Hours.parse(Hours.editable(minutes: minutes)) == .success(minutes))
        }
        #expect(Hours.editable(minutes: 450) == "7.5")
        #expect(Hours.editable(minutes: 440) == "7:20")
    }
}

@Suite struct PointsTests {
    @Test(arguments: [("1", 1000), ("1.5", 1500), (".5", 500), ("0.125", 125), ("100", 100_000), ("0", 0)] as [(String, Int64)])
    func parses(text: String, units: Int64) {
        #expect(Points.parse(text) == .success(units))
    }

    @Test(arguments: [("", PointsInputError.empty), ("-1", .negative), ("1.2345", .tooManyDecimals), ("100.001", .tooLarge), ("one", .invalid)])
    func rejects(text: String, error: PointsInputError) {
        #expect(Points.parse(text) == .failure(error))
    }

    @Test func formatsWithoutTrailingZeros() {
        #expect(Points.format(units: 1000) == "1")
        #expect(Points.format(units: 1500) == "1.5")
        #expect(Points.format(units: 1250) == "1.25")
        #expect(Points.format(units: 1) == "0.001")
        for units in Int64(0)...Int64(5000) {
            #expect(Points.parse(Points.format(units: units)) == .success(units))
        }
    }
}

@Suite struct CalendarDayTests {
    @Test func encodesAsIsoAndFormatsTheSameEverywhere() throws {
        let day = CalendarDay(year: 2026, month: 10, day: 8)
        #expect(day.isoString == "2026-10-08")
        #expect(day.mediumText == "Thu, Oct 8, 2026")
        #expect(day.monthText == "October 2026")
        #expect(CalendarDay(isoString: "2026-10-08") == day)
        #expect(CalendarDay(isoString: "2026-02-30") == nil)
        #expect(CalendarDay(isoString: "26-10-08") == nil)
    }
}
