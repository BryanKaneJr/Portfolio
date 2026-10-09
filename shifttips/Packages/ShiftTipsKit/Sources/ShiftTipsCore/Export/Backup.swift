import Foundation

/// Everything ShiftTips keeps on the device, apart from the shift being
/// edited.
public struct Library: Codable, Hashable, Sendable {
    public var crews: [Crew]
    public var shifts: [FinishedShift]
    public var settings: AppSettings

    public init(crews: [Crew] = [], shifts: [FinishedShift] = [], settings: AppSettings = AppSettings()) {
        self.crews = crews
        self.shifts = shifts
        self.settings = settings
    }
}

/// The manual backup file a person saves to Files and can import later.
public struct BackupDocument: Codable, Hashable, Sendable {
    public static let formatIdentifier = "app.shifttips.backup"
    public static let currentSchemaVersion = 1

    public var format: String
    public var schemaVersion: Int
    public var exportedAt: Date
    public var appVersion: String?
    public var crews: [Crew]
    public var shifts: [FinishedShift]
    public var settings: AppSettings?

    public init(library: Library, exportedAt: Date, appVersion: String?) {
        format = Self.formatIdentifier
        schemaVersion = Self.currentSchemaVersion
        self.exportedAt = exportedAt
        self.appVersion = appVersion
        crews = library.crews
        shifts = library.shifts
        settings = library.settings
    }
}

public enum BackupError: Error, Hashable, Sendable {
    case notABackup
    case newerVersion
    case damaged(String)

    public var message: String {
        switch self {
        case .notABackup: "This file isn't a ShiftTips backup."
        case .newerVersion: "This backup is from a newer version of ShiftTips. Update the app, then import it again."
        case .damaged(let detail): "This backup is damaged and wasn't imported. \(detail)"
        }
    }
}

public enum ImportMode: Hashable, Sendable {
    /// Adds crews and shifts that aren't already here. Nothing is removed or
    /// overwritten.
    case merge
    /// Replaces all crews, shifts and settings with the backup's.
    case replace
}

public struct ImportSummary: Hashable, Sendable {
    public var crewsAdded = 0
    /// Crews whose id was already here with different contents. Both are
    /// kept; the imported one is added as a copy.
    public var crewsAddedAsCopies = 0
    public var crewsAlreadyHere = 0
    public var shiftsAdded = 0
    public var shiftsAlreadyHere = 0
    /// Saved shifts whose id was already here with different contents. The
    /// one on this iPhone is kept.
    public var shiftsKeptAsIs = 0

    public init() {}

    public var message: String {
        var parts: [String] = []
        parts.append(count(crewsAdded + crewsAddedAsCopies, "crew") + " added")
        parts.append(count(shiftsAdded, "shift") + " added")
        if crewsAlreadyHere + shiftsAlreadyHere > 0 {
            parts.append("\(crewsAlreadyHere + shiftsAlreadyHere) already here")
        }
        if crewsAddedAsCopies > 0 {
            parts.append(count(crewsAddedAsCopies, "crew") + " differed and came in as a copy")
        }
        if shiftsKeptAsIs > 0 {
            parts.append(count(shiftsKeptAsIs, "saved shift") + " differed; this iPhone's version was kept")
        }
        return parts.joined(separator: ", ") + "."
    }

    private func count(_ n: Int, _ noun: String) -> String { n == 1 ? "1 \(noun)" : "\(n) \(noun)s" }
}

public enum BackupCodec {
    public static func encode(_ document: BackupDocument) throws -> Data {
        try encoder().encode(document)
    }

    /// Decodes and fully validates a backup. Throws `BackupError` for
    /// anything that isn't a complete, consistent backup.
    public static func decode(_ data: Data) throws(BackupError) -> BackupDocument {
        struct Header: Decodable { var format: String; var schemaVersion: Int }
        guard let header = try? decoder().decode(Header.self, from: data),
              header.format == BackupDocument.formatIdentifier else { throw .notABackup }
        guard header.schemaVersion <= BackupDocument.currentSchemaVersion else { throw .newerVersion }

        let document: BackupDocument
        do {
            document = try decoder().decode(BackupDocument.self, from: data)
        } catch {
            throw .damaged("Some of its data couldn't be read.")
        }
        try validate(document)
        return document
    }

