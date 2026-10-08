import Foundation
@testable import RandomizerCore

/// Deterministic generator (SplitMix64) so engine tests are repeatable.
/// The app itself always uses SystemRandomNumberGenerator.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

enum Fixtures {
    static let now = Date(timeIntervalSinceReferenceDate: 800_000_000)

    static func list(
        _ names: [String],
        weights: [Int]? = nil,
        mode: OddsMode = .equal,
        removeAfterSelection: Bool = true
    ) -> DrawList {
        let entries = names.enumerated().map { index, name in
            DrawEntry(name: name, weight: weights?[index] ?? 1)
        }
        return DrawList(
            title: "Test",
            entries: entries,
            oddsMode: mode,
            removeAfterSelection: removeAfterSelection,
            createdAt: now
        )
    }

    static func id(_ name: String, in list: DrawList) -> UUID {
        list.entries.first { $0.name == name }!.id
    }

    static func temporaryDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("RandomizerCoreTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
