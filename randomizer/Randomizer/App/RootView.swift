import SwiftUI

enum Route: Hashable {
    case editor(UUID)
    case lottery(UUID)
}

/// One shallow navigation stack: Home, then a league's lottery or editor.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .editor(let id):
                        LeagueEditorView(leagueID: id, path: $path)
                    case .lottery(let id):
                        LotteryView(leagueID: id, path: $path)
                    }
                }
        }
        .onAppear {
            if !appState.launchRoutes.isEmpty {
                path = appState.launchRoutes
                appState.launchRoutes = []
            }
        }
    }
}

extension Array where Element == Route {
    /// Opens a league's lottery, going back to it if it's already open.
    mutating func showLottery(_ id: UUID) {
        if let index = lastIndex(of: .lottery(id)) {
            removeSubrange((index + 1)...)
        } else {
            if last == .editor(id) { removeLast() }
            append(.lottery(id))
        }
    }

    mutating func showEditor(_ id: UUID) {
        if let index = lastIndex(of: .editor(id)) {
            removeSubrange((index + 1)...)
        } else {
            append(.editor(id))
        }
    }
}
