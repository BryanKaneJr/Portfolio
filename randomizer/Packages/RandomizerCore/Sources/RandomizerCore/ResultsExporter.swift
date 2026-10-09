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

public enum SampleLists {
    /// The first-run list: something anyone can draw from in seconds.
    public static func dinner(now: Date = Date()) -> DrawList {
        DrawList(
            title: "Dinner tonight",
            entries: ["Pizza", "Tacos", "Burgers", "Sushi"].map { DrawEntry(name: $0) },
            oddsMode: .equal,
            revealStyle: .wheel,
            removeAfterSelection: true,
            isSample: true,
            createdAt: now
        )
    }
}
