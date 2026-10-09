import SwiftUI

/// The "Remove" switch (Remove after selection): ON, each winner leaves
/// the pool for the session; OFF, repeats are possible. It sits at the
/// bottom right of every draw screen (all reveal styles and odds modes,
/// the result, presenter mode and the draft order reveal), affects future
/// draws only, and only the person ever flips it.
struct RemoveToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            Text("Remove")
                .font(Theme.rounded(.subheadline, weight: .semibold))
                .foregroundStyle(isOn ? Theme.textPrimary : Theme.textSecondary)
        }
        .fixedSize()
        .tint(Theme.accent)
        .accessibilityLabel("Remove after selection")
        .accessibilityHint(isOn
            ? "On: winners leave the pool. Affects future draws only."
            : "Off: repeats are possible. Affects future draws only.")
        .accessibilityIdentifier("removeAfterSelectionToggle")
    }
}

/// Undo and Restore chips, shown only when there is something to undo or
/// restore.
struct SessionActions: View {
    let removedCount: Int
    let canUndo: Bool
    var showsRestore = true
    let onRestoreAll: () -> Void
    let onChooseRestore: () -> Void
    let onUndo: () -> Void

    var isEmpty: Bool {
        !canUndo && !(showsRestore && removedCount > 0)
    }

    var body: some View {
        HStack(spacing: 8) {
            if canUndo {
                Button(action: onUndo) {
                    Label("Undo", systemImage: "arrow.uturn.left")
                }
                .buttonStyle(ChipButtonStyle(tint: Theme.textPrimary))
                .accessibilityLabel("Undo last draw")
                .accessibilityIdentifier("undoLastDrawButton")
            }
            if showsRestore, removedCount > 0 {
                Menu {
                    Button(action: onRestoreAll) {
                        Label("Restore all \(removedCount)", systemImage: "arrow.uturn.backward.circle")
                    }
                    Button(action: onChooseRestore) {
                        Label("Choose entries\u{2026}", systemImage: "checklist")
                    }
                } label: {
                    Label("Restore \(removedCount)", systemImage: "arrow.uturn.backward.circle")
                        .font(Theme.rounded(.footnote, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 12)
                        .frame(minHeight: 36)
                        .background(Capsule().fill(Theme.accent.opacity(0.16)))
                }
                .accessibilityLabel("Restore removed, \(removedCount)")
                .accessibilityIdentifier("restoreRemovedButton")
            }
            Spacer(minLength: 0)
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
