import SwiftUI
import ShiftTipsCore

/// Equal | By Hours | Hours x Points, as a segmented strip whose labels
/// wrap rather than truncate at big text sizes.
struct MethodPicker: View {
    @Binding var method: SplitMethod

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Split method")
            SegmentedTabs(
                SplitMethod.allCases,
                selection: method,
                title: { $0.title },
                spokenTitle: { $0.spokenTitle },
                identifier: { "method-\($0.rawValue)" },
                onSelect: { method = $0 }
            )
            Text(method.summary)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}
