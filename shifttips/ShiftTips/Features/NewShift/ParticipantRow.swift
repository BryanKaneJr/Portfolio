import SwiftUI
import ShiftTipsCore

/// One line of the crew on New Shift: in or out of the pool, their hours
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
            HStack(alignment: .center, spacing: 10) {
                IncludeControl(row: row, noun: "pool", onToggle: onToggle, onInfo: onInfo)
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(row.isInPool ? Theme.ink : Theme.inkSecondary)
                    if let detail = detailText {
                        Text(detail)
                            .font(.mono(.caption))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    if row.isOneOff {
                        RemoveOneOffButton(name: row.name, action: onRemove)
                    }
                }
                Spacer(minLength: 8)
                amount
            }
            if row.isInPool && method.usesHours {
                HStack(alignment: .top, spacing: 10) {
                    hoursField
                    if method.usesPoints { pointsField }
                    Spacer(minLength: 0)
                }
                .padding(.leading, 54)
            }
        }
        .padding(.vertical, 12)
    }

    private var detailText: String? {
        var parts: [String] = []
        if let role = row.role, !role.isEmpty { parts.append(role) }
        switch row.eligibility {
        case .managerSupervisorOwner: parts.append("Owner or manager, never in pool")
        case .notEligible: parts.append("Not eligible for pool")
        case .eligible: if !row.included { parts.append("Left out") }
        }
        if row.isOneOff { parts.append("This shift only") }
        return parts.isEmpty ? nil : parts.joined(separator: " \u{00B7} ").uppercased()
    }

    @ViewBuilder
    private var amount: some View {
        if let allocation, showAmounts || allocation.status == .needsHours || allocation.status == .needsPoints {
            switch allocation.status {
            case .receiving:
                MoneyText(cents: allocation.totalCents)
                    .foregroundStyle(Theme.ink)
            case .needsHours, .needsPoints:
                Tag(allocation.status.shortText, style: .warning)
            case .leftOut, .notEligible, .managerSupervisorOwner:
                Tag("Not in pool", style: .muted)
            }
        }
    }

    private var hoursField: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                TextField("Hours", text: $row.hoursText, prompt: Text("0").foregroundStyle(Theme.inkTertiary))
                    .keyboardType(.decimalPad)
                    .font(.mono(.body, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .focused(focus, equals: .hours(row.id))
                    .accessibilityLabel("Hours for \(row.name)")
                    .accessibilityValue(hoursHint.text)
                Text("HRS")
                    .font(.mono(.caption2, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .accessibilityHidden(true)
            }
            .fieldBox(focused: focus.wrappedValue == .hours(row.id), error: hoursHint.isError)
            .frame(width: 116)
            .id(ShiftForm.Field.hours(row.id))
            Text(hoursHint.text)
                .font(.mono(.caption))
                .foregroundStyle(hoursHint.isError ? Theme.warning : Theme.inkSecondary)
                .accessibilityHidden(true)
        }
    }

    private var pointsField: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                TextField("Points", text: $row.pointsText, prompt: Text("1").foregroundStyle(Theme.inkTertiary))
                    .keyboardType(.decimalPad)
                    .font(.mono(.body, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .focused(focus, equals: .points(row.id))
                    .accessibilityLabel("Points for \(row.name)")
                Text("PTS")
                    .font(.mono(.caption2, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .accessibilityHidden(true)
            }
            .fieldBox(focused: focus.wrappedValue == .points(row.id), error: pointsError != nil)
            .frame(width: 100)
            .id(ShiftForm.Field.points(row.id))
            if let error = pointsError {
                Text(error)
                    .font(.mono(.caption))
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

/// The circle at the start of a person's line: a check for in or out of
/// this shift, or a dashed lock for someone who can't take part.
struct IncludeControl: View {
    let row: ShiftForm.Row
    /// "pool" or "tip-outs", for VoiceOver.
    let noun: String
    let onToggle: () -> Void
    let onInfo: () -> Void
    @Environment(\.hapticsEnabled) private var hapticsEnabled

    var body: some View {
        if row.eligibility.canParticipate {
            Button(action: onToggle) {
                SelectionMark(isOn: row.included)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.name) in \(noun)")
            .accessibilityValue(row.included ? "Included" : "Left out")
            .accessibilityHint(row.included ? "Double tap to leave out of this shift" : "Double tap to include in this shift")
            .sensoryFeedback(trigger: row.included) { _, _ in
                hapticsEnabled ? .selection : nil
            }
        } else {
            Button(action: onInfo) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 24, height: 24)
                    .overlay {
                        Circle()
                            .strokeBorder(Theme.inkSecondary, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
                    }
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.name) can't take part in the \(noun). Learn why")
        }
    }
}

/// Takes someone added for one shift back off it.
struct RemoveOneOffButton: View {
    let name: String
    let action: () -> Void

    var body: some View {
        Button("Remove", action: action)
            .buttonStyle(TextButtonStyle())
            .accessibilityLabel("Remove \(name) from this shift")
    }
}
