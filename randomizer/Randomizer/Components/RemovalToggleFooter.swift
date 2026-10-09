import SwiftUI

/// "Remove after selection", with Restore removed and Undo last draw beside
/// it. This one component sits in the sticky footer of every draw screen:
/// all four reveal styles, all three odds modes, single and batch draws,
/// the result view, presenter mode and the draft order reveal. It must
/// never move into Settings.
struct RemovalToggleFooter: View {
    @Binding var isOn: Bool
    let removedCount: Int
    let canUndo: Bool
    let onRestoreAll: () -> Void
    let onChooseRestore: () -> Void
    let onUndo: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle(isOn: $isOn) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remove after selection")
                        .font(Theme.rounded(.headline, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(isOn ? "Winners leave the pool for this session" : "Winners stay in. Repeats possible")
                        .font(.caption)
                        .foregroundStyle(isOn ? Theme.textSecondary : Theme.caution)
                }
            }
            .tint(Theme.accent)
            .accessibilityIdentifier("removeAfterSelectionToggle")
            .accessibilityHint("Applies to future draws only.")

            HStack(spacing: 8) {
                if removedCount > 0 {
                    Menu {
                        Button(action: onRestoreAll) {
                            Label("Restore all \(removedCount)", systemImage: "arrow.uturn.backward.circle")
                        }
                        Button(action: onChooseRestore) {
                            Label("Choose entries\u{2026}", systemImage: "checklist")
                        }
                    } label: {
                        Label("Restore removed (\(removedCount))", systemImage: "arrow.uturn.backward.circle")
                            .font(Theme.rounded(.footnote, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 36)
                            .background(Capsule().fill(Theme.accent.opacity(0.16)))
                    }
                    .accessibilityIdentifier("restoreRemovedButton")
                }
                Button(action: onUndo) {
                    Label("Undo last draw", systemImage: "arrow.uturn.left")
                }
                .buttonStyle(ChipButtonStyle(tint: Theme.textPrimary))
                .disabled(!canUndo)
                .accessibilityIdentifier("undoLastDrawButton")
                Spacer(minLength: 0)
            }
        }
    }
}

/// How many winners one tap draws.
struct BatchCountControl: View {
    @Binding var count: Int
    let maximum: Int

    var body: some View {
        HStack(spacing: 2) {
            Text("Winners")
                .lineLimit(1)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .padding(.leading, 10)
            Button {
                count = max(1, count - 1)
            } label: {
                Image(systemName: "minus")
                    .frame(width: 32, height: 36)
            }
            .disabled(count <= 1)
            .accessibilityLabel("Fewer winners")
            .accessibilityIdentifier("batchDecrement")
            Text("\(count)")
                .font(Theme.rounded(.subheadline, weight: .bold))
                .monospacedDigit()
                .frame(minWidth: 22)
                .accessibilityLabel("\(count) \(count == 1 ? "winner" : "winners") per draw")
                .accessibilityIdentifier("batchCount")
            Button {
                count = min(max(maximum, 1), count + 1)
            } label: {
                Image(systemName: "plus")
                    .frame(width: 32, height: 36)
            }
            .disabled(count >= maximum)
            .accessibilityLabel("More winners")
            .accessibilityIdentifier("batchIncrement")
        }
        .font(.subheadline.weight(.bold))
        .foregroundStyle(Theme.textPrimary)
        .background(Capsule().fill(Theme.surfaceRaised))
        .fixedSize()
    }
}

/// A short-lived confirmation such as "Undid: Sushi".
struct ToastView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.rounded(.footnote, weight: .semibold))
            .foregroundStyle(Theme.textPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(Theme.surfaceRaised))
            .overlay(Capsule().strokeBorder(Theme.stroke))
            .shadow(color: .black.opacity(0.3), radius: 10, y: 4)
    }
}
