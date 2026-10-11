import Foundation
import ShiftTipsCore
import ShiftTipsData

/// Realistic data for the App Store screenshots: a saved crew, a few
/// shifts saved this week, and tonight's shift ready to review. Only UI
/// tests launched with `-ui-testing -store-demo` use it, on throwaway
/// in-memory storage; a real install never sees it.
enum StoreDemo {
    @MainActor
    static func seed(_ store: AppStore, tipOut: Bool) {
        let crew = Crew(name: "Dinner Crew", employees: [
            Employee(name: "Ava", role: "Server"),
            Employee(name: "Marco", role: "Server"),
            Employee(name: "Priya", role: "Bartender"),
            Employee(name: "Jordan", role: "Barback"),
            Employee(name: "Sam", role: "Host"),
            Employee(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner),
        ])
        store.saveCrew(crew)
        store.selectCrew(id: crew.id)
        let today = store.today

        // Earlier shifts, saved: days ago, label, tips, hours in crew order.
        let earlier: [(Int, String, String, [String])] = [
            (3, "Dinner", "538.20", ["7", "6.5", "8", "5.5", "4"]),
            (2, "Dinner", "611.45", ["7.5", "7", "8", "6", "5"]),
            (1, "Dinner", "497.10", ["6.5", "6", "7.5", "5", "4.5"]),
            (0, "Lunch", "214.60", ["4", "4.5", "5", "3", "3.5"]),
        ]
        for (daysAgo, label, tips, hours) in earlier {
            store.form = shift(crew: crew, day: today.adding(days: -daysAgo), label: label, tips: tips, hours: hours)
            _ = store.finishShift()
        }

        if tipOut {
            var form = ShiftForm.example(day: today, mode: .tipOut, method: .hours)
            form.isExample = false
            form.label = "Dinner"
            form.crewName = crew.name
            store.form = form
        } else {
            store.form = shift(crew: crew, day: today, label: "Dinner", tips: "472.38", hours: ["7.5", "6.25", "8", "5", "4.5"])
        }
    }

    private static func shift(crew: Crew, day: CalendarDay, label: String, tips: String, hours: [String]) -> ShiftForm {
        var form = ShiftForm(day: day, label: label, method: .hours, crew: crew)
        form.makeSimple()
        form.tipsText = tips
        for (index, value) in hours.enumerated() where index < form.rows.count {
            form.rows[index].hoursText = value
        }
        return form
    }
}
