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
            HStack(alignment: .center, spacing: 10) {
                IncludeControl(row: row, noun: "tip-outs", onToggle: onToggle, onInfo: onInfo)
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(status.takesPart ? Theme.ink : Theme.inkSecondary)
                    Text(detailText)
                        .font(.mono(.caption))
                        .foregroundStyle(status == .noRole ? Theme.warning : Theme.inkSecondary)
                    if row.isOneOff {
                        RemoveOneOffButton(name: row.name, action: onRemove)
                    }
                }
                Spacer(minLength: 8)
                amount
            }
            if !bases.isEmpty || status.receives {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 120), spacing: 10, alignment: .leading)],
                    alignment: .leading,
                    spacing: 10
                ) {
                    ForEach(bases, id: \.self) { basis in
                        moneyField(basis)
                    }
                    if status.receives {
                        hoursField
                    }
                }
                .padding(.leading, 54)
            }
        }
        .padding(.vertical, 12)
    }

    private var detailText: String {
        var parts: [String] = []
        if let role = row.role, !role.isEmpty { parts.append(role.uppercased()) }
        switch status {
        case .pays: parts.append("Tips out")
        case .receives: parts.append("Receives by hours")
        case .paysAndReceives: parts.append("Tips out and receives")
        case .noRule: parts.append("No rule for this role")
        case .noRole: parts.append("Needs a role for tip-outs")
        case .leftOut: parts.append("Left out")
        case .notEligible: parts.append("Not eligible")
        case .managerSupervisorOwner: parts.append("Owner or manager, never in tip-outs")
        }
        if row.isOneOff { parts.append("This shift only") }
        return parts.joined(separator: " \u{00B7} ")
    }

    @ViewBuilder
    private var amount: some View {
        if let person, status.takesPart {
            if status.pays && (try? row.amount(for: .tips).get()) == nil {
                Tag("Needs tips", style: .warning)
            } else if status.receives && ((try? row.minutes.get()) ?? 0) <= 0 {
                Tag("Needs hours", style: .warning)
            } else {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(status == .pays ? "KEEPS" : (status == .receives ? "RECEIVES" : "NET"))
                        .font(.mono(.caption2, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                    MoneyText(cents: status == .receives ? person.receivedCents : person.netCents)
                        .foregroundStyle(Theme.ink)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func moneyField(_ basis: TipOutBasis) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(basis.title.uppercased())
                .font(.mono(.caption2, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
                .accessibilityHidden(true)
            TextField(
                basis.title,
                text: dollarBinding(Binding(get: { row.text(for: basis) }, set: { row.setText($0, for: basis) })),
                prompt: Text("$0").foregroundStyle(Theme.inkTertiary)
            )
            .keyboardType(.decimalPad)
            .font(.mono(.body, weight: .medium))
            .foregroundStyle(Theme.ink)
            .focused(focus, equals: .amount(row.id, basis))
            .fieldBox(focused: focus.wrappedValue == .amount(row.id, basis), error: amountError(basis) != nil)
            .id(ShiftForm.Field.amount(row.id, basis))
            .accessibilityLabel("\(basis.title) for \(row.name)")
            .accessibilityIdentifier("\(basis.rawValue)-\(row.name)")
            if let error = amountError(basis) {
                Text(error)
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.warning)
            }
        }
    }

    private func amountError(_ basis: TipOutBasis) -> String? {
        if case .failure(let error) = row.amount(for: basis), error != .empty { return error.message }
        return nil
    }

    private var hoursField: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("HOURS")
                .font(.mono(.caption2, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
                .accessibilityHidden(true)
            TextField("Hours", text: $row.hoursText, prompt: Text("0").foregroundStyle(Theme.inkTertiary))
                .keyboardType(.decimalPad)
                .font(.mono(.body, weight: .medium))
                .foregroundStyle(Theme.ink)
                .focused(focus, equals: .hours(row.id))
                .fieldBox(focused: focus.wrappedValue == .hours(row.id), error: hoursIsError)
                .id(ShiftForm.Field.hours(row.id))
                .accessibilityLabel("Hours for \(row.name)")
            switch row.minutes {
            case .success(let minutes):
                Text(Hours.format(minutes: minutes))
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.inkSecondary)
            case .failure(.empty):
                Text("e.g. 7.5")
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.inkSecondary)
            case .failure(let error):
                Text(error.message)
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.warning)
            }
        }
    }

    private var hoursIsError: Bool {
        if case .failure(let error) = row.minutes, error != .empty { return true }
        return false
    }
}
