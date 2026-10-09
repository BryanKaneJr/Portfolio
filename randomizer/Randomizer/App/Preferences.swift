import Foundation

/// App-wide feel settings, kept in UserDefaults (lists live in the JSON
/// store). Launch arguments such as `-animationSpeed instant` override them,
/// which is how UI tests run quietly and quickly.
enum PreferenceKey {
    static let sound = "soundOn"
    static let haptics = "hapticsOn"
    static let speed = "animationSpeed"
}

enum AnimationSpeed: String, CaseIterable, Identifiable {
    case standard
    case fast
    case instant

    var id: String { rawValue }

    var title: String {
        switch self {
        case .standard: return "Standard"
        case .fast: return "Fast"
        case .instant: return "Instant"
        }
    }
}

enum Preferences {
    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            PreferenceKey.sound: true,
            PreferenceKey.haptics: true,
            PreferenceKey.speed: AnimationSpeed.standard.rawValue,
        ])
    }

    static var speed: AnimationSpeed {
        AnimationSpeed(rawValue: UserDefaults.standard.string(forKey: PreferenceKey.speed) ?? "") ?? .standard
    }

    static var soundOn: Bool { UserDefaults.standard.bool(forKey: PreferenceKey.sound) }
    static var hapticsOn: Bool { UserDefaults.standard.bool(forKey: PreferenceKey.haptics) }
}
