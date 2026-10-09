import Foundation
import Testing
import ShiftTipsCore
@testable import ShiftTipsData

@MainActor
@Suite struct AppStoreTests {
    let clock = Date(timeIntervalSince1970: 1_791_500_000.75)

    func makeStore(_ storage: MemoryStorage = MemoryStorage()) -> AppStore {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let now = clock
        return AppStore(storage: storage, now: { now }, calendar: calendar)
    }

    func crew() -> Crew {
        Crew(name: "Dinner", employees: [Employee(name: "Ava", role: "Server"), Employee(name: "Marco"), Employee(name: "Lee", eligibility: .managerSupervisorOwner)])
    }

    func fillHours(_ store: AppStore) {
        store.form.tipsText = "150"
        store.form.rows[0].hoursText = "8"
        store.form.rows[1].hoursText = "4"
    }

    @Test func firstCrewLoadsIntoTheEmptyShift() {
        let store = makeStore()
        #expect(store.form.rows.isEmpty)
        store.saveCrew(crew())
        #expect(store.settings.activeCrewId == store.crews[0].id)
        #expect(store.form.rows.map(\.name) == ["Ava", "Marco", "Lee"])
    }

    @Test func choosingACrewReplacesTheExample() {
        let store = makeStore()
        store.saveCrew(crew())
        store.loadExample()
        #expect(store.form.rows.count == 6)
        store.selectCrew(id: store.crews[0].id)
        #expect(!store.form.isExample)
        #expect(store.form.rows.map(\.name) == ["Ava", "Marco", "Lee"])
        #expect(store.form.tipsText.isEmpty)
    }

    @Test func tipOutRulesLiveOnTheCrewAndShiftsSaveAsTipOuts() {
        let storage = MemoryStorage()
        let store = makeStore(storage)
        store.saveCrew(Crew(name: "Bar", employees: [Employee(name: "Ava", role: "Server"), Employee(name: "Jo", role: "Busser")]))
        store.setMode(.tipOut)
        #expect(store.form.mode == .tipOut)
        let rule = TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 1000)
        store.setTipOutRules([rule])
        #expect(store.crews[0].tipOutRules == [rule])
        #expect(storage.library?.crews[0].tipOutRules == [rule])

        store.form.rows[0].tipsText = "250"
        store.form.rows[1].hoursText = "5"
        guard case .saved(let shift) = store.finishShift() else { Issue.record("not saved"); return }
        #expect(shift.outcome.mode == .tipOut)
        #expect(shift.outcome.tipOut?.people.map(\.netCents) == [22500, 2500])
        #expect(shift.outcome.headlineCents == 2500)

