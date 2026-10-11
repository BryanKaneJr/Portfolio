import Foundation

public enum LeagueEditError: Error, Equatable, Sendable {
    case emptyName
    case leagueFull
    case teamNotFound
}

/// What a paste will add, shown before the person confirms it.
public struct PasteParseResult: Equatable, Sendable {
    /// Cleaned names that fit, in pasted order.
    public let names: [String]
    /// Valid names left out by the team limit.
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

    /// One team per line, in standings order. Blank lines are skipped, a
    /// leading bullet ("- ", "* ", "• ") or standings number ("1. ", "2) ")
    /// is dropped, and names beyond the team limit are counted rather than
    /// silently lost.
    public static func parsePaste(_ text: String, existingCount: Int) -> PasteParseResult {
        let room = max(0, Limits.maxTeams - existingCount)
        var names: [String] = []
        var overLimit = 0
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").split(
            omittingEmptySubsequences: false,
            whereSeparator: { $0.isNewline }
        )
        for line in lines {
            guard let name = clean(stripPrefix(String(line))) else { continue }
            if names.count < room {
                names.append(name)
            } else {
                overLimit += 1
            }
        }
        return PasteParseResult(names: names, overLimit: overLimit)
    }

    private static func stripPrefix(_ line: String) -> String {
        let trimmed = line.drop(while: { $0.isWhitespace })
        for bullet in ["- ", "* ", "• ", "· "] where trimmed.hasPrefix(bullet) {
            return String(trimmed.dropFirst(bullet.count))
        }
        // "1. Name" or "12) Name" from a copied standings table.
        let digits = trimmed.prefix(while: { $0.isNumber })
        if !digits.isEmpty, digits.count <= 2 {
            let rest = trimmed.dropFirst(digits.count)
            if let mark = rest.first, mark == "." || mark == ")", rest.dropFirst().first?.isWhitespace == true {
                return String(rest.dropFirst())
            }
        }
        return String(trimmed)
    }
}

/// Editing a league. Edits never touch the latest run: it keeps the names,
/// standings and odds it was drawn with.
public extension League {
    var isFull: Bool { teams.count >= Limits.maxTeams }

    @discardableResult
    mutating func addTeam(named raw: String, weight: Int = Limits.defaultWeight, now: Date = Date()) throws -> Team {
        guard let name = NameRules.clean(raw) else { throw LeagueEditError.emptyName }
        guard !isFull else { throw LeagueEditError.leagueFull }
        let team = Team(name: name, weight: weight)
        teams.append(team)
        updatedAt = now
        return team
    }

    /// Adds as many cleaned names as fit, at the bottom of the standings.
    /// Returns the teams added.
    @discardableResult
    mutating func addTeams(named names: [String], now: Date = Date()) -> [Team] {
        var added: [Team] = []
        for raw in names {
            guard !isFull else { break }
            guard let name = NameRules.clean(raw) else { continue }
            let team = Team(name: name)
            teams.append(team)
            added.append(team)
        }
        if !added.isEmpty { updatedAt = now }
        return added
    }

    mutating func renameTeam(_ id: UUID, to raw: String, now: Date = Date()) throws {
        guard let name = NameRules.clean(raw) else { throw LeagueEditError.emptyName }
        guard let index = index(of: id) else { throw LeagueEditError.teamNotFound }
        guard teams[index].name != name else { return }
        teams[index].name = name
        updatedAt = now
    }

    mutating func deleteTeams(_ ids: Set<UUID>, now: Date = Date()) {
        let before = teams.count
        teams.removeAll { ids.contains($0.id) }
        if teams.count != before {
            normalizeFormat()
            updatedAt = now
        }
    }

    /// Same semantics as SwiftUI's `move(fromOffsets:toOffset:)`.
    mutating func moveTeams(fromOffsets source: IndexSet, toOffset destination: Int, now: Date = Date()) {
        let valid = source.filter { teams.indices.contains($0) }
        guard !valid.isEmpty else { return }
        let moving = valid.map { teams[$0] }
        let movedAbove = valid.filter { $0 < destination }.count
        var remaining = teams
        for index in valid.sorted(by: >) { remaining.remove(at: index) }
        let insertAt = min(max(destination - movedAbove, 0), remaining.count)
        remaining.insert(contentsOf: moving, at: insertAt)
        guard remaining != teams else { return }
        teams = remaining
        updatedAt = now
    }

