import SwiftUI
import ShiftTipsCore
import ShiftTipsData

@main
struct ShiftTipsApp: App {
    @State private var store: AppStore
    @State private var router = Router()

    init() {
        _store = State(initialValue: Self.makeStore())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(router)
        }
    }

    /// Real storage on device; throwaway memory storage for UI tests
    /// (launched with `-ui-testing`, plus `-advanced` or `-show-welcome`),
    /// so tests never touch real data.
    @MainActor
    private static func makeStore() -> AppStore {
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-ui-testing") {
            var library = Library()
            library.settings.hasSeenWelcome = !arguments.contains("-show-welcome")
            library.settings.experience = arguments.contains("-advanced") ? .advanced : .simple
            return AppStore(storage: MemoryStorage(library: library))
        }
        do {
            return AppStore(storage: try FileStorage.standard())
        } catch {
            let store = AppStore(storage: MemoryStorage())
            store.storageProblem = "ShiftTips couldn't open its storage on this iPhone, so nothing will be saved this time. Close and reopen the app to try again."
            return store
        }
    }
}

/// Screens pushed on the main navigation stack.
enum Route: Hashable {
    case review
    case history
    case shift(UUID)
    case totals
}

@Observable
final class Router {
    var path: [Route] = []

    func popToRoot() {
        path.removeAll()
    }
}

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.scenePhase) private var scenePhase
    @State private var showWelcome = false

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            NewShiftView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .review: ReviewSplitView()
                    case .history: HistoryView()
                    case .shift(let id): ShiftDetailView(shiftId: id)
                    case .totals: PeriodTotalsView()
                    }
                }
        }
        .tint(Theme.accent)
        .preferredColorScheme(store.settings.appearance.colorScheme)
        .onAppear {
            store.refreshForToday()
            if !store.settings.hasSeenWelcome { showWelcome = true }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.refreshForToday() }
        }
        .sheet(isPresented: $showWelcome, onDismiss: {
            store.updateSettings { $0.hasSeenWelcome = true }
        }) {
            WelcomeView()
        }
        .alert(
            "Storage Problem",
            isPresented: Binding(get: { store.storageProblem != nil }, set: { if !$0 { store.storageProblem = nil } }),
            presenting: store.storageProblem
        ) { _ in
            Button("OK") { store.storageProblem = nil }
        } message: { problem in
            Text(problem)
        }
    }
}

extension Appearance {
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

enum AppInfo {
    static var version: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    /// Set before launch (see README, "Launch checklist"). The support row
    /// in Settings stays hidden until it is.
    static let supportEmail: String? = nil
}
