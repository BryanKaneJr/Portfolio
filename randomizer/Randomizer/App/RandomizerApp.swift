import SwiftUI

@main
@MainActor
struct RandomizerApp: App {
    @State private var appState: AppState

    init() {
        Preferences.registerDefaults()
        Theme.configureAppearance()
        _appState = State(initialValue: AppState.live())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}
