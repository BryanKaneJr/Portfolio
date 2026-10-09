import SwiftUI
import ShiftTipsCore

/// The top of a tip-out: the total tipped out and the line proving every
/// cent tipped out reached someone.
struct TipOutHeader: View {
    let result: TipOutResult
    var savedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(result.draft.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkSecondary)
            MoneyText(cents: result.tippedOutCents, font: .system(.largeTitle, design: .rounded).weight(.bold))
                .foregroundStyle(Theme.ink)
            Text("Tipped out from \(Money.format(result.collectedCents)) in tips")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
            Text(result.takingPartCount == 1 ? "Tip Out \u{00B7} 1 person" : "Tip Out \u{00B7} \(result.takingPartCount) people")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: result.reconciles ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(result.reconciles ? Theme.positive : Theme.warning)
                    .accessibilityHidden(true)
                Text("Tipped out \(Money.format(result.tippedOutCents)) \u{00B7} received \(Money.format(result.receivedCents)) \u{00B7} \(Money.format(result.leftOverCents)) left over")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(result.reconciles ? Theme.positive : Theme.warning)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("reconciliationLine")
            if let savedAt {
                Text("Saved \(savedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .card(padding: 18)
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

        VStack(alignment: .leading, spacing: 10) {
            if !result.pots.isEmpty {
                SectionLabel("POTS")
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(result.pots, id: \.role) { pot in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(pot.role)
                                    .font(.body.weight(.semibold))
                                Text(potDetail(pot))
                                    .font(.footnote)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer()
                            MoneyText(cents: pot.cents, font: .headline)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .card()
            }

            SectionLabel(taking.count == 1 ? "PEOPLE (1)" : "PEOPLE (\(taking.count))")
                .padding(.top, 6)
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
            }

            ForEach(capped) { entry in
                Banner(.warning, "\(entry.participant.name)'s tip-outs came to more than the \(Money.format(entry.person.tipsCents ?? 0)) in tips they collected, so each was reduced in proportion.")
            }

            SectionLabel("RULES")
                .padding(.top, 6)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(result.draft.tipOutRules.enumerated()), id: \.element.id) { index, rule in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(rule.summary)
                            .font(.subheadline.weight(.semibold))
                        if index < result.rules.count, let note = Explainer.skippedNote(for: rule, status: result.rules[index].status) {
                            Text(note)
                                .font(.caption)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(rule.spokenSummary)
                }
            }
            .card()

            if !outside.isEmpty {
                SectionLabel("NOT IN TIP-OUTS")
                    .padding(.top, 6)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(outside) { entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.participant.name)
                                .font(.body.weight(.semibold))
                            Text(Explainer.reason(for: entry.person.status, participant: entry.participant))
                                .font(.footnote)
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .card()
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
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(person.status == .pays ? "Keeps" : (person.status == .receives ? "Receives" : "Net"))
                            .font(.caption)
                            .foregroundStyle(Theme.inkSecondary)
                        MoneyText(cents: person.status == .receives ? person.receivedCents : person.netCents, font: .headline)
                            .foregroundStyle(Theme.ink)
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
                let explanation = Explainer.explain(person, in: result)
                VStack(alignment: .leading, spacing: 10) {
                    Text(explanation.summary)
                        .font(.footnote)
                        .foregroundStyle(Theme.ink)
                    Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                        ForEach(Array(explanation.lines.enumerated()), id: \.offset) { _, line in
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
        let person = entry.person
        var parts: [String] = []
        if let role = entry.participant.role, !role.isEmpty { parts.append(role) }
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

/// Either kind of saved or live result, header first.
struct OutcomeView: View {
    let outcome: ShiftOutcome
    var savedAt: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
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
    }
}
