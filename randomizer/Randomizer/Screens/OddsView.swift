import SwiftUI
import RandomizerCore

/// The lottery odds table: every team's chance at the #1 pick and, when the
/// lottery draws fewer picks than it has teams, at a drawn pick. Custom
/// Odds weights are edited here.
struct OddsView: View {
    let leagueID: UUID
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let league = appState.league(leagueID) {
                    content(league)
                } else {
                    ContentUnavailableView("League not found", systemImage: "questionmark.folder")
                }
            }
            .navigationTitle("Lottery odds")
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

    private func content(_ league: League) -> some View {
        let rows = OddsCalculator.rows(for: league)
        let top = rows.map(\.probability).max() ?? 0
        let topN = league.drawnPicksAreContested ? league.drawnPicks : nil
        return List {
            Section {
                Picker("Odds", selection: Binding(
                    get: { league.oddsMode },
                    set: { mode in appState.update(leagueID) { $0.setOddsMode(mode) } }
                )) {
                    ForEach(OddsMode.allCases, id: \.self) { mode in
                        Text(mode.shortTitle).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("oddsModePicker")
                Text(league.oddsMode.explanation)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                Text([league.lotteryTeamsText, league.drawnPicksText, league.standingsPicksText].compactMap { $0 }.joined(separator: " \u{00B7} "))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
            }
            .listRowBackground(Theme.surface)

            Section {
                ForEach(rows) { row in
                    OddsRowView(
                        row: row,
                        fraction: top > 0 ? row.probability / top : 0,
                        topN: topN,
                        mode: league.oddsMode,
                        onSetWeight: { weight in appState.update(leagueID) { $0.setWeight(weight, for: row.id) } }
                    )
                }
            } header: {
                HStack {
                    Text("Standings: worst first")
                    Spacer()
                    Text(topN.map { "#1 \u{00B7} top \($0)" } ?? "#1 pick")
                }
            } footer: {
                Text(footer(league, topN: topN))
            }
            .listRowBackground(Theme.surface)
        }
        .themedList()
    }

    private func footer(_ league: League, topN: Int?) -> String {
        var parts: [String] = []
        switch league.oddsMode {
        case .reverseStandings:
            parts.append("Weights run from \(league.lotteryTeams) for the worst finish down to 1. Editing a weight switches to Custom Odds and keeps the others.")
        case .equal:
            parts.append("Switch to Custom to give some teams better chances.")
        case .customWeighted:
            parts.append("#1 pick chance = weight \u{F7} total weight of the lottery teams. After each pick the drawn team leaves the lottery, so everyone else's chance at the next pick goes up.")
        }
        if let topN {
            parts.append("Top \(topN) is the exact chance of landing any of the \(topN) drawn picks.")
        }
        return parts.joined(separator: " ")
    }
}

struct OddsRowView: View {
    let row: OddsRow
    let fraction: Double
    let topN: Int?
    let mode: OddsMode
    let onSetWeight: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                StandingBadge(standing: row.standing, size: 28)
                Text(row.name)
                    .font(Theme.rounded(.body, weight: .semibold))
                    .foregroundStyle(row.status == .inLottery ? Theme.textPrimary : Theme.textSecondary)
                    .lineLimit(2)
                Spacer(minLength: 8)
                trailing
            }
            if row.status != .notInLottery {
                OddsBar(fraction: fraction, color: row.status == .inLottery ? Theme.paletteColor(row.standing - 1) : Theme.textTertiary)
            }
            if mode == .customWeighted, row.status != .notInLottery {
                HStack(spacing: 8) {
                    Text("Weight")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                    Spacer(minLength: 0)
                    TextField("0", value: Binding(get: { row.weight }, set: { onSetWeight($0) }), format: .number)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .monospacedDigit()
                        .frame(width: 60)
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
        .accessibilityIdentifier("oddsRow")
    }

    @ViewBuilder
    private var trailing: some View {
        switch row.status {
        case .inLottery:
            VStack(alignment: .trailing, spacing: 0) {
                Text(row.chanceText)
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                if let top = row.drawnPickChanceText, let topN {
                    Text("top \(topN): \(top)")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .monospacedDigit()
        case .noChance:
            Text("0% \u{00B7} by standings")
                .font(.caption)
                .foregroundStyle(Theme.textTertiary)
        case .notInLottery:
            Tag(text: "Not in lottery", tint: Theme.textTertiary)
        }
    }

    private var accessibilitySummary: String {
        switch row.status {
        case .inLottery:
            var text = "Finish \(row.standing), \(row.name). \(row.chanceText) chance at the first pick."
            if let top = row.drawnPickChanceText, let topN { text += " \(top) chance at a top \(topN) pick." }
            return text
        case .noChance:
            return "Finish \(row.standing), \(row.name). Weight 0: picks by standings."
        case .notInLottery:
            return "Finish \(row.standing), \(row.name). Not in the lottery: picks by standings."
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
