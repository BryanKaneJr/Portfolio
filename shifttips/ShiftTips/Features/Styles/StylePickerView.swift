import SwiftUI
import ShiftTipsCore

/// "Which sounds most like your team?" The common ways of running tips,
/// each described in plain words. Picking one sets up a crew; every number
/// can be changed afterwards.
struct StylePickerView: View {
    var current: TipStyle?
    let onPick: (TipStyle) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Which sounds most like your team?")
                        .font(.display(.title2))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Pick the closest one. Next, you'll make every number match how you actually do it.")
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, 4)

                ForEach(Array(TipStyle.allCases.enumerated()), id: \.element) { position, style in
                    StyleCard(style: style, number: position + 1, isCurrent: style == current) { onPick(style) }
                }

                Text("These are common starting points, not recommendations. Set every number to match your workplace's own policy. " + PolicyCopy.disclaimer)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background { Theme.background.ignoresSafeArea() }
        .navigationTitle("Tip Style")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StyleCard: View {
    let style: TipStyle
    let number: Int
    let isCurrent: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(number < 10 ? "0\(number)" : "\(number)")
                        .font(.mono(.subheadline, weight: .bold))
                        .foregroundStyle(Theme.inkTertiary)
                        .accessibilityHidden(true)
                    Text(style.title)
                        .font(.display(.title3, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 4)
                    if isCurrent {
                        Tag("Current", style: .highlight)
                    }
                }
                Text(style.summary)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 4) {
                    SectionLabel("Sounds like you if")
                    Text(style.soundsLike)
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: 6) {
                    SectionLabel("Starts with")
                    ForEach(style.setupLines, id: \.self) { line in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("+")
                                .font(.mono(.caption, weight: .bold))
                                .foregroundStyle(Theme.inkSecondary)
                                .accessibilityHidden(true)
                            Text(line)
                                .font(.mono(.caption))
                                .foregroundStyle(Theme.ink)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.corner)
                        .strokeBorder(Theme.inkTertiary, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
                Text("Common in: \(style.commonIn)")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.corner))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(isCurrent ? Theme.ink : Theme.rule, lineWidth: isCurrent ? 2 : 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(StyleCardPress())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Sets up your crew this way. You can change every number next.")
        .accessibilityIdentifier("style-\(style.rawValue)")
    }
}

/// Cards press in with an ink edge, like a key.
private struct StyleCardPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(Theme.ink, lineWidth: configuration.isPressed ? 2 : 0)
            }
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

extension Crew {
    /// "Points pool", or what the crew does without a chosen style.
    var setupTitle: String {
        if let style { return style.title }
        return mode == .tipOut ? ShiftMode.tipOut.title : "\(ShiftMode.pool.title), \(method.title.lowercased())"
    }
}
