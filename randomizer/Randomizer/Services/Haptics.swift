import UIKit

/// Light taps while a reveal plays and a success buzz when it lands, if the
/// person has haptics on.
@MainActor
enum Haptics {
    private static let impact = UIImpactFeedbackGenerator(style: .light)
    private static let notification = UINotificationFeedbackGenerator()

    static func tick() {
        guard Preferences.hapticsOn else { return }
        impact.impactOccurred(intensity: 0.55)
    }

    static func success() {
        guard Preferences.hapticsOn else { return }
        notification.notificationOccurred(.success)
    }
}
