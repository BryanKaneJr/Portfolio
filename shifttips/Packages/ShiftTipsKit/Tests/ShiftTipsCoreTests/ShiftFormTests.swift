import Foundation
import Testing
@testable import ShiftTipsCore

@Suite struct ShiftFormTests {
    let ava = Employee(name: "Ava", role: "Server")
    let marco = Employee(name: "Marco", role: "Server", pointsUnits: 1500)
    let lee = Employee(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner)
    let pat = Employee(name: "Pat", eligibility: .notEligible)

    var crew: Crew { Crew(name: "Thursday Dinner", employees: [ava, marco, lee, pat]) }

    @Test func loadingACrewStartsEligiblePeopleIncludedWithEmptyHours() {
        let form = ShiftForm(day: Fixture.day, method: .hours, crew: crew)
        #expect(form.rows.map(\.name) == ["Ava", "Marco", "Lee", "Pat"])
        #expect(form.rows.map(\.included) == [true, true, false, false])
        #expect(form.rows.allSatisfy { $0.hoursText.isEmpty })
        #expect(form.rows[1].pointsText == "1.5")
        #expect(form.crewName == "Thursday Dinner")
    }

    @Test func ineligiblePeopleCantBeSwitchedIn() {
        var form = ShiftForm(day: Fixture.day, method: .equal, crew: crew)
        form.setIncluded(true, rowId: form.rows[2].id)
        form.setIncluded(true, rowId: form.rows[3].id)
        #expect(form.rows[2].included == false)
        #expect(form.rows[3].included == false)
    }

    @Test func readinessWalksThroughWhatsMissing() {
        var form = ShiftForm(day: Fixture.day, method: .hours, crew: crew)
        #expect(form.readiness(form.calculation) == .blocked("Enter the pooled tips"))
        form.tipsText = "4.567"
        #expect(form.readiness(form.calculation) == .blocked("Use at most two decimal places."))
        form.tipsText = "$150"
        #expect(form.readiness(form.calculation) == .blocked("Enter hours for 2 people"))
        form.rows[0].hoursText = "8"
        #expect(form.readiness(form.calculation) == .blocked("Enter hours for Marco"))
        form.rows[1].hoursText = "4x"
        #expect(form.readiness(form.calculation) == .blocked("Check hours for Marco"))
        form.rows[1].hoursText = "4"
        #expect(form.readiness(form.calculation) == .ready)
        #expect(Fixture.cents(form.calculation) == [10000, 5000, 0, 0])
    }

    @Test func liveAmountsShowForPeopleWithHoursWhileOthersAreMissing() {
        var form = ShiftForm(day: Fixture.day, method: .hours, crew: crew)
        form.tipsText = "100"
        form.rows[0].hoursText = "5"
        let calc = form.calculation
        #expect(Fixture.cents(calc) == [10000, 0, 0, 0])
        #expect(calc.allocations[1].status == .needsHours)
        #expect(!form.readiness(calc).isReady)
    }

    @Test func emptyInputsDontCrashOrSaveBogusValues() {
        var form = ShiftForm(day: Fixture.day, method: .weightedHours, crew: crew)
        for text in ["", ".", "0.", "$", "-"] {
            form.tipsText = text
            form.rows[0].hoursText = text
            form.rows[0].pointsText = text
            #expect(!form.readiness(form.calculation).isReady)
        }
    }

    @Test func zeroPointsAreCalledOut() {
        var form = ShiftForm(day: Fixture.day, method: .weightedHours, crew: crew)
        form.tipsText = "100"
        form.rows[0].hoursText = "5"
        form.rows[1].hoursText = "5"
        form.rows[1].pointsText = "0"
        #expect(form.inputIssues.contains(.zeroPoints(form.rows[1].id)))
        #expect(form.readiness(form.calculation) == .blocked("Check points for Marco"))
    }

