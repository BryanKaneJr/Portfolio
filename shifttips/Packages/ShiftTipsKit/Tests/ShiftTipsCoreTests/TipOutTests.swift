import Foundation
import Testing
@testable import ShiftTipsCore

@Suite struct PercentTests {
    @Test(arguments: [("2", 200), ("2.5", 250), ("1.25", 125), (".5", 50), ("2%", 200), (" 10 % ", 1000), ("100", 10_000), ("0", 0)] as [(String, Int64)])
    func parses(text: String, points: Int64) {
        #expect(Percent.parse(text) == .success(points))
    }

    @Test(arguments: [("", PercentInputError.empty), ("-1", .negative), ("1.234", .tooManyDecimals), ("100.01", .tooLarge), ("two", .invalid), (".", .invalid)])
    func rejects(text: String, error: PercentInputError) {
        #expect(Percent.parse(text) == .failure(error))
    }

    @Test func formatsAndRoundsToTheNearestCent() {
        #expect(Percent.format(basisPoints: 200) == "2%")
        #expect(Percent.format(basisPoints: 250) == "2.5%")
        #expect(Percent.format(basisPoints: 125) == "1.25%")
        #expect(Percent.format(basisPoints: 5) == "0.05%")
        #expect(TipOutCalculator.percentOf(165_540, basisPoints: 200) == 3311) // 3310.8
        #expect(TipOutCalculator.percentOf(165_540, basisPoints: 100) == 1655) // 1655.4
        #expect(TipOutCalculator.percentOf(100, basisPoints: 50) == 1) // half a cent rounds up
        #expect(TipOutCalculator.percentOf(Limits.maxPoolCents, basisPoints: 10_000) == Limits.maxPoolCents)
    }

    @Test func rulesCheckThemselves() {
        #expect(TipOutRule(fromRole: "Server", toRole: " server ", basis: .tips, rateBasisPoints: 100).problem == .sameRole)
        #expect(TipOutRule(fromRole: " ", toRole: "Busser", basis: .tips, rateBasisPoints: 100).problem == .missingFromRole)
        #expect(TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 0).problem == .zeroRate)
        let rule = TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 250)
        #expect(rule.isValid)
        #expect(rule.summary == "Server \u{2192} Busser: 2.5% of sales")
        #expect(TipOutRule.roleKey("  Bar   Back ") == "bar back")
    }
}

@Suite struct TipOutCalculatorTests {
    func person(_ name: String, _ role: String?, tips: Int64? = nil, sales: Int64? = nil, bar: Int64? = nil, hours: Int64 = 0,
                included: Bool = true, eligibility: Eligibility = .eligible) -> ShiftParticipant {
        ShiftParticipant(name: name, role: role, included: included, eligibility: eligibility, minutesWorked: hours * 60,
                         tipsCents: tips, salesCents: sales, barSalesCents: bar)
    }

    func draft(_ people: [ShiftParticipant], _ rules: [TipOutRule]) -> ShiftDraft {
        ShiftDraft(day: Fixture.day, mode: .tipOut, method: .hours, pool: .total(0), participants: people, tipOutRules: rules)
    }

