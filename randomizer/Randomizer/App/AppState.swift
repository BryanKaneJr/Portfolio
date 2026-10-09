import Foundation
import Observation
import RandomizerCore

/// Holds every saved list and writes the store after each change. Draws go
/// through here so the outcome is saved before any reveal animation starts:
/// a force quit mid-spin finds the result already in history and never
/// draws again.
@Observable
@MainActor
final class AppState {
    private(set) var lists: [DrawList]
    /// Shown once on Home when the store had to recover.
    private(set) var storeNotice: String?
    private(set) var saveFailed = false
    /// Screens to open at launch (UI tests and screenshots only).
    var launchRoutes: [Route] = []

    private let repository: ListRepository?
    @ObservationIgnored private var didSeedSample: Bool

    init(repository: ListRepository?) {
        var loadedLists: [DrawList] = []
        var seeded = false
        var notice: String?
        if let repository {
            let (document, outcome) = repository.load()
            loadedLists = document.lists
            seeded = document.didSeedSample
            switch outcome {
            case .recoveredFromBackup:
                notice = "Your latest save couldn't be read, so Randomizer restored the one before it."
            case .resetAfterUnreadableData:
                notice = "Your saved lists couldn't be read. The damaged file was kept on this iPhone."
            case .fresh, .loaded:
                break
            }
        } else {
            notice = "Randomizer can't save on this device right now. Draws still work."
        }
        let needsSample = !seeded
        if needsSample {
            loadedLists.insert(SampleLists.dinner(), at: 0)
        }
        self.repository = repository
        self.didSeedSample = true
        self.lists = loadedLists
        self.storeNotice = notice
        if needsSample {
            persist()
        }
    }

    static func live() -> AppState {
        if LaunchOptions.isUITesting {
            return UITestSeeds.makeState()
        }
        let repository = (try? ListRepository.defaultDirectory()).map { ListRepository(directory: $0) }
        return AppState(repository: repository)
    }

    // MARK: Reading

    func list(_ id: UUID) -> DrawList? {
        lists.first { $0.id == id }
    }

    var sampleList: DrawList? {
        lists.first(where: \.isSample)
    }

    /// The person's own lists, most recently used first.
    var userLists: [DrawList] {
        lists.filter { !$0.isSample }.sorted { ($0.lastUsedAt ?? $0.updatedAt) > ($1.lastUsedAt ?? $1.updatedAt) }
    }

    // MARK: Changing

    /// Applies a change to one list and saves, unless nothing changed.
    func update(_ id: UUID, _ change: (inout DrawList) throws -> Void) rethrows {
        guard let index = lists.firstIndex(where: { $0.id == id }) else { return }
        var copy = lists[index]
        try change(&copy)
        guard copy != lists[index] else { return }
        lists[index] = copy
        persist()
    }

    @discardableResult
    func createList(title: String = "New list") -> DrawList {
        let list = DrawList(title: title)
        lists.append(list)
        persist()
        return list
    }

    func delete(_ id: UUID) {
        lists.removeAll { $0.id == id }
        persist()
    }

    @discardableResult
    func duplicate(_ id: UUID) -> DrawList? {
        guard let original = list(id) else { return nil }
        let copy = original.duplicated(title: "\(original.title) copy")
        lists.append(copy)
        persist()
        return copy
    }

    /// The sample becomes an ordinary list.
    func keepSample(_ id: UUID) {
        update(id) { $0.isSample = false }
    }

    func dismissStoreNotice() {
        storeNotice = nil
    }

    // MARK: Drawing

    /// Draws, commits and saves in one step, then hands back the outcome
    /// for the reveal. The animation only ever shows this outcome.
    func draw(_ id: UUID, count: Int) throws -> DrawOutcome {
        guard let index = lists.firstIndex(where: { $0.id == id }) else { throw DrawError.noEligibleEntries }
        var copy = lists[index]
        let outcome = try copy.draw(count: count)
        lists[index] = copy
        persist()
        return outcome
    }

    func generateDraftOrder(_ id: UUID) throws -> DrawOutcome {
        guard let index = lists.firstIndex(where: { $0.id == id }) else { throw DrawError.noEligibleEntries }
        var copy = lists[index]
        let outcome = try copy.generateDraftOrder()
        lists[index] = copy
        persist()
        return outcome
    }

    private func persist() {
        guard let repository else { return }
        do {
            try repository.save(StoreDocument(lists: lists, didSeedSample: didSeedSample))
            saveFailed = false
        } catch {
            saveFailed = true
        }
    }
}

enum LaunchOptions {
    static var isUITesting: Bool {
        ProcessInfo.processInfo.arguments.contains("-ui-testing")
    }

    static func environment(_ key: String) -> String? {
        ProcessInfo.processInfo.environment[key]
    }
}

extension DrawError {
    var message: String {
        switch self {
        case .noEligibleEntries:
            return "No entries can be drawn right now."
        case .invalidCount:
            return "Choose at least one winner."
        case .countExceedsPool(let available):
            return "Only \(available) can be drawn at once right now."
        case .uniqueOrderRequiresRemoval:
            return "Turn on Remove after selection to generate a unique draft order."
        case .notEnoughForOrder:
            return "A draft order needs at least two eligible entries."
        case .internalInvariantFailure:
            return "Something went wrong. Nothing was drawn."
        }
    }
}
