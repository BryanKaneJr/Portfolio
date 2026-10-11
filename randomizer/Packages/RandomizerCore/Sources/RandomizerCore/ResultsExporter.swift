import Foundation

public enum AppInfo {
    public static let name = "Draft Lottery"
}

/// Plain-text draft order for the share sheet, built entirely on device.
public enum ResultsExporter {
    /// The full order, pick 1 first, with how each pick was decided and
    /// how far each lottery team moved from its finish. The run number is
    /// always there, so a re-run can't pass as the first. `dateText` is
    /// formatted by the caller in the person's locale.
    public static func runText(title: String, run: LotteryRun, dateText: String) -> String {
        var lines = ["\(title): draft order"]
        lines.append("Lottery run #\(run.number) \u{00B7} \(dateText)")
        lines.append(formatLine(run))
        lines.append("")
        for pick in run.picks.sorted(by: { $0.pick < $1.pick }) {
            lines.append("\(pick.pick). \(pick.teamName) (\(detail(pick, in: run)))")
        }
        lines.append("")
        lines.append("Drawn with \(AppInfo.name)")
        return lines.joined(separator: "\n")
    }

    /// "drawn, finished 4th, up 3", "by standings, finished 1st, down 4",
    /// or "by standings" for a team outside the lottery.
    public static func detail(_ pick: LotteryPick, in run: LotteryRun) -> String {
        guard run.isLotteryPick(pick) else { return "by standings" }
        let how = pick.wasDrawn ? "drawn" : "by standings"
        return "\(how), finished \(Ordinal.text(pick.standing)), \(pick.movementText)"
    }

    /// "Worst 6 of 10 teams, weighted by standings. Picks 1–4 drawn."
    public static func formatLine(_ run: LotteryRun) -> String {
        let total = run.picks.count
        let teams = run.lotteryTeams == total ? "All \(total) teams" : "Worst \(run.lotteryTeams) of \(total) teams"
        let odds: String
        switch run.oddsMode {
        case .reverseStandings: odds = "weighted by standings"
        case .equal: odds = "equal odds"
        case .customWeighted: odds = "custom odds"
        }
        let drawn = run.drawnPicks == 1 ? "Pick 1 drawn." : "Picks 1\u{2013}\(run.drawnPicks) drawn."
        return "\(teams), \(odds). \(drawn)"
    }
}

/// The sample league a new customer can run in seconds, then keep, edit,
/// duplicate or delete like any league.
public enum SampleLeague {
    /// Last season's finish, worst to best.
    public static let teams = [
        "Matt's Marauders", "Joey's Giants", "Jimmy's Juggernauts", "Danny's Dynasty", "Chris's Crushers",
        "Mike's Mayhem", "Nick's Night Owls", "Tony's Tornadoes", "Steve's Stampede", "Kyle's Kodiaks",
    ]

    /// Ten teams; the six that missed the playoffs are in the lottery,
    /// weighted by standings, and the four playoff teams pick 7 to 10.
    public static func make(now: Date = Date()) -> League {
        League(
            title: "Sample League",
            teams: teams.map { Team(name: $0) },
            oddsMode: .reverseStandings,
            revealStyle: .lotteryBalls,
            lotteryTeamCount: 6,
            isSample: true,
            createdAt: now
        )
    }
}
