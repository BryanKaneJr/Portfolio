import SwiftUI
import ShiftTipsCore

/// One person on New Shift in Tip Out mode: the tips and sales they
/// collected (if they pay), their hours (if they receive), and their live
/// result.
struct TipOutParticipantRow: View {
    @Binding var row: ShiftForm.Row
    let person: TipOutPerson?
    /// The amounts their rules need, tips first.
    let bases: [TipOutBasis]
    var focus: FocusState<ShiftForm.Field?>.Binding
    let onToggle: () -> Void
    let onInfo: () -> Void
    let onRemove: () -> Void

    private var status: TipOutStatus { person?.status ?? .noRule }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                includeControl
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(status.takesPart ? Theme.ink : Theme.inkSecondary)
                    subtitle
                }
                Spacer(minLength: 8)
                amount
            }
            if !bases.isEmpty || status.receives {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10, alignment: .leading)], alignment: .leading, spacing: 10) {
                    ForEach(bases, id: \.self) { basis in
                        moneyField(basis)
                    }
                    if status.receives {
                        hoursField
                    }
                }
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private var includeControl: some View {
        if row.eligibility.canParticipate {
            Button(action: onToggle) {
                Image(systemName: row.included ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(row.included ? Theme.accent : Theme.inkSecondary)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.name) in tip-outs")
            .accessibilityValue(row.included ? "Included" : "Left out")
            .accessibilityHint(row.included ? "Double tap to leave out of this shift" : "Double tap to include in this shift")
        } else {
            Button(action: onInfo) {
                Image(systemName: "lock.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.name) can't take part in tip-outs. Learn why")
        }
    }

    private var subtitle: some View {
        HStack(spacing: 6) {
            Text(subtitleText)
                .font(.footnote)
                .foregroundStyle(status == .noRole ? Theme.warning : Theme.inkSecondary)
            if row.isOneOff {
                Button("Remove", action: onRemove)
                    .font(.footnote.weight(.semibold))
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Remove \(row.name) from this shift")
            }
        }
    }

    private var subtitleText: String {
        var parts: [String] = []
        if let role = row.role, !role.isEmpty { parts.append(role) }
        switch status {
        case .pays: parts.append("Tips out")
        case .receives: parts.append("Receives by hours")
        case .paysAndReceives: parts.append("Tips out and receives")
        case .noRule: parts.append("No rule for this role")
        case .noRole: parts.append("Needs a role for tip-outs")
        case .leftOut: parts.append("Left out")
        case .notEligible: parts.append("Not eligible")
        case .managerSupervisorOwner: parts.append("Owner/manager, never in tip-outs")
        }
        if row.isOneOff { parts.append("This shift only") }
        return parts.joined(separator: " \u{00B7} ")
    }

    @ViewBuilder
    private var amount: some View {
        if let person, status.takesPart {
            if status.pays && (try? row.amount(for: .tips).get()) == nil {
                needs("Needs tips")
            } else if status.receives && ((try? row.minutes.get()) ?? 0) <= 0 {
                needs("Needs hours")
            } else {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(status == .pays ? "Keeps" : (status == .receives ? "Receives" : "Net"))
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                    MoneyText(cents: status == .receives ? person.receivedCents : person.netCents)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func needs(_ text: String) -> some View {
        Text(text)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.warning)
    }

    private func moneyField(_ basis: TipOutBasis) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(basis.title)
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
            TextField(
                basis.title,
                text: dollarBinding(Binding(get: { row.text(for: basis) }, set: { row.setText($0, for: basis) })),
                prompt: Text("$0")
            )
            .keyboardType(.decimalPad)
            .font(.body.monospacedDigit())
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .focused(focus, equals: .amount(row.id, basis))
            .id(ShiftForm.Field.amount(row.id, basis))
            .accessibilityLabel("\(basis.title) for \(row.name)")
            .accessibilityIdentifier("\(basis.rawValue)-\(row.name)")
            if case .failure(let error) = row.amount(for: basis), error != .empty {
                Text(error.message)
                    .font(.caption)
                    .foregroundStyle(Theme.warning)
            }
        }
    }

    private var hoursField: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Hours")
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
            TextField("Hours", text: $row.hoursText, prompt: Text("0"))
                .keyboardType(.decimalPad)
                .font(.body.monospacedDigit())
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .focused(focus, equals: .hours(row.id))
                .id(ShiftForm.Field.hours(row.id))
                .accessibilityLabel("Hours for \(row.name)")
            switch row.minutes {
            case .success(let minutes):
                Text(Hours.format(minutes: minutes))
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            case .failure(.empty):
                Text("e.g. 7.5")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            case .failure(let error):
                Text(error.message)
                    .font(.caption)
                    .foregroundStyle(Theme.warning)
            }
        }
    }
}
