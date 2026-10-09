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
                MiniWheel(count: 8)
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

    static func resultsImage(for list: DrawList) -> Image? {
        let lines = list.activeResults.map {
            ShareLine(position: "\($0.ordinal).", name: $0.nameSnapshot, detail: "\($0.chanceText) chance")
        }
        let date = (list.activeResults.first?.drawnAt ?? Date()).formatted(date: .abbreviated, time: .shortened)
        return image(
            title: list.title,
            subtitle: "Results \u{00B7} \(date)",
            lines: lines,
            footnote: list.sessionEdited ? "Edited session: a draw was undone." : nil
        )
    }

    static func draftOrderImage(title: String, picks: [DrawResult]) -> Image? {
        let lines = picks.sorted { $0.positionInAction < $1.positionInAction }.map {
            ShareLine(position: "#\($0.positionInAction)", name: $0.nameSnapshot, detail: nil)
        }
        let date = (picks.first?.drawnAt ?? Date()).formatted(date: .abbreviated, time: .shortened)
        return image(
            title: title,
            subtitle: "Draft order \u{00B7} \(date)",
            lines: lines
        )
    }
}
