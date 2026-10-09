import Foundation

public enum AppInfo {
    public static let name = "Randomizer: Spin & Reveal"
    public static let shortName = "Randomizer"
}

/// Plain-text summaries for the share sheet, built entirely on device.
public enum ResultsExporter {
    /// The session's results in draw order.
    public static func resultsText(
        title: String,
        results: [DrawResult],
        sessionEdited: Bool = false,
        includeChances: Bool = true
    ) -> String {
        var lines = ["\(title): results"]
        if results.isEmpty {
            lines.append("No draws yet.")
        }
        for result in results {
            var line = "\(result.ordinal). \(result.nameSnapshot)"
            if includeChances { line += " (\(result.chanceText) chance)" }
            lines.append(line)
        }
        if sessionEdited {
            lines.append("")
            lines.append("Edited session: a draw was undone.")
        }
        lines.append("")
        lines.append("Drawn with \(AppInfo.name)")
        return lines.joined(separator: "\n")
    }

    /// A unique order, pick 1 first, whatever order it was revealed in.
    public static func draftOrderText(
        title: String,
        picks: [DrawResult],
        includeChances: Bool = true
    ) -> String {
        var lines = ["\(title): draft order"]
        for pick in picks.sorted(by: { $0.positionInAction < $1.positionInAction }) {
            var line = "Pick \(pick.positionInAction): \(pick.nameSnapshot)"
            if includeChances { line += " (\(pick.chanceText) chance at that pick)" }
            lines.append(line)
        }
        lines.append("")
        lines.append("Drawn with \(AppInfo.name)")
        return lines.joined(separator: "\n")
    }
}

/// The ready-made examples a new customer sees on Home, one per reveal
/// style that tells its own story. Each can be tried at once, then kept,
/// edited, duplicated or deleted like any list.
public enum SampleLists {
    public static func examples(now: Date = Date()) -> [DrawList] {
        [dinner(now: now), draftLottery(now: now), contestants(now: now)]
    }

    /// Spin Wheel, equal odds, repeats allowed: dinner can come up twice.
    public static func dinner(now: Date = Date()) -> DrawList {
        DrawList(
            title: "What's for Dinner?",
            entries: ["Italian", "Chinese", "Mexican", "Burgers", "Pizza", "Sushi", "Thai", "BBQ"]
                .map { DrawEntry(name: $0) },
            oddsMode: .equal,
            revealStyle: .wheel,
            removeAfterSelection: false,
            isSample: true,
            createdAt: now
        )
    }

    /// Lottery Balls with Reverse Standings: ten teams, worst finish first,
    /// ready for a weighted draft order.
    public static func draftLottery(now: Date = Date()) -> DrawList {
        DrawList(
            title: "Fantasy Draft Lottery",
            entries: draftTeams.map { DrawEntry(name: $0) },
            oddsMode: .reverseStandings,
            revealStyle: .lotteryBalls,
            removeAfterSelection: true,
            isSample: true,
            createdAt: now
        )
    }

    /// Name Reel, a game-show style call: everyone gets called once.
    public static func contestants(now: Date = Date()) -> DrawList {
        DrawList(
            title: "Next Contestant",
            entries: ["Bryan", "Anthony", "Jayna", "Joe", "James", "Cassey", "Brandon", "Maria", "Tyler", "Nicole"]
                .map { DrawEntry(name: $0) },
            oddsMode: .equal,
            revealStyle: .reel,
            removeAfterSelection: true,
            isSample: true,
            createdAt: now
        )
    }

    /// Last season's finish, worst to best.
    public static let draftTeams = [
        "Matt's Marauders", "Joey's Giants", "Jimmy's Juggernauts", "Danny's Dynasty", "Chris's Crushers",
        "Mike's Mayhem", "Nick's Night Owls", "Tony's Tornadoes", "Steve's Stampede", "Kyle's Kodiaks",
    ]
}