    @Test func theExampleShiftWorksOutToTheCent() {
        let calc = ShiftForm.example(day: Fixture.day, mode: .tipOut, method: .hours).tipOutCalculation
        let result = calc.result
        #expect(!calc.isBlocked)
        #expect(result.reconciles)

        let byName = Dictionary(uniqueKeysWithValues: result.entries.map { ($0.participant.name, $0.person) })
        // Ava: 2% of $2,140 sales, 5% of $520 bar sales, 1% of $2,140 sales.
        #expect(byName["Ava"]?.payments.map(\.cents) == [4280, 2600, 2140])
        #expect(byName["Ava"]?.keptCents == 32230)
        // Marco: 2% of $1,655.40 is $33.108, 1% is $16.554: nearest cent.
        #expect(byName["Marco"]?.payments.map(\.cents) == [3311, 1550, 1655])
        #expect(byName["Marco"]?.keptCents == 25359)
        // Priya pays 10% of her own $286 tips and gets the whole bar pot.
        #expect(byName["Priya"]?.status == .paysAndReceives)
        #expect(byName["Priya"]?.paidCents == 2860)
        #expect(byName["Priya"]?.receivedCents == 4150)
        #expect(byName["Priya"]?.netCents == 29890)
        // The busser pot ($75.91) splits 6h:4h; Jordan's remainder wins the cent.
        #expect(byName["Jordan"]?.receivedCents == 4555)
        #expect(byName["Kim"]?.receivedCents == 3036)
        #expect(byName["Sam"]?.receivedCents == 3795)
        #expect(byName["Dee"]?.receivedCents == 2860)
        #expect(byName["Lee"]?.status == .managerSupervisorOwner)
        #expect(byName["Lee"]?.netCents == 0)

        #expect(result.pots.map(\.role) == ["Busser", "Bartender", "Host", "Barback"])
        #expect(result.pots.map(\.cents) == [7591, 4150, 3795, 2860])
        #expect(result.collectedCents == 101_725)
        #expect(result.tippedOutCents == 18_396)
        #expect(result.receivedCents == 18_396)
        #expect(result.leftOverCents == 0)
    }

