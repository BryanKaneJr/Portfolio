import SwiftUI
import ShiftTipsCore

/// The top of a split's slip: the pool, how it was split, and the
/// reconciliation line proving every cent is allocated.
struct SplitHeader: View {
    let result: SplitResult
    var savedAt: Date?

    var body: some View {
        let pool = result.draft.pool
        VStack(alignment: .leading, spacing: 12) {
            SlipTitle(
                kind: "\(ShiftMode.pool.title) \u{00B7} \(result.draft.method.title)",
                title: result.draft.title,
                savedAt: savedAt
            )
            MoneyText(cents: pool.totalCents, font: .display(.largeTitle))
                .foregroundStyle(Theme.ink)
            if let cash = pool.cashCents, let card = pool.cardCents {
                Text("CASH \(Money.format(cash)) \u{00B7} CARD \(Money.format(card))")
                    .font(.mono(.caption, weight: .medium))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Text(methodLine)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            DashedRule()
            ReconciliationLine(
                reconciles: result.reconciles,
                text: "Allocated \(Money.format(result.allocatedCents)) of \(Money.format(result.draft.pool.totalCents)) \u{00B7} \(Money.format(result.remainingCents)) remaining"
            )
        }
    }

    private var methodLine: String {
        let people = result.receivingCount == 1 ? "1 person" : "\(result.receivingCount) people"
        switch result.draft.method {
        case .equal: return "Split equally among \(people)"
        case .hours: return "Split by hours among \(people) (\(Hours.format(minutes: result.totalWeight)) in all)"
        case .weightedHours: return "Split by hours \u{00D7} points among \(people)"
        }
    }
}

/// What kind of shift, its date and label, and the stamp once saved.
struct SlipTitle: View {
    let kind: String
    let title: String
    var savedAt: Date?

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text(kind.uppercased())
                    .font(.mono(.caption, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.inkSecondary)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.ink)
            }
            Spacer(minLength: 8)
            if let savedAt {
                SavedStamp(date: savedAt)
                    .padding(.top, 4)
            }
        }
    }
}

/// "Reconciled", highlighted, over the line that proves it.
struct ReconciliationLine: View {
    let reconciles: Bool
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: reconciles ? "checkmark" : "exclamationmark.triangle.fill")
                    .font(.system(size: 10, weight: .black))
                    .accessibilityHidden(true)
                Text(reconciles ? "RECONCILED" : "DOESN'T RECONCILE")
                    .font(.mono(.caption2, weight: .bold))
                    .tracking(0.6)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .foregroundStyle(reconciles ? Theme.onHighlight : Theme.warning)
            .background(reconciles ? Theme.highlight : Theme.warningSoft, in: Capsule())
            Text(text)
                .font(.mono(.footnote, weight: .semibold))
                .foregroundStyle(reconciles ? Theme.ink : Theme.warning)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("reconciliationLine")
    }
}

/// Everyone's allocation, set like the lines of a receipt, then the
/// total. Tapping a person shows the working behind it.
struct BreakdownList: View {
    let result: SplitResult
    @State private var expanded: Set<UUID> = []

    var body: some View {
        let entries = result.entries
        let receiving = entries.filter { $0.allocation.status == .receiving }
        let outside = entries.filter { $0.allocation.status != .receiving }

        VStack(alignment: .leading, spacing: 0) {
            SlipColumns(title: receiving.count == 1 ? "In the pool, 1 person" : "In the pool, \(receiving.count) people", trailing: "Amount")
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
                if entry.id != receiving.last?.id {
                    DashedRule()
                }
            }
            SlipTotal(cents: result.allocatedCents)
            if result.draft.pool.isSplit {
                VStack(spacing: 4) {
                    SlipSubtotal(label: "Cash", cents: result.allocatedCashCents)
                    SlipSubtotal(label: "Card", cents: result.allocatedCardCents)
                }
                .padding(.bottom, 8)
            }

            if !outside.isEmpty {
                SlipColumns(title: "Not in this pool", trailing: nil)
                    .padding(.top, 16)
                ForEach(outside) { entry in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(entry.participant.name)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(Explainer.reason(for: entry.allocation.status, name: entry.participant.name))
                                .font(.footnote)
                                .foregroundStyle(Theme.inkSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 8)
                        MoneyText(cents: 0, font: .mono(.body))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .padding(.vertical, 10)
                    .accessibilityElement(children: .combine)
                    if entry.id != outside.last?.id {
                        DashedRule()
                    }
                }
            }
        }
    }
}

