import SwiftUI
import UIKit

/// "A receipt, softened." Ink on warm paper with rounded white cards, big
/// rounded numbers, monospaced figures and labels like a printed slip, and
/// one plain yellow for the next thing to do and the result. See
/// docs/design.md.
///
/// Every text pair here meets WCAG AA in light and dark mode. Yellow is a
/// fill only, always with ink on it.
enum Theme {
    static let background = Color(light: 0xF2F1EC, dark: 0x0D0D0D)
    /// Cards, list rows and the receipt slip.
    static let surface = Color(light: 0xFFFFFF, dark: 0x1A1A1A)
    /// Fields, secondary buttons and pressed states.
    static let sunken = Color(light: 0xE9E8E2, dark: 0x262626)

    static let ink = Color(light: 0x141414, dark: 0xF2F1EC)
    static let inkSecondary = Color(light: 0x5C5B56, dark: 0xA6A5A0)
    /// Placeholders and decoration only, never information.
    static let inkTertiary = Color(light: 0x8A8984, dark: 0x75746F)
    /// Text on an ink fill.
    static let onInk = Color(light: 0xF2F1EC, dark: 0x0D0D0D)
    static let rule = Color(light: 0xDEDDD6, dark: 0x2E2E2C)

    /// The yellow: the primary action, "Reconciled", the total.
    static let highlight = Color(light: 0xFFD60A, dark: 0xFFD60A)
    static let onHighlight = Color(light: 0x141414, dark: 0x141414)
    static let highlightSoft = Color(light: 0xFFF3C4, dark: 0x3A3110)

    static let warning = Color(light: 0x9A4400, dark: 0xFFA14A)
    static let warningSoft = Color(light: 0xFBEBDA, dark: 0x3A2A16)
    static let danger = Color(light: 0xC12A1B, dark: 0xFF6E5E)

    /// The tips card: ink in light mode, a raised surface in dark.
    static let hero = Color(light: 0x161616, dark: 0x1F1F1F)
    static let onHero = Color(light: 0xF2F1EC, dark: 0xF2F1EC)
    static let onHeroSecondary = Color(light: 0xA9A8A2, dark: 0xA6A5A0)
    static let heroField = Color(light: 0x2A2A2A, dark: 0x2E2E2E)

    /// Buttons and fields.
    static let corner: CGFloat = 14
    /// Cards and the receipt.
    static let cardCorner: CGFloat = 20
    /// Space between numbered sections on a screen.
    static let sectionSpacing: CGFloat = 26
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor(light: light, dark: dark))
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

    convenience init(light: UInt32, dark: UInt32) {
        self.init { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        }
    }
}

extension Font {
    /// Rounded and heavy: titles and the numbers that matter.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .heavy) -> Font {
        .system(style, design: .rounded, weight: weight)
    }

    /// Receipt figures, labels and tags.
    static func mono(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .monospaced, weight: weight)
    }
}

extension UIFont {
    /// SF Pro Rounded, for UIKit text.
    static func rounded(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        guard let descriptor = base.fontDescriptor.withDesign(.rounded) else { return base }
        return UIFont(descriptor: descriptor, size: size)
    }
}

extension View {
    /// A rounded white card, the original ShiftTips container.
    func card(padding: CGFloat = 16) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
    }
}

/// Navigation bar titles in the display face, set once at launch. On iOS
/// 26 the bars keep the system's glass; earlier, they sit on the paper.
enum Chrome {
    static func apply() {
        let ink = UIColor(light: 0x141414, dark: 0xF2F1EC)
        let large = UIFontMetrics(forTextStyle: .largeTitle).scaledFont(for: .rounded(ofSize: 34, weight: .heavy))
        let inline = UIFontMetrics(forTextStyle: .headline).scaledFont(for: .rounded(ofSize: 17, weight: .bold))

        func styled(_ appearance: UINavigationBarAppearance) -> UINavigationBarAppearance {
            appearance.largeTitleTextAttributes = [.font: large, .foregroundColor: ink]
            appearance.titleTextAttributes = [.font: inline, .foregroundColor: ink]
            return appearance
        }

        let standard = UINavigationBarAppearance()
        if #available(iOS 26, *) {
            standard.configureWithDefaultBackground()
        } else {
            standard.configureWithOpaqueBackground()
            standard.backgroundColor = UIColor(light: 0xF2F1EC, dark: 0x0D0D0D)
            standard.shadowColor = UIColor(light: 0xDEDDD6, dark: 0x2E2E2C)
        }
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()

        let bar = UINavigationBar.appearance()
        bar.standardAppearance = styled(standard)
        bar.compactAppearance = styled(standard)
        bar.scrollEdgeAppearance = styled(edge)
    }
}

// MARK: - Buttons

/// The yellow button: the one thing to do next.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.display(.headline, weight: .bold))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 16)
            .foregroundStyle(isEnabled ? Theme.onHighlight : Theme.inkTertiary)
            .background(isEnabled ? Theme.highlight : Theme.sunken, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay {
                // Pressed, the yellow darkens a touch.
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .fill(Color.black.opacity(configuration.isPressed && isEnabled ? 0.12 : 0))
            }
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .contentShape(Rectangle())
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// A soft gray button, for the other way forward.
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.display(.headline, weight: .bold))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 16)
            .foregroundStyle(isEnabled ? Theme.ink : Theme.inkTertiary)
            .background(Theme.sunken, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .fill(Theme.ink.opacity(configuration.isPressed ? 0.08 : 0))
            }
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .contentShape(Rectangle())
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Primary-sized but dashed: a step that still needs doing. Tapping it
/// goes to what's missing.
struct PendingButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 16)
            .foregroundStyle(Theme.ink)
            .background(configuration.isPressed ? Theme.sunken : Color.clear, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .strokeBorder(Theme.inkSecondary, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
            .contentShape(Rectangle())
    }
}

/// Words that act: semibold ink with a light underline, at least 44pt tall.
struct TextButtonStyle: ButtonStyle {
    var color: Color = Theme.ink

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .underline(true, color: color.opacity(0.3))
            .foregroundStyle(color)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
    }
}