    @Test func tipOutsNeverExceedTheTipsCollected() {
        let rules = [
            TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 200),
            TipOutRule(fromRole: "Server", toRole: "Host", basis: .sales, rateBasisPoints: 100),
        ]
        let calc = TipOutCalculator.calculate(draft([
            person("Slow", "Server", tips: 1000, sales: 200_000),
            person("B", "Busser", hours: 5),
            person("H", "Host", hours: 5),
        ], rules))
        let slow = calc.result.people[0]
        #expect(slow.capped)
        #expect(slow.payments.map(\.fullCents) == [4000, 2000])
        #expect(slow.payments.map(\.cents) == [667, 333])
        #expect(slow.keptCents == 0)
        #expect(calc.issues.contains(.capped(slow.participantId)))
        #expect(!calc.isBlocked)
        #expect(calc.result.reconciles)
    }

    @Test func aRuleWithNobodyToReceiveIsntTaken() {
        let rules = [
            TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 1000),
            TipOutRule(fromRole: "Server", toRole: "Host", basis: .tips, rateBasisPoints: 300),
        ]
        let calc = TipOutCalculator.calculate(draft([
            person("A", "Server", tips: 10_000),
            person("H", "Host", hours: 4),
        ], rules))
        #expect(calc.result.rules.map(\.status) == [.noRecipients, .applied])
        #expect(calc.result.people[0].payments.map(\.cents) == [300])
        #expect(calc.issues.contains(.ruleSkipped(rules[0].id)))
        #expect(!calc.isBlocked)
    }

    @Test func tipOutsComeFromOwnTipsNotFromTipOutsReceived() {
        let rules = [
            TipOutRule(fromRole: "Server", toRole: "Bartender", basis: .tips, rateBasisPoints: 1000),
            TipOutRule(fromRole: "Bartender", toRole: "Barback", basis: .tips, rateBasisPoints: 1000),
        ]
        let calc = TipOutCalculator.calculate(draft([
            person("S", "Server", tips: 50_000),
            person("T", "Bartender", tips: 20_000, hours: 8),
            person("K", "Barback", hours: 6),
        ], rules))
        // The barback gets 10% of the bartender's own $200, not of $250.
        #expect(calc.result.people[1].paidCents == 2000)
        #expect(calc.result.people[1].receivedCents == 5000)
        #expect(calc.result.people[2].receivedCents == 2000)
        #expect(calc.result.reconciles)
    }

    @Test func missingInputsBlockAndSayWhat() {
        let rules = [TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 200)]
        let a = person("A", "Server")
        let b = person("B", "Busser")
        let calc = TipOutCalculator.calculate(draft([a, b], rules))
        #expect(calc.isBlocked)
        #expect(calc.issues.contains(.missingAmount(a.id, .tips)))
        #expect(calc.issues.contains(.missingAmount(a.id, .sales)))
        #expect(calc.issues.contains(.missingHours(b.id)))
    }

    @Test func statusesCoverEveryone() {
        let rules = [TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 500)]
        let calc = TipOutCalculator.calculate(draft([
            person("S", "Server", tips: 1000),
            person("B", "Busser", hours: 2),
            person("Host", "Host", hours: 3),
            person("Nobody", nil, tips: 500),
            person("Out", "Server", tips: 9000, included: false),
            person("No", "Busser", hours: 2, eligibility: .notEligible),
            person("Boss", "Busser", hours: 9, eligibility: .managerSupervisorOwner),
        ], rules))
        #expect(calc.result.people.map(\.status) == [.pays, .receives, .noRule, .noRole, .leftOut, .notEligible, .managerSupervisorOwner])
        #expect(calc.result.people[1].receivedCents == 50)
        #expect(calc.result.people.dropFirst(2).allSatisfy { $0.paidCents == 0 && $0.receivedCents == 0 })
    }

    @Test func noRulesOrNoMatchesBlock() {
        #expect(TipOutCalculator.calculate(draft([person("A", "Server", tips: 100)], [])).issues.contains(.noRules))
        let rules = [TipOutRule(fromRole: "Server", toRole: "Busser", basis: .tips, rateBasisPoints: 500)]
        let calc = TipOutCalculator.calculate(draft([person("A", "Host", tips: 100)], rules))
        #expect(calc.issues.contains(.nothingApplies))
        #expect(calc.isBlocked)
        let bad = [TipOutRule(fromRole: "Server", toRole: "Server", basis: .tips, rateBasisPoints: 500)]
        #expect(TipOutCalculator.calculate(draft([person("A", "Server", tips: 100)], bad)).issues.contains(.invalidRule(bad[0].id)))
    }

    @Test func randomTipOutsAlwaysReconcile() {
        var rng = SplitMix64(seed: 2026_10_09)
        let roles = ["Server", "Bartender", "Busser", "Host", "Runner", "Barback"]
        for _ in 0..<1500 {
            let rules = (0..<Int.random(in: 1...5, using: &rng)).map { _ in
                TipOutRule(
                    fromRole: roles.randomElement(using: &rng)!,
                    toRole: roles.randomElement(using: &rng)!,
                    basis: TipOutBasis.allCases.randomElement(using: &rng)!,
                    rateBasisPoints: .random(in: 1...3000, using: &rng)
                )
            }
            let people = (0..<Int.random(in: 1...20, using: &rng)).map { i in
                ShiftParticipant(
                    name: "P\(i)",
                    role: roles.randomElement(using: &rng)!,
                    included: Int.random(in: 0..<10, using: &rng) > 0,
                    eligibility: [Eligibility.eligible, .eligible, .eligible, .managerSupervisorOwner].randomElement(using: &rng)!,
                    minutesWorked: .random(in: 1...900, using: &rng),
                    tipsCents: .random(in: 0...200_000, using: &rng),
                    salesCents: .random(in: 0...1_000_000, using: &rng),
                    foodSalesCents: .random(in: 0...800_000, using: &rng),
                    barSalesCents: .random(in: 0...400_000, using: &rng)
                )
            }
            let calc = TipOutCalculator.calculate(draft(people, rules))
            guard !calc.isBlocked else { continue }
            let result = calc.result
            #expect(result.reconciles)
            #expect(result.leftOverCents == 0)
            #expect(result.people.allSatisfy { $0.keptCents >= 0 })
            #expect(result.people.filter { !$0.status.takesPart }.allSatisfy { $0.paidCents == 0 && $0.receivedCents == 0 })
            // Money is only moved, never made or lost.
            let before = result.people.reduce(Int64(0)) { $0 + ($1.status.pays ? ($1.tipsCents ?? 0) : 0) }
            let after = result.people.reduce(Int64(0)) { $0 + ($1.status.pays ? $1.keptCents : 0) + $1.receivedCents }
            #expect(before == after)
        }
    }
}

