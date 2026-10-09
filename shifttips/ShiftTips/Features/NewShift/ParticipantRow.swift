import SwiftUI
import ShiftTipsCore

/// One person on the New Shift screen: in or out of the pool, their hours
/// and points when the method uses them, and their live amount.
struct ParticipantRow: View {
    @Binding var row: ShiftForm.Row
    let allocation: Allocation?
    let method: SplitMethod
    /// False until tips are entered, so rows don't show a misleading $0.00.
    let showAmounts: Bool
    var focus: FocusState<ShiftForm.Field?>.Binding
    let onToggle: () -> Void
    let onInfo: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                includeControl
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(row.isInPool ? Theme.ink : Theme.inkSecondary)
                    subtitle
                }
                Spacer(minLength: 8)
                amount
            }
            if row.isInPool && method.usesHours {
                HStack(alignment: .top, spacing: 12) {
                    hoursField
                    if method.usesPoints { pointsField }
                    Spacer(minLength: 0)
                }
                .padding(.leading, 56)
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
            .accessibilityLabel("\(row.name) in pool")
            .accessibilityValue(row.included ? "In pool" : "Left out")
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
            .accessibilityLabel("\(row.name) can't be in the pool. Learn why")
        }
    }

    private var subtitle: some View {
        HStack(spacing: 6) {
            if let text = subtitleText {
                Text(text)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            if row.isOneOff {
                Button("Remove", action: onRemove)
                    .font(.footnote.weight(.semibold))
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Remove \(row.name) from this shift")
            }
        }
    }

    private var subtitleText: String? {
        var parts: [String] = []
        if let role = row.role, !role.isEmpty { parts.append(role) }
        switch row.eligibility {
        case .managerSupervisorOwner: parts.append("Owner/manager, never in pool")
        case .notEligible: parts.append("Not eligible for pool")
        case .eligible: if !row.included { parts.append("Left out") }
        }
        if row.isOneOff { parts.append("This shift only") }
        return parts.isEmpty ? nil : parts.joined(separator: " \u{00B7} ")
    }

    @ViewBuilder
    private var amount: some View {
        if let allocation, showAmounts || allocation.status == .needsHours || allocation.status == .needsPoints {
            switch allocation.status {
            case .receiving:
                MoneyText(cents: allocation.totalCents)
            case .needsHours, .needsPoints:
                Text(allocation.status.shortText)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.warning)
            case .leftOut, .notEligible, .managerSupervisorOwner:
                Text("Not in pool")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
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
                .frame(width: 88, height: 44)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .focused(focus, equals: .hours(row.id))
                .id(ShiftForm.Field.hours(row.id))
                .accessibilityLabel("Hours for \(row.name)")
                .accessibilityValue(hoursHint.text)
            Text(hoursHint.text)
                .font(.caption)
                .foregroundStyle(hoursHint.isError ? Theme.warning : Theme.inkSecondary)
                .accessibilityHidden(true)
        }
    }

    private var pointsField: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Points")
                .font(.caption)
                .foregroundStyle(Theme.inkSecondary)
            TextField("Points", text: $row.pointsText, prompt: Text("1"))
                .keyboardType(.decimalPad)
                .font(.body.monospacedDigit())
                .padding(.horizontal, 10)
                .frame(width: 72, height: 44)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .focused(focus, equals: .points(row.id))
                .id(ShiftForm.Field.points(row.id))
                .accessibilityLabel("Points for \(row.name)")
            if let error = pointsError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Theme.warning)
            }
        }
    }

    /// Echoes how the hours were read ("7h 30m"), or what's wrong.
    private var hoursHint: (text: String, isError: Bool) {
        switch row.minutes {
        case .success(let minutes): return (Hours.format(minutes: minutes), minutes == 0)
        case .failure(.empty): return ("e.g. 7.5", false)
        case .failure(let error): return (error.message, true)
        }
    }

    private var pointsError: String? {
        switch row.points {
        case .success(0): return "Must be more than 0"
        case .success, .failure(.empty): return nil
        case .failure(let error): return error.message
        }
    }
}
