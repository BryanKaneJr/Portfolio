import Foundation

/// The frozen result of a shift: a pool split or a tip-out.
public enum ShiftOutcome: Codable, Hashable, Sendable {
    case pool(SplitResult)
    case tipOut(TipOutResult)

    public var draft: ShiftDraft {
        switch self {
        case .pool(let result): result.draft
        case .tipOut(let result): result.draft
        }
    }

    public var mode: ShiftMode {
        switch self {
        case .pool: .pool
        case .tipOut: .tipOut
        }
    }

    public var pool: SplitResult? {
        if case .pool(let result) = self { return result }
        return nil
    }

    public var tipOut: TipOutResult? {
        if case .tipOut(let result) = self { return result }
        return nil
    }

    public var reconciles: Bool {
        switch self {
        case .pool(let result): result.reconciles
        case .tipOut(let result): result.reconciles
        }
    }

    /// The pool, or the total tipped out.
    public var headlineCents: Int64 {
        switch self {
        case .pool(let result): result.draft.pool.totalCents
        case .tipOut(let result): result.tippedOutCents
        }
    }

    /// People sharing the pool, or taking part in tip-outs.
    public var peopleCount: Int {
        switch self {
        case .pool(let result): result.receivingCount
        case .tipOut(let result): result.takingPartCount
        }
    }

    private enum Keys: String, CodingKey { case mode, pool, tipOut }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(ShiftMode.self, forKey: .mode) {
        case .pool: self = .pool(try c.decode(SplitResult.self, forKey: .pool))
        case .tipOut: self = .tipOut(try c.decode(TipOutResult.self, forKey: .tipOut))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        try c.encode(mode, forKey: .mode)
        switch self {
        case .pool(let result): try c.encode(result, forKey: .pool)
        case .tipOut(let result): try c.encode(result, forKey: .tipOut)
        }
    }
}

/// A saved shift: an immutable snapshot of its inputs and results. It is
/// always shown from these stored numbers, never recalculated from today's
/// crew. Changing it means duplicating it into a new shift.
public struct FinishedShift: Codable, Hashable, Identifiable, Sendable {
    /// The id of the draft it was finished from, so finishing the same draft
    /// twice (a double tap) can't create two shifts.
    public var id: UUID
    public var finishedAt: Date
    public var outcome: ShiftOutcome
    public var engineVersion: Int
    /// The saved shift this was duplicated from, if any.
    public var duplicatedFrom: UUID?

    public init(id: UUID, finishedAt: Date, outcome: ShiftOutcome, engineVersion: Int = PoolCalculator.engineVersion, duplicatedFrom: UUID? = nil) {
        self.id = id
        self.finishedAt = finishedAt
        self.outcome = outcome
        self.engineVersion = engineVersion
        self.duplicatedFrom = duplicatedFrom
    }

    public var draft: ShiftDraft { outcome.draft }
    public var day: CalendarDay { outcome.draft.day }
}

public enum Appearance: String, Codable, CaseIterable, Hashable, Sendable {
    case system, light, dark

    public var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

public struct AppSettings: Codable, Hashable, Sendable {
    public var defaultMethod: SplitMethod
    public var appearance: Appearance
    public var hapticsEnabled: Bool
    /// The crew a new shift starts with.
    public var activeCrewId: UUID?
    public var hasSeenWelcome: Bool

    public init(
        defaultMethod: SplitMethod = .hours,
        appearance: Appearance = .system,
        hapticsEnabled: Bool = true,
        activeCrewId: UUID? = nil,
        hasSeenWelcome: Bool = false
    ) {
        self.defaultMethod = defaultMethod
        self.appearance = appearance
        self.hapticsEnabled = hapticsEnabled
        self.activeCrewId = activeCrewId
        self.hasSeenWelcome = hasSeenWelcome
    }

    // Tolerates keys added in later versions being absent.
    public init(from decoder: Decoder) throws {
        enum Keys: String, CodingKey { case defaultMethod, appearance, hapticsEnabled, activeCrewId, hasSeenWelcome }
        let c = try decoder.container(keyedBy: Keys.self)
        let defaults = AppSettings()
        defaultMethod = try c.decodeIfPresent(SplitMethod.self, forKey: .defaultMethod) ?? defaults.defaultMethod
        appearance = try c.decodeIfPresent(Appearance.self, forKey: .appearance) ?? defaults.appearance
        hapticsEnabled = try c.decodeIfPresent(Bool.self, forKey: .hapticsEnabled) ?? defaults.hapticsEnabled
        activeCrewId = try c.decodeIfPresent(UUID.self, forKey: .activeCrewId)
        hasSeenWelcome = try c.decodeIfPresent(Bool.self, forKey: .hasSeenWelcome) ?? defaults.hasSeenWelcome
    }
}
