import SwiftUI
import RandomizerCore

/// Sector layout. Each sector's angle is exactly its share of the pool's
/// weight, so a weighted wheel shows the real odds, never decorative ones.
enum WheelGeometry {
    /// Above this many sectors, names give way to numbers and a legend.
    static let labelLimit = 24

    struct Sector {
        let member: PoolMember
        /// Degrees clockwise from 12 o'clock.
        let start: Double
        let end: Double

        var span: Double { end - start }
        var mid: Double { (start + end) / 2 }
    }

    static func sectors(_ pool: [PoolMember]) -> [Sector] {
        let total = Double(pool.reduce(0) { $0 + $1.weight })
        var angle = 0.0
        return pool.map { member in
            let span = total > 0 ? Double(member.weight) / total * 360 : 360 / Double(max(pool.count, 1))
            defer { angle += span }
            return Sector(member: member, start: angle, end: angle + span)
        }
    }
}

struct WheelRevealView: View {
    let pool: [PoolMember]
    let winnerID: UUID?
    let phase: StagePhase
    let token: UUID

    @State private var startRotation = 0.0
    @State private var endRotation = 0.0
    @State private var plannedToken: UUID?

    var body: some View {
        let sectors = WheelGeometry.sectors(pool)
        TimelineView(.animation(minimumInterval: nil, paused: !phase.isAnimating)) { timeline in
            let t = phase.progress(at: timeline.date)
            let rotation = phase.isAnimating
                ? startRotation + (endRotation - startRotation) * Easing.out(t, power: RevealTiming.wheelPower)
                : endRotation
            GeometryReader { proxy in
                let side = min(proxy.size.width, proxy.size.height)
                ZStack(alignment: .top) {
                    WheelFace(
                        sectors: sectors,
                        rotation: rotation,
                        highlightID: phase == .landed ? winnerID : nil,
                        spinning: phase.isAnimating,
                        time: timeline.date.timeIntervalSinceReferenceDate
                    )
                    WheelPointer()
                        .frame(width: side * 0.11, height: side * 0.13)
                        .offset(y: -side * 0.015)
                }
                .frame(width: side, height: side)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
            }
        }
        .onAppear(perform: plan)
        .onChange(of: token) { _, _ in plan() }
    }

    /// Works out where to stop so the pointer lands inside the winner's
    /// sector. The spot within the sector is cosmetic only.
    private func plan() {
        guard let winnerID, plannedToken != token else { return }
        plannedToken = token
        guard let sector = WheelGeometry.sectors(pool).first(where: { $0.member.id == winnerID }) else { return }
        var random = CosmeticRandom(token)
        let landing = sector.start + sector.span * (0.2 + 0.6 * random.unit())
        let rest = endRotation
        var delta = (-landing - rest).truncatingRemainder(dividingBy: 360)
        if delta < 0 { delta += 360 }
        var spins = 0.0
        if case .animating(_, let duration) = phase {
            spins = RevealTiming.wheelSpins(for: duration)
        }
        startRotation = rest
        endRotation = rest + spins * 360 + delta
    }
}

private struct WheelFace: View {
    let sectors: [WheelGeometry.Sector]
    let rotation: Double
    let highlightID: UUID?
    let spinning: Bool
    let time: Double

    var body: some View {
        Canvas { context, size in
            draw(in: &context, size: size)
        }
        .shadow(color: .black.opacity(0.35), radius: 18, y: 10)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize) {
        let outer: CGFloat = min(size.width, size.height) / 2
        let rim: CGFloat = outer * 0.075
        let radius: CGFloat = outer - rim
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        drawRim(in: &context, center: center, outer: outer, rim: rim)

        var wheel = context
        wheel.translateBy(x: center.x, y: center.y)
        wheel.rotate(by: .degrees(rotation))
        for (index, sector) in sectors.enumerated() {
            drawSector(sector, index: index, in: &wheel, radius: radius)
        }
        if let highlightID, sectors.count > 1, let sector = sectors.first(where: { $0.member.id == highlightID }) {
            wheel.stroke(Self.sectorPath(sector, radius: radius), with: .color(.white), lineWidth: 4)
        }
        drawHub(in: &context, center: center, radius: radius)
    }

    private func drawRim(in context: inout GraphicsContext, center: CGPoint, outer: CGFloat, rim: CGFloat) {
        let rimRect = CGRect(x: center.x - outer, y: center.y - outer, width: outer * 2, height: outer * 2)
        context.fill(Path(ellipseIn: rimRect), with: .color(Theme.surfaceRaised))
        let bulbs = 24
        let ring: CGFloat = outer - rim / 2
        let bulbRadius: CGFloat = rim * 0.22
        let step = Int(time * 12)
        for index in 0..<bulbs {
            let angle = Double(index) / Double(bulbs) * 2 * Double.pi
            let x: CGFloat = center.x + CGFloat(cos(angle)) * ring
            let y: CGFloat = center.y + CGFloat(sin(angle)) * ring
            let lit: Bool = spinning ? (index + step) % 2 == 0 : (highlightID != nil || index % 2 == 0)
            let bulb = Path(ellipseIn: CGRect(x: x - bulbRadius, y: y - bulbRadius, width: bulbRadius * 2, height: bulbRadius * 2))
            let color: Color = lit ? Theme.caution : Theme.caution.opacity(0.25)
            context.fill(bulb, with: .color(color))
        }
    }