    public static func validate(_ document: BackupDocument) throws(BackupError) {
        guard Set(document.crews.map(\.id)).count == document.crews.count else {
            throw .damaged("Two crews share an id.")
        }
        for crew in document.crews {
            guard !crew.name.trimmingSpaces().isEmpty else { throw .damaged("A crew has no name.") }
            guard Set(crew.employees.map(\.id)).count == crew.employees.count else {
                throw .damaged("Two people in \(crew.name) share an id.")
            }
            for employee in crew.employees {
                guard !employee.name.trimmingSpaces().isEmpty else { throw .damaged("Someone in \(crew.name) has no name.") }
                guard (Limits.minPointsUnits...Limits.maxPointsUnits).contains(employee.pointsUnits) else {
                    throw .damaged("\(employee.name) has points out of range.")
                }
            }
        }
        guard Set(document.shifts.map(\.id)).count == document.shifts.count else {
            throw .damaged("Two saved shifts share an id.")
        }
        for shift in document.shifts {
            try validate(shift)
        }
    }

    /// A saved shift must be exactly what the engine that saved it produces
    /// for its inputs, with nothing left to fix.
    static func validate(_ shift: FinishedShift) throws(BackupError) {
        let title = shift.draft.title
        guard shift.engineVersion <= PoolCalculator.engineVersion else { throw .newerVersion }
        let result = shift.result
        guard result.allocations.map(\.participantId) == result.draft.participants.map(\.id) else {
            throw .damaged("The shift on \(title) has mismatched people and amounts.")
        }
        guard result.reconciles else {
            throw .damaged("The shift on \(title) doesn't add up to its pool.")
        }
        let recalculated = PoolCalculator.calculate(result.draft)
        guard !recalculated.isBlocked, recalculated.result == result else {
            throw .damaged("The amounts saved for \(title) don't match its inputs.")
        }
    }

    public static func merge(_ document: BackupDocument, into library: Library) -> (Library, ImportSummary) {
        var merged = library
        var summary = ImportSummary()
        for crew in document.crews {
            if let existing = merged.crews.first(where: { $0.id == crew.id }) {
                if existing == crew {
                    summary.crewsAlreadyHere += 1
                } else {
                    var copy = crew
                    copy.id = UUID()
                    copy.name = crew.name + " (from backup)"
                    copy.employees = crew.employees.map { var e = $0; e.id = UUID(); return e }
                    merged.crews.append(copy)
                    summary.crewsAddedAsCopies += 1
                }
            } else {
                merged.crews.append(crew)
                summary.crewsAdded += 1
            }
        }
        for shift in document.shifts {
            if let existing = merged.shifts.first(where: { $0.id == shift.id }) {
                if existing == shift { summary.shiftsAlreadyHere += 1 } else { summary.shiftsKeptAsIs += 1 }
            } else {
                merged.shifts.append(shift)
                summary.shiftsAdded += 1
            }
        }
        return (merged, summary)
    }

    public static func replacing(with document: BackupDocument, keeping library: Library) -> Library {
        var settings = document.settings ?? library.settings
        settings.hasSeenWelcome = true
        if let active = settings.activeCrewId, !document.crews.contains(where: { $0.id == active }) {
            settings.activeCrewId = nil
        }
        return Library(crews: document.crews, shifts: document.shifts, settings: settings)
    }

    public static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    public static func fileName(exportedOn day: CalendarDay) -> String {
        safeFileName("ShiftTips backup \(day.isoString)", ext: "json")
    }

    /// Keeps letters, digits, spaces, dashes and dots; trims the rest.
    public static func safeFileName(_ base: String, ext: String) -> String {
        let allowed = base.map { ($0.isLetter || $0.isNumber || " -._".contains($0)) ? $0 : " " }
        let collapsed = String(allowed).split(separator: " ").joined(separator: " ")
        return (collapsed.isEmpty ? "ShiftTips" : collapsed) + "." + ext
    }
}
