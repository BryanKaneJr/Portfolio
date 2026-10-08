import XCTest
@testable import RandomizerCore

final class PersistenceTests: XCTestCase {
    private var directory: URL!
    private var repository: ListRepository!

    override func setUp() {
        super.setUp()
        directory = Fixtures.temporaryDirectory()
        repository = ListRepository(directory: directory)
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
        XCTAssertTrue(document.lists.isEmpty)
        XCTAssertFalse(document.didSeedSample)
        XCTAssertEqual(document.schemaVersion, StoreDocument.currentSchemaVersion)
    }

    /// Toggle test 8: close and reopen keeps the toggle, pool and results.
    func testToggle8_ReopeningRestoresToggleActivePoolAndResults() throws {
        var rng = SeededGenerator(seed: 21)
        var list = Fixtures.list((1...20).map { "Player \($0)" }, weights: Array(1...20), mode: .customWeighted)
        list.setRevealStyle(.reel)
        _ = try list.draw(count: 3, now: Fixtures.now, using: &rng)
        list.setRemoveAfterSelection(false)
        _ = try list.draw(now: Fixtures.now, using: &rng)
        list.undoLastDraw(now: Fixtures.now)
        _ = try list.draw(now: Fixtures.now, using: &rng)
        let document = StoreDocument(lists: [list], didSeedSample: true)

        try repository.save(document)
        let (reloaded, outcome) = ListRepository(directory: directory).load()
        XCTAssertEqual(outcome, .loaded)
        XCTAssertEqual(reloaded, document)
        let restored = reloaded.lists[0]
        XCTAssertFalse(restored.removeAfterSelection)
        XCTAssertEqual(restored.removedEntryIDs, list.removedEntryIDs)
        XCTAssertEqual(restored.eligibleCandidates, list.eligibleCandidates)
        XCTAssertEqual(restored.activeResults, list.activeResults)
        XCTAssertTrue(restored.sessionEdited)
        XCTAssertEqual(restored.revealStyle, .reel)
        XCTAssertEqual(restored.entries, list.entries)
    }

    func testEachSaveKeepsThePreviousOneAsBackup() throws {
        let first = StoreDocument(lists: [Fixtures.list(["A", "B"])], didSeedSample: true)
        var second = first
        second.lists.append(Fixtures.list(["C", "D"]))
        try repository.save(first)
        XCTAssertFalse(FileManager.default.fileExists(atPath: repository.backupURL.path))
        try repository.save(second)
        let backup = try ListRepository.decode(Data(contentsOf: repository.backupURL))
        XCTAssertEqual(backup, first)
        XCTAssertEqual(repository.load().document, second)
    }

    /// An interrupted or damaged write must never lose everything: the
    /// unreadable file is set aside and the previous save is used.
    func testUnreadableStoreRecoversFromBackup() throws {
        let first = StoreDocument(lists: [Fixtures.list(["A", "B"])], didSeedSample: true)
        var second = first
        second.lists[0].title = "Second"
        try repository.save(first)
        try repository.save(second)
        // Simulate a torn write.
        let full = try Data(contentsOf: repository.storeURL)
        try full.prefix(full.count / 2).write(to: repository.storeURL)

        let (document, outcome) = ListRepository(directory: directory).load()
        XCTAssertEqual(outcome, .recoveredFromBackup)
        XCTAssertEqual(document, first)
        XCTAssertTrue(files().contains { $0.contains(".unreadable-") }, "The damaged file is kept, not deleted")
        XCTAssertFalse(FileManager.default.fileExists(atPath: repository.storeURL.path))

        // The next save works and doesn't copy the damaged file over the backup.
        try repository.save(document)
        XCTAssertEqual(repository.load().outcome, .loaded)
        XCTAssertEqual(try ListRepository.decode(Data(contentsOf: repository.backupURL)), first)
    }

    func testNothingReadableStartsEmptyAndKeepsTheFiles() throws {
        try Data("{not json".utf8).write(to: repository.storeURL)
        try Data("also broken".utf8).write(to: repository.backupURL)
        let (document, outcome) = repository.load()
        XCTAssertEqual(outcome, .resetAfterUnreadableData)
        XCTAssertTrue(document.lists.isEmpty)
        XCTAssertEqual(files().filter { $0.contains(".unreadable-") }.count, 2)
    }

    func testFutureSchemaVersionIsNotMisread() throws {
        let future = #"{"schemaVersion": 99, "lists": [], "didSeedSample": true}"#
        try Data(future.utf8).write(to: repository.storeURL)
        XCTAssertEqual(repository.load().outcome, .resetAfterUnreadableData)
    }

    func testOlderFilesWithMissingFieldsStillLoad() throws {
        let id = UUID()
        let entryID = UUID()
        let minimal = """
        {"schemaVersion": 1, "lists": [{"id": "\(id.uuidString)", "title": "Old",
          "entries": [{"id": "\(entryID.uuidString)", "name": "Only", "weight": 4}]}]}
        """
        try Data(minimal.utf8).write(to: repository.storeURL)
        let (document, outcome) = repository.load()
        XCTAssertEqual(outcome, .loaded)
        let list = document.lists[0]
        XCTAssertEqual(list.id, id)
        XCTAssertTrue(list.removeAfterSelection, "Missing toggle falls back to the ON default")
        XCTAssertEqual(list.oddsMode, .equal)
        XCTAssertEqual(list.revealStyle, .wheel)
        XCTAssertEqual(list.entries.first?.weight, 4)
        XCTAssertTrue(document.didSeedSample, "An existing store never gets the sample re-added")
    }

    func testTwentyEntryListRoundTripsExactly() throws {
        var list = Fixtures.list((1...20).map { "Person \($0)" })
        list.setOddsMode(.reverseStandings)
        list.moveEntries(fromOffsets: IndexSet(integer: 19), toOffset: 0)
        list.setRemoveAfterSelection(false)
        list.setRevealStyle(.mysteryCard)
        try repository.save(StoreDocument(lists: [list], didSeedSample: true))
        XCTAssertEqual(ListRepository(directory: directory).load().document.lists, [list])
    }
}
