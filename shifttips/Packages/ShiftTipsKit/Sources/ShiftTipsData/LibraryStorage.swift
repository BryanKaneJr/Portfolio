import Foundation
import ShiftTipsCore

/// Where the library and the shift being edited are kept. Everything is on
/// the device; there is no network code anywhere in ShiftTips.
public protocol LibraryStorage: AnyObject {
    func loadLibrary() throws -> Library?
    func saveLibrary(_ library: Library) throws
    func loadForm() throws -> ShiftForm?
    func saveForm(_ form: ShiftForm) throws
    func deleteAll() throws
}

/// JSON files in Application Support. The library file is in the backup
/// format, so a copy of it is also a valid backup. Writes are atomic: a
/// crash mid-write leaves the previous file intact.
public final class FileStorage: LibraryStorage {
    public let directory: URL
    private var libraryURL: URL { directory.appendingPathComponent("library.json") }
    private var formURL: URL { directory.appendingPathComponent("current-shift.json") }

    public init(directory: URL) {
        self.directory = directory
    }

    /// `Application Support/ShiftTips`. The iPhone's own device backups
    /// include it like any other app data; ShiftTips never uploads it.
    public static func standard() throws -> FileStorage {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return FileStorage(directory: base.appendingPathComponent("ShiftTips", isDirectory: true))
    }

    public func loadLibrary() throws -> Library? {
        guard let data = try read(libraryURL) else { return nil }
        do {
            let document = try BackupCodec.decoder().decode(BackupDocument.self, from: data)
            return Library(crews: document.crews, shifts: document.shifts, settings: document.settings ?? AppSettings())
        } catch {
            // Never overwrite data we couldn't read: set it aside first.
            try setAside(libraryURL)
            throw StorageError.damagedLibrary
        }
    }

    public func saveLibrary(_ library: Library) throws {
        let document = BackupDocument(library: library, exportedAt: Date(), appVersion: nil)
        try write(BackupCodec.encode(document), to: libraryURL)
    }

    public func loadForm() throws -> ShiftForm? {
        guard let data = try read(formURL) else { return nil }
        // A damaged in-progress shift isn't worth stopping for; start fresh.
        return try? BackupCodec.decoder().decode(ShiftForm.self, from: data)
    }

    public func saveForm(_ form: ShiftForm) throws {
        try write(BackupCodec.encoder().encode(form), to: formURL)
    }

    public func deleteAll() throws {
        for url in [libraryURL, formURL] where FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }

    private func read(_ url: URL) throws -> Data? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try Data(contentsOf: url)
    }

    private func write(_ data: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: url, options: [.atomic])
    }

    private func setAside(_ url: URL) throws {
        let stamp = Int(Date().timeIntervalSince1970)
        let aside = directory.appendingPathComponent("library-unreadable-\(stamp).json")
        try FileManager.default.moveItem(at: url, to: aside)
    }
}

/// Keeps everything in memory. Used by tests, previews and UI tests.
public final class MemoryStorage: LibraryStorage {
    public var library: Library?
    public var form: ShiftForm?
    /// Set to make every save fail, to test out-of-storage handling.
    public var failSaves = false
    public private(set) var libraryWrites = 0

    public init(library: Library? = nil, form: ShiftForm? = nil) {
        self.library = library
        self.form = form
    }

    public func loadLibrary() throws -> Library? { library }

    public func saveLibrary(_ library: Library) throws {
        if failSaves { throw StorageError.writeFailed }
        self.library = library
        libraryWrites += 1
    }

    public func loadForm() throws -> ShiftForm? { form }

    public func saveForm(_ form: ShiftForm) throws {
        if failSaves { throw StorageError.writeFailed }
        self.form = form
    }

    public func deleteAll() throws {
        library = nil
        form = nil
    }
}

public enum StorageError: Error, Hashable {
    case damagedLibrary
    case writeFailed
}