    @Test func cashAndCardTreatsAnEmptySideAsZero() {
        var form = ShiftForm(day: Fixture.day, method: .equal, crew: crew)
        form.setSplitCashAndCard(true)
        #expect(form.parsedPool() == .failure(.tipsMissing))
        form.cashText = "100.01"
        #expect(form.parsedPool() == .success(.cashAndCard(cash: 10001, card: 0)))
        form.cardText = "50.02"
        #expect(form.draft.pool.totalCents == 15003)
        // Turning the split off keeps the combined amount.
        form.setSplitCashAndCard(false)
        #expect(form.tipsText == "150.03")
    }

    @Test func crewEditsKeepWhatWasTypedForThisShift() {
        var form = ShiftForm(day: Fixture.day, method: .weightedHours, crew: crew)
        form.rows[0].hoursText = "7.5"
        form.rows[1].pointsText = "2" // changed for this shift only
        form.addOneOff(name: " Jo ", role: " ")

        var edited = crew
        edited.employees[0].name = "Ava R."
        edited.employees[1].pointsUnits = 1250
        edited.employees[0].pointsUnits = 1100
        edited.employees.remove(at: 3)
        edited.employees.append(Employee(name: "New"))
        form.apply(crew: edited)

        #expect(form.rows.map(\.name) == ["Ava R.", "Marco", "Lee", "New", "Jo"])
        #expect(form.rows[0].hoursText == "7.5")
        #expect(form.rows[0].pointsText == "1.1") // followed the crew
        #expect(form.rows[1].pointsText == "2") // kept the shift's override
        #expect(form.rows[4].role == nil)
        #expect(form.rows[4].isOneOff)
    }

    @Test func eligibilityChangesFromTheCrewApply() {
        var form = ShiftForm(day: Fixture.day, method: .equal, crew: crew)
        var edited = crew
        edited.employees[0].eligibility = .managerSupervisorOwner
        edited.employees[3].eligibility = .eligible
        form.apply(crew: edited)
        #expect(form.rows[0].included == false)
        #expect(form.rows[3].included == true)
    }

    @Test func nextMissingFieldSkipsWhatsFilled() {
        var form = ShiftForm(day: Fixture.day, method: .hours, crew: crew)
        let ava = form.rows[0].id, marco = form.rows[1].id
        #expect(form.nextMissingField(after: nil) == .tips)
        form.tipsText = "100"
        #expect(form.nextMissingField(after: .tips) == .hours(ava))
        form.rows[0].hoursText = "5"
        #expect(form.nextMissingField(after: .hours(ava)) == .hours(marco))
        form.rows[1].hoursText = "5"
        #expect(form.nextMissingField(after: .hours(marco)) == nil)
        #expect(form.fieldOrder == [.tips, .hours(ava), .hours(marco)])
    }

    @Test func exampleIsAReadyReconciledSplitThatSavesNoCrew() {
        let form = ShiftForm.example(day: Fixture.day, method: .hours)
        let calc = form.calculation
        #expect(form.readiness(calc) == .ready)
        #expect(form.isExample)
        #expect(form.crewId == nil)
        #expect(form.rows.allSatisfy { $0.isOneOff })
        #expect(calc.result.reconciles)
        #expect(calc.result.allocatedCents == 47238)
        // 31h 15m of hours among five; Lee (manager) is out.
        #expect(calc.result.totalWeight == 1875)
        #expect(Fixture.cents(calc) == [11337, 9448, 12093, 7558, 6802, 0])
    }

    @Test func duplicatingAShiftReproducesItsSplitAsANewShift() {
        let original = ShiftForm.example(day: Fixture.day, method: .weightedHours)
        let saved = FinishedShift(id: original.id, finishedAt: Date(timeIntervalSince1970: 0), result: original.calculation.result)
        let copy = ShiftForm.duplicating(saved, day: CalendarDay(year: 2026, month: 10, day: 9))
        #expect(copy.id != original.id)
        #expect(copy.duplicatedFrom == original.id)
        #expect(Fixture.cents(copy.calculation) == Fixture.cents(original.calculation))
        #expect(copy.calculation.draft.participants.map(\.minutesWorked) == original.calculation.draft.participants.map(\.minutesWorked))
    }
}