        // The next shift stays in Tip Out with the crew's rules.
        store.startNewShift()
        #expect(store.form.mode == .tipOut)
        #expect(store.form.tipOutRules == [rule])
        #expect(store.form.rows.allSatisfy { $0.tipsText.isEmpty })
    }

    @Test func switchingModeSwapsTheExample() {
        let store = makeStore()
        store.loadExample()
        #expect(store.form.mode == .pool)
        store.setMode(.tipOut)
        #expect(store.form.isExample)
        #expect(store.form.mode == .tipOut)
        #expect(!store.form.tipOutRules.isEmpty)
        #expect(store.form.readiness(store.form.live) == .ready)
    }

    @Test func finishingSavesAFrozenSnapshotOnce() {
        let storage = MemoryStorage()
        let store = makeStore(storage)
        store.saveCrew(crew())
        store.form.method = .hours
        fillHours(store)

        guard case .saved(let shift) = store.finishShift() else {
            Issue.record("Expected the shift to save")
            return
        }
        #expect(shift.outcome.pool?.allocations.map(\.totalCents) == [10000, 5000, 0])
        #expect(shift.finishedAt == Date(timeIntervalSince1970: 1_791_500_000))
        #expect(store.isFormSaved)

        // A rapid second tap can't make a duplicate.
        #expect(store.finishShift() == .alreadySaved(shift))
        #expect(store.library.shifts.count == 1)
        #expect(storage.library?.shifts == [shift])
    }

    @Test func blockedShiftsDontSave() {
        let store = makeStore()
        store.saveCrew(crew())
        store.form.method = .hours
        store.form.tipsText = "150"
        #expect(store.finishShift() == .blocked("Enter hours for 2 people"))
        #expect(store.library.shifts.isEmpty)
    }

    @Test func crewEditsNeverRewriteHistory() {
        let store = makeStore()
        store.saveCrew(crew())
        store.form.method = .weightedHours
        fillHours(store)
        guard case .saved(let saved) = store.finishShift() else { Issue.record("not saved"); return }

        var edited = store.crews[0]
        edited.employees[0].name = "Ava Renamed"
        edited.employees[0].pointsUnits = 3000
        edited.employees[1].eligibility = .notEligible
        store.saveCrew(edited)
        store.deleteCrew(id: edited.id)

        #expect(store.shift(id: saved.id) == saved)
        #expect(store.shift(id: saved.id)?.draft.participants[0].name == "Ava")
    }

    @Test func nextShiftKeepsMethodAndCrewButClearsNumbers() {
        let store = makeStore()
        store.saveCrew(crew())
        store.form.method = .hours
        store.form.setSplitCashAndCard(true)
        store.form.cashText = "100"
        store.form.rows[0].hoursText = "8"
        store.form.rows[1].hoursText = "4"
        _ = store.finishShift()
        let oldId = store.form.id

        store.startNewShift()
        #expect(store.form.id != oldId)
        #expect(store.form.method == .hours)
        #expect(store.form.splitCashAndCard)
        #expect(store.form.rows.map(\.name) == ["Ava", "Marco", "Lee"])
        #expect(store.form.rows.allSatisfy { $0.hoursText.isEmpty })
        #expect(store.form.cashText.isEmpty)
        #expect(store.form.day == CalendarDay(year: 2026, month: 10, day: 8))
    }

    @Test func aNewDayMovesAnUntouchedShiftButNotATypedOne() {
        let storage = MemoryStorage()
        let yesterday = CalendarDay(year: 2026, month: 10, day: 7)
        storage.form = ShiftForm(day: yesterday, method: .equal)
        let store = makeStore(storage)
        store.refreshForToday()
        #expect(store.form.day == CalendarDay(year: 2026, month: 10, day: 8))

        var typed = ShiftForm(day: yesterday, method: .equal)
        typed.tipsText = "10"
        storage.form = typed
        let other = makeStore(storage)
        other.refreshForToday()
        #expect(other.form.day == yesterday)
    }

    @Test func formSurvivesARelaunch() {
        let storage = MemoryStorage()
        let store = makeStore(storage)
        store.saveCrew(crew())
        store.form.tipsText = "47"
        store.form.rows[0].hoursText = "7."

        let relaunched = makeStore(storage)
        #expect(relaunched.form == store.form)
        #expect(relaunched.crews == store.crews)
    }

    @Test func duplicateMakesANewShiftAndLeavesTheOriginal() {
        let store = makeStore()
        store.saveCrew(crew())
        store.form.method = .hours
        fillHours(store)
        guard case .saved(let original) = store.finishShift() else { Issue.record("not saved"); return }

        store.duplicate(original)
        #expect(store.form.duplicatedFrom == original.id)
        #expect(!store.isFormSaved)
        store.form.tipsText = "300"
        guard case .saved(let copy) = store.finishShift() else { Issue.record("copy not saved"); return }
        #expect(copy.duplicatedFrom == original.id)
        #expect(copy.outcome.pool?.allocations.map(\.totalCents) == [20000, 10000, 0])
        #expect(store.shift(id: original.id) == original)
        #expect(store.shiftsNewestFirst.map(\.id) == [copy.id, original.id])
    }

    @Test func malformedImportChangesNothing() throws {
        let store = makeStore()
        store.saveCrew(crew())
        let before = store.library
        #expect(throws: BackupError.notABackup) {
            try store.importBackup(Data("not json".utf8), mode: .replace)
        }
        #expect(store.library == before)
    }

    @Test func importMergesAndReplaces() throws {
        let source = makeStore()
        source.saveCrew(crew())
        source.form.method = .hours
        fillHours(source)
        _ = source.finishShift()
        let data = try source.backupData(appVersion: "1.0")

        let target = makeStore()
        let summary = try target.importBackup(data, mode: .merge)
        #expect(summary.crewsAdded == 1 && summary.shiftsAdded == 1)
        #expect(target.library.shifts == source.library.shifts)

        let again = try target.importBackup(data, mode: .merge)
        #expect(again.crewsAlreadyHere == 1 && again.shiftsAlreadyHere == 1)
        #expect(target.library.shifts.count == 1)

        target.saveCrew(Crew(name: "Lunch"))
        _ = try target.importBackup(data, mode: .replace)
        #expect(target.crews.map(\.name) == ["Dinner"])
    }

    @Test func saveFailuresAreReportedNotSwallowed() {
        let storage = MemoryStorage()
        let store = makeStore(storage)
        storage.failSaves = true
        store.saveCrew(crew())
        #expect(store.storageProblem != nil)
        // The change is still in memory.
        #expect(store.crews.count == 1)
    }

    @Test func deleteAllDataClearsEverything() {
        let storage = MemoryStorage()
        let store = makeStore(storage)
        store.saveCrew(crew())
        store.form.method = .hours
        fillHours(store)
        _ = store.finishShift()
        store.deleteAllData()
        #expect(store.crews.isEmpty)
        #expect(store.library.shifts.isEmpty)
        #expect(store.form.rows.isEmpty)
        #expect(storage.library?.crews.isEmpty == true)
    }

    @Test func fileStorageRoundTripsAndSetsAsideDamagedData() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("shifttips-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let storage = FileStorage(directory: directory)
        let store = makeStore(MemoryStorage())
        store.saveCrew(crew())
        store.form.method = .hours
        fillHours(store)
        _ = store.finishShift()

        try storage.saveLibrary(store.library)
        try storage.saveForm(store.form)
        #expect(try storage.loadLibrary() == store.library)
        #expect(try storage.loadForm() == store.form)

        try Data("{ broken".utf8).write(to: directory.appendingPathComponent("library.json"))
        let recovering = AppStore(storage: storage)
        #expect(recovering.crews.isEmpty)
        #expect(recovering.storageProblem != nil)
        let files = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        #expect(files.contains { $0.hasPrefix("library-unreadable-") })
        #expect(try storage.loadLibrary() == nil)
    }
}
