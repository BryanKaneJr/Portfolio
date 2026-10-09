import SwiftUI
import RandomizerCore

/// Where a reveal is. Reveal views are pure functions of the pool, the
/// already chosen winner and this phase, so skipping, switching style
/// mid-spin or coming back to the screen can never change the result.
enum StagePhase: Equatable {
    case idle
    case animating(start: Date, duration: Double)
    case landed

    var isAnimating: Bool {
        if case .animating = self { return true }
        return false
    }

    /// 0 at the start of the animation, 1 once landed.
    func progress(at date: Date) -> Double {
        switch self {
        case .idle:
            return 0
        case .landed:
            return 1
        case .animating(let start, let duration):
            guard duration > 0 else { return 1 }
            return Easing.clamp(date.timeIntervalSince(start) / duration)
        }
    }
}

enum Easing {
    static func clamp(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }

    /// Fast start, long gentle stop.
    static func out(_ t: Double, power: Double) -> Double {
        1 - pow(1 - clamp(t), power)
    }

    /// The time fraction at which `out(_:power:)` reaches `progress`.
    static func inverseOut(_ progress: Double, power: Double) -> Double {
        1 - pow(1 - clamp(progress), 1 / power)
    }

    static func inOut(_ t: Double) -> Double {
        let t = clamp(t)
        return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
    }

    /// Maps `t` from the window `from...to` onto 0...1.
    static func segment(_ t: Double, from: Double, to: Double) -> Double {
        guard to > from else { return t >= to ? 1 : 0 }
        return clamp((t - from) / (to - from))
    }
}

/// Decoration-only randomness (a wheel's landing spot inside the winning
/// sector, the reel's filler order, ball paths). Seeded from the reveal so
/// a reveal always looks the same; it never influences who wins.
struct CosmeticRandom: RandomNumberGenerator {
    private var state: UInt64

    init(_ token: UUID) {
        let bytes = withUnsafeBytes(of: token.uuid) { Array($0) }
        let offsetBasis: UInt64 = 0xCBF2_9CE4_8422_2325
        let prime: UInt64 = 0x100_0000_01B3
        state = bytes.reduce(offsetBasis) { ($0 ^ UInt64($1)) &* prime }
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    mutating func unit() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }
}

/// Shows the chosen style. Every style takes the same inputs.
struct RevealStage: View {
    let style: RevealStyle
    let pool: [PoolMember]
    let winnerID: UUID?
    let phase: StagePhase
    let token: UUID

    var body: some View {
        switch style {
        case .wheel:
            WheelRevealView(pool: pool, winnerID: winnerID, phase: phase, token: token)
        case .reel:
            ReelRevealView(pool: pool, winnerID: winnerID, phase: phase, token: token)
        case .lotteryBalls:
            BallsRevealView(pool: pool, winnerID: winnerID, phase: phase, token: token)
        case .mysteryCard:
            MysteryRevealView(pool: pool, winnerID: winnerID, phase: phase, token: token)
        }
    }
}

/// How long each style plays and when its ticks sound.
enum RevealTiming {
    static func duration(for style: RevealStyle, speed: AnimationSpeed, reduceMotion: Bool) -> Double {
        if reduceMotion || speed == .instant { return 0 }
        let standard: Double
        switch style {
        case .wheel: standard = 4.6
        case .reel: standard = 3.8
        case .lotteryBalls: standard = 4.2
        case .mysteryCard: standard = 3.2
        }
        return speed == .fast ? standard * 0.45 : standard
    }

    static func wheelSpins(for duration: Double) -> Double {
        duration < 3 ? 3 : 5
    }

    /// Names the reel scrolls through, ending on the winner.
    static let reelItemCount = 34

    static let wheelPower = 4.0
    static let reelPower = 4.0

    /// Tick sounds that follow what's on screen: slowing for the wheel and
    /// reel, a rattle for the balls, a quickening drumroll for the card.
    static func ticks(for style: RevealStyle, duration: Double, poolCount: Int, token: UUID) -> (SoundEffect, [Double]) {
        guard duration > 0 else { return (.tick, []) }
        var times: [Double] = []
        switch style {
        case .wheel:
            let crossings = Int((wheelSpins(for: duration) + 0.5) * Double(max(poolCount, 2)))
            let count = min(crossings, 70)
            times = (1..<count).map { k in
                duration * Easing.inverseOut(Double(k) / Double(count), power: wheelPower)
            }
            return (.tick, spaced(times, minimumGap: 0.045))
        case .reel:
            let count = reelItemCount - 1
            times = (1...count).map { k in
                duration * Easing.inverseOut(Double(k) / Double(count), power: reelPower)
            }
            return (.tick, spaced(times, minimumGap: 0.045))
        case .lotteryBalls:
            var random = CosmeticRandom(token)
            var t = 0.05
            while t < duration * 0.7 {
                times.append(t)
                t += 0.06 + random.unit() * 0.12
            }
            return (.clack, times)
        case .mysteryCard:
            var t = 0.0
            var gap = 0.26
            while t < duration * 0.62 {
                times.append(t)
                t += gap
                gap = max(0.05, gap * 0.86)
            }
            return (.tick, times)
        }
    }

    private static func spaced(_ times: [Double], minimumGap: Double) -> [Double] {
        var result: [Double] = []
        for time in times where time - (result.last ?? -1) >= minimumGap {
            result.append(time)
        }
        return result
    }
}

/// Runs one reveal at a time: start, skip, land. Landing is driven by a
/// timer here, not by the animation, so a skipped or interrupted reveal
/// still lands on the same committed result.
@Observable
@MainActor
final class RevealDriver {
    private(set) var phase: StagePhase = .idle
    private(set) var token = UUID()
    /// Increments on every landing, for announcements.
    private(set) var landings = 0

    @ObservationIgnored private var landingTask: Task<Void, Never>?

    func start(style: RevealStyle, poolCount: Int, reduceMotion: Bool) {
        landingTask?.cancel()
        token = UUID()
        let duration = RevealTiming.duration(for: style, speed: Preferences.speed, reduceMotion: reduceMotion)
        guard duration > 0 else {
            land()
            return
        }
        phase = .animating(start: Date(), duration: duration)
        let (effect, times) = RevealTiming.ticks(for: style, duration: duration, poolCount: poolCount, token: token)
        SoundPlayer.shared.playSchedule(effect, at: times)
        landingTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            self?.land()
        }
    }

    /// Jumps straight to the result that was already drawn.
    func skip() {
        guard phase.isAnimating else { return }
        landingTask?.cancel()
        land()
    }

    /// Lands without playing anything (Show all, Reveal all).
    func showLanded() {
        landingTask?.cancel()
        SoundPlayer.shared.stopSchedule()
        token = UUID()
        phase = .landed
        landings += 1
    }

    func reset() {
        landingTask?.cancel()
        SoundPlayer.shared.stopSchedule()
        phase = .idle
    }

    private func land() {
        SoundPlayer.shared.stopSchedule()
        withAnimation(.spring(response: 0.45, dampingFraction: 0.82)) {
            phase = .landed
        }
        landings += 1
        SoundPlayer.shared.play(.reveal)
        Haptics.success()
    }
}
