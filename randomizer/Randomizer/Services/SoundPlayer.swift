import AVFoundation
import Foundation

enum SoundEffect: String, CaseIterable {
    case tick
    case clack
    case reveal
}

/// Small bundled sounds made for this app. The ambient session respects
/// the ringer switch and mixes with whatever else is playing.
@MainActor
final class SoundPlayer {
    static let shared = SoundPlayer()

    private var players: [SoundEffect: [AVAudioPlayer]] = [:]
    private var nextPlayer: [SoundEffect: Int] = [:]
    private var schedule: Task<Void, Never>?

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        for effect in SoundEffect.allCases {
            guard let url = Bundle.main.url(forResource: effect.rawValue, withExtension: "wav") else { continue }
            let voices = effect == .reveal ? 1 : 4
            players[effect] = (0..<voices).compactMap { _ in
                let player = try? AVAudioPlayer(contentsOf: url)
                player?.prepareToPlay()
                return player
            }
        }
    }

    func play(_ effect: SoundEffect, volume: Float = 1) {
        guard Preferences.soundOn, let voices = players[effect], !voices.isEmpty else { return }
        let index = (nextPlayer[effect] ?? 0) % voices.count
        nextPlayer[effect] = index + 1
        let player = voices[index]
        player.volume = volume
        player.currentTime = 0
        player.play()
    }

    /// Plays `effect` at each offset (seconds from now), with a light haptic
    /// on each when haptics are on.
    func playSchedule(_ effect: SoundEffect, at times: [Double]) {
        schedule?.cancel()
        guard !times.isEmpty else { return }
        let start = Date()
        schedule = Task { [weak self] in
            for time in times {
                let wait = time - Date().timeIntervalSince(start)
                if wait > 0 {
                    try? await Task.sleep(for: .seconds(wait))
                }
                guard !Task.isCancelled else { return }
                self?.play(effect, volume: effect == .tick ? 0.6 : 0.8)
                Haptics.tick()
            }
        }
    }

    func stopSchedule() {
        schedule?.cancel()
        schedule = nil
    }
}
