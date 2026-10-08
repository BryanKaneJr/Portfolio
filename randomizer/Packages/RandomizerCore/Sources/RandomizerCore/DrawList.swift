import Foundation

/// A saved list plus its current session. Everything a draw screen needs to
/// resume after a force quit lives here, including the removal toggle.
public struct DrawList: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var title: String
    /// In Reverse Standings this order is the ranking, worst finish first.
    public var entries: [DrawEntry]
    public var oddsMode: OddsMode
    public var revealStyle: RevealStyle
    /// "Remove after selection". Saved per list, ON for new lists, and only
    /// ever changed by the person tapping the switch.
    public var removeAfterSelection: Bool
    /// Entries taken out of the pool this session (by UUID, never by name).
    public var removedEntryIDs: Set<UUID>
    public var activeSessionID: UUID
    /// This session's results in draw order.
    public var activeResults: [DrawResult]
    /// Set when a draw was undone, so the history says it was edited.
    public var sessionEdited: Bool
    /// The first-run demo list until the person keeps or replaces it.
    public var isSample: Bool
    public var createdAt: Date
    public var updatedAt: Date
    public var lastUsedAt: Date?

    public init(
        id: UUID = UUID(),
        title: String,
        entries: [DrawEntry] = [],
        oddsMode: OddsMode = .equal,
        revealStyle: RevealStyle = .wheel,
        removeAfterSelection: Bool = true,
        removedEntryIDs: Set<UUID> = [],
        activeSessionID: UUID = UUID(),
        activeResults: [DrawResult] = [],
        sessionEdited: Bool = false,
        isSample: Bool = false,
        createdAt: Date = Date(),
        updatedAt: Date? = nil,
        lastUsedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.entries = entries
        self.oddsMode = oddsMode
        self.revealStyle = revealStyle
        self.removeAfterSelection = removeAfterSelection
        self.removedEntryIDs = removedEntryIDs
        self.activeSessionID = activeSessionID
        self.activeResults = activeResults
        self.sessionEdited = sessionEdited
        self.isSample = isSample
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
        self.lastUsedAt = lastUsedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, entries, oddsMode, revealStyle, removeAfterSelection
        case removedEntryIDs, activeSessionID, activeResults, sessionEdited
        case isSample, createdAt, updatedAt, lastUsedAt
    }

    // Lenient decoding: a field added in a later version must not make an
    // older file unreadable, so everything but identity has a default.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled list"
        entries = try c.decodeIfPresent([DrawEntry].self, forKey: .entries) ?? []
        oddsMode = try c.decodeIfPresent(OddsMode.self, forKey: .oddsMode) ?? .equal
        revealStyle = try c.decodeIfPresent(RevealStyle.self, forKey: .revealStyle) ?? .wheel
        removeAfterSelection = try c.decodeIfPresent(Bool.self, forKey: .removeAfterSelection) ?? true
        removedEntryIDs = try c.decodeIfPresent(Set<UUID>.self, forKey: .removedEntryIDs) ?? []
        activeSessionID = try c.decodeIfPresent(UUID.self, forKey: .activeSessionID) ?? UUID()
        activeResults = try c.decodeIfPresent([DrawResult].self, forKey: .activeResults) ?? []
        sessionEdited = try c.decodeIfPresent(Bool.self, forKey: .sessionEdited) ?? false
        isSample = try c.decodeIfPresent(Bool.self, forKey: .isSample) ?? false
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
        lastUsedAt = try c.decodeIfPresent(Date.self, forKey: .lastUsedAt)
    }

    public func entry(_ id: UUID) -> DrawEntry? {
        entries.first { $0.id == id }
    }

    public func index(of id: UUID) -> Int? {
        entries.firstIndex { $0.id == id }
    }

    /// Entries currently out of the pool, in list order.
    public var removedEntries: [DrawEntry] {
        entries.filter { removedEntryIDs.contains($0.id) }
    }

    /// True once the session has any results.
    public var hasActiveSession: Bool {
        !activeResults.isEmpty || !removedEntryIDs.isEmpty
    }
}
