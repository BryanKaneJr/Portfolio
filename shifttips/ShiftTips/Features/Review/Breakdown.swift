import SwiftUI
import ShiftTipsCore

/// The top of a split: the pool, how it was split, and the reconciliation
/// line proving every cent is allocated.
struct SplitHeader: View {
    let result: SplitResult
    var savedAt: Date?

    var body: some View {
        let pool = result.draft.pool
        VStack(alignment: .leading, spacing: 10) {
            Text(result.draft.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            MoneyText(cents: pool.totalCents, font: .system(.largeTitle, design: .rounded).weight(.bold))
                .foregroundStyle(Theme.ink)
            if let cash = pool.cashCents, let card = pool.cardCents {
                Text("Cash \(Money.format(cash)) \u{00B7} Card \(Money.format(card))")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.inkSecondary)
            }
            Text(methodLine)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
            reconciliation
            if let savedAt {
                Text("Saved \(savedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .card(padding: 18)
    }

    private var methodLine: String {
        let people = result.receivingCount == 1 ? "1 person" : "\(result.receivingCount) people"
        switch result.draft.method {
        case .equal: return "Split equally among \(people)"
        case .hours: return "Split by hours among \(people) (\(Hours.format(minutes: result.totalWeight)) in all)"
        case .weightedHours: return "Split by hours \u{00D7} points among \(people)"
        }
    }

    private var reconciliation: some View {
        let reconciles = result.reconciles
        return HStack(alignment: .top, spacing: 8) {
            Image(systemName: reconciles ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(reconciles ? Theme.positive : Theme.warning)
                .accessibilityHidden(true)
            Text("Allocated \(Money.format(result.allocatedCents)) of \(Money.format(result.draft.pool.totalCents)) \u{00B7} \(Money.format(result.remainingCents)) remaining")
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(reconciles ? Theme.positive : Theme.warning)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("reconciliationLine")
    }
}

/// Everyone's allocation. Tapping a person shows the working behind it.
struct BreakdownList: View {
    let result: SplitResult
    @State private var expanded: Set<UUID> = []

    var body: some View {
        let entries = result.entries
        let receiving = entries.filter { $0.allocation.status == .receiving }
        let outside = entries.filter { $0.allocation.status != .receiving }

        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(receiving.count == 1 ? "IN THE POOL (1 PERSON)" : "IN THE POOL (\(receiving.count) PEOPLE)")
            ForEach(receiving) { entry in
                BreakdownRow(
                    entry: entry,
                    result: result,
                    isExpanded: expanded.contains(entry.id),
                    toggle: {
                        withAnimation(.snappy) {
                            if expanded.contains(entry.id) { expanded.remove(entry.id) } else { expanded.insert(entry.id) }
                        }
                    }
                )
            }
            if !outside.isEmpty {
                SectionLabel("NOT IN THIS POOL")
                    .padding(.top, 8)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(outside) { entry in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.participant.name)
                                    .font(.body.weight(.semibold))
                                Text(Explainer.reason(for: entry.allocation.status, name: entry.participant.name))
                                    .font(.footnote)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer()
                            MoneyText(cents: 0, font: .body)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .card()
            }
        }
    }
}

struct BreakdownRow: View {
    let entry: SplitResult.Entry
    let result: SplitResult
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: toggle) {
                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.participant.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(detail)
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 3) {
                        MoneyText(cents: entry.allocation.totalCents, font: .headline)
                            .foregroundStyle(Theme.ink)
                        if let cash = entry.allocation.cashCents, let card = entry.allocation.cardCents {
                            Text("Cash \(Money.format(cash)) \u{00B7} Card \(Money.format(card))")
                                .font(.caption)
                                .monospacedDigit()
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.inkSecondary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint(isExpanded ? "Hides the working" : "Shows how this amount was worked out")

            if isExpanded {
                let explanation = Explainer.explain(entry.allocation, in: result)
                VStack(alignment: .leading, spacing: 10) {
                    Text(explanation.summary)
                        .font(.footnote)
                        .foregroundStyle(Theme.ink)
                    Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                        ForEach(explanation.lines, id: \.label) { line in
                            GridRow {
                                Text(line.label)
                                    .foregroundStyle(Theme.inkSecondary)
                                Text(line.value)
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.ink)
                                    .gridColumnAlignment(.trailing)
                                    .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                            .font(.footnote)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(12)
                .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .card(padding: 14)
    }

    private var detail: String {
        let participant = entry.participant
        var parts: [String] = []
        if let role = participant.role, !role.isEmpty { parts.append(role) }
        if result.draft.method.usesHours { parts.append(Hours.format(minutes: participant.minutesWorked)) }
        if result.draft.method.usesPoints { parts.append("\(Points.format(units: participant.pointsUnits)) pts") }
        parts.append(Explainer.percentText(weight: entry.allocation.weight, total: result.totalWeight))
        return parts.joined(separator: " \u{00B7} ")
    }
}

/// The footnote every breakdown carries.
struct AllocationNote: View {
    var body: some View {
        Text(PolicyCopy.allocationNote)
            .font(.footnote)
            .foregroundStyle(Theme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
    }
}
