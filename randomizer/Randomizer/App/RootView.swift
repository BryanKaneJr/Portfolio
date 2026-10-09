import SwiftUI

enum Route: Hashable {
    case editor(UUID)
    case draw(UUID)
    case draftOrder(UUID)
}

/// One shallow navigation stack: Home, then a list's editor or draw screen.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .editor(let id):
                        ListEditorView(listID: id, path: $path)
                    case .draw(let id):
                        DrawView(listID: id, path: $path)
                    case .draftOrder(let id):
                        DraftOrderView(listID: id)
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
    /// Opens a list's draw screen, going back to it if it's already open.
    mutating func showDraw(_ id: UUID) {
        if let index = lastIndex(of: .draw(id)) {
            removeSubrange((index + 1)...)
        } else {
            if last == .editor(id) { removeLast() }
            append(.draw(id))
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