@Suite struct TipOutFormTests {
    let rules = [
        TipOutRule(fromRole: "Server", toRole: "Busser", basis: .sales, rateBasisPoints: 200),
        TipOutRule(fromRole: "Bartender", toRole: "Barback", basis: .tips, rateBasisPoints: 1000),
    ]

    func crew() -> Crew {
        Crew(name: "Dinner", employees: [
            Employee(name: "Ava", role: "Server"),
            Employee(name: "Priya", role: "Bartender"),
            Employee(name: "Jordan", role: "Busser"),
            Employee(name: "Dee", role: "Barback"),
            Employee(name: "Lee", role: "Manager", eligibility: .managerSupervisorOwner),
        ], tipOutRules: rules)
    }

    @Test func aCrewBringsItsRulesAndTheFieldsTheyNeed() {
        var form = ShiftForm(day: Fixture.day, mode: .tipOut, method: .hours, crew: crew())
        #expect(form.tipOutRules == rules)
        let ids = form.rows.map(\.id)
        #expect(form.fieldOrder == [
            .amount(ids[0], .tips), .amount(ids[0], .sales),
            .amount(ids[1], .tips),
            .hours(ids[2]),
            .hours(ids[3]),
        ])
        #expect(form.readiness(form.live) == .blocked("Enter tips for Ava"))
        form.rows[0].tipsText = "400"
        #expect(form.readiness(form.live) == .blocked("Enter sales for Ava"))
        form.rows[0].salesText = "2,000"
        form.rows[1].tipsText = "250"
        #expect(form.readiness(form.live) == .blocked("Enter hours for Jordan"))
        form.rows[2].hoursText = "6"
        form.rows[3].hoursText = "5x"
        #expect(form.readiness(form.live) == .blocked("Check hours for Dee"))
        form.rows[3].hoursText = "5"
        #expect(form.readiness(form.live) == .ready)
        let people = form.tipOutCalculation.result.people
        #expect(people.map(\.netCents) == [36000, 22500, 4000, 2500, 0])
    }

    @Test func nothingToDoSaysSo() {
        var form = ShiftForm(day: Fixture.day, mode: .tipOut, method: .hours)
        #expect(form.readiness(form.live) == .blocked("Add your tip-out rules"))
        form.tipOutRules = rules
        #expect(form.readiness(form.live) == .blocked("Add people to tip out"))
        form.addOneOff(name: "Sam", role: "Host")
        #expect(form.readiness(form.live) == .blocked("No tip-out rule matches who's working"))
    }

    @Test func switchingModesKeepsWhatWasTyped() {
        var form = ShiftForm(day: Fixture.day, method: .hours, crew: crew())
        form.tipsText = "100"
        form.rows[0].hoursText = "5"
        form.mode = .tipOut
        form.rows[0].tipsText = "400"
        form.mode = .pool
        #expect(form.tipsText == "100")
        #expect(form.rows[0].hoursText == "5")
        #expect(form.draft.participants[0].tipsCents == nil)
        form.mode = .tipOut
        #expect(form.draft.participants[0].tipsCents == 40000)
        #expect(form.draft.tipOutRules == rules)
    }

    @Test func duplicatingATipOutShiftReproducesIt() {
        let original = ShiftForm.example(day: Fixture.day, mode: .tipOut, method: .hours)
        let saved = FinishedShift(id: original.id, finishedAt: Date(timeIntervalSince1970: 0), outcome: .tipOut(original.tipOutCalculation.result))
        let copy = ShiftForm.duplicating(saved, day: Fixture.day)
        #expect(copy.mode == .tipOut)
        #expect(copy.tipOutRules == original.tipOutRules)
        #expect(copy.tipOutCalculation.result.people.map(\.netCents) == original.tipOutCalculation.result.people.map(\.netCents))
    }

    @Test func exportsDescribeTheTipOut() throws {
        let form = ShiftForm.example(day: Fixture.day, mode: .tipOut, method: .hours)
        let result = form.tipOutCalculation.result
        let text = ShareSummary.text(for: ShiftOutcome.tipOut(result))
        #expect(text.contains("Tip out: $183.96 tipped out from $1,017.25 in tips"))
        #expect(text.contains("Ava (Server): tips $412.50, tipped out $90.20, keeps $322.30"))
        #expect(text.contains("Priya (Bartender) \u{00B7} 8h: tips $286.00, tipped out $28.60, received $41.50, net $298.90"))
        #expect(text.contains("Jordan (Busser) \u{00B7} 6h: received $45.55"))
        #expect(text.contains("Tipped out $183.96, received $183.96, $0.00 left over"))
        #expect(!text.contains("\u{2014}"))

        let shift = FinishedShift(id: form.id, finishedAt: Date(timeIntervalSince1970: 1_791_500_000), outcome: .tipOut(result))
        let lines = CSVExporter.csv(for: [shift]).split(separator: "\r\n").map(String.init)
        #expect(lines.count == 1 + 8)
        #expect(lines[1].contains(",Tip Out,,Ava,Server,Yes,Tips out,Eligible for pool,,,,,,,,,,,412.50,2140.00,,520.00,90.20,0.00,322.30,"))
        #expect(lines[4].contains(",Jordan,Busser,Yes,Receives,Eligible for pool,6:00,360,"))

        let explanation = Explainer.explain(result.people[0], in: result)
        #expect(explanation.lines.first == Explanation.Line(label: "Tips collected", value: "$412.50"))
        #expect(explanation.lines.contains(Explanation.Line(label: "To Busser: 2% of $2,140.00 sales", value: "-$42.80")))
        #expect(explanation.lines.last == Explanation.Line(label: "Keeps", value: "$322.30"))
    }

    @Test func tipOutShiftsSurviveABackupAndTamperingIsCaught() throws {
        let form = ShiftForm.example(day: Fixture.day, mode: .tipOut, method: .hours)
        let shift = FinishedShift(id: form.id, finishedAt: Date(timeIntervalSince1970: 1_791_500_000), outcome: .tipOut(form.tipOutCalculation.result))
        let library = Library(crews: [crew()], shifts: [shift])
        let data = try BackupCodec.encode(BackupDocument(library: library, exportedAt: Date(timeIntervalSince1970: 0), appVersion: nil))
        let decoded = try BackupCodec.decode(data)
        #expect(decoded.shifts == [shift])
        #expect(decoded.crews[0].tipOutRules == rules)

        var tampered = shift
        guard case .tipOut(var result) = tampered.outcome else { return }
        result.people[3].receipts[0].cents += 1
        result.people[4].receipts[0].cents -= 1
        tampered.outcome = .tipOut(result)
        let bad = try BackupCodec.encode(BackupDocument(library: Library(shifts: [tampered]), exportedAt: Date(timeIntervalSince1970: 0), appVersion: nil))
        #expect(throws: BackupError.self) { try BackupCodec.decode(bad) }
    }

    @Test func oldSavedDataWithoutTipOutFieldsStillLoads() throws {
        let json = """
        {"id":"7B4E1C42-6A1F-4C55-9E0B-6F8C7F7D4E11","name":"Dinner","employees":[]}
        """
        let crew = try JSONDecoder().decode(Crew.self, from: Data(json.utf8))
        #expect(crew.tipOutRules.isEmpty)
    }
}
