/// Plain-language working for one person's allocation: the numbers behind
/// it, from weight to share to the final cents.
public struct Explanation: Hashable, Sendable {
    public struct Line: Hashable, Sendable {
        public let label: String
        public let value: String
    }

    public let summary: String
    public let lines: [Line]
}

public enum Explainer {
    public static func explain(_ allocation: Allocation, in result: SplitResult) -> Explanation {
        guard let participant = result.participant(for: allocation) else {
            return Explanation(summary: "", lines: [])
        }
        let method = result.draft.method
        let pool = result.draft.pool

        guard allocation.status == .receiving, result.totalWeight > 0 else {
            return Explanation(summary: reason(for: allocation.status, name: participant.name), lines: [])
        }

        var lines: [Explanation.Line] = [.init(label: "Method", value: method.title)]
        if method.usesHours {
            lines.append(.init(label: "Hours", value: Hours.format(minutes: participant.minutesWorked)))
        }
        if method.usesPoints {
            lines.append(.init(label: "Points", value: Points.format(units: participant.pointsUnits)))
        }
        lines.append(.init(label: "Their weight", value: weightText(allocation.weight, method: method)))
        lines.append(.init(label: "Pool weight", value: weightText(result.totalWeight, method: method)))
        let percent = percentText(weight: allocation.weight, total: result.totalWeight)
        lines.append(.init(label: "Share of pool", value: percent))

        if let cash = pool.cashCents, let card = pool.cardCents {
            lines.append(.init(label: "Exact cash share", value: exactShareText(pool: cash, weight: allocation.weight, total: result.totalWeight)))
            lines.append(.init(label: "Cash allocated", value: Money.format(allocation.cashCents ?? 0)))
            lines.append(.init(label: "Exact card share", value: exactShareText(pool: card, weight: allocation.weight, total: result.totalWeight)))
            lines.append(.init(label: "Card allocated", value: Money.format(allocation.cardCents ?? 0)))
        } else {
            lines.append(.init(label: "Exact share", value: exactShareText(pool: pool.totalCents, weight: allocation.weight, total: result.totalWeight)))
        }
        lines.append(.init(label: "Rounding", value: roundingText(allocation.roundingCents)))
        lines.append(.init(label: "Allocated", value: Money.format(allocation.totalCents)))

        let summary = "\(participant.name) gets \(percent) of the pool: \(weightSentence(participant, allocation: allocation, result: result))"
        return Explanation(summary: summary, lines: lines)
    }

    public static func reason(for status: ParticipationStatus, name: String) -> String {
        switch status {
        case .receiving: "\(name) is in the pool."
        case .leftOut: "\(name) was left out of this shift's pool, so they aren't counted in the split."
        case .notEligible: "\(name) is marked not eligible for the pool, so they aren't counted in the split."
        case .managerSupervisorOwner: "\(name) is marked as an owner, manager or supervisor. ShiftTips never includes them in a pool."
        case .needsHours: "\(name) needs hours before the pool can be split."
        case .needsPoints: "\(name) needs points before the pool can be split."
        }
    }

    /// The weight in the units people think in: shares, hours, or weighted
    /// hours (hours x points).
    public static func weightText(_ weight: Int64, method: SplitMethod) -> String {
        switch method {
        case .equal: weight == 1 ? "1 share" : "\(weight) shares"
        case .hours: Hours.format(minutes: weight)
        case .weightedHours: weightedHoursText(weight) + " weighted hrs"
        }
    }

    /// minutes x point units / 60,000, to two decimals; "about" when the
    /// exact value has more digits (the arithmetic itself is never rounded).
    public static func weightedHoursText(_ weight: Int64) -> String {
        let divisor: Int64 = 60 * Limits.pointsScale
        let (hundredths, remainder) = divideFullWidth(weight, times: 100, by: divisor)
        let text = String(hundredths / 100) + "." + Money.twoDigits(UInt64(hundredths % 100))
        return remainder == 0 ? text : "about " + text
    }

    /// The share of the pool, to one decimal: "37.5%", "100%".
    public static func percentText(weight: Int64, total: Int64) -> String {
        guard total > 0 else { return "0%" }
        // Tenths of a percent, rounded half up.
        let (tenths, remainder) = divideFullWidth(weight, times: 1000, by: total)
        let rounded = remainder >= total - remainder ? tenths + 1 : tenths
        if rounded % 10 == 0 { return "\(rounded / 10)%" }
        return "\(rounded / 10).\(rounded % 10)%"
    }

    /// The exact, unrounded entitlement, to a hundredth of a cent:
    /// "$85.50", or "$85.4966..." when it goes on.
    public static func exactShareText(pool: Int64, weight: Int64, total: Int64) -> String {
        guard total > 0 else { return Money.format(0) }
        let (cents, remainder) = divideFullWidth(pool, times: weight, by: total)
        let (subcents, rest) = divideFullWidth(remainder, times: 100, by: total)
        var text = Money.format(cents)
        if subcents > 0 || rest > 0 { text += Money.twoDigits(UInt64(subcents)) }
        if rest > 0 { text += "\u{2026}" }
        return text
    }

    public static func roundingText(_ cents: Int64) -> String {
        switch cents {
        case 0: "None"
        case 1: "+1\u{00A2} leftover cent"
        default: "+\(cents)\u{00A2} leftover cents"
        }
    }

