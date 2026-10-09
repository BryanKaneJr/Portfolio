import Foundation
import Observation
import ShiftTipsCore

/// The app's single source of truth: the saved library (crews, finished
/// shifts, settings) and the shift being edited. Every change is written to
/// storage straight away.
@MainActor
@Observable
public final class AppStore {
    public enum FinishOutcome: Equatable {
        case saved(FinishedShift)
        /// This exact shift was already saved (a double tap, or the app
        /// was closed on the success screen). Nothing new was created.
        case alreadySaved(FinishedShift)
        case blocked(String)
    }

    public private(set) var library: Library
    /// The New Shift screen. Saved on every change so nothing typed is lost.
    public var form: ShiftForm {
        didSet { if form != oldValue { persistForm() } }
    }
    /// The draft as it was the last time Review was opened, to point out
    /// changes made since.
    public var lastReviewedDraft: ShiftDraft?
    /// A problem saving or loading, for the UI to show until dismissed.
    public var storageProblem: String?

    private let storage: LibraryStorage
    private let now: () -> Date
    private let calendar: Calendar

    public init(storage: LibraryStorage, now: @escaping () -> Date = Date.init, calendar: Calendar = .current) {
        self.storage = storage
        self.now = now
        self.calendar = calendar
        var problem: String?
        let loaded: Library
        do {
            loaded = try storage.loadLibrary() ?? Library()
        } catch {
            loaded = Library()
            problem = "ShiftTips couldn't read its saved data, so it set that file aside and started fresh. If you have a backup, import it from Settings."
        }
        library = loaded
        let today = CalendarDay(now(), calendar: calendar)
        let activeCrew = loaded.crews.first { $0.id == loaded.settings.activeCrewId }
        if let saved = try? storage.loadForm() {
            form = saved
        } else {
            var fresh = ShiftForm(day: today, method: loaded.settings.defaultMethod, crew: activeCrew)
            Self.shape(&fresh, experience: loaded.settings.experience, crew: activeCrew)
            form = fresh
        }
        storageProblem = problem
    }

    /// Simple: one pool by hours. Advanced: the crew's setup, when there is
    /// a crew.
    private static func shape(_ form: inout ShiftForm, experience: Experience, crew: Crew?) {
        switch experience {
        case .simple: form.makeSimple()
        case .advanced: if let crew { form.useSetup(of: crew) }
        }
    }

    private func shapeForm(crew: Crew?) {
        guard !isFormSaved else { return }
        Self.shape(&form, experience: library.settings.experience, crew: crew)
    }

    public var isSimple: Bool { library.settings.experience == .simple }

    /// Switches between Simple and Advanced. The shift on screen follows;
    /// anything typed for Advanced stays in it, unused, and nothing about a
    /// crew's Advanced setup is lost.
    public func setExperience(_ experience: Experience) {
        updateSettings { $0.experience = experience }
        if form.isExample && experience == .simple && form.mode != .pool {
            form = ShiftForm.example(day: today, mode: .pool, method: .hours)
            return
        }
        shapeForm(crew: form.crewId.flatMap(crew(id:)))
    }

    // MARK: - Reading

    public var crews: [Crew] { library.crews }
    public var settings: AppSettings { library.settings }
    public var today: CalendarDay { CalendarDay(now(), calendar: calendar) }

    public var activeCrew: Crew? {
        library.crews.first { $0.id == library.settings.activeCrewId }
    }

    /// Newest shift day first; same-day shifts newest saved first.
    public var shiftsNewestFirst: [FinishedShift] {
        library.shifts.enumerated().sorted { a, b in
            if a.element.day != b.element.day { return a.element.day > b.element.day }
            if a.element.finishedAt != b.element.finishedAt { return a.element.finishedAt > b.element.finishedAt }
            return a.offset > b.offset
        }.map(\.element)
    }

    public func shift(id: UUID) -> FinishedShift? {
        library.shifts.first { $0.id == id }
    }

    public func crew(id: UUID) -> Crew? {
        library.crews.first { $0.id == id }
    }

    /// The shift on screen has already been saved.
    public var isFormSaved: Bool { shift(id: form.id) != nil }

    // MARK: - Settings

    public func updateSettings(_ change: (inout AppSettings) -> Void) {
        var settings = library.settings
        change(&settings)
        guard settings != library.settings else { return }
        library.settings = settings
        persistLibrary()
    }

    // MARK: - Crews

    /// Adds or updates a crew. If it's loaded in the current shift, the shift
    /// picks up the changes and keeps what was typed.
    public func saveCrew(_ crew: Crew) {
        var crew = crew
        crew.name = crew.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if let index = library.crews.firstIndex(where: { $0.id == crew.id }) {
            library.crews[index] = crew
        } else {
            library.crews.append(crew)
        }
        if library.settings.activeCrewId == nil {
            library.settings.activeCrewId = crew.id
        }
        persistLibrary()
        if form.crewId == crew.id {
            form.apply(crew: crew)
            shapeForm(crew: crew)
        } else if form.crewId == nil && !form.isExample && form.rows.isEmpty && library.settings.activeCrewId == crew.id {
            form.apply(crew: crew)
            shapeForm(crew: crew)
        }
    }

    public func deleteCrew(id: UUID) {
        library.crews.removeAll { $0.id == id }
        if library.settings.activeCrewId == id {
            library.settings.activeCrewId = library.crews.first?.id
        }
        persistLibrary()
        if form.crewId == id {
            // Keep what was typed; the people just stop being linked to a crew.
            form.crewId = nil
            form.crewName = nil
        }
    }

