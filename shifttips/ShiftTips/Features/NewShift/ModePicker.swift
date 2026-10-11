import SwiftUI
import ShiftTipsCore

/// Tip Pool | Tip Out, at the top of New Shift in Advanced.
struct ModePicker: View {
    let mode: ShiftMode
    let onChange: (ShiftMode) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SegmentedTabs(
                ShiftMode.allCases,
                selection: mode,
                title: { $0.title },
                identifier: { "mode-\($0.rawValue)" },
                onSelect: onChange
            )
            Text(mode.summary)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}
