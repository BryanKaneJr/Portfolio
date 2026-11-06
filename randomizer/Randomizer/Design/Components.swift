import RandomizerCore
import SwiftUI

/// The one obvious action on a screen.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.rounded(.title3, weight: .bold))
            .foregroundStyle(isEnabled ? Color.white : Theme.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(isEnabled ? AnyShapeStyle(Theme.accentGradient) : AnyShapeStyle(Theme.surfaceRaised))
            }
            .shadow(color: isEnabled ? Theme.accent.opacity(0.35) : .clear, radius: 14, y: 6)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Secondary actions: calm, still easy to hit.
struct SecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.accent
    var fill: Color = Theme.surfaceRaised
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.rounded(.subheadline, weight: .semibold))
            .foregroundStyle(isEnabled ? tint : Theme.textTertiary)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(fill.opacity(configuration.isPressed ? 0.7 : 1))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.stroke)
            }
    }
}

/// Small pill buttons in the control footer.
struct ChipButtonStyle: ButtonStyle {
    var tint: Color = Theme.accent
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.rounded(.footnote, weight: .semibold))
            .foregroundStyle(isEnabled ? tint : Theme.textTertiary)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(
                Capsule().fill(isEnabled ? tint.opacity(configuration.isPressed ? 0.28 : 0.16) : Theme.surfaceRaised)
            )
    }
}

struct CardBackground: ViewModifier {
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Theme.surface)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Theme.stroke)
            }
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View {
        modifier(CardBackground(padding: padding))
    }

    /// Dark list and form backgrounds.
    func themedList() -> some View {
        scrollContentBackground(.hidden)
            .background(Theme.background)
    }
}

/// A rounded label with an icon, for modes and statuses.
struct Tag: View {
    let text: String
    var systemImage: String?
    var tint: Color = Theme.textSecondary

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small)
            }
            Text(text)
        }
        .font(Theme.rounded(.caption, weight: .semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(tint.opacity(0.14)))
    }
}

extension RevealStyle {
    var systemImage: String {
        switch self {
        case .lotteryBalls: return "circle.grid.2x2.fill"
        case .cardFlip: return "rectangle.portrait.fill"
        }
    }
}

extension LotteryType {
    var systemImage: String {
        switch self {
        case .pro: return "basketball.fill"
        case .longShot: return "dice.fill"
        case .slotDraft: return "hand.point.up.left.fill"
        }
    }

    /// How the type works, in a sentence or two.
    var explanation: String {
        switch self {
        case .pro:
            return "Teams that missed the playoffs draw for the top picks with the pros' odds: the three worst share the best chance, so last place never guarantees #1. Everyone the draw doesn't reach picks by standings."
        case .longShot:
            return "Every team is in and every pick is drawn. Odds climb from 1% for the champion to the best odds for last place, so anything can happen."
        case .slotDraft:
            return "Every team has the same chance in the draw. The first team drawn chooses any draft slot, then the next team chooses from what's left."
        }
    }
}

/// A team's finish as a small lottery ball: the number on its ball.
struct StandingBadge: View {
    let standing: Int
    var size: CGFloat = 30

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.paletteColor(standing - 1))
            Circle()
                .fill(.white)
                .padding(size * 0.2)
            Text("\(standing)")
                .font(.system(size: size * 0.36, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.onPalette)
                .minimumScaleFactor(0.5)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Dismisses the keyboard from anywhere (number pads have no return key).
@MainActor
func dismissKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
