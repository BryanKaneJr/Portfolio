import SwiftUI
import ShiftTipsCore

/// Equal | By Hours | Hours x Points, as three large buttons that wrap
/// rather than truncate at big text sizes.
struct MethodPicker: View {
    @Binding var method: SplitMethod

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("SPLIT METHOD")
            HStack(spacing: 6) {
                ForEach(SplitMethod.allCases, id: \.self) { option in
                    let selected = option == method
                    Button {
                        method = option
                    } label: {
                        Text(option.title)
                            .font(.subheadline.weight(.semibold))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.85)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .padding(.horizontal, 4)
                            .foregroundStyle(selected ? Theme.onAccent : Theme.ink)
                            .background(selected ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(option.spokenTitle)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityIdentifier("method-\(option.rawValue)")
                }
            }
            Text(method.summary)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}