    private func drawSector(_ sector: WheelGeometry.Sector, index: Int, in wheel: inout GraphicsContext, radius: CGFloat) {
        let dimmed: Bool = highlightID != nil && sector.member.id != highlightID
        let path = Self.sectorPath(sector, radius: radius)
        let base: Color = Theme.paletteColor(index, count: sectors.count)
        wheel.fill(path, with: .color(dimmed ? base.opacity(0.35) : base))
        if sectors.count > 1 {
            wheel.stroke(path, with: .color(Theme.background.opacity(0.5)), lineWidth: 1.5)
        }

        var label = wheel
        label.rotate(by: .degrees(sector.mid - 90))
        let arcWidth: CGFloat = radius * 0.62 * CGFloat(sector.span * Double.pi / 180)
        let ink: Color = Theme.onPalette.opacity(dimmed ? 0.55 : 1)
        if sectors.count <= WheelGeometry.labelLimit, arcWidth >= 13 {
            let fontSize: CGFloat = min(18, max(10, min(arcWidth * 0.55, radius * 0.11)))
            let maxChars = max(3, Int(radius * 0.6 / (fontSize * 0.6)))
            let text = Text(Self.truncated(sector.member.name, to: maxChars))
                .font(.system(size: fontSize, weight: .bold, design: .rounded))
                .foregroundStyle(ink)
            label.draw(text, at: CGPoint(x: radius * 0.6, y: 0), anchor: .center)
        } else if arcWidth >= 8 {
            let fontSize: CGFloat = min(12, arcWidth * 0.7)
            let text = Text("\(sector.member.listIndex + 1)")
                .font(.system(size: fontSize, weight: .bold, design: .rounded))
                .foregroundStyle(ink)
            label.draw(text, at: CGPoint(x: radius * 0.84, y: 0), anchor: .center)
        }
    }

    private func drawHub(in context: inout GraphicsContext, center: CGPoint, radius: CGFloat) {
        let hub: CGFloat = radius * 0.17
        let hubPath = Path(ellipseIn: CGRect(x: center.x - hub, y: center.y - hub, width: hub * 2, height: hub * 2))
        context.fill(hubPath, with: .color(Theme.background))
        context.stroke(hubPath, with: .color(Theme.accent), lineWidth: 4)
        let dot: CGFloat = hub * 0.3
        context.fill(Path(ellipseIn: CGRect(x: center.x - dot, y: center.y - dot, width: dot * 2, height: dot * 2)), with: .color(Theme.accent))
    }

    private static func sectorPath(_ sector: WheelGeometry.Sector, radius: CGFloat) -> Path {
        var path = Path()
        path.move(to: .zero)
        path.addArc(
            center: .zero,
            radius: radius,
            startAngle: .degrees(sector.start - 90),
            endAngle: .degrees(sector.end - 90),
            clockwise: false
        )
        path.closeSubpath()
        return path
    }

    static func truncated(_ name: String, to limit: Int) -> String {
        name.count > limit ? String(name.prefix(max(limit - 1, 1))) + "\u{2026}" : name
    }
}

/// The fixed pointer at 12 o'clock.
private struct WheelPointer: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            path.move(to: CGPoint(x: size.width * 0.12, y: 0))
            path.addLine(to: CGPoint(x: size.width * 0.88, y: 0))
            path.addLine(to: CGPoint(x: size.width / 2, y: size.height))
            path.closeSubpath()
            context.fill(path, with: .color(.white))
            context.stroke(path, with: .color(Theme.background), lineWidth: 2)
        }
        .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
        .accessibilityHidden(true)
    }
}

/// Numbers to names when the wheel is too full for labels.
struct WheelLegendSheet: View {
    let pool: [PoolMember]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("This wheel has too many entries to label every sector. Name Reel reads better for big lists; switch styles from the \u{2026} menu.")
                        .font(.footnote)
                        .foregroundStyle(Theme.textSecondary)
                }
                .listRowBackground(Theme.surface)
                Section {
                    ForEach(Array(pool.enumerated()), id: \.element.id) { index, member in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Theme.paletteColor(index, count: pool.count))
                                .frame(width: 14, height: 14)
                            Text("\(member.listIndex + 1)")
                                .font(Theme.rounded(.subheadline, weight: .bold))
                                .monospacedDigit()
                                .frame(minWidth: 30, alignment: .leading)
                            Text(member.name)
                            Spacer()
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("Wheel legend")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
