import SwiftUI
import RandomizerCore

/// A vertical ticker of names that scrolls fast and settles on the winner
/// under the window. Readable with any number of entries.
struct ReelRevealView: View {
    let pool: [PoolMember]
    let winnerID: UUID?
    let phase: StagePhase
    let token: UUID

    var body: some View {
        let items = Self.items(pool: pool, winnerID: winnerID, token: token)
        let restIndex = winnerID == nil ? Double(min(items.count - 1, 2)) : Double(RevealTiming.reelItemCount - 1)
        TimelineView(.animation(minimumInterval: nil, paused: !phase.isAnimating)) { timeline in
            let t = phase.progress(at: timeline.date)
            let position = phase.isAnimating ? restIndex * Easing.out(t, power: RevealTiming.reelPower) : restIndex
            GeometryReader { proxy in
                let rowHeight = min(72, max(44, proxy.size.height / 5.2))
                let lower = max(0, Int(position.rounded(.down)) - 3)
                let upper = min(items.count - 1, Int(position.rounded(.up)) + 3)
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Theme.surface)
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(phase == .landed && winnerID != nil ? Theme.accent.opacity(0.28) : Theme.accentSoft)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Theme.accent, lineWidth: phase == .landed && winnerID != nil ? 3 : 1.5)
                        )
                        .frame(height: rowHeight * 1.08)
                        .padding(.horizontal, 12)
                    if lower <= upper {
                        ForEach(Array(lower...upper), id: \.self) { index in
                            let distance = Double(index) - position
                            Text(items[index].name)
                                .font(.system(size: rowHeight * 0.46, weight: .heavy, design: .rounded))
                                .foregroundStyle(abs(distance) < 0.5 ? Theme.textPrimary : Theme.textSecondary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.4)
                                .padding(.horizontal, 28)
                                .frame(width: proxy.size.width, height: rowHeight)
                                .scaleEffect(1 - min(abs(distance) * 0.12, 0.4))
                                .opacity(1 - min(abs(distance) / 3.2, 0.9))
                                .offset(y: distance * rowHeight)
                        }
                    }
                    HStack {
                        ReelArrow()
                        Spacer()
                        ReelArrow().rotationEffect(.degrees(180))
                    }
                    .frame(height: rowHeight)
                    .padding(.horizontal, 2)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(Theme.stroke)
                )
            }
        }
    }

    /// Filler names in a cosmetic order with the winner at index
    /// `reelItemCount - 1` and a few names after it, so the window always
    /// has neighbours. Idle, it's just the pool.
    static func items(pool: [PoolMember], winnerID: UUID?, token: UUID) -> [PoolMember] {
        guard !pool.isEmpty else { return [] }
        guard let winnerID, let winner = pool.first(where: { $0.id == winnerID }) else {
            return Array(pool.prefix(7))
        }
        let total = RevealTiming.reelItemCount + trailing
        guard pool.count > 1 else {
            return Array(repeating: winner, count: total)
        }
        let winnerIndex = RevealTiming.reelItemCount - 1
        var random = CosmeticRandom(token)
        var items: [PoolMember] = []
        items.reserveCapacity(total)
        while items.count < total {
            if items.count == winnerIndex {
                items.append(winner)
                continue
            }
            // No name twice in a row, and no decoy of the winner right
            // beside it; relax rather than loop when the pool is tiny.
            var options = pool.filter { $0.id != items.last?.id }
            if abs(items.count - winnerIndex) == 1 {
                let withoutWinner = options.filter { $0.id != winner.id }
                if !withoutWinner.isEmpty { options = withoutWinner }
            }
            if options.isEmpty { options = pool }
            items.append(options[Int(random.next() % UInt64(options.count))])
        }
        return items
    }

    private static let trailing = 3
}

private struct ReelArrow: View {
    var body: some View {
        Image(systemName: "arrowtriangle.right.fill")
            .font(.system(size: 14))
            .foregroundStyle(Theme.accent)
            .accessibilityHidden(true)
    }
}