    private static func weightSentence(_ participant: ShiftParticipant, allocation: Allocation, result: SplitResult) -> String {
        let method = result.draft.method
        let total = weightText(result.totalWeight, method: method)
        switch method {
        case .equal:
            return "one equal share out of \(result.totalWeight)."
        case .hours:
            return "\(Hours.format(minutes: participant.minutesWorked)) of \(total) worked."
        case .weightedHours:
            return "\(Hours.format(minutes: participant.minutesWorked)) \u{00D7} \(Points.format(units: participant.pointsUnits)) points = \(weightText(allocation.weight, method: method)), of \(total)."
        }
    }

    /// `(a * b / c, a * b % c)` for non-negative values, computed at full
    /// width. Callers keep the quotient small enough for 64 bits.
    static func divideFullWidth(_ a: Int64, times b: Int64, by c: Int64) -> (Int64, Int64) {
        let product = UInt64(a).multipliedFullWidth(by: UInt64(b))
        let (q, r) = UInt64(c).dividingFullWidth(product)
        return (Int64(q), Int64(r))
    }
}

// MARK: - Tip Out

extension Explainer {
    /// The working behind one person's tip-outs: what they collected, each
    /// tip-out with its base and percentage, what they keep, and their share
    /// of each pot.
    public static func explain(_ person: TipOutPerson, in result: TipOutResult) -> Explanation {
        guard let participant = result.draft.participants.first(where: { $0.id == person.participantId }) else {
            return Explanation(summary: "", lines: [])
        }
        guard person.status.takesPart else {
            return Explanation(summary: reason(for: person.status, participant: participant), lines: [])
        }
        let name = participant.name
        var lines: [Explanation.Line] = []
        var sentences: [String] = []

        if person.status.pays {
            let tips = person.tipsCents ?? 0
            lines.append(.init(label: "Tips collected", value: Money.format(tips)))
            for payment in person.payments {
                let base = payment.basis == .tips ? "tips" : "\(Money.format(payment.baseCents)) \(payment.basis.phrase)"
                let label = "To \(payment.toRole): \(Percent.format(basisPoints: payment.rateBasisPoints)) of \(base)"
                var value = "-" + Money.format(payment.cents)
                if payment.cents != payment.fullCents { value += " (was \(Money.format(payment.fullCents)))" }
                lines.append(.init(label: label, value: value))
            }
            lines.append(.init(label: "Keeps", value: Money.format(person.keptCents)))
            sentences.append("\(name) collected \(Money.format(tips)) in tips and tipped out \(Money.format(person.paidCents)), keeping \(Money.format(person.keptCents)).")
            if person.capped {
                sentences.append("Their tip-outs came to more than their tips, so each was reduced in proportion to total exactly \(Money.format(tips)).")
            }
        }

        if person.status.receives {
            for receipt in person.receipts {
                let label = "From the \(receipt.role) pot: \(Hours.format(minutes: receipt.minutes)) of \(Hours.format(minutes: receipt.potMinutes))"
                lines.append(.init(label: label, value: "+" + Money.format(receipt.cents)))
                if receipt.roundingCents > 0 {
                    lines.append(.init(label: "Rounding", value: roundingText(receipt.roundingCents)))
                }
                let share = percentText(weight: receipt.minutes, total: receipt.potMinutes)
                sentences.append("\(name) worked \(Hours.format(minutes: receipt.minutes)) of the \(Hours.format(minutes: receipt.potMinutes)) the \(receipt.role) pot is shared by, so gets \(share) of its \(Money.format(receipt.potCents)).")
            }
        }

        if person.status == .paysAndReceives {
            lines.append(.init(label: "Net", value: Money.format(person.netCents)))
        } else if person.status == .receives {
            lines.append(.init(label: "Receives", value: Money.format(person.receivedCents)))
        }
        return Explanation(summary: sentences.joined(separator: " "), lines: lines)
    }

    public static func reason(for status: TipOutStatus, participant: ShiftParticipant) -> String {
        let name = participant.name
        switch status {
        case .pays, .receives, .paysAndReceives:
            return "\(name) takes part in this shift's tip-outs."
        case .noRule:
            return "No tip-out rule applies to \(participant.role ?? "their role") on this shift."
        case .noRole:
            return "\(name) has no role, so no tip-out rule can apply. Give them a role on the crew."
        case .leftOut:
            return "\(name) was left out of this shift's tip-outs."
        case .notEligible:
            return "\(name) is marked not eligible, so they don't pay or receive tip-outs."
        case .managerSupervisorOwner:
            return "\(name) is marked as an owner, manager or supervisor. ShiftTips never includes them in tip-outs."
        }
    }

    /// Why a rule wasn't used this shift, or nil if it was.
    public static func skippedNote(for rule: TipOutRule, status: TipOutRuleOutcome.Status) -> String? {
        switch status {
        case .applied: nil
        case .noPayers: "Not used: no \(rule.fromRole.trimmingSpaces()) on this shift."
        case .noRecipients: "Not taken: no \(rule.toRole.trimmingSpaces()) on this shift."
        case .invalid: "Not used: \(rule.problem?.message ?? "the rule is incomplete.")"
        }
    }
}
