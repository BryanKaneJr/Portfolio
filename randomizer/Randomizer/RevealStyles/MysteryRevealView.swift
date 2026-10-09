import SwiftUI
import RandomizerCore

/// A face-down card trembles, glows, then flips to show the winner.
struct MysteryRevealView: View {
    let pool: [PoolMember]
    let winnerID: UUID?
    let phase: StagePhase
    let token: UUID

    var body: some View {
        let winner = winnerID.flatMap { id in pool.first { $0.id == id } }
        TimelineView(.animation(minimumInterval: nil, paused: !phase.isAnimating)) { timeline in
            let t = phase.progress(at: timeline.date)
            let time = timeline.date.timeIntervalSinceReferenceDate
            let build = phase.isAnimating ? Easing.segment(t, from: 0, to: 0.62) : 0
            let flip: Double = {
                switch phase {
                case .idle: return 0
                case .landed: return winner == nil ? 0 : 1
                case .animating: return Easing.inOut(Easing.segment(t, from: 0.62, to: 0.94))
                }
            }()
            let shake = phase.isAnimating ? sin(time * 40) * 5 * build * (1 - flip) : 0
            let lift = -12 * build * (1 - flip)
            let angle = flip * 180

            GeometryReader { proxy in
                let height = min(proxy.size.height * 0.9, 360)
                let width = min(height * 0.7, proxy.size.width * 0.8)
                ZStack {
                    Circle()
                        .fill(Theme.accent)
                        .frame(width: width * 1.3, height: width * 1.3)
                        .blur(radius: 50)
                        .opacity(0.15 + 0.45 * build + (phase == .landed && winner != nil ? 0.25 : 0))
                    ZStack {
                        if angle < 90 {
                            CardBack()
                        } else {
                            CardFront(member: winner)
                                .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                        }
                    }
                    .frame(width: width, height: height)
                    .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.45)
                    .rotationEffect(.degrees(shake))
                    .scaleEffect(1 + 0.05 * build * (1 - flip))
                    .offset(y: lift)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
        }
    }
}

private struct CardBack: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(Theme.accentGradient)
            .overlay {
                GeometryReader { proxy in
                    Canvas { context, size in
                        let step = 26.0
                        var y = step / 2
                        var row = 0
                        while y < size.height {
                            var x = row % 2 == 0 ? step / 2 : step
                            while x < size.width {
                                let diamond = Path { path in
                                    path.move(to: CGPoint(x: x, y: y - 4))
                                    path.addLine(to: CGPoint(x: x + 4, y: y))
                                    path.addLine(to: CGPoint(x: x, y: y + 4))
                                    path.addLine(to: CGPoint(x: x - 4, y: y))
                                    path.closeSubpath()
                                }
                                context.fill(diamond, with: .color(.white.opacity(0.12)))
                                x += step
                            }
                            y += step / 2
                            row += 1
                        }
                    }
                    .frame(width: proxy.size.width, height: proxy.size.height)
                }
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(.white.opacity(0.5), lineWidth: 2)
                    .padding(12)
            }
            .overlay {
                Text("?")
                    .font(.system(size: 96, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.25), radius: 8, y: 4)
            }
            .shadow(color: Theme.accentDeep.opacity(0.5), radius: 20, y: 10)
    }
}

private struct CardFront: View {
    let member: PoolMember?

    var body: some View {
        RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(Theme.surfaceRaised)
            .overlay(alignment: .top) {
                UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26, style: .continuous)
                    .fill(Theme.paletteColor(member?.listIndex ?? 0))
                    .frame(height: 18)
            }
            .overlay {
                VStack(spacing: 10) {
                    Image(systemName: "sparkles")
                        .font(.title)
                        .foregroundStyle(Theme.caution)
                    Text(member?.name ?? "")
                        .font(.system(size: 36, weight: .heavy, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .minimumScaleFactor(0.35)
                        .padding(.horizontal, 18)
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .strokeBorder(Theme.accent, lineWidth: 3)
            }
            .shadow(color: Theme.accent.opacity(0.45), radius: 24, y: 10)
    }
}
