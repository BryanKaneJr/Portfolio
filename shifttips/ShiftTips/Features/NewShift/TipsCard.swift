import SwiftUI
import ShiftTipsCore

/// The big pooled-tips input, with optional separate cash and card fields.
struct TipsCard: View {
    @Binding var form: ShiftForm
    var focus: FocusState<ShiftForm.Field?>.Binding
    @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 46

    var body: some View {
        VStack(spacing: 14) {
            Text("TODAY'S POOLED TIPS")
                .font(.caption.weight(.semibold))
                .tracking(1)
                .foregroundStyle(Theme.onHeroSecondary)
                .accessibilityAddTraits(.isHeader)

            if form.splitCashAndCard {
                amountRow("Cash", text: $form.cashText, field: .cash)
                amountRow("Card", text: $form.cardText, field: .card)
                Divider().overlay(Theme.onHeroSecondary.opacity(0.4))
                HStack {
                    Text("Total pool")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(totalText)
                        .font(.title2.weight(.bold))
                        .monospacedDigit()
                }
                .accessibilityElement(children: .combine)
            } else {
                TextField(
                    "Pooled tips",
                    text: dollarBinding($form.tipsText),
                    prompt: Text("$0.00").foregroundStyle(Theme.onHeroSecondary)
                )
                .font(.system(size: heroSize, weight: .bold, design: .rounded))
                .monospacedDigit()
                .multilineTextAlignment(.center)
                .keyboardType(.decimalPad)
                .focused(focus, equals: .tips)
                .minimumScaleFactor(0.6)
                .id(ShiftForm.Field.tips)
                .accessibilityLabel("Pooled tips")
                .accessibilityIdentifier("tipsField")
            }

            if let error = errorText {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.onHero)
            }

            Toggle(isOn: Binding(get: { form.splitCashAndCard }, set: { form.setSplitCashAndCard($0) })) {
                Text("Separate cash & card")
                    .font(.subheadline)
            }
            .tint(Theme.accent)
            .accessibilityIdentifier("splitCashCardToggle")
        }
        .padding(20)
        .foregroundStyle(Theme.onHero)
        .background(Theme.hero, in: RoundedRectangle(cornerRadius: Theme.corner + 4, style: .continuous))
    }

    private func amountRow(_ title: String, text: Binding<String>, field: ShiftForm.Field) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.headline)
                .frame(width: 56, alignment: .leading)
            TextField(title, text: dollarBinding(text), prompt: Text("$0.00").foregroundStyle(Theme.onHeroSecondary))
                .font(.system(.title, design: .rounded).weight(.bold))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .keyboardType(.decimalPad)
                .focused(focus, equals: field)
                .padding(.horizontal, 12)
                .frame(minHeight: 52)
                .background(Theme.heroField, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
