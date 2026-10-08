import Foundation

public enum ListEditError: Error, Equatable, Sendable {
    case emptyName
    case listFull
    case entryNotFound
}

/// What a paste will add, shown before the person confirms it.
public struct PasteParseResult: Equatable, Sendable {
    /// Cleaned names that fit, in pasted order.
    public let names: [String]
    /// Valid names left out by the entry limit.
    public let overLimit: Int

    public init(names: [String], overLimit: Int) {
        self.names = names
        self.overLimit = overLimit
    }
}

public enum NameRules {
    /// Trims, folds runs of whitespace into one space and caps the length.
    /// Returns nil for a name that is blank once trimmed.
    public static func clean(_ raw: String, maxLength: Int = Limits.maxNameLength) -> String? {
        let words = raw.split(whereSeparator: { $0.isWhitespace })
        guard !words.isEmpty else { return nil }
        let joined = words.joined(separator: " ")
        return joined.count > maxLength ? String(joined.prefix(maxLength)) : joined
    }

    public static func cleanTitle(_ raw: String) -> String? {
        clean(raw, maxLength: Limits.maxTitleLength)
    }

    /// One name per line. Blank lines are skipped, a leading bullet
    /// ("- ", "* ", "• ") is dropped, and names beyond the entry limit are
    /// counted rather than silently lost.
    public static func parsePaste(_ text: String, existingCount: Int) -> PasteParseResult {
        let room = max(0, Limits.maxEntries - existingCount)
        var names: [String] = []
        var overLimit = 0
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").split(
            omittingEmptySubsequences: false,
            whereSeparator: { $0.isNewline }
        )
        for line in lines {
            guard let name = clean(stripBullet(String(line))) else { continue }
            if names.count < room {
                names.append(name)
            } else {
                overLimit += 1
            }
        }
        return PasteParseResult(names: names, overLimit: overLimit)
    }

    private static func stripBullet(_ line: String) -> String {
        let trimmed = line.drop(while: { $0.isWhitespace })
        for bullet in ["- ", "* ", "• ", "· "] where trimmed.hasPrefix(bullet) {
            return String(trimmed.dropFirst(bullet.count))
        }
        return String(trimmed)
    }
}

/// Editing a saved list. Edits never reset the session: new entries join
/// future draws, deleted entries leave the pool, and past results keep the
/// names and odds they were drawn with.
public extension DrawList {
    var isFull: Bool { entries.count >= Limits.maxEntries }

    @discardableResult
    mutating func addEntry(named raw: String, weight: Int = Limits.defaultWeight, now: Date = Date()) throws -> DrawEntry {
        guard let name = NameRules.clean(raw) else { throw ListEditError.emptyName }
        guard !isFull else { throw ListEditError.listFull }
        let entry = DrawEntry(name: name, weight: weight)
        entries.append(entry)
        updatedAt = now
        return entry
    }

    /// Adds as many cleaned names as fit. Returns the entries added.
    @discardableResult
    mutating func addEntries(named names: [String], now: Date = Date()) -> [DrawEntry] {
        var added: [DrawEntry] = []
        for raw in names {
            guard !isFull else { break }
            guard let name = NameRules.clean(raw) else { continue }
            let entry = DrawEntry(name: name)
            entries.append(entry)
            added.append(entry)
        }
        if !added.isEmpty { updatedAt = now }
        return added
    }

    mutating func renameEntry(_ id: UUID, to raw: String, now: Date = Date()) throws {
        guard let name = NameRules.clean(raw) else { throw ListEditError.emptyName }
        guard let index = index(of: id) else { throw ListEditError.entryNotFound }
        guard entries[index].name != name else { return }
        entries[index].name = name
        updatedAt = now
    }

    mutating func deleteEntries(_ ids: Set<UUID>, now: Date = Date()) {
        let before = entries.count
        entries.removeAll { ids.contains($0.id) }
        removedEntryIDs.subtract(ids)
        if entries.count != before { updatedAt = now }
    }

    /// Same semantics as SwiftUI's `move(fromOffsets:toOffset:)`.
    mutating func moveEntries(fromOffsets source: IndexSet, toOffset destination: Int, now: Date = Date()) {
        let valid = source.filter { entries.indices.contains($0) }
        guard !valid.isEmpty else { return }
        let moving = valid.map { entries[$0] }
        let movedAbove = valid.filter { $0 < destination }.count
        var remaining = entries
        for index in valid.sorted(by: >) { remaining.remove(at: index) }
        let insertAt = min(max(destination - movedAbove, 0), remaining.count)
        remaining.insert(contentsOf: moving, at: insertAt)
        guard remaining != entries else { return }
        entries = remaining
        updatedAt = now
    }

    /// Sets a custom weight (clamped to 0...1,000). Editing a weight while in
    /// Reverse Standings or Equal Odds switches the list to Weighted; from
    /// Standings the preset weights are kept first so only the edited
    /// entry changes and the ranking order stays as it was.
    mutating func setWeight(_ weight: Int, for id: UUID, now: Date = Date()) {
        guard let index = index(of: id) else { return }
        if oddsMode == .reverseStandings {
            let preset = OddsCalculator.reverseStandingsWeights(count: entries.count)
            for i in entries.indices { entries[i].weight = preset[i] }
        }
        oddsMode = .customWeighted
        entries[index].weight = DrawEntry.clampWeight(weight)
        updatedAt = now
    }

    mutating func setOddsMode(_ mode: OddsMode, now: Date = Date()) {
        guard oddsMode != mode else { return }
        oddsMode = mode
        updatedAt = now
    }

    mutating func rename(to raw: String, now: Date = Date()) throws {
        guard let title = NameRules.cleanTitle(raw) else { throw ListEditError.emptyName }
        guard self.title != title else { return }
        self.title = title
        updatedAt = now
    }

    /// Removes every entry. Past results keep their name snapshots.
    mutating func clearEntries(now: Date = Date()) {
        guard !entries.isEmpty else { return }
        entries.removeAll()
        removedEntryIDs.removeAll()
        updatedAt = now
    }

    /// Display names used by more than one entry (case-insensitive). They
    /// are allowed: each entry is its own participant.
    var duplicateNames: [String] {
        var seen: [String: String] = [:]
        var duplicates: [String] = []
        for entry in entries {
            let key = entry.name.lowercased()
            if seen[key] != nil {
                if !duplicates.contains(where: { $0.lowercased() == key }) {
                    duplicates.append(entry.name)
                }
            } else {
                seen[key] = entry.name
            }
        }
        return duplicates
    }

    /// Why the editor can't start drawing yet, or nil when it can. A pool
    /// emptied by removals is fine: the draw screen offers Restore removed.
    var startProblem: String? {
        if entries.count < 2 { return "Add at least two entries to start drawing." }
        if !entries.indices.contains(where: { effectiveWeight(atIndex: $0) > 0 }) {
            return "Give at least one entry a weight above 0."
        }
        return nil
    }

    /// A copy with new identities and a fresh session. Settings and
    /// weights carry over; the copy is never the sample.
    func duplicated(title newTitle: String, now: Date = Date()) -> DrawList {
        DrawList(
            title: NameRules.cleanTitle(newTitle) ?? title,
            entries: entries.map { DrawEntry(name: $0.name, weight: $0.weight) },
            oddsMode: oddsMode,
            revealStyle: revealStyle,
            removeAfterSelection: removeAfterSelection,
            createdAt: now
        )
    }
}
