import Foundation

/// A saved shift: an immutable snapshot of its inputs and allocations. It is
/// always shown from these stored numbers, never recalculated from today's
/// crew. Changing it means duplicating it into a new shift.
public struct FinishedShift: Codable, Hashable, Identifiable, Sendable {
    /// The id of the draft it was finished from, so finishing the same draft
    /// twice (a double tap) can't create two shifts.
    public var id: UUID
    public var finishedAt: Date
    public var result: SplitResult
    public var engineVersion: Int
    /// The saved shift this was duplicated from, if any.
    public var duplicatedFrom: UUID?

    public init(id: UUID, finishedAt: Date, result: SplitResult, engineVersion: Int = PoolCalculator.engineVersion, duplicatedFrom: UUID? = nil) {
        self.id = id
        self.finishedAt = finishedAt
        self.result = result
        self.engineVersion = engineVersion
        self.duplicatedFrom = duplicatedFrom
    }

    public var draft: ShiftDraft { result.draft }
    public var day: CalendarDay { result.draft.day }
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
