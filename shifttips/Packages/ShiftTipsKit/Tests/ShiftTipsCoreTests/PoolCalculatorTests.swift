import Foundation
import Testing
@testable import ShiftTipsCore

/// The worked cases from the build plan (section 6), then the edge cases
/// from its acceptance criteria (section 12).
@Suite struct PoolCalculatorTests {
    // 1. Equal: $10.00 / 3 => $3.34, $3.33, $3.33 in roster order.
    @Test func planCase1Equal() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(1000), [
            Fixture.person("A"), Fixture.person("B"), Fixture.person("C"),
        ]))
        #expect(Fixture.cents(calc) == [334, 333, 333])
        #expect(!calc.isBlocked)
        #expect(calc.result.reconciles)
    }

    // 2. Hours: $150.00; 8 hours and 4 hours => $100.00 and $50.00.
    @Test func planCase2Hours() {
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(15000), [
            Fixture.person("A", hours: 8), Fixture.person("B", hours: 4),
        ]))
        #expect(Fixture.cents(calc) == [10000, 5000])
    }

    // 3. Hours x Points: $190.00; weights 8, 9, 3 => $76.00, $85.50, $28.50.
    @Test func planCase3HoursTimesPoints() {
        let calc = PoolCalculator.calculate(Fixture.draft(.weightedHours, pool: .total(19000), [
            Fixture.person("Server", hours: 8, points: 1000),
            Fixture.person("Bartender", hours: 6, points: 1500),
            Fixture.person("Support", hours: 6, points: 500),
        ]))
        #expect(Fixture.cents(calc) == [7600, 8550, 2850])
        #expect(Explainer.weightedHoursText(calc.allocations[1].weight) == "9.00")
    }

    // 4. Zero-dollar pool: everyone $0.00, still savable (with a warning).
    @Test func planCase4ZeroPool() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(0), [
            Fixture.person("A"), Fixture.person("B"), Fixture.person("C"),
        ]))
        #expect(Fixture.cents(calc) == [0, 0, 0])
        #expect(calc.issues == [.zeroPool])
        #expect(!calc.isBlocked)
        #expect(calc.result.reconciles)
    }

    // 5. Cash $100.01 and card $50.02 among 3 equal => each reconciles.
    @Test func planCase5CashAndCard() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .cashAndCard(cash: 10001, card: 5002), [
            Fixture.person("A"), Fixture.person("B"), Fixture.person("C"),
        ]))
        #expect(calc.allocations.map(\.cashCents) == [3334, 3334, 3333])
        #expect(calc.allocations.map(\.cardCents) == [1668, 1667, 1667])
        #expect(Fixture.cents(calc) == [5002, 5001, 5000])
        #expect(calc.result.allocatedCashCents == 10001)
        #expect(calc.result.allocatedCardCents == 5002)
        #expect(calc.result.allocatedCents == 15003)
        #expect(calc.result.reconciles)
    }

    // 6. Nobody eligible and in the pool, positive pool => blocked.
    @Test func planCase6NobodyInPool() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(5000), [
            Fixture.person("Owner", eligibility: .managerSupervisorOwner),
            Fixture.person("Out", included: false),
            Fixture.person("No", eligibility: .notEligible),
        ]))
        #expect(calc.isBlocked)
        #expect(calc.issues.contains(.nobodyInPool))
        #expect(Fixture.cents(calc) == [0, 0, 0])
    }

    // 7. Total weight zero with a positive pool => blocked, naming who.
    @Test func planCase7ZeroWeight() {
        let a = Fixture.person("A"), b = Fixture.person("B")
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(5000), [a, b]))
        #expect(calc.isBlocked)
        #expect(calc.issues.contains(.missingHours([a.id, b.id])))
        #expect(calc.issues.contains(.nobodyInPool))
    }

    // 8. Excluded people get zero and aren't in the divisor.
    @Test func planCase8ExcludedNotInDivisor() {
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(9000), [
            Fixture.person("A", hours: 6),
            Fixture.person("Out", hours: 40, included: false),
            Fixture.person("B", hours: 3),
        ]))
        #expect(Fixture.cents(calc) == [6000, 0, 3000])
        #expect(calc.result.totalWeight == 9 * 60)
        #expect(calc.allocations[1].status == .leftOut)
        #expect(calc.allocations[1].weight == 0)
    }

    // 9. Recalculating after a change never keeps stale amounts.
    @Test func planCase9NoStaleAllocations() {
        var draft = Fixture.draft(.hours, pool: .total(10000), [
            Fixture.person("A", hours: 5), Fixture.person("B", hours: 5),
        ])
        #expect(Fixture.cents(PoolCalculator.calculate(draft)) == [5000, 5000])
        draft.participants[1].minutesWorked = 15 * 60
        #expect(Fixture.cents(PoolCalculator.calculate(draft)) == [2500, 7500])
        draft.participants[1].included = false
        #expect(Fixture.cents(PoolCalculator.calculate(draft)) == [10000, 0])
        draft.method = .equal
        draft.participants[1].included = true
        #expect(Fixture.cents(PoolCalculator.calculate(draft)) == [5000, 5000])
    }

    @Test func onePersonGetsEverything() {
        let calc = PoolCalculator.calculate(Fixture.draft(.weightedHours, pool: .total(47238), [
            Fixture.person("Solo", hours: 7.5, points: 1250),
        ]))
        #expect(Fixture.cents(calc) == [47238])
        #expect(Explainer.percentText(weight: calc.allocations[0].weight, total: calc.result.totalWeight) == "100%")
    }

    @Test func managersNeverReceiveEvenIfIncluded() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(900), [
            Fixture.person("A"),
            Fixture.person("Boss", included: true, eligibility: .managerSupervisorOwner),
            Fixture.person("NotEligible", included: true, eligibility: .notEligible),
        ]))
        #expect(Fixture.cents(calc) == [900, 0, 0])
        #expect(calc.allocations.map(\.status) == [.receiving, .managerSupervisorOwner, .notEligible])
    }

    @Test func zeroHourPersonCantQuietlyReceive() {
        let zero = Fixture.person("Zero", hours: 0)
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(10000), [
            Fixture.person("A", hours: 4), zero,
        ]))
        #expect(calc.allocations[1].totalCents == 0)
        #expect(calc.allocations[1].status == .needsHours)
        #expect(calc.isBlocked)
        #expect(calc.issues.contains(.missingHours([zero.id])))
        // The people who can be paid still reconcile, so nothing on screen lies.
        #expect(calc.result.reconciles)
    }

    @Test func zeroPointsBlocksWeightedSplit() {
        let calc = PoolCalculator.calculate(Fixture.draft(.weightedHours, pool: .total(10000), [
            Fixture.person("A", hours: 4), Fixture.person("B", hours: 4, points: 0),
        ]))
        #expect(calc.allocations[1].status == .needsPoints)
        #expect(calc.isBlocked)
    }

    @Test func hoursDontMatterForEqual() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(1000), [
            Fixture.person("A", hours: 0), Fixture.person("B", hours: 12),
        ]))
        #expect(Fixture.cents(calc) == [500, 500])
        #expect(!calc.isBlocked)
    }

    @Test func sameNameTwiceStaysSeparate() {
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(3000), [
            Fixture.person("Alex", hours: 2), Fixture.person("Alex", hours: 1),
        ]))
        #expect(Fixture.cents(calc) == [2000, 1000])
        #expect(Set(calc.allocations.map(\.participantId)).count == 2)
    }

    @Test func tiesFollowRosterOrderSoReorderingMovesThePenny() {
        let a = Fixture.person("A", hours: 1), b = Fixture.person("B", hours: 1)
        let first = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(101), [a, b]))
        let swapped = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(101), [b, a]))
        #expect(Fixture.cents(first) == [51, 50])
        #expect(Fixture.cents(swapped) == [51, 50])
        #expect(first.allocations[0].participantId == a.id)
        #expect(swapped.allocations[0].participantId == b.id)
    }

    @Test func outOfRangeValuesBlock() {
        let calc = PoolCalculator.calculate(Fixture.draft(.hours, pool: .total(100), [
            ShiftParticipant(name: "Typo", minutesWorked: Limits.maxMinutes + 1),
        ]))
        #expect(calc.issues.contains(.valueOutOfRange))
        #expect(calc.isBlocked)
    }

    @Test func tooManyPeopleBlocks() {
        let people = (0...Limits.maxParticipants).map { Fixture.person("P\($0)") }
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(100_000), people))
        #expect(calc.issues.contains(.tooManyParticipants))
        #expect(calc.result.reconciles)
    }

    @Test func randomShiftsAlwaysReconcile() {
        var rng = SplitMix64(seed: 472_38)
        for _ in 0..<1500 {
            let method = SplitMethod.allCases.randomElement(using: &rng)!
            let split = Bool.random(using: &rng)
            let pool: TipPool = split
                ? .cashAndCard(cash: .random(in: 0...5_000_000, using: &rng), card: .random(in: 0...5_000_000, using: &rng))
                : .total(.random(in: 0...Limits.maxPoolCents, using: &rng))
            let people = (0..<Int.random(in: 1...25, using: &rng)).map { i in
                ShiftParticipant(
                    name: "P\(i)",
                    included: Int.random(in: 0..<10, using: &rng) > 0,
                    eligibility: [Eligibility.eligible, .eligible, .eligible, .notEligible, .managerSupervisorOwner].randomElement(using: &rng)!,
                    minutesWorked: .random(in: 1...Limits.maxMinutes, using: &rng),
                    pointsUnits: .random(in: 1...Limits.maxPointsUnits, using: &rng)
                )
            }
            let calc = PoolCalculator.calculate(Fixture.draft(method, pool: pool, people))
            if calc.issues.contains(.nobodyInPool) {
                #expect(calc.result.allocatedCents == 0)
                continue
            }
            #expect(calc.result.reconciles)
            #expect(calc.result.remainingCents == 0)
            for allocation in calc.allocations where allocation.status != .receiving {
                #expect(allocation.totalCents == 0)
            }
        }
    }
}
