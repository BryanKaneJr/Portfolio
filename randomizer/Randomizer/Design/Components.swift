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
        case .wheel: return "circle.circle"
        case .reel: return "text.line.first.and.arrowtriangle.forward"
        case .lotteryBalls: return "circle.grid.2x2.fill"
        case .mysteryCard: return "questionmark.square.fill"
        }
    }
}

extension OddsMode {
    var systemImage: String {
        switch self {
        case .equal: return "equal.circle"
        case .customWeighted: return "slider.horizontal.3"
        case .reverseStandings: return "list.number"
        }
    }

    var explanation: String {
        switch self {
        case .equal:
            return "Every eligible entry has the same chance."
        case .customWeighted:
            return "Weights are relative chances, not fixed percentages. A weight of 0 keeps an entry out of draws."
        case .reverseStandings:
            return "Order entries from worst finish (top) to best. The worst gets the most weight. An illustrative fantasy preset, not any league's official lottery."
        }
    }
}

/// Dismisses the keyboard from anywhere (number pads have no return key).
@MainActor
func dismissKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
