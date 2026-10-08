// swift-tools-version: 5.9
import PackageDescription

// The draw engine, odds, session rules and local storage. No UI and no
// platform frameworks beyond Foundation, so `swift test` runs on macOS and
// Linux alike. The iOS app links this package and draws every reveal style
// from it.
let package = Package(
    name: "RandomizerCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RandomizerCore", targets: ["RandomizerCore"]),
    ],
    targets: [
        .target(name: "RandomizerCore"),
        .testTarget(name: "RandomizerCoreTests", dependencies: ["RandomizerCore"]),
    ]
)
