import Foundation
import RandomizerCore

/// Ready-made lists for UI tests and App Store screenshots, used only when
/// the app is launched with `-ui-testing`. Each launch gets its own empty
/// store unless `UITEST_STORE` names one to reuse across relaunches.
@MainActor
enum UITestSeeds {
    static func makeState() -> AppState {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent("RandomizerUITests", isDirectory: true)
        let name = LaunchOptions.environment("UITEST_STORE") ?? UUID().uuidString
        let state = AppState(repository: ListRepository(directory: base.appendingPathComponent(name, isDirectory: true)))
        guard state.userLists.isEmpty else { return state }

        switch LaunchOptions.environment("UITEST_SEED") {
        case "league":
            let list = league(
                style: RevealStyle(rawValue: LaunchOptions.environment("UITEST_STYLE") ?? "") ?? .wheel,
                mode: OddsMode(rawValue: LaunchOptions.environment("UITEST_MODE") ?? "") ?? .equal,
                removal: LaunchOptions.environment("UITEST_REMOVAL") != "off"
            )
            insert(list, into: state)
            if LaunchOptions.environment("UITEST_OPEN") == "draw" {
                state.launchRoutes = [.draw(list.id)]
            }
        case "tour":
            for list in tour() {
                insert(list, into: state)
            }
        default:
            break
        }
        return state
    }

    private static func insert(_ list: DrawList, into state: AppState) {
        let created = state.createList(title: list.title)
        state.update(created.id) { $0 = list }
    }

    static let teams = [
        "Gridiron Ghosts", "Turf Burners", "Blitz Brigade", "Fourth & Long",
        "Hail Marys", "End Zone Elite", "Pocket Passers", "Red Zone Royals",
    ]

    static func league(style: RevealStyle, mode: OddsMode, removal: Bool) -> DrawList {
        var list = DrawList(
            title: "Friday Fantasy Draft",
            entries: teams.map { DrawEntry(name: $0) },
            oddsMode: mode,
            revealStyle: style,
            removeAfterSelection: removal
        )
        if mode == .customWeighted {
            for (index, weight) in [40, 30, 20, 10, 8, 6, 4, 2].enumerated() {
                list.entries[index].weight = weight
            }
        }
        return list
    }

    static func tour() -> [DrawList] {
        let now = Date()
        var draft = league(style: .mysteryCard, mode: .reverseStandings, removal: true)
        draft.lastUsedAt = now

        let students = [
            "Ava", "Ben", "Chloe", "Diego", "Emma", "Farah", "Gabe", "Hana", "Isaac", "Jade",
            "Kai", "Leo", "Maya", "Noah", "Olive", "Priya", "Quinn", "Ruby", "Sam", "Theo",
        ]
        var classroom = DrawList(
            title: "Period 3",
            entries: students.map { DrawEntry(name: $0) },
            oddsMode: .equal,
            revealStyle: .reel,
            removeAfterSelection: true
        )
        classroom.lastUsedAt = now.addingTimeInterval(-3_600)

        var dinner = DrawList(
            title: "Dinner Choices",
            entries: ["Pizza", "Tacos", "Sushi", "Burgers", "Ramen", "Curry"].map { DrawEntry(name: $0) },
            oddsMode: .equal,
            revealStyle: .wheel,
            removeAfterSelection: false
        )
        dinner.lastUsedAt = now.addingTimeInterval(-7_200)

        var raffle = DrawList(
            title: "Team Raffle",
            entries: [("Alex", 3), ("Jordan", 2), ("Alex", 1), ("Riley", 4), ("Casey", 2), ("Morgan", 1), ("Taylor", 2), ("Jamie", 1)]
                .map { DrawEntry(name: $0.0, weight: $0.1) },
            oddsMode: .customWeighted,
            revealStyle: .lotteryBalls,
            removeAfterSelection: true
        )
        raffle.lastUsedAt = now.addingTimeInterval(-86_400)
        return [draft, classroom, dinner, raffle]
    }
}
