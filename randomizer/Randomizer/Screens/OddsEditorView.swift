import SwiftUI
import RandomizerCore

/// Every entry's weight and chance for the next draw, side by side, with a
/// proportional bar. Chances follow the current pool, not the whole list.
struct OddsEditorView: View {
    let listID: UUID
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let list = appState.list(listID) {
                    content(list)
                } else {
                    ContentUnavailableView("List not found", systemImage: "questionmark.folder")
                }
            }
            .navigationTitle("Odds")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("oddsDoneButton")
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { dismissKeyboard() }
                }
            }
        }
    }

    private func content(_ list: DrawList) -> some View {
        let rows = OddsCalculator.rows(for: list)
        let top = rows.map(\.probability).max() ?? 0
        return List {
            Section {
                Picker("Odds", selection: Binding(
                    get: { list.oddsMode },
                    set: { mode in appState.update(listID) { $0.setOddsMode(mode) } }
                )) {
                    ForEach(OddsMode.allCases, id: \.self) { mode in
                        Text(mode.shortTitle).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                Text(list.oddsMode.explanation)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                summary(list)
            }
            .listRowBackground(Theme.surface)

            Section {
                ForEach(rows) { row in
                    OddsRowView(
                        row: row,
                        fraction: top > 0 ? row.probability / top : 0,
                        color: Theme.paletteColor(row.rank - 1),
                        mode: list.oddsMode,
                        onSetWeight: { weight in appState.update(listID) { $0.setWeight(weight, for: row.id) } }
                    )
                }
            } header: {
                Text("Chance for the next draw")
            } footer: {
                Text(footer(list))
            }
            .listRowBackground(Theme.surface)
        }
        .themedList()
    }

    private func summary(_ list: DrawList) -> some View {
        HStack(spacing: 8) {
            Tag(text: "\(list.eligibleCount) eligible", systemImage: "checkmark.circle", tint: Theme.positive)
            if !list.removedEntryIDs.isEmpty {
                Tag(text: "\(list.removedEntries.count) removed", systemImage: "minus.circle", tint: Theme.caution)
            }
            if !list.excludedEntries.isEmpty {
                Tag(text: "\(list.excludedEntries.count) at 0", systemImage: "slash.circle", tint: Theme.textTertiary)
            }
            Spacer(minLength: 0)
            Text("Total weight \(list.totalEligibleWeight)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private func footer(_ list: DrawList) -> String {
        switch list.oddsMode {
        case .equal:
            return "Switch to Weighted to give some entries better chances."
        case .customWeighted:
            return "Chance = weight \u{F7} total weight of eligible entries. When someone is removed, everyone else's chance goes up in proportion."
        case .reverseStandings:
            return "Weights run from \(list.entries.count) for the worst finish down to 1 for the best. Editing a weight switches to Weighted and keeps this order."
        }
    }
}

struct OddsRowView: View {
    let row: OddsRow
    let fraction: Double
    let color: Color
    let mode: OddsMode
    let onSetWeight: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                if mode == .reverseStandings {
                    Text("\(row.rank).")
                        .font(Theme.rounded(.subheadline, weight: .bold))
                        .foregroundStyle(Theme.accent)
                        .monospacedDigit()
                }
                Text(row.name)
                    .font(Theme.rounded(.body, weight: .semibold))
                    .foregroundStyle(row.status == .eligible ? Theme.textPrimary : Theme.textSecondary)
                    .lineLimit(2)
                Spacer(minLength: 8)
                Text(row.chanceText)
                    .font(Theme.rounded(.headline, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(row.status == .eligible ? Theme.textPrimary : Theme.textTertiary)
            }
            OddsBar(fraction: fraction, color: row.status == .eligible ? color : Theme.textTertiary)
            HStack(spacing: 8) {
                Text(weightLine)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
                if mode != .equal {
                    TextField("0", value: Binding(get: { row.weight }, set: { onSetWeight($0) }), format: .number)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .monospacedDigit()
                        .frame(width: 56)
                        .padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Theme.surfaceRaised))
                        .accessibilityLabel("Weight for \(row.name)")
                    Stepper(
                        "Weight",
                        value: Binding(get: { row.weight }, set: { onSetWeight($0) }),
                        in: Limits.minWeight...Limits.maxWeight
                    )
                    .labelsHidden()
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilitySummary)
    }

    private var weightLine: String {
        switch row.status {
        case .eligible:
            return "Weight \(row.weight) | Chance \(row.chanceText)"
        case .removed:
            return "Weight \(row.weight) | Removed this session"
        case .excluded:
            return "Weight 0 | 0% \u{00B7} excluded"
        }
    }

    private var accessibilitySummary: String {
        switch row.status {
        case .eligible:
            return "\(row.name). Weight \(row.weight). Chance \(row.chanceText)."
        case .removed:
            return "\(row.name). Removed this session. No chance in the next draw."
        case .excluded:
            return "\(row.name). Weight 0, excluded from draws."
        }
    }
}

/// A horizontal bar proportional to a chance.
struct OddsBar: View {
    let fraction: Double
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surfaceRaised)
                Capsule()
                    .fill(color)
                    .frame(width: max(fraction > 0 ? 4 : 0, proxy.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 8)
        .accessibilityHidden(true)
    }
}