    /// Makes `id` the crew new shifts start with and loads it now. The
    /// example's made-up people, or a shift that's already saved, make way
    /// for a fresh shift instead of mixing with the crew.
    public func selectCrew(id: UUID?) {
        updateSettings { $0.activeCrewId = id }
        if form.isExample || isFormSaved {
            startNewShift()
        } else if let id, let crew = crew(id: id) {
            form.apply(crew: crew)
            shapeForm(crew: crew)
        } else {
            form.removeCrew()
        }
    }

    // MARK: - The current shift

    /// A blank shift for today with the active crew, keeping the mode, split
    /// method and cash and card choice from the last one.
    public func startNewShift() {
        let previous = form
        var next = ShiftForm(
            day: today,
            mode: previous.mode,
            method: previous.isExample ? library.settings.defaultMethod : previous.method,
            splitCashAndCard: previous.isExample ? false : previous.splitCashAndCard,
            crew: activeCrew
        )
        if activeCrew == nil && !previous.isExample {
            next.tipOutRules = previous.tipOutRules
        }
        Self.shape(&next, experience: library.settings.experience, crew: activeCrew)
        form = next
        lastReviewedDraft = nil
    }

    /// Switches the shift between Tip Pool and Tip Out. Typed values are
    /// kept for when it's switched back. The example swaps to the other
    /// mode's example.
    public func setMode(_ mode: ShiftMode) {
        guard mode != form.mode, !isFormSaved else { return }
        if form.isExample {
            form = ShiftForm.example(day: today, mode: mode, method: form.method)
        } else {
            form.mode = mode
        }
        lastReviewedDraft = nil
    }

    /// Sets the shift's tip-out rules, and the crew's too when the shift has
    /// one, so the next shift starts with them.
    public func setTipOutRules(_ rules: [TipOutRule]) {
        form.tipOutRules = rules
        if let crewId = form.crewId, let index = library.crews.firstIndex(where: { $0.id == crewId }) {
            library.crews[index].tipOutRules = rules
            persistLibrary()
        }
    }

    /// When the app comes back on a later day: a shift with nothing typed
    /// moves to today, and an already saved one makes way for a new shift.
    public func refreshForToday() {
        guard form.day != today else { return }
        if isFormSaved {
            startNewShift()
        } else if !form.hasEnteredValues {
            form.day = today
        }
    }

    public func loadExample() {
        form = isSimple
            ? ShiftForm.example(day: today, mode: .pool, method: .hours)
            : ShiftForm.example(day: today, mode: form.mode, method: form.method)
        lastReviewedDraft = nil
    }

    /// Starts a new shift copied from a saved one. The saved one never
    /// changes.
    public func duplicate(_ shift: FinishedShift) {
        var copy = ShiftForm.duplicating(shift, day: today)
        // People still on that crew follow its current names and eligibility.
        if let crewId = copy.crewId, let crew = crew(id: crewId) {
            copy.apply(crew: crew)
        }
        form = copy
        lastReviewedDraft = nil
    }

    /// Saves the current shift as a frozen snapshot. Calling it again for the
    /// same shift returns the one already saved instead of making another.
    @discardableResult
    public func finishShift() -> FinishOutcome {
        if let existing = shift(id: form.id) { return .alreadySaved(existing) }
        let live = form.live
        if case .blocked(let reason) = form.readiness(live) { return .blocked(reason) }
        let outcome = live.outcome
        guard outcome.reconciles else { return .blocked("Check the numbers entered") }

        // Whole seconds, so the saved time survives the JSON round trip.
        let finishedAt = Date(timeIntervalSince1970: now().timeIntervalSince1970.rounded(.down))
        let shift = FinishedShift(id: form.id, finishedAt: finishedAt, outcome: outcome, duplicatedFrom: form.duplicatedFrom)
        library.shifts.append(shift)
        persistLibrary()
        return .saved(shift)
    }

    // MARK: - History

    public func deleteShift(id: UUID) {
        library.shifts.removeAll { $0.id == id }
        persistLibrary()
    }

    // MARK: - Backup

    public func backupData(appVersion: String?) throws -> Data {
        try BackupCodec.encode(BackupDocument(library: library, exportedAt: now(), appVersion: appVersion))
    }

    /// Validates the whole file first; if anything is wrong nothing changes.
    public func importBackup(_ data: Data, mode: ImportMode) throws(BackupError) -> ImportSummary {
        let document = try BackupCodec.decode(data)
        switch mode {
        case .merge:
            let (merged, summary) = BackupCodec.merge(document, into: library)
            library = merged
            persistLibrary()
            return summary
        case .replace:
            library = BackupCodec.replacing(with: document, keeping: library)
            persistLibrary()
            var summary = ImportSummary()
            summary.crewsAdded = document.crews.count
            summary.shiftsAdded = document.shifts.count
            startNewShift()
            return summary
        }
    }

    /// Removes every crew, shift and setting from this iPhone.
    public func deleteAllData() {
        do {
            try storage.deleteAll()
        } catch {
            storageProblem = "Some data couldn't be deleted. Try again."
        }
        library = Library()
        library.settings.hasSeenWelcome = true
        persistLibrary()
        form = ShiftForm(day: today, method: library.settings.defaultMethod)
        shapeForm(crew: nil)
        lastReviewedDraft = nil
    }

    // MARK: - Persistence

    private func persistLibrary() {
        do {
            try storage.saveLibrary(library)
        } catch {
            storageProblem = "ShiftTips couldn't save to this iPhone. Free up some storage, then try again. Your changes are kept while the app stays open."
        }
    }

    private func persistForm() {
        do {
            try storage.saveForm(form)
        } catch {
            storageProblem = "ShiftTips couldn't save the shift you're entering. Free up some storage so nothing is lost if the app closes."
        }
    }
}
