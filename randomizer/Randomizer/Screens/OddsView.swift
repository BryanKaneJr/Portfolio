import SwiftUI
import RandomizerCore

/// The odds table: every team's chance at the #1 pick (or the first choice
/// in a Slot Draft) and, when the lottery draws fewer picks than it has
/// teams, its exact chance of landing a drawn pick.
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
            }
        }
    }

    private func content(_ league: League) -> some View {
        let rows = OddsCalculator.rows(for: league)
        let top = rows.map(\.probability).max() ?? 0
        let topN = league.drawnPicksAreContested ? league.drawnPicks : nil
        return List {
            Section {
                Label(league.type.title, systemImage: league.type.systemImage)
                    .font(Theme.rounded(.headline, weight: .bold))
                    .foregroundStyle(Theme.accent)
                Text(league.type.explanation)
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
                        topN: topN
                    )
                }
            } header: {
                HStack {
                    Text("Standings: worst first")
                    Spacer()
                    Text(league.type == .slotDraft ? "1st choice" : topN.map { "#1 \u{00B7} top \($0)" } ?? "#1 pick")
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
        switch league.type {
        case .pro:
            parts.append("The same combinations the pros use, for the \(league.lotteryTeams) teams in your lottery. Each drawn team leaves the drum, so everyone else's chance at the next pick goes up.")
        case .longShot:
            parts.append("Out of 1,000 combinations the champion holds 10, and each worse finish holds an equal step more.")
        case .slotDraft:
            parts.append("Everyone has the same chance to choose first. Each team chooses its draft slot when its name comes up.")
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
            if row.status == .inLottery {
                OddsBar(fraction: fraction, color: Theme.paletteColor(row.standing - 1))
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
        case .notInLottery:
            Tag(text: "Playoff team", tint: Theme.textTertiary)
        }
    }

    private var accessibilitySummary: String {
        switch row.status {
        case .inLottery:
            var text = "Finish \(row.standing), \(row.name). \(row.chanceText) chance at the first pick."
            if let top = row.drawnPickChanceText, let topN { text += " \(top) chance at a top \(topN) pick." }
            return text
        case .notInLottery:
            return "Finish \(row.standing), \(row.name). Playoff team: picks by standings."
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
