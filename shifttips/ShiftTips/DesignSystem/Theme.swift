import SwiftUI
import UIKit

/// "Highlighter on a receipt." Black ink on white paper, wide heavy type
/// for the numbers that matter, monospaced figures and labels, hairline
/// rules instead of cards, and one fluorescent highlighter for the next
/// thing to do and the result. See docs/design.md.
///
/// Every text pair here meets WCAG AA in light and dark mode. The
/// highlighter is a fill only, always with ink on it; in light mode it's
/// close to the paper's brightness, so it's outlined in ink there.
enum Theme {
    static let background = Color(light: 0xF2F2EF, dark: 0x0C0C0C)
    /// Fields, rows in lists and the receipt slip.
    static let surface = Color(light: 0xFFFFFF, dark: 0x181818)
    /// Pressed states and the working behind an amount.
    static let sunken = Color(light: 0xE7E7E3, dark: 0x222222)

    static let ink = Color(light: 0x0E0E0E, dark: 0xF2F2EF)
    static let inkSecondary = Color(light: 0x5A5A56, dark: 0xA3A3A0)
    /// Placeholders and decoration only, never information.
    static let inkTertiary = Color(light: 0x8A8A85, dark: 0x737370)
    /// Text on an ink fill.
    static let onInk = Color(light: 0xF2F2EF, dark: 0x0C0C0C)
    static let rule = Color(light: 0xD3D3CE, dark: 0x2E2E2C)

    static let highlight = Color(light: 0xD4FF3A, dark: 0xD4FF3A)
    static let onHighlight = Color(light: 0x0E0E0E, dark: 0x0E0E0E)
    static let highlightEdge = Color(light: 0x0E0E0E, dark: 0xD4FF3A)

    static let warning = Color(light: 0x9E4300, dark: 0xFFA14A)
    static let danger = Color(light: 0xC12A1B, dark: 0xFF6E5E)

    static let corner: CGFloat = 4
    /// Space between numbered sections on a screen.
    static let sectionSpacing: CGFloat = 32
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
    /// Wide and heavy: titles and the numbers that matter.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .heavy) -> Font {
        .system(style, weight: weight).width(.expanded)
    }

    /// Receipt figures, labels and tags.
    static func mono(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .monospaced, weight: weight)
    }
}

/// Navigation bar titles in the display face, set once at launch. On iOS
/// 26 the bars keep the system's glass; earlier, they sit on the paper.
enum Chrome {
    static func apply() {
        let ink = UIColor(light: 0x0E0E0E, dark: 0xF2F2EF)
        let large = UIFontMetrics(forTextStyle: .largeTitle)
            .scaledFont(for: .systemFont(ofSize: 32, weight: .heavy, width: .expanded))
        let inline = UIFontMetrics(forTextStyle: .headline)
            .scaledFont(for: .systemFont(ofSize: 16, weight: .bold, width: .expanded))

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
            standard.backgroundColor = UIColor(light: 0xF2F2EF, dark: 0x0C0C0C)
            standard.shadowColor = UIColor(light: 0xD3D3CE, dark: 0x2E2E2C)
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

/// The highlighter key: the one thing to do next.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        // Pressed, the key inverts: highlighter ink on black.
        let pressed = configuration.isPressed && isEnabled
        return configuration.label
            .font(.display(.headline, weight: .bold))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 16)
            .foregroundStyle(!isEnabled ? Theme.inkTertiary : (pressed ? Theme.highlight : Theme.onHighlight))
            .background(
                !isEnabled ? Theme.sunken : (pressed ? Theme.onHighlight : Theme.highlight),
                in: RoundedRectangle(cornerRadius: Theme.corner)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(isEnabled ? Theme.highlightEdge : Color.clear, lineWidth: 1.5)
            }
            .contentShape(Rectangle())
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// An outlined key, for the other way forward.
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.display(.headline, weight: .bold))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 16)
            .foregroundStyle(isEnabled ? Theme.ink : Theme.inkTertiary)
            .background(configuration.isPressed ? Theme.sunken : Color.clear, in: RoundedRectangle(cornerRadius: Theme.corner))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(isEnabled ? Theme.ink : Theme.rule, lineWidth: 1.5)
            }
            .contentShape(Rectangle())
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
            .background(configuration.isPressed ? Theme.sunken : Color.clear, in: RoundedRectangle(cornerRadius: Theme.corner))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(Theme.inkSecondary, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
            .contentShape(Rectangle())
    }
}

/// Words that act: semibold ink with an underline, at least 44pt tall.
struct TextButtonStyle: ButtonStyle {
    var color: Color = Theme.ink

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .underline(true, color: color.opacity(0.35))
            .foregroundStyle(color)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
    }
}
