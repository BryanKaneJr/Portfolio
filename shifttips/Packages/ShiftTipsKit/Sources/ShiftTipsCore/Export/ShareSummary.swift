/// The plain-text breakdown shared to Messages, Mail or anywhere else. It
/// states allocations, not payments.
public enum ShareSummary {
    public static func text(for outcome: ShiftOutcome) -> String {
        switch outcome {
        case .pool(let result): text(for: result)
        case .tipOut(let result): text(for: result)
        }
    }

    public static func text(for result: TipOutResult) -> String {
        let draft = result.draft
        var lines: [String] = []
        lines.append("ShiftTips: \(draft.title)")
        lines.append("Tip out: \(Money.format(result.tippedOutCents)) tipped out from \(Money.format(result.collectedCents)) in tips")
        lines.append("")

        for entry in result.entries where entry.person.status.takesPart {
            let person = entry.person
            var heading = entry.participant.nameWithRole
            if person.status.receives { heading += " \u{00B7} " + Hours.format(minutes: entry.participant.minutesWorked) }
            var parts: [String] = []
            if person.status.pays {
                parts.append("tips \(Money.format(person.tipsCents ?? 0))")
                parts.append("tipped out \(Money.format(person.paidCents))")
            }
            if person.status.receives { parts.append("received \(Money.format(person.receivedCents))") }
            switch person.status {
            case .pays: parts.append("keeps \(Money.format(person.keptCents))")
            case .paysAndReceives: parts.append("net \(Money.format(person.netCents))")
            default: break
            }
            lines.append(heading + ": " + parts.joined(separator: ", "))
        }

        lines.append("")
        lines.append("Rules:")
        for (rule, outcome) in zip(draft.tipOutRules, result.rules) {
            var line = "\u{2022} " + rule.summary
            if let note = Explainer.skippedNote(for: rule, status: outcome.status) { line += " (\(note))" }
            lines.append(line)
        }
        for entry in result.entries where entry.person.capped {
            lines.append("\(entry.participant.name)'s tip-outs were reduced to the \(Money.format(entry.person.tipsCents ?? 0)) in tips they collected.")
        }

        let outside = result.entries.filter { !$0.person.status.takesPart }
        if !outside.isEmpty {
            lines.append("")
            let names = outside.map { "\($0.participant.name) (\($0.person.status.shortText.lowercased()))" }
            lines.append("Not in tip-outs: " + names.joined(separator: ", "))
        }

        lines.append("")
        lines.append("Tipped out \(Money.format(result.tippedOutCents)), received \(Money.format(result.receivedCents)), \(Money.format(result.leftOverCents)) left over")
        lines.append("A calculation of how tips are allocated, not a record of payment.")
        return lines.joined(separator: "\n")
    }

    public static func text(for result: SplitResult) -> String {
        let draft = result.draft
        let pool = draft.pool
        var lines: [String] = []

        lines.append("ShiftTips: \(draft.title)")
        if let cash = pool.cashCents, let card = pool.cardCents {
            lines.append("Pooled tips: \(Money.format(pool.totalCents)) (cash \(Money.format(cash)) + card \(Money.format(card)))")
        } else {
            lines.append("Pooled tips: \(Money.format(pool.totalCents))")
        }
        lines.append("Split: \(draft.method.title)" + totalWeightSuffix(result))
        lines.append("")

        for (participant, allocation) in result.rows where allocation.status == .receiving {
            var detail: [String] = [participant.nameWithRole]
            if draft.method.usesHours { detail.append(Hours.format(minutes: participant.minutesWorked)) }
            if draft.method.usesPoints { detail.append("\(Points.format(units: participant.pointsUnits)) pts") }
            var line = detail.joined(separator: " \u{00B7} ") + ": " + Money.format(allocation.totalCents)
            if let cash = allocation.cashCents, let card = allocation.cardCents {
                line += " (cash \(Money.format(cash)), card \(Money.format(card)))"
            }
            lines.append(line)
        }

        let outside = result.rows.filter { $0.allocation.status != .receiving }
        if !outside.isEmpty {
            lines.append("")
            let names = outside.map { "\($0.participant.name) (\(outsideReason($0.allocation.status)))" }
            lines.append("Not in this pool: " + names.joined(separator: ", "))
        }

        lines.append("")
        lines.append("Allocated \(Money.format(result.allocatedCents)) of \(Money.format(pool.totalCents)), \(Money.format(result.remainingCents)) remaining")
        lines.append("A calculation of how the pool is allocated, not a record of payment.")
        return lines.joined(separator: "\n")
    }

    static func totalWeightSuffix(_ result: SplitResult) -> String {
        guard result.totalWeight > 0 else { return "" }
        switch result.draft.method {
        case .equal: return " (\(result.receivingCount) equal shares)"
        case .hours: return " (\(Hours.format(minutes: result.totalWeight)) in total)"
        case .weightedHours: return " (\(Explainer.weightedHoursText(result.totalWeight)) weighted hours in total)"
        }
    }

    static func outsideReason(_ status: ParticipationStatus) -> String {
        switch status {
        case .receiving: "in pool"
        case .leftOut: "left out of this shift"
        case .notEligible: "not eligible"
        case .managerSupervisorOwner: "owner, manager or supervisor"
        case .needsHours: "missing hours"
        case .needsPoints: "missing points"
        }
    }
}
