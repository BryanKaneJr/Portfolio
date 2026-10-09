import SwiftUI
import ShiftTipsCore

/// The pooled tips, typed big and left-aligned on the page over an ink
/// rule, with optional separate cash and card amounts.
struct TipsCard: View {
    @Binding var form: ShiftForm
    var focus: FocusState<ShiftForm.Field?>.Binding
    /// Simple hides the separate cash and card amounts.
    var allowsCashAndCard = true
    var number: String?
    @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 50

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Tips to split", index: number) {
                Text("USD")
                    .font(.mono(.caption, weight: .semibold))
                    .foregroundStyle(Theme.inkTertiary)
                    .accessibilityHidden(true)
            }

            if form.splitCashAndCard {
                amountRow("Cash", text: $form.cashText, field: .cash)
                amountRow("Card", text: $form.cardText, field: .card)
                HStack(alignment: .firstTextBaseline) {
                    SectionLabel("Total pool")
                    Spacer()
                    Text(totalText)
                        .font(.display(.title2))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                }
                .padding(.top, 2)
                .accessibilityElement(children: .combine)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    TextField(
                        "Pooled tips",
                        text: dollarBinding($form.tipsText),
                        prompt: Text("$0.00").foregroundStyle(Theme.inkTertiary)
                    )
                    .font(.system(size: heroSize, weight: .heavy).width(.expanded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                    .keyboardType(.decimalPad)
                    .focused(focus, equals: .tips)
                    .padding(.bottom, 4)
                    .id(ShiftForm.Field.tips)
                    .accessibilityLabel("Pooled tips")
                    .accessibilityIdentifier("tipsField")
                    Rule(color: errorText == nil ? Theme.ink : Theme.warning, weight: focus.wrappedValue == .tips ? 3 : 1.5)
                        .animation(.snappy(duration: 0.2), value: focus.wrappedValue == .tips)
                }
            }

            if let error = errorText {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.warning)
            }

            if allowsCashAndCard {
                Toggle(isOn: Binding(get: { form.splitCashAndCard }, set: { form.setSplitCashAndCard($0) })) {
                    Text("Separate cash and card")
                        .font(.subheadline)
                }
                .toggleStyle(CheckboxToggleStyle())
                .accessibilityIdentifier("splitCashCardToggle")
            }
        }
    }

    private func amountRow(_ title: String, text: Binding<String>, field: ShiftForm.Field) -> some View {
        HStack(spacing: 12) {
            Text(title.uppercased())
                .font(.mono(.subheadline, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 56, alignment: .leading)
                .accessibilityHidden(true)
            TextField(title, text: dollarBinding(text), prompt: Text("$0.00").foregroundStyle(Theme.inkTertiary))
                .font(.display(.title))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.trailing)
                .keyboardType(.decimalPad)
                .focused(focus, equals: field)
                .padding(.vertical, 6)
                .fieldBox(focused: focus.wrappedValue == field)
                .id(field)
                .accessibilityLabel("\(title) tips")
        }
    }

    private var totalText: String {
        if case .success(let pool) = form.parsedPool() { return Money.format(pool.totalCents) }
        return Money.format(0)
    }

    private var errorText: String? {
        switch form.parsedPool() {
        case .success, .failure(.tipsMissing): return nil
        case .failure(.tips(let error)): return error.message
        case .failure(.cash(let error)): return "Cash: " + error.message
        case .failure(.card(let error)): return "Card: " + error.message
        case .failure(.combinedTooLarge): return MoneyInputError.tooLarge.message
        case .failure: return nil
        }
    }
}

/// Shows a "$" in front of what's typed without storing it, so the decimal
/// keypad (which has no "$") still produces "$472.38" on screen.
func dollarBinding(_ text: Binding<String>) -> Binding<String> {
    Binding(
        get: { text.wrappedValue.isEmpty ? "" : "$" + text.wrappedValue },
        set: { newValue in
            var value = Substring(newValue)
            while let first = value.first, first == "$" || first == " " {
                value = value.dropFirst()
            }
            text.wrappedValue = String(value)
        }
    )
}
