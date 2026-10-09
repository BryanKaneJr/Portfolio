import SwiftUI
import UIKit

/// Colors and shapes. Midnight navy and warm off-white, with a mint/teal
/// accent; green only for reconciled totals. Every pair here meets WCAG AA
/// contrast for text in both light and dark mode.
enum Theme {
    static let background = Color(light: 0xF7F4EE, dark: 0x0B1220)
    static let surface = Color(light: 0xFFFFFF, dark: 0x152033)
    static let surfaceMuted = Color(light: 0xEFEBE3, dark: 0x1F2C43)
    static let separator = Color(light: 0xE4DED3, dark: 0x2A3852)

    static let ink = Color(light: 0x0F1B2D, dark: 0xEEF2F7)
    static let inkSecondary = Color(light: 0x56606F, dark: 0xA3AFBF)

    static let accent = Color(light: 0x0B7A6C, dark: 0x3DD6C0)
    static let onAccent = Color(light: 0xFFFFFF, dark: 0x0B1220)
    static let accentSoft = Color(light: 0xDDF2EE, dark: 0x173C3B)

    static let positive = Color(light: 0x1E7A46, dark: 0x5BD18F)
    static let warning = Color(light: 0x8F5300, dark: 0xF0B35A)
    static let warningSoft = Color(light: 0xFBEEDB, dark: 0x3A2C14)

    /// The pooled tips card: navy in light mode, a raised surface in dark.
    static let hero = Color(light: 0x0F1B2D, dark: 0x16243A)
    static let onHero = Color(light: 0xF7F4EE, dark: 0xEEF2F7)
    static let onHeroSecondary = Color(light: 0xB4BECC, dark: 0xA3AFBF)
    static let heroField = Color(light: 0x1C2B42, dark: 0x22314B)

    static let corner: CGFloat = 16
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

struct CardModifier: ViewModifier {
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View {
        modifier(CardModifier(padding: padding))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 52)
            .padding(.horizontal, 16)
            .foregroundStyle(isEnabled ? Theme.onAccent : Theme.inkSecondary)
            .background(isEnabled ? Theme.accent : Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .contentShape(Rectangle())
    }
}

/// Primary-sized, but quieter: for a step that still needs doing.
struct PendingButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 52)
            .padding(.horizontal, 16)
            .foregroundStyle(Theme.ink)
            .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .contentShape(Rectangle())
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 52)
            .padding(.horizontal, 16)
            .foregroundStyle(Theme.accent)
            .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .contentShape(Rectangle())
    }
}
