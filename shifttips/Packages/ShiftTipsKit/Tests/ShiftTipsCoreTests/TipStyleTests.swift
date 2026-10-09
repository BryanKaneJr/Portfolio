import Foundation
import Testing
@testable import ShiftTipsCore

@Suite struct TipStyleTests {
    @Test(arguments: TipStyle.allCases)
    func everyStyleStartsValid(style: TipStyle) {
        #expect(style.startingRules().allSatisfy { $0.isValid })
        #expect(style.startingRolePoints.allSatisfy { (Limits.minPointsUnits...Limits.maxPointsUnits).contains($0.pointsUnits) })
        #expect(!style.setupLines.isEmpty)
        #expect(!style.summary.contains("\u{2014}") && !style.soundsLike.contains("\u{2014}"))
        #expect(style.mode == .tipOut ? !style.startingRules().isEmpty : style.startingRules().isEmpty)
    }

    @Test func adoptingAStyleSetsUpTheCrew() {
        var crew = Crew(name: "Floor", employees: [
            Employee(name: "Ava", role: "Server"),
            Employee(name: "Jo", role: "busser"),
            Employee(name: "Pat", role: "Expo"),
        ])
        crew.adopt(.pointsPool)
        #expect(crew.style == .pointsPool)
        #expect(crew.mode == .pool && crew.method == .weightedHours)
        #expect(crew.employees.map(\.pointsUnits) == [1000, 500, 1000]) // Expo has no points yet
        #expect(crew.points(forRole: " BUSSER ") == 500)
        #expect(crew.pointRoles.prefix(3) == ["Server", "busser", "Expo"])

        crew.setPoints(750, forRole: "Expo")
        #expect(crew.employees[2].pointsUnits == 750)
        #expect(crew.points(forRole: "expo") == 750)
        crew.setPoints(400, forRole: "Busser")
        #expect(crew.employees[1].pointsUnits == 400)

        crew.adopt(.tipOutOfSales)
        #expect(crew.mode == .tipOut)
        #expect(crew.tipOutRules.map(\.summary).first == "Server \u{2192} Busser: 2% of sales")
        // Role points are kept for if they switch back.
        #expect(crew.points(forRole: "Busser") == 400)
    }

    @Test func aStyledCrewSplitsAsAdvertised() {
        var crew = Crew(name: "Floor", employees: [Employee(name: "Ava", role: "Server"), Employee(name: "Jo", role: "Busser")])
        crew.adopt(.pointsPool)
        var form = ShiftForm(day: Fixture.day, method: .hours, crew: crew)
        form.useSetup(of: crew)
        form.tipsText = "150"
        form.rows[0].hoursText = "8"
        form.rows[1].hoursText = "8"
        // 8h x 1 and 8h x 0.5: two thirds and one third.
        #expect(Fixture.cents(form.calculation) == [10000, 5000])
    }

    @Test func oldCrewsAndSettingsLoadWithDefaults() throws {
        let crew = try JSONDecoder().decode(Crew.self, from: Data(#"{"id":"7B4E1C42-6A1F-4C55-9E0B-6F8C7F7D4E11","name":"Dinner","employees":[]}"#.utf8))
        #expect(crew.style == nil && crew.mode == .pool && crew.method == .hours && crew.rolePoints.isEmpty)
        let settings = try JSONDecoder().decode(AppSettings.self, from: Data("{}".utf8))
        #expect(settings.experience == .simple)
    }

    @Test func simpleCompatibilityOfSavedShifts() {
        let pool = ShiftForm.example(day: Fixture.day, method: .hours)
        let poolShift = FinishedShift(id: pool.id, finishedAt: Date(), outcome: .pool(pool.calculation.result))
        #expect(poolShift.isSimpleCompatible)
        let points = ShiftForm.example(day: Fixture.day, method: .weightedHours)
        #expect(!FinishedShift(id: points.id, finishedAt: Date(), outcome: .pool(points.calculation.result)).isSimpleCompatible)
        let tipOut = ShiftForm.example(day: Fixture.day, mode: .tipOut, method: .hours)
        #expect(!FinishedShift(id: tipOut.id, finishedAt: Date(), outcome: .tipOut(tipOut.tipOutCalculation.result)).isSimpleCompatible)
    }
}
