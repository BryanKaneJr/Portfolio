import Foundation

public enum AppInfo {
    public static let name = "Draft Lottery"
}

/// Plain-text draft order for the share sheet, built entirely on device.
public enum ResultsExporter {
    /// The full order, slot 1 first, with how each pick was decided. The
    /// run number is always there, so a re-run can't pass as the first.
    /// `dateText` is formatted by the caller in the person's locale.
    public static func runText(title: String, run: LotteryRun, dateText: String) -> String {
        var lines = ["\(title): draft order"]
        lines.append("\(run.type.title) run #\(run.number) \u{00B7} \(dateText)")
        lines.append(formatLine(run))
        lines.append("")
        for position in run.draftOrder {
            guard let pick = position.pick else {
                lines.append("\(position.slot). (open)")
                continue
            }
            lines.append("\(position.slot). \(pick.teamName) (\(detail(pick, in: run)))")
        }
        lines.append("")
        lines.append("Drawn with \(AppInfo.name)")
        return lines.joined(separator: "\n")
    }

    /// "drawn, finished 4th, up 3", "by standings, finished 1st, down 4",
    /// "by standings" for a playoff team, or "chose 3rd" in a Slot Draft.
    public static func detail(_ pick: LotteryPick, in run: LotteryRun) -> String {
        if run.type == .slotDraft {
            return "chose \(Ordinal.text(pick.pick))"
        }
        guard run.isLotteryPick(pick) else { return "by standings" }
        let how = pick.wasDrawn ? "drawn" : "by standings"
        return "\(how), finished \(Ordinal.text(pick.standing)), \(pick.movementText)"
    }

    /// One line on how the run worked.
    public static func formatLine(_ run: LotteryRun) -> String {
        let total = run.picks.count
        switch run.type {
        case .pro:
            let teams = run.lotteryTeams == total ? "All \(total) teams" : "Worst \(run.lotteryTeams) of \(total) teams"
            let drawn = run.drawnPicks == 1 ? "Pick 1 drawn" : "Picks 1\u{2013}\(run.drawnPicks) drawn"
            return "\(teams) in the lottery, pro-style odds. \(drawn)."
        case .longShot:
            return "All \(total) teams in, every pick drawn. The champ had a 1% shot at #1."
        case .slotDraft:
            return "All \(total) teams drew for the choosing order with equal odds, then chose their draft slots."
        }
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

    /// Ten teams in a Pro Lottery: the six that missed the playoffs draw
    /// for the top four picks, and the four playoff teams pick 7 to 10.
    public static func make(now: Date = Date()) -> League {
        League(
            title: "Sample League",
            teams: teams.map { Team(name: $0) },
            type: .pro,
            revealStyle: .lotteryBalls,
            isSample: true,
            createdAt: now
        )
    }
}