    /// Sets a Custom Odds weight (clamped to 0...1,000). Editing a weight in
    /// another mode switches to Custom Odds; from Weighted by Standings the
    /// standings weights are copied first, so only the edited team changes.
    mutating func setWeight(_ weight: Int, for id: UUID, now: Date = Date()) {
        guard let index = index(of: id) else { return }
        if oddsMode != .customWeighted {
            for i in teams.indices where isInLottery(atIndex: i) {
                teams[i].weight = effectiveWeight(atIndex: i)
            }
        }
        oddsMode = .customWeighted
        teams[index].weight = Team.clampWeight(weight)
        updatedAt = now
    }

    mutating func setOddsMode(_ mode: OddsMode, now: Date = Date()) {
        guard oddsMode != mode else { return }
        oddsMode = mode
        updatedAt = now
    }

    /// How many of the worst finishers are in the lottery. Setting it to
    /// every team stores "all", so adding a team later keeps everyone in.
    mutating func setLotteryTeams(_ count: Int, now: Date = Date()) {
        let drawnBefore = drawnPicks
        let wasEveryPick = drawnPickCount == nil
        let clamped = min(max(count, Limits.minTeams), max(teams.count, Limits.minTeams))
        let stored: Int? = clamped >= teams.count ? nil : clamped
        guard stored != lotteryTeamCount else { return }
        lotteryTeamCount = stored
        // Keep "top N drawn" when it still fits; "every pick" follows along.
        if !wasEveryPick {
            drawnPickCount = min(drawnBefore, lotteryTeams)
        }
        normalizeFormat()
        updatedAt = now
    }

    /// How many picks the lottery draws. Every lottery pick stores "all".
    mutating func setDrawnPicks(_ count: Int, now: Date = Date()) {
        let clamped = min(max(count, 1), max(lotteryTeams, 1))
        let stored: Int? = clamped >= lotteryTeams ? nil : clamped
        guard stored != drawnPickCount else { return }
        drawnPickCount = stored
        updatedAt = now
    }

    mutating func setRevealStyle(_ style: RevealStyle, now: Date = Date()) {
        guard revealStyle != style else { return }
        revealStyle = style
        updatedAt = now
    }

    mutating func rename(to raw: String, now: Date = Date()) throws {
        guard let title = NameRules.cleanTitle(raw) else { throw LeagueEditError.emptyName }
        guard self.title != title else { return }
        self.title = title
        updatedAt = now
    }

    /// Removes every team. The latest run keeps its name snapshots.
    mutating func clearTeams(now: Date = Date()) {
        guard !teams.isEmpty else { return }
        teams.removeAll()
        lotteryTeamCount = nil
        drawnPickCount = nil
        updatedAt = now
    }

    /// Team names used more than once (case-insensitive). They're allowed:
    /// each is its own team.
    var duplicateNames: [String] {
        var seen: Set<String> = []
        var duplicates: [String] = []
        for team in teams {
            let key = team.name.lowercased()
            if seen.contains(key) {
                if !duplicates.contains(where: { $0.lowercased() == key }) {
                    duplicates.append(team.name)
                }
            } else {
                seen.insert(key)
            }
        }
        return duplicates
    }

    /// A copy with new identities and no runs. Teams, standings, weights
    /// and format carry over; the copy is never the sample.
    func duplicated(title newTitle: String, now: Date = Date()) -> League {
        League(
            title: NameRules.cleanTitle(newTitle) ?? title,
            teams: teams.map { Team(name: $0.name, weight: $0.weight) },
            oddsMode: oddsMode,
            revealStyle: revealStyle,
            lotteryTeamCount: lotteryTeamCount,
            drawnPickCount: drawnPickCount,
            createdAt: now
        )
    }

    /// Drops stored counts that no longer mean anything after teams leave.
    private mutating func normalizeFormat() {
        if let count = lotteryTeamCount, count >= teams.count {
            lotteryTeamCount = nil
        }
        if let count = drawnPickCount, count >= lotteryTeams {
            drawnPickCount = nil
        }
    }
}