/// Column heads over a ruled list on the slip.
struct SlipColumns: View {
    let title: String
    let trailing: String?

    var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(title)
                Spacer(minLength: 8)
                if let trailing {
                    Text(trailing.uppercased())
                        .font(.mono(.caption, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(Theme.inkSecondary)
                        .accessibilityHidden(true)
                }
            }
            Rule()
        }
    }
}

/// The double-ruled TOTAL line, with the amount on yellow.
struct SlipTotal: View {
    var label = "Total"
    let cents: Int64

    var body: some View {
        VStack(spacing: 2) {
            Rule(color: Theme.ink, weight: 1)
            Rule(color: Theme.ink, weight: 1)
            HStack(alignment: .firstTextBaseline) {
                Text(label.uppercased())
                    .font(.mono(.subheadline, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 8)
                MoneyText(cents: cents, font: .mono(.title3, weight: .bold))
                    .foregroundStyle(Theme.onHighlight)
                    .highlighted()
            }
            .padding(.vertical, 10)
            .accessibilityElement(children: .combine)
        }
    }
}

struct SlipSubtotal: View {
    let label: String
    let cents: Int64

    var body: some View {
        HStack {
            Text(label.uppercased())
                .font(.mono(.caption, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
            Spacer()
            MoneyText(cents: cents, font: .mono(.footnote, weight: .semibold))
                .foregroundStyle(Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }
}

struct BreakdownRow: View {
    let entry: SplitResult.Entry
    let result: SplitResult
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.participant.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(detail)
                            .font(.mono(.caption))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 3) {
                        MoneyText(cents: entry.allocation.totalCents, font: .mono(.body, weight: .bold))
                            .foregroundStyle(Theme.ink)
                        if let cash = entry.allocation.cashCents, let card = entry.allocation.cardCents {
                            Text("CASH \(Money.format(cash)) \u{00B7} CARD \(Money.format(card))")
                                .font(.mono(.caption2))
                                .foregroundStyle(Theme.inkSecondary)
                                .accessibilityLabel("Cash \(Money.format(cash)), card \(Money.format(card))")
                        }
                    }
                    ExpandChevron(isExpanded: isExpanded)
                }
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint(isExpanded ? "Hides the working" : "Shows how this amount was worked out")

            if isExpanded {
                let explanation = Explainer.explain(entry.allocation, in: result)
                WorkingView(summary: explanation.summary, lines: explanation.lines.map { ($0.label, $0.value) })
                    .padding(.bottom, 12)
            }
        }
    }

    private var detail: String {
        let participant = entry.participant
        var parts: [String] = []
        if let role = participant.role, !role.isEmpty { parts.append(role.uppercased()) }
        if result.draft.method.usesHours { parts.append(Hours.format(minutes: participant.minutesWorked)) }
        if result.draft.method.usesPoints { parts.append("\(Points.format(units: participant.pointsUnits)) pts") }
        parts.append(Explainer.percentText(weight: entry.allocation.weight, total: result.totalWeight))
        return parts.joined(separator: " \u{00B7} ")
    }
}

/// The working behind one amount, set off by an ink bar.
struct WorkingView: View {
    let summary: String
    let lines: [(String, String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(summary)
                .font(.footnote)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    GridRow {
                        Text(line.0)
                            .foregroundStyle(Theme.inkSecondary)
                        Text(line.1)
                            .foregroundStyle(Theme.ink)
                            .gridColumnAlignment(.trailing)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    .font(.mono(.caption))
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(.leading, 14)
        .padding(.vertical, 4)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.ink)
                .frame(width: 2)
                .accessibilityHidden(true)
        }
    }
}

struct ExpandChevron: View {
    let isExpanded: Bool

    var body: some View {
        Image(systemName: "chevron.down")
            .font(.caption.weight(.heavy))
            .foregroundStyle(Theme.inkSecondary)
            .rotationEffect(.degrees(isExpanded ? 180 : 0))
            .accessibilityHidden(true)
    }
}

/// The fine print every breakdown carries.
struct AllocationNote: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            DashedRule()
            Text(PolicyCopy.allocationNote)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
