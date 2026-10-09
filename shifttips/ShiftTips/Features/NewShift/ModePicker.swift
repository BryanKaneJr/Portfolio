import SwiftUI
import ShiftTipsCore

/// Tip Pool | Tip Out, at the top of New Shift.
struct ModePicker: View {
    let mode: ShiftMode
    let onChange: (ShiftMode) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                ForEach(ShiftMode.allCases, id: \.self) { option in
                    let selected = option == mode
                    Button {
                        onChange(option)
                    } label: {
                        Text(option.title)
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundStyle(selected ? Theme.onHero : Theme.ink)
                            .background(selected ? Theme.hero : Color.clear, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityIdentifier("mode-\(option.rawValue)")
                }
            }
            .padding(4)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text(mode.summary)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
    }
}
