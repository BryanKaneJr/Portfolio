import XCTest
@testable import RandomizerCore

final class PersistenceTests: XCTestCase {
    private var directory: URL!
    private var repository: LeagueRepository!

    override func setUp() {
        super.setUp()
        directory = Fixtures.temporaryDirectory()
        repository = LeagueRepository(directory: directory)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    private func files() -> [String] {
        ((try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []).sorted()
    }

    func testMissingFileStartsFresh() {
        let (document, outcome) = repository.load()
        XCTAssertEqual(outcome, .fresh)
        XCTAssertTrue(document.leagues.isEmpty)
        XCTAssertFalse(document.didSeedSample)
        XCTAssertEqual(document.schemaVersion, StoreDocument.currentSchemaVersion)
    }

    /// Closing the app mid-reveal keeps the run, its number and how much of
    /// it was shown.
    func testReopeningRestoresTheRunAndRevealProgress() throws {
        var rng = SeededGenerator(seed: 21)
        var league = Fixtures.league(Fixtures.teams(12), lotteryTeams: 8, drawnPicks: 4)
        league.setRevealStyle(.cardFlip)
        league.setType(.pro)
        try league.runLottery(now: Fixtures.now, using: &rng)
        try league.runLottery(now: Fixtures.now, using: &rng)
        league.revealNextPick(now: Fixtures.now)
        league.revealNextPick(now: Fixtures.now)
        let document = StoreDocument(leagues: [league], didSeedSample: true)

        try repository.save(document)
        let (reloaded, outcome) = LeagueRepository(directory: directory).load()
        XCTAssertEqual(outcome, .loaded)
        XCTAssertEqual(reloaded, document)
        let restored = reloaded.leagues[0]
        XCTAssertEqual(restored.latestRun?.number, 2)
        XCTAssertEqual(restored.latestRun?.revealedCount, 2)
        XCTAssertEqual(restored.runCount, 2)
        XCTAssertEqual(restored.lotteryTeams, 8)
        XCTAssertEqual(restored.drawnPicks, 4)
        XCTAssertEqual(restored.revealStyle, .cardFlip)
    }

    func testEachSaveKeepsThePreviousOneAsBackup() throws {
        let first = StoreDocument(leagues: [Fixtures.league(["A", "B"])], didSeedSample: true)
        var second = first
        second.leagues.append(Fixtures.league(["C", "D"]))
        try repository.save(first)
        XCTAssertFalse(FileManager.default.fileExists(atPath: repository.backupURL.path))
        try repository.save(second)
        let backup = try LeagueRepository.decode(Data(contentsOf: repository.backupURL))
        XCTAssertEqual(backup, first)
        XCTAssertEqual(repository.load().document, second)
    }

    /// An interrupted or damaged write must never lose everything: the
    /// unreadable file is set aside and the previous save is used.
    func testUnreadableStoreRecoversFromBackup() throws {
        let first = StoreDocument(leagues: [Fixtures.league(["A", "B"])], didSeedSample: true)
        var second = first
        second.leagues[0].title = "Second"
        try repository.save(first)
        try repository.save(second)
        // Simulate a torn write.
        let full = try Data(contentsOf: repository.storeURL)
        try full.prefix(full.count / 2).write(to: repository.storeURL)

        let (document, outcome) = LeagueRepository(directory: directory).load()
        XCTAssertEqual(outcome, .recoveredFromBackup)
        XCTAssertEqual(document, first)
        XCTAssertTrue(files().contains { $0.contains(".unreadable-") }, "The damaged file is kept, not deleted")
        XCTAssertFalse(FileManager.default.fileExists(atPath: repository.storeURL.path))

        // The next save works and doesn't copy the damaged file over the backup.
        try repository.save(document)
        XCTAssertEqual(repository.load().outcome, .loaded)
        XCTAssertEqual(try LeagueRepository.decode(Data(contentsOf: repository.backupURL)), first)
    }

    func testNothingReadableStartsEmptyAndKeepsTheFiles() throws {
        try Data("{not json".utf8).write(to: repository.storeURL)
        try Data("also broken".utf8).write(to: repository.backupURL)
        let (document, outcome) = repository.load()
        XCTAssertEqual(outcome, .resetAfterUnreadableData)
        XCTAssertTrue(document.leagues.isEmpty)
        XCTAssertEqual(files().filter { $0.contains(".unreadable-") }.count, 2)
    }

    func testFutureSchemaVersionIsNotMisread() throws {
        let future = #"{"schemaVersion": 99, "leagues": [], "didSeedSample": true}"#
        try Data(future.utf8).write(to: repository.storeURL)
        XCTAssertEqual(repository.load().outcome, .resetAfterUnreadableData)
    }

    func testFilesWithMissingFieldsStillLoad() throws {
        let id = UUID()
        let teamID = UUID()
        let minimal = """
        {"schemaVersion": 1, "leagues": [{"id": "\(id.uuidString)", "title": "Old",
          "teams": [{"id": "\(teamID.uuidString)", "name": "Only", "weight": 4}],
          "oddsMode": "customWeighted", "revealStyle": "someFutureStyle", "type": "someFutureType"}]}
        """
        try Data(minimal.utf8).write(to: repository.storeURL)
        let (document, outcome) = repository.load()
        XCTAssertEqual(outcome, .loaded)
        let league = document.leagues[0]
        XCTAssertEqual(league.id, id)
        XCTAssertEqual(league.type, .pro, "An unknown type falls back instead of failing the load")
        XCTAssertEqual(league.revealStyle, .lotteryBalls)
        XCTAssertNil(league.lotteryTeamCount)
        XCTAssertNil(league.latestRun)
        XCTAssertEqual(league.runCount, 0)
        XCTAssertEqual(league.teams.first?.name, "Only")
        XCTAssertTrue(document.didSeedSample, "An existing store never gets the sample re-added")
    }

    func testSlotDraftChoicesSurviveReopening() throws {
        var rng = SeededGenerator(seed: 23)
        var league = Fixtures.league(Fixtures.teams(6), type: .slotDraft)
        try league.runLottery(now: Fixtures.now, using: &rng)
        league.revealAllPicks(now: Fixtures.now)
        league.chooseSlot(6, now: Fixtures.now)
        league.chooseSlot(1, now: Fixtures.now)
        try repository.save(StoreDocument(leagues: [league], didSeedSample: true))
        let restored = LeagueRepository(directory: directory).load().document.leagues[0]
        XCTAssertEqual(restored.latestRun?.slotChoices, [6, 1])
        XCTAssertEqual(restored.latestRun?.nextChooser, league.latestRun?.picks[2])
    }

    func testThirtyTwoTeamLeagueRoundTripsExactly() throws {
        var league = Fixtures.league(Fixtures.teams(32), lotteryTeams: 16, drawnPicks: 4)
        league.moveTeams(fromOffsets: IndexSet(integer: 31), toOffset: 0)
        var rng = SeededGenerator(seed: 22)
        try league.runLottery(now: Fixtures.now, using: &rng)
        try repository.save(StoreDocument(leagues: [league], didSeedSample: true))
        XCTAssertEqual(LeagueRepository(directory: directory).load().document.leagues, [league])
    }
}
