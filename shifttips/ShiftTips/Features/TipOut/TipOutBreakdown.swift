import SwiftUI
import ShiftTipsCore

/// The top of a tip-out's slip: the total tipped out and the line proving
/// every cent tipped out reached someone.
struct TipOutHeader: View {
    let result: TipOutResult
    var savedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SlipTitle(
                kind: result.takingPartCount == 1 ? "Tip Out \u{00B7} 1 person" : "Tip Out \u{00B7} \(result.takingPartCount) people",
                title: result.draft.title,
                savedAt: savedAt
            )
            MoneyText(cents: result.tippedOutCents, font: .display(.largeTitle))
                .foregroundStyle(Theme.ink)
            Text("Tipped out from \(Money.format(result.collectedCents)) in tips")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
            DashedRule()
            ReconciliationLine(
                reconciles: result.reconciles,
                text: "Tipped out \(Money.format(result.tippedOutCents)) \u{00B7} received \(Money.format(result.receivedCents)) \u{00B7} \(Money.format(result.leftOverCents)) left over"
            )
        }
    }
}

/// Pots, people (tap for the working), rules and anyone left out.
struct TipOutBreakdown: View {
    let result: TipOutResult
    @State private var expanded: Set<UUID> = []

    var body: some View {
        let entries = result.entries
        let taking = entries.filter { $0.person.status.takesPart }
        let outside = entries.filter { !$0.person.status.takesPart }
        let capped = entries.filter { $0.person.capped }

        VStack(alignment: .leading, spacing: 0) {
            if !result.pots.isEmpty {
                SlipColumns(title: "Pots", trailing: "Shared")
                ForEach(result.pots, id: \.role) { pot in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(pot.role)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                            Text(potDetail(pot))
                                .font(.mono(.caption))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        Spacer(minLength: 8)
                        MoneyText(cents: pot.cents, font: .mono(.body, weight: .bold))
                            .foregroundStyle(Theme.ink)
                    }
                    .padding(.vertical, 10)
                    .accessibilityElement(children: .combine)
                    if pot.role != result.pots.last?.role {
                        DashedRule()
                    }
                }
                SlipTotal(label: "Tipped out", cents: result.tippedOutCents)
                    .padding(.bottom, 16)
            }

            SlipColumns(title: taking.count == 1 ? "People, 1" : "People, \(taking.count)", trailing: "Ends with")
            ForEach(taking) { entry in
                TipOutBreakdownRow(
                    entry: entry,
                    result: result,
                    isExpanded: expanded.contains(entry.id),
                    toggle: {
                        withAnimation(.snappy) {
                            if expanded.contains(entry.id) { expanded.remove(entry.id) } else { expanded.insert(entry.id) }
                        }
                    }
                )
                if entry.id != taking.last?.id {
                    DashedRule()
                }
            }

            if !capped.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(capped) { entry in
                        Banner(.warning, "\(entry.participant.name)'s tip-outs came to more than the \(Money.format(entry.person.tipsCents ?? 0)) in tips they collected, so each was reduced in proportion.")
                    }
                }
                .padding(.vertical, 12)
            }

            SlipColumns(title: "Rules", trailing: nil)
                .padding(.top, 16)
            ForEach(Array(result.draft.tipOutRules.enumerated()), id: \.element.id) { position, rule in
                VStack(alignment: .leading, spacing: 3) {
                    RuleLine(rule: rule)
                    if position < result.rules.count, let note = Explainer.skippedNote(for: rule, status: result.rules[position].status) {
                        Text(note)
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                }
                .padding(.vertical, 10)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(rule.spokenSummary)
                if position < result.draft.tipOutRules.count - 1 {
                    DashedRule()
                }
            }

            if !outside.isEmpty {
                SlipColumns(title: "Not in tip-outs", trailing: nil)
                    .padding(.top, 16)
                ForEach(outside) { entry in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.participant.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(Explainer.reason(for: entry.person.status, participant: entry.participant))
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
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

    private func potDetail(_ pot: TipOutPot) -> String {
        let people = pot.recipientIds.count == 1 ? "1 person" : "\(pot.recipientIds.count) people"
        return "Shared by \(people) over \(Hours.format(minutes: pot.minutes))"
    }
}

struct TipOutBreakdownRow: View {
    let entry: TipOutResult.Entry
    let result: TipOutResult
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        let person = entry.person
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
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(person.status == .pays ? "KEEPS" : (person.status == .receives ? "RECEIVES" : "NET"))
                            .font(.mono(.caption2, weight: .semibold))
                            .foregroundStyle(Theme.inkSecondary)
                        MoneyText(cents: person.status == .receives ? person.receivedCents : person.netCents, font: .mono(.body, weight: .bold))
                            .foregroundStyle(Theme.ink)
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
                let explanation = Explainer.explain(person, in: result)
                WorkingView(summary: explanation.summary, lines: explanation.lines.map { ($0.label, $0.value) })
                    .padding(.bottom, 12)
            }
        }
    }

    private var detail: String {
        let person = entry.person
        var parts: [String] = []
        if let role = entry.participant.role, !role.isEmpty { parts.append(role.uppercased()) }
        if person.status.pays {
            parts.append("tips \(Money.format(person.tipsCents ?? 0))")
            parts.append("out \(Money.format(person.paidCents))")
        }
        if person.status.receives {
            parts.append(Hours.format(minutes: entry.participant.minutesWorked))
            if person.status == .paysAndReceives { parts.append("in \(Money.format(person.receivedCents))") }
        }
        return parts.joined(separator: " \u{00B7} ")
    }
}

/// Either kind of saved or live result, printed on one receipt slip.
struct OutcomeView: View {
    let outcome: ShiftOutcome
    var savedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            switch outcome {
            case .pool(let result):
                SplitHeader(result: result, savedAt: savedAt)
                if result.draft.pool.totalCents == 0 {
                    Banner(.warning, "The pool is $0.00, so everyone is allocated $0.00.")
                }
                BreakdownList(result: result)
            case .tipOut(let result):
                TipOutHeader(result: result, savedAt: savedAt)
                if result.tippedOutCents == 0 {
                    Banner(.warning, "Nothing is tipped out on this shift.")
                }
                TipOutBreakdown(result: result)
            }
            AllocationNote()
        }
        .receiptSlip()
    }
}
