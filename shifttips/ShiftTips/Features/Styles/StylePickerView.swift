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
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Which sounds most like your team?")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    Text("Pick the closest one. Next, you'll make every number match how you actually do it.")
                        .foregroundStyle(Theme.inkSecondary)
                }
                .padding(.bottom, 4)

                ForEach(TipStyle.allCases) { style in
                    StyleCard(style: style, isCurrent: style == current) { onPick(style) }
                }

                Text("These are common starting points, not recommendations. Set every number to match your workplace's own policy. " + PolicyCopy.disclaimer)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Tip Style")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StyleCard: View {
    let style: TipStyle
    let isCurrent: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: style.icon)
                        .font(.title3)
                        .foregroundStyle(Theme.accent)
                        .frame(width: 28)
                        .accessibilityHidden(true)
                    Text(style.title)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    if isCurrent {
                        Text("Current")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .foregroundStyle(Theme.accent)
                            .background(Theme.accentSoft, in: Capsule())
                    }
                }
                Text(style.summary)
                    .font(.subheadline)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.leading)
                Text("Sounds like you if \(style.soundsLike)")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.leading)
                VStack(alignment: .leading, spacing: 3) {
                    Text("STARTS WITH")
                        .font(.caption2.weight(.semibold))
                        .tracking(0.8)
                        .foregroundStyle(Theme.inkSecondary)
                    ForEach(style.setupLines, id: \.self) { line in
                        Text(line)
                            .font(.caption)
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.leading)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text("Common in: \(style.commonIn)")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .stroke(isCurrent ? Theme.accent : Color.clear, lineWidth: 2)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Sets up your crew this way. You can change every number next.")
        .accessibilityIdentifier("style-\(style.rawValue)")
    }
}

extension TipStyle {
    var icon: String {
        switch self {
        case .equalPool: "equal.circle.fill"
        case .hoursPool: "clock.fill"
        case .pointsPool: "chart.bar.fill"
        case .tipOutOfTips: "arrow.triangle.branch"
        case .tipOutOfSales: "receipt.fill"
        }
    }
}

extension Crew {
    /// "Points pool", or what the crew does without a chosen style.
    var setupTitle: String {
        if let style { return style.title }
        return mode == .tipOut ? ShiftMode.tipOut.title : "\(ShiftMode.pool.title), \(method.title.lowercased())"
    }
}
