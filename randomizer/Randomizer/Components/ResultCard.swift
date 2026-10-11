import SwiftUI
import RandomizerCore

/// One line on a share card.
struct ShareLine: Identifiable {
    let id = UUID()
    let position: String
    let name: String
    let detail: String?
}

/// The image people share: built on device, never uploaded anywhere.
struct ResultCardView: View {
    let title: String
    let subtitle: String
    let lines: [ShareLine]
    var footnote: String?

    static let maxLines = 24

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 10) {
                BallCluster()
                    .frame(width: 30, height: 30)
                Text(AppInfo.name)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.textSecondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)
                Text(subtitle)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading, spacing: 10) {
                ForEach(lines.prefix(Self.maxLines)) { line in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(line.position)
                            .font(.system(size: 16, weight: .heavy, design: .rounded))
                            .foregroundStyle(Theme.accent)
                            .frame(minWidth: 34, alignment: .leading)
                        Text(line.name)
                            .font(.system(size: 19, weight: .bold, design: .rounded))
                            .foregroundStyle(Theme.textPrimary)
                            .lineLimit(2)
                        Spacer(minLength: 8)
                        if let detail = line.detail {
                            Text(detail)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                if lines.count > Self.maxLines {
                    Text("+ \(lines.count - Self.maxLines) more")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(18)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.surface))
            if let footnote {
                Text(footnote)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(26)
        .frame(width: 390)
        .background(
            LinearGradient(
                colors: [Theme.background, Color(red: 0.13, green: 0.09, blue: 0.2)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .environment(\.colorScheme, .dark)
    }
}

@MainActor
enum ShareRenderer {
    static func image(title: String, subtitle: String, lines: [ShareLine], footnote: String? = nil) -> Image? {
        let renderer = ImageRenderer(content: ResultCardView(title: title, subtitle: subtitle, lines: lines, footnote: footnote))
        renderer.scale = 3
        guard let uiImage = renderer.uiImage else { return nil }
        return Image(uiImage: uiImage)
    }

    /// The full order, pick 1 first, with the run number on it.
    static func runImage(title: String, run: LotteryRun) -> Image? {
        let lines = run.picks.sorted { $0.pick < $1.pick }.map { pick in
            ShareLine(position: "#\(pick.pick)", name: pick.teamName, detail: movement(pick, in: run))
        }
        let date = run.ranAt.formatted(date: .abbreviated, time: .shortened)
        return image(
            title: title,
            subtitle: "Draft order \u{00B7} Run #\(run.number) \u{00B7} \(date)",
            lines: lines,
            footnote: ResultsExporter.formatLine(run)
        )
    }

    /// "▲ 3 from 4th" for lottery teams that moved, "4th" for one that
    /// didn't, nothing for teams outside the lottery.
    private static func movement(_ pick: LotteryPick, in run: LotteryRun) -> String? {
        guard run.isLotteryPick(pick) else { return nil }
        let finish = Ordinal.text(pick.standing)
        if pick.movement > 0 { return "\u{25B2} \(pick.movement) from \(finish)" }
        if pick.movement < 0 { return "\u{25BC} \(-pick.movement) from \(finish)" }
        return finish
    }
}

/// Three overlapping lottery balls, the app's mark.
struct BallCluster: View {
    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height) * 0.62
            ZStack {
                ball(Theme.paletteColor(0), size: size)
                    .offset(x: -size * 0.32, y: size * 0.18)
                ball(Theme.paletteColor(5), size: size)
                    .offset(x: size * 0.32, y: size * 0.18)
                ball(Theme.paletteColor(2), size: size)
                    .offset(y: -size * 0.24)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .accessibilityHidden(true)
    }

    private func ball(_ color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(color)
            .overlay(Circle().fill(.white).padding(size * 0.28))
            .frame(width: size, height: size)
    }
}
