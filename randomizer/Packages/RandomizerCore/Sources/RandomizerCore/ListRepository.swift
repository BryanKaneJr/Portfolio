import Foundation

/// The single versioned file that holds every saved list.
public struct StoreDocument: Codable, Equatable, Sendable {
    public static let currentSchemaVersion = 1

    public var schemaVersion: Int
    public var lists: [DrawList]
    /// The first-run sample is created once, so deleting it sticks.
    public var didSeedSample: Bool

    public init(lists: [DrawList] = [], didSeedSample: Bool = false) {
        schemaVersion = StoreDocument.currentSchemaVersion
        self.lists = lists
        self.didSeedSample = didSeedSample
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion, lists, didSeedSample
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try c.decode(Int.self, forKey: .schemaVersion)
        lists = try c.decodeIfPresent([DrawList].self, forKey: .lists) ?? []
        didSeedSample = try c.decodeIfPresent(Bool.self, forKey: .didSeedSample) ?? true
    }
}

/// How a load went, so the app can tell the person when it had to recover.
public enum StoreLoadOutcome: Equatable, Sendable {
    /// No saved data yet.
    case fresh
    case loaded
    /// The main file was unreadable; the previous save was used.
    case recoveredFromBackup
    /// Nothing readable; started empty. The unreadable file was kept aside.
    case resetAfterUnreadableData
}

/// Local JSON storage in Application Support. No network, no account.
///
/// Each save first copies the current file to a backup, then writes the new
/// file atomically (temporary file + rename), so a crash mid-write leaves
/// either the old or the new file, and an unreadable file falls back to the
/// previous save. Unreadable files are renamed aside, never deleted.
public final class ListRepository: @unchecked Sendable {
    public static let fileName = "randomizer_store_v1.json"
    public static let backupFileName = "randomizer_store_v1.backup.json"

    public let directory: URL
    private let fileManager: FileManager

    public init(directory: URL, fileManager: FileManager = .default) {
        self.directory = directory
        self.fileManager = fileManager
    }

    public static func defaultDirectory(fileManager: FileManager = .default) throws -> URL {
        let base = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return base.appendingPathComponent("Randomizer", isDirectory: true)
    }

    public var storeURL: URL { directory.appendingPathComponent(Self.fileName) }
    public var backupURL: URL { directory.appendingPathComponent(Self.backupFileName) }

    public func load() -> (document: StoreDocument, outcome: StoreLoadOutcome) {
        let mainExists = fileManager.fileExists(atPath: storeURL.path)
        let backupExists = fileManager.fileExists(atPath: backupURL.path)
        if mainExists, let document = decode(at: storeURL) {
            return (document, .loaded)
        }
        if mainExists { setAside(storeURL) }
        if backupExists, let document = decode(at: backupURL) {
            return (document, .recoveredFromBackup)
        }
        if !mainExists && !backupExists {
            return (StoreDocument(), .fresh)
        }
        if backupExists { setAside(backupURL) }
        return (StoreDocument(didSeedSample: false), .resetAfterUnreadableData)
    }

    public func save(_ document: StoreDocument) throws {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try Self.encode(document)
        if let current = try? Data(contentsOf: storeURL) {
            try write(current, to: backupURL)
        }
        try write(data, to: storeURL)
    }

    public static func encode(_ document: StoreDocument) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(document)
    }

    public static func decode(_ data: Data) throws -> StoreDocument {
        let document = try JSONDecoder().decode(StoreDocument.self, from: data)
        guard document.schemaVersion >= 1, document.schemaVersion <= StoreDocument.currentSchemaVersion else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return document
    }

    private func decode(at url: URL) -> StoreDocument? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? Self.decode(data)
    }

    private func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: url, options: [.atomic])
        #endif
    }

    /// Renames an unreadable file so it is neither loaded nor overwritten.
    private func setAside(_ url: URL) {
        let stamp = Int(Date().timeIntervalSince1970)
        let name = url.deletingPathExtension().lastPathComponent + ".unreadable-\(stamp)-\(UUID().uuidString.prefix(8)).json"
        try? fileManager.moveItem(at: url, to: directory.appendingPathComponent(name))
    }
}
