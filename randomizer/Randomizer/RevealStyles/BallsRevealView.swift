import SwiftUI
import RandomizerCore

/// Numbered balls tumble in a drum, then the winning ball rises out of it.
/// Simple 2D paths, no physics. The balls are presentation only: the odds
/// above the stage are what count, and the winner was drawn before the
/// first bounce.
struct BallsRevealView: View {
    let pool: [PoolMember]
    let winnerID: UUID?
    let phase: StagePhase
    let token: UUID

    static let maxBalls = 20

    var body: some View {
        let balls = Self.balls(pool: pool, winnerID: winnerID)
        let paths = Self.paths(count: balls.count, token: token)
        TimelineView(.animation(minimumInterval: nil, paused: !phase.isAnimating)) { timeline in
            let t = phase.progress(at: timeline.date)
            let time = timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { proxy in
                Canvas { context, size in
                    draw(context: &context, size: size, balls: balls, paths: paths, t: t, time: time)
                }
                .overlay(alignment: .bottom) {
                    if pool.count > balls.count {
                        Text("Showing \(balls.count) of \(pool.count) balls")
                            .font(.caption2)
                            .foregroundStyle(Theme.textTertiary)
                    }
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
        }
    }

    // MARK: Layout

    private struct Layout {
        let drumCenter: CGPoint
        let drumRadius: Double
        let ballRadius: Double
        let slot: CGPoint
    }

    private func makeLayout(for size: CGSize, count: Int) -> Layout {
        let diameter = min(size.width * 0.86, size.height * 0.74)
        let radius = diameter / 2
        let center = CGPoint(x: size.width / 2, y: size.height - radius - 14)
        let ballRadius = radius * (count > 12 ? 0.12 : 0.15)
        let top = center.y - radius
        let slotY = max(ballRadius * 2.6, top / 2)
        return Layout(drumCenter: center, drumRadius: radius, ballRadius: ballRadius, slot: CGPoint(x: size.width / 2, y: slotY))
    }

    /// Balls resting in a heap at the bottom of the drum.
    private func restPositions(count: Int, layout: Layout) -> [CGPoint] {
        var positions: [CGPoint] = []
        let r = layout.ballRadius
        let inner = layout.drumRadius - r - 2
        var row = 0
        while positions.count < count, row < 20 {
            let y = layout.drumCenter.y + inner - Double(row) * r * 1.75
            let dy = y - layout.drumCenter.y
            let halfWidth = max(0, (inner * inner - dy * dy).squareRoot())
            let capacity = max(1, Int((halfWidth * 2) / (r * 2.05)) + 1)
            let take = min(capacity, count - positions.count)
            let span = Double(take - 1) * r * 2.05
            let offset = row % 2 == 0 ? 0 : r * 0.4
            for index in 0..<take {
                positions.append(CGPoint(x: layout.drumCenter.x - span / 2 + Double(index) * r * 2.05 + offset, y: y))
            }
            row += 1
        }
        while positions.count < count {
            positions.append(layout.drumCenter)
        }
        return positions
    }

    private struct BallPath {
        let spin: Double
        let pulse: Double
        let angle: Double
        let phase: Double
    }

    private static func paths(count: Int, token: UUID) -> [BallPath] {
        var random = CosmeticRandom(token)
        return (0..<count).map { _ in
            BallPath(
                spin: (2.4 + random.unit() * 3) * (random.unit() < 0.5 ? -1 : 1),
                pulse: 2.5 + random.unit() * 3.5,
                angle: random.unit() * 2 * .pi,
                phase: random.unit() * 2 * .pi
            )
        }
    }

    private func tumbling(_ path: BallPath, time: Double, layout: Layout) -> CGPoint {
        let reach = layout.drumRadius - layout.ballRadius - 2
        let distance = reach * (0.2 + 0.8 * abs(sin(path.pulse * time + path.phase)))
        let angle = path.angle + path.spin * time
        return CGPoint(x: layout.drumCenter.x + cos(angle) * distance, y: layout.drumCenter.y + sin(angle) * distance)
    }

    // MARK: Drawing

    private func draw(context: inout GraphicsContext, size: CGSize, balls: [PoolMember], paths: [BallPath], t: Double, time: Double) {
        let layout = makeLayout(for: size, count: balls.count)
        let drum = Path(ellipseIn: CGRect(
            x: layout.drumCenter.x - layout.drumRadius,
            y: layout.drumCenter.y - layout.drumRadius,
            width: layout.drumRadius * 2,
            height: layout.drumRadius * 2
        ))
        context.fill(drum, with: .color(Theme.surface))
        context.stroke(drum, with: .color(Theme.accent.opacity(0.5)), lineWidth: 3)

        // The chute the winner rises through.
        let chuteWidth = layout.ballRadius * 2.6
        let chute = Path(roundedRect: CGRect(
            x: layout.slot.x - chuteWidth / 2,
            y: layout.slot.y,
            width: chuteWidth,
            height: max(0, layout.drumCenter.y - layout.drumRadius - layout.slot.y + 6)
        ), cornerRadius: chuteWidth / 2)
        context.fill(chute, with: .color(Theme.surface))
        context.stroke(chute, with: .color(Theme.accent.opacity(0.35)), lineWidth: 2)

        let winnerIndex = winnerID.flatMap { id in balls.firstIndex { $0.id == id } }
        let others = balls.indices.filter { $0 != winnerIndex }
        let restIdle = restPositions(count: balls.count, layout: layout)
        let restLanded = restPositions(count: others.count, layout: layout)

        let animating = phase.isAnimating
        let start = Easing.inOut(Easing.segment(t, from: 0, to: 0.12))
        let settle = Easing.inOut(Easing.segment(t, from: 0.7, to: 0.92))

        var drawn: [(CGPoint, Double, PoolMember, Int)] = []
        for (order, index) in others.enumerated() {
            let position: CGPoint
            if winnerIndex == nil {
                position = restIdle[index]
            } else if animating {
                let tumble = tumbling(paths[index], time: time, layout: layout)
                let from = mix(restIdle[index], tumble, start)
                position = mix(from, restLanded[order], settle)
            } else {
                position = restLanded[order]
            }
            drawn.append((position, 1, balls[index], index))
        }
        if let winnerIndex {
            let position: CGPoint
            let scale: Double
            if animating {
                let tumble = tumbling(paths[winnerIndex], time: time, layout: layout)
                let from = mix(restIdle[winnerIndex], tumble, start)
                position = mix(from, layout.slot, settle)
                scale = 1 + 1.3 * settle
            } else {
                position = layout.slot
                scale = 2.3
            }
            drawn.append((position, scale, balls[winnerIndex], winnerIndex))
        }

        context.drawLayer { layer in
            layer.clip(to: drum.union(chute))
            for item in drawn.dropLast(winnerIndex == nil ? 0 : 1) {
                drawBall(in: &layer, at: item.0, radius: layout.ballRadius * item.1, member: item.2)
            }
        }
        if winnerIndex != nil, let winner = drawn.last {
            if phase == .landed {
                let glow = Path(ellipseIn: CGRect(x: winner.0.x - layout.ballRadius * 3.2, y: winner.0.y - layout.ballRadius * 3.2, width: layout.ballRadius * 6.4, height: layout.ballRadius * 6.4))
                context.fill(glow, with: .radialGradient(
                    Gradient(colors: [Theme.accent.opacity(0.45), .clear]),
                    center: winner.0,
                    startRadius: 0,
                    endRadius: layout.ballRadius * 3.2
                ))
            }
            drawBall(in: &context, at: winner.0, radius: layout.ballRadius * winner.1, member: winner.2)
        }
    }

    private func drawBall(in context: inout GraphicsContext, at point: CGPoint, radius: Double, member: PoolMember) {
        let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        let ball = Path(ellipseIn: rect)
        context.fill(ball, with: .color(Theme.paletteColor(member.listIndex)))
        context.fill(ball, with: .radialGradient(
            Gradient(colors: [.white.opacity(0.55), .clear]),
            center: CGPoint(x: point.x - radius * 0.35, y: point.y - radius * 0.4),
            startRadius: 0,
            endRadius: radius * 1.1
        ))
        let face = radius * 0.52
        context.fill(
            Path(ellipseIn: CGRect(x: point.x - face, y: point.y - face, width: face * 2, height: face * 2)),
            with: .color(.white)
        )
        let label = Text("\(member.listIndex + 1)")
            .font(.system(size: face * 1.05, weight: .heavy, design: .rounded))
            .foregroundStyle(Theme.onPalette)
        context.draw(label, at: point, anchor: .center)
    }

    private func mix(_ a: CGPoint, _ b: CGPoint, _ amount: Double) -> CGPoint {
        CGPoint(x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount)
    }

    /// Up to 20 balls in list order, always including the winner.
    static func balls(pool: [PoolMember], winnerID: UUID?) -> [PoolMember] {
        guard pool.count > maxBalls else { return pool }
        guard let winnerID, let winner = pool.first(where: { $0.id == winnerID }) else {
            return Array(pool.prefix(maxBalls))
        }
        var chosen = Array(pool.filter { $0.id != winnerID }.prefix(maxBalls - 1))
        let insertAt = chosen.firstIndex { $0.listIndex > winner.listIndex } ?? chosen.count
        chosen.insert(winner, at: insertAt)
        return chosen
    }
}
