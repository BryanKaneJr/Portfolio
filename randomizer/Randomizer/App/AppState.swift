import Foundation
import Observation
import RandomizerCore

/// Holds every saved league and writes the store after each change. The
/// lottery runs through here so the draft order is saved before any reveal
/// plays: a force quit mid-reveal finds the order already saved and never
/// draws again.
@Observable
@MainActor
final class AppState {
    private(set) var leagues: [League]
    /// Shown once on Home when the store had to recover.
    private(set) var storeNotice: String?
    private(set) var saveFailed = false
    /// Screens to open at launch (UI tests and screenshots only).
    var launchRoutes: [Route] = []

    private let repository: LeagueRepository?
    @ObservationIgnored private var didSeedSample: Bool

    init(repository: LeagueRepository?) {
        var loaded: [League] = []
        var seeded = false
        var notice: String?
        if let repository {
            let (document, outcome) = repository.load()
            loaded = document.leagues
            seeded = document.didSeedSample
            switch outcome {
            case .recoveredFromBackup:
                notice = "Your latest save couldn't be read, so the one before it was restored."
            case .resetAfterUnreadableData:
                notice = "Your saved leagues couldn't be read. The damaged file was kept on this iPhone."
            case .fresh, .loaded:
                break
            }
        } else {
            notice = "Leagues can't be saved on this device right now. The lottery still works."
        }
        let needsSample = !seeded
        if needsSample {
            loaded.insert(SampleLeague.make(), at: 0)
        }
        self.repository = repository
        self.didSeedSample = true
        self.leagues = loaded
        self.storeNotice = notice
        if needsSample {
            persist()
        }
    }

    static func live() -> AppState {
        if LaunchOptions.isUITesting {
            return UITestSeeds.makeState()
        }
        let repository = (try? LeagueRepository.defaultDirectory()).map { LeagueRepository(directory: $0) }
        return AppState(repository: repository)
    }

    // MARK: Reading

    func league(_ id: UUID) -> League? {
        leagues.first { $0.id == id }
    }

    /// The sample league, until it's kept or deleted.
    var sampleLeague: League? {
        leagues.first(where: \.isSample)
    }

    /// The person's own leagues, most recently used first.
    var userLeagues: [League] {
        leagues.filter { !$0.isSample }.sorted { ($0.lastUsedAt ?? $0.updatedAt) > ($1.lastUsedAt ?? $1.updatedAt) }
    }

    // MARK: Changing

    /// Applies a change to one league and saves, unless nothing changed.
    func update(_ id: UUID, _ change: (inout League) throws -> Void) rethrows {
        guard let index = leagues.firstIndex(where: { $0.id == id }) else { return }
        var copy = leagues[index]
        try change(&copy)
        guard copy != leagues[index] else { return }
        leagues[index] = copy
        persist()
    }

    nonisolated static let newLeagueTitle = "New league"

    @discardableResult
    func createLeague(title: String = AppState.newLeagueTitle) -> League {
        let league = League(title: title)
        leagues.append(league)
        persist()
        return league
    }

    /// Adds a fully built league (UI test seeds).
    func insert(_ league: League) {
        leagues.append(league)
        persist()
    }

    /// Drops a league made with New League and left without a name or teams.
    func discardIfUntouched(_ id: UUID) {
        guard let league = league(id), league.teams.isEmpty, league.title == Self.newLeagueTitle, league.latestRun == nil else { return }
        delete(id)
    }

    func delete(_ id: UUID) {
        leagues.removeAll { $0.id == id }
        persist()
    }

    @discardableResult
    func duplicate(_ id: UUID) -> League? {
        guard let original = league(id) else { return nil }
        let copy = original.duplicated(title: "\(original.title) copy")
        leagues.append(copy)
        persist()
        return copy
    }

    /// The sample becomes one of the person's own leagues.
    func keepSample(_ id: UUID) {
        update(id) { $0.isSample = false }
    }

    func dismissStoreNotice() {
        storeNotice = nil
    }

    // MARK: The lottery

    /// Runs the lottery, records the order as the latest run and saves, in
    /// one step. Reveals only ever show this saved order.
    @discardableResult
    func runLottery(_ id: UUID) throws -> LotteryRun {
        guard let index = leagues.firstIndex(where: { $0.id == id }) else { throw DrawError.notEnoughTeams }
        var copy = leagues[index]
        let run = try copy.runLottery()
        leagues[index] = copy
        persist()
        return run
    }

    private func persist() {
        guard let repository else { return }
        do {
            try repository.save(StoreDocument(leagues: leagues, didSeedSample: didSeedSample))
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
        case .notEnoughTeams:
            return "Add at least two teams to run the lottery."
        case .noLotteryChances:
            return "Give at least one lottery team a chance above 0."
        case .invalidCount, .countExceedsPool:
            return "Check the lottery format and try again."
        case .internalInvariantFailure:
            return "Something went wrong. Nothing was drawn."
        }
    }
}
