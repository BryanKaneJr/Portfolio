// swift-tools-version: 6.0
// ShiftTipsKit holds everything in ShiftTips that isn't a SwiftUI view or a
// PDF renderer, so it builds and tests anywhere Swift runs (Linux included).

import PackageDescription

let package = Package(
    name: "ShiftTipsKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "ShiftTipsCore", targets: ["ShiftTipsCore"]),
        .library(name: "ShiftTipsData", targets: ["ShiftTipsData"]),
    ],
    targets: [
        // Pure domain: money, minutes, points, the split engine, the shift
        // form, exports and the backup format. Foundation only.
        .target(name: "ShiftTipsCore"),
        // Local persistence and the observable app store.
        .target(name: "ShiftTipsData", dependencies: ["ShiftTipsCore"]),
        .testTarget(name: "ShiftTipsCoreTests", dependencies: ["ShiftTipsCore"]),
        .testTarget(name: "ShiftTipsDataTests", dependencies: ["ShiftTipsData"]),
    ]
)
