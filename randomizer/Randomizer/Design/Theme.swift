import SwiftUI
import UIKit

/// Colour and type tokens. Dark-first: a warm near-black base, one electric
/// violet accent, and a bright palette kept for wheel sectors and balls.
enum Theme {
    static let background = Color(red: 0.075, green: 0.063, blue: 0.055)
    static let surface = Color(red: 0.122, green: 0.106, blue: 0.094)
    static let surfaceRaised = Color(red: 0.173, green: 0.153, blue: 0.137)
    static let stroke = Color.white.opacity(0.08)
    static let accent = Color(red: 0.608, green: 0.420, blue: 1.0)
    static let accentDeep = Color(red: 0.443, green: 0.247, blue: 0.937)
    static let accentSoft = accent.opacity(0.18)
    static let textPrimary = Color(red: 0.969, green: 0.957, blue: 0.945)
    static let textSecondary = textPrimary.opacity(0.62)
    static let textTertiary = textPrimary.opacity(0.4)
    static let positive = Color(red: 0.239, green: 0.863, blue: 0.592)
    static let caution = Color(red: 1.0, green: 0.71, blue: 0.278)
    static let danger = Color(red: 1.0, green: 0.42, blue: 0.42)
    /// Text drawn on top of a palette colour.
    static let onPalette = Color(red: 0.102, green: 0.078, blue: 0.063)

    static let accentGradient = LinearGradient(
        colors: [accent, accentDeep],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let palette: [Color] = [
        Color(red: 1.0, green: 0.42, blue: 0.42),
        Color(red: 1.0, green: 0.71, blue: 0.278),
        Color(red: 1.0, green: 0.878, blue: 0.4),
        Color(red: 0.482, green: 0.847, blue: 0.561),
        Color(red: 0.239, green: 0.863, blue: 0.773),
        Color(red: 0.302, green: 0.671, blue: 0.969),
        Color(red: 0.455, green: 0.561, blue: 0.988),
        Color(red: 0.608, green: 0.420, blue: 1.0),
        Color(red: 0.906, green: 0.498, blue: 0.941),
        Color(red: 1.0, green: 0.561, blue: 0.671),
    ]

    /// Colour for an item at `index`; never repeats on neighbours, including
    /// the last and first sector of a wheel.
    static func paletteColor(_ index: Int, count: Int? = nil) -> Color {
        let size = palette.count
        var slot = ((index % size) + size) % size
        // The last sector would match the first one it touches.
        if let count, count > 2, index == count - 1, slot == 0 {
            slot = size / 2
        }
        return palette[slot]
    }

    static func rounded(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .rounded, weight: weight)
    }

    /// Navigation bars that match the dark base with rounded titles.
    @MainActor
    static func configureAppearance() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(background)
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [
            .foregroundColor: UIColor(textPrimary),
            .font: roundedUIFont(size: 17, weight: .semibold),
        ]
        appearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(textPrimary),
            .font: roundedUIFont(size: 34, weight: .bold),
        ]
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
    }

    private static func roundedUIFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        guard let descriptor = base.fontDescriptor.withDesign(.rounded) else { return base }
        return UIFont(descriptor: descriptor, size: size)
    }
}
