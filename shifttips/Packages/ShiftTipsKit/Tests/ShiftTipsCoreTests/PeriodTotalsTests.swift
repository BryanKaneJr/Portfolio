import Foundation
import Testing
@testable import ShiftTipsCore

@Suite struct PeriodTotalsTests {
    let ava = UUID(), marco = UUID(), jordan = UUID()

    func day(_ d: Int) -> CalendarDay { CalendarDay(year: 2026, month: 10, day: d) }

    func saved(_ draft: ShiftDraft, at seconds: TimeInterval = 0) -> FinishedShift {
        let outcome: ShiftOutcome = draft.mode == .pool
            ? .pool(PoolCalculator.calculate(draft).result)
            : .tipOut(TipOutCalculator.calculate(draft).result)
        return FinishedShift(id: draft.id, finishedAt: Date(timeIntervalSince1970: 1_791_000_000 + seconds), outcome: outcome)
    }

    func poolShift(on d: Int, cents: Int64, avaName: String = "Ava") -> FinishedShift {
        saved(ShiftDraft(day: day(d), method: .hours, pool: .cashAndCard(cash: cents / 2, card: cents - cents / 2), participants: [
            ShiftParticipant(employeeId: ava, name: avaName, role: "Server", minutesWorked: 360),
            ShiftParticipant(employeeId: marco, name: "Marco", role: "Server", minutesWorked: 120),
            ShiftParticipant(name: "Jo", role: "Runner", minutesWorked: 120),
            ShiftParticipant(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner, minutesWorked: 480),
        ]), at: Double(d))
    }

    func tipOutShift(on d: Int) -> FinishedShift {
        saved(ShiftDraft(day: day(d), mode: .tipOut, method: .hours, pool: .total(0), participants: [
            ShiftParticipant(employeeId: ava, name: "Ava R.", role: "Server", tipsCents: 30_000),
            ShiftParticipant(employeeId: jordan, name: "Jordan", role: "Busser", minutesWorked: 300),
            ShiftParticipant(name: "jo", role: "Busser", minutesWorked: 300),
        ], tipOutRules: [TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 1000)]), at: Double(d))
    }

    @Test func addsUpBothModesByPerson() {
        let shifts = [poolShift(on: 1, cents: 99_999), poolShift(on: 5, cents: 10_000), tipOutShift(on: 6), poolShift(on: 12, cents: 50_000)]
        let summary = PeriodTotals.summarize(shifts, from: day(5), through: day(11))
        #expect(summary.shiftCount == 2)

        let byName = Dictionary(uniqueKeysWithValues: summary.people.map { ($0.name, $0) })
        // Ava: 6h of 10h of $100.00 by hours, then keeps $270 of $300 in tips.
        let a = byName["Ava R."]
        #expect(a?.shiftCount == 2)
        #expect(a?.poolCents == 6000)
        #expect(a?.poolCashCents == 3000 && a?.poolCardCents == 3000)
        #expect(a?.tipsCollectedCents == 30_000)
        #expect(a?.tippedOutCents == 3000)
        #expect(a?.totalCents == 33_000) // 6,000 pool + 27,000 kept
        #expect(byName["Marco"]?.totalCents == 2000)
        #expect(byName["Jordan"]?.receivedCents == 1500)
        // "Jo" and "jo" are the same one-off person, matched by name.
        #expect(byName["jo"]?.isOneOff == true)
        #expect(byName["jo"]?.shiftCount == 2)
        #expect(byName["jo"]?.totalCents == 3_500) // 2,000 pool + 1,500 received
        // The manager never received, so isn't listed.
        #expect(byName["Lee"] == nil)
        #expect(summary.people.map(\.name) == ["Ava R.", "jo", "Jordan", "Marco"])
        // Everything allocated or tipped out in the period is accounted for.
        #expect(summary.poolCents == 10_000)
        #expect(summary.tippedOutCents == 3000)
        #expect(summary.totalCents == 10_000 + 30_000)
    }

    @Test func exportsReadCleanly() {
        let summary = PeriodTotals.summarize([poolShift(on: 5, cents: 10_000), tipOutShift(on: 6)], from: day(5), through: day(11))
        let csv = PeriodTotals.csv(summary).split(separator: "\r\n").map(String.init)
        #expect(csv[0].hasPrefix("Person,Role,One-off,Shifts,"))
        #expect(csv[1] == "Ava R.,Server,No,2,60.00,30.00,30.00,300.00,30.00,0.00,330.00,2026-10-05,2026-10-11")
        let text = PeriodTotals.text(summary)
        #expect(text.contains("Oct 5, 2026 to Oct 11, 2026 \u{00B7} 2 shifts"))
        #expect(text.contains("Ava R. (Server): $330.00 (2 shifts): pool $60.00, tips $300.00, tipped out -$30.00"))
        #expect(text.contains("Marco (Server): $20.00 (1 shift)"))
        #expect(text.contains("Total: $400.00"))
        #expect(!text.contains("\u{2014}"))
    }

    @Test func emptyPeriodsAreEmpty() {
        let summary = PeriodTotals.summarize([poolShift(on: 1, cents: 100)], from: day(5), through: day(11))
        #expect(summary.people.isEmpty)
        #expect(summary.shiftCount == 0)
        #expect(summary.totalCents == 0)
    }

    @Test func presetsCoverPayPeriods() {
        let thursday = CalendarDay(year: 2026, month: 10, day: 8)
        #expect(thursday.weekday == 5)
        // Weeks starting Sunday (US default) and Monday.
        #expect(PeriodPreset.thisWeek.range(today: thursday, firstWeekday: 1) == (day(4), day(10)))
        #expect(PeriodPreset.thisWeek.range(today: thursday, firstWeekday: 2) == (day(5), day(11)))
        #expect(PeriodPreset.lastWeek.range(today: thursday, firstWeekday: 1) == (CalendarDay(year: 2026, month: 9, day: 27), day(3)))
        #expect(PeriodPreset.lastTwoWeeks.range(today: thursday, firstWeekday: 1) == (CalendarDay(year: 2026, month: 9, day: 20), day(3)))
        #expect(PeriodPreset.thisMonth.range(today: thursday, firstWeekday: 1) == (day(1), day(31)))
        #expect(PeriodPreset.lastMonth.range(today: thursday, firstWeekday: 1) == (CalendarDay(year: 2026, month: 9, day: 1), CalendarDay(year: 2026, month: 9, day: 30)))
        let january = CalendarDay(year: 2027, month: 1, day: 3)
        #expect(PeriodPreset.lastMonth.range(today: january, firstWeekday: 1) == (CalendarDay(year: 2026, month: 12, day: 1), CalendarDay(year: 2026, month: 12, day: 31)))
        #expect(CalendarDay(year: 2028, month: 2, day: 10).endOfMonth == CalendarDay(year: 2028, month: 2, day: 29))
        #expect(day(31).adding(days: 1) == CalendarDay(year: 2026, month: 11, day: 1))
    }
}
