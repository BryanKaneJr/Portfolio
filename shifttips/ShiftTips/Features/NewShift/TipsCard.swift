import SwiftUI
import ShiftTipsCore

/// The pooled tips, typed big on the dark tips card, with optional
/// separate cash and card amounts.
struct TipsCard: View {
    @Binding var form: ShiftForm
    var focus: FocusState<ShiftForm.Field?>.Binding
    /// Simple hides the separate cash and card amounts.
    var allowsCashAndCard = true
    @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 52

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Tips to split")

            VStack(alignment: .leading, spacing: 14) {
                if form.splitCashAndCard {
                    amountRow("Cash", text: $form.cashText, field: .cash)
                    amountRow("Card", text: $form.cardText, field: .card)
                    Rectangle()
                        .fill(Theme.onHeroSecondary.opacity(0.35))
                        .frame(height: 1)
                        .accessibilityHidden(true)
                    HStack(alignment: .firstTextBaseline) {
                        Text("TOTAL POOL")
                            .font(.mono(.caption, weight: .semibold))
                            .tracking(1)
                            .foregroundStyle(Theme.onHeroSecondary)
                        Spacer()
                        Text(totalText)
                            .font(.display(.title2))
                            .monospacedDigit()
                            .foregroundStyle(Theme.onHero)
                    }
                    .accessibilityElement(children: .combine)
                } else {
                    HStack(alignment: .firstTextBaseline) {
                        TextField(
                            "Pooled tips",
                            text: dollarBinding($form.tipsText),
                            prompt: Text("$0.00").foregroundStyle(Theme.onHeroSecondary)
                        )
                        .font(.system(size: heroSize, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Theme.onHero)
                        .tint(Theme.highlight)
                        .keyboardType(.decimalPad)
                        .focused(focus, equals: .tips)
                        .id(ShiftForm.Field.tips)
                        .accessibilityLabel("Pooled tips")
                        .accessibilityIdentifier("tipsField")
                        Text("USD")
                            .font(.mono(.caption, weight: .semibold))
                            .foregroundStyle(Theme.onHeroSecondary)
                            .accessibilityHidden(true)
                    }
                }

                if let error = errorText {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.highlight)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.hero, in: RoundedRectangle(cornerRadius: Theme.cardCorner + 4, style: .continuous))
            .overlay {
                // A yellow ring while typing the tips.
                RoundedRectangle(cornerRadius: Theme.cardCorner + 4, style: .continuous)
                    .strokeBorder(Theme.highlight, lineWidth: focus.wrappedValue == .tips ? 2 : 0)
            }
            .animation(.snappy(duration: 0.2), value: focus.wrappedValue == .tips)

            if allowsCashAndCard {
                Toggle(isOn: Binding(get: { form.splitCashAndCard }, set: { form.setSplitCashAndCard($0) })) {
                    Text("Separate cash and card")
                        .font(.subheadline)
                }
                .toggleStyle(CheckboxToggleStyle())
                .padding(.horizontal, 4)
                .accessibilityIdentifier("splitCashCardToggle")
            }
        }
    }

    private func amountRow(_ title: String, text: Binding<String>, field: ShiftForm.Field) -> some View {
        HStack(spacing: 12) {
            Text(title.uppercased())
                .font(.mono(.subheadline, weight: .semibold))
                .foregroundStyle(Theme.onHeroSecondary)
                .frame(width: 56, alignment: .leading)
                .accessibilityHidden(true)
            TextField(title, text: dollarBinding(text), prompt: Text("$0.00").foregroundStyle(Theme.onHeroSecondary))
                .font(.display(.title))
                .monospacedDigit()
                .foregroundStyle(Theme.onHero)
                .tint(Theme.highlight)
                .multilineTextAlignment(.trailing)
                .keyboardType(.decimalPad)
                .focused(focus, equals: field)
                .padding(.horizontal, 12)
                .frame(minHeight: 52)
                .background(Theme.heroField, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Theme.highlight, lineWidth: focus.wrappedValue == field ? 2 : 0)
                }
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
