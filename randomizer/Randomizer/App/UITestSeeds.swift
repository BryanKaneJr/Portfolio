import Foundation
import RandomizerCore

/// Ready-made leagues for UI tests and App Store screenshots, used only
/// when the app is launched with `-ui-testing`. Each launch gets its own
/// empty store unless `UITEST_STORE` names one to reuse across relaunches.
@MainActor
enum UITestSeeds {
    static func makeState() -> AppState {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent("DraftLotteryUITests", isDirectory: true)
        let name = LaunchOptions.environment("UITEST_STORE") ?? UUID().uuidString
        let state = AppState(repository: LeagueRepository(directory: base.appendingPathComponent(name, isDirectory: true)))
        guard state.userLeagues.isEmpty else { return state }

        switch LaunchOptions.environment("UITEST_SEED") {
        case "league":
            var seeded = league(
                style: RevealStyle(rawValue: LaunchOptions.environment("UITEST_STYLE") ?? "") ?? .lotteryBalls,
                mode: OddsMode(rawValue: LaunchOptions.environment("UITEST_MODE") ?? "") ?? .reverseStandings,
                lotteryTeams: LaunchOptions.environment("UITEST_LOTTERY").flatMap(Int.init),
                drawnPicks: LaunchOptions.environment("UITEST_DRAWN").flatMap(Int.init)
            )
            if let run = LaunchOptions.environment("UITEST_RUN") {
                _ = try? seeded.runLottery()
                if run == "revealed" { seeded.revealAllPicks() }
            }
            state.insert(seeded)
            switch LaunchOptions.environment("UITEST_OPEN") {
            case "lottery": state.launchRoutes = [.lottery(seeded.id)]
            case "editor": state.launchRoutes = [.editor(seeded.id)]
            default: break
            }
        case "tour":
            // Leagues kept as the person's own (no sample banner in
            // screenshots), one with a finished lottery.
            let now = Date()
            if let sample = state.sampleLeague {
                state.update(sample.id) {
                    $0.isSample = false
                    $0.title = "Sunday Night League"
                    $0.lastUsedAt = now
                }
            }
            var office = League(
                title: "Office League",
                teams: officeTeams.map { Team(name: $0) },
                revealStyle: .cardFlip,
                lotteryTeamCount: 6,
                drawnPickCount: 4,
                lastUsedAt: now.addingTimeInterval(-3_600)
            )
            _ = try? office.runLottery(now: now.addingTimeInterval(-3_600))
            office.revealAllPicks()
            office.lastUsedAt = now.addingTimeInterval(-3_600)
            state.insert(office)
            state.insert(League(
                title: "Family Dynasty",
                teams: teams.map { Team(name: $0) },
                oddsMode: .equal,
                lastUsedAt: now.addingTimeInterval(-86_400 * 3)
            ))
        default:
            break
        }
        return state
    }

    /// Last season's finish, worst first.
    static let teams = [
        "Gridiron Ghosts", "Turf Burners", "Blitz Brigade", "Fourth & Long",
        "Hail Marys", "End Zone Elite", "Pocket Passers", "Red Zone Royals",
    ]

    static let officeTeams = [
        "Accounts Payable", "The Interns", "Help Desk Heroes", "Sales Sharks", "Legal Eagles", "Night Shift",
        "Marketing Mavens", "Ops Squad", "Payroll Panthers", "C-Suite Kings", "Dev Ops", "Front Desk",
    ]

    static func league(style: RevealStyle, mode: OddsMode, lotteryTeams: Int?, drawnPicks: Int?) -> League {
        var league = League(
            title: "Friday Fantasy League",
            teams: teams.map { Team(name: $0) },
            oddsMode: mode,
            revealStyle: style,
            lotteryTeamCount: lotteryTeams,
            drawnPickCount: drawnPicks
        )
        if mode == .customWeighted {
            for (index, weight) in [40, 30, 20, 10, 8, 6, 4, 2].enumerated() {
                league.teams[index].weight = weight
            }
        }
        return league
    }
}
