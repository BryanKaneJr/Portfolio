import Foundation
import Testing
@testable import ShiftTipsCore

@Suite struct ExplanationTests {
    @Test func percentAndExactShare() {
        #expect(Explainer.percentText(weight: 1, total: 3) == "33.3%")
        #expect(Explainer.percentText(weight: 2, total: 3) == "66.7%")
        #expect(Explainer.percentText(weight: 3, total: 8) == "37.5%")
        #expect(Explainer.percentText(weight: 5, total: 5) == "100%")
        #expect(Explainer.exactShareText(pool: 19000, weight: 9, total: 20) == "$85.50")
        #expect(Explainer.exactShareText(pool: 1000, weight: 1, total: 3) == "$3.3333\u{2026}")
        #expect(Explainer.exactShareText(pool: 101, weight: 1, total: 4) == "$0.2525")
        #expect(Explainer.weightedHoursText(450 * 1500) == "11.25")
        #expect(Explainer.weightedHoursText(7 * 1000) == "about 0.11")
    }

    @Test func explainsAReceivingPersonStepByStep() {
        let calc = PoolCalculator.calculate(Fixture.draft(.weightedHours, pool: .total(19000), [
            Fixture.person("Server", hours: 8, points: 1000),
            Fixture.person("Bartender", hours: 6, points: 1500),
            Fixture.person("Support", hours: 6, points: 500),
        ]))
        let explanation = Explainer.explain(calc.allocations[1], in: calc.result)
        let values = Dictionary(uniqueKeysWithValues: explanation.lines.map { ($0.label, $0.value) })
        #expect(values["Hours"] == "6h")
        #expect(values["Points"] == "1.5")
        #expect(values["Their weight"] == "9.00 weighted hrs")
        #expect(values["Pool weight"] == "20.00 weighted hrs")
        #expect(values["Share of pool"] == "45%")
        #expect(values["Exact share"] == "$85.50")
        #expect(values["Rounding"] == "None")
        #expect(values["Allocated"] == "$85.50")
    }

    @Test func explainsWhySomeoneIsOut() {
        let calc = PoolCalculator.calculate(Fixture.draft(.equal, pool: .total(100), [
            Fixture.person("A"), Fixture.person("Lee", eligibility: .managerSupervisorOwner),
        ]))
        let explanation = Explainer.explain(calc.allocations[1], in: calc.result)
        #expect(explanation.lines.isEmpty)
        #expect(explanation.summary.contains("never includes them"))
    }
}

@Suite struct ShareSummaryTests {
    @Test func summaryStatesAllocationNotPayment() {
        var draft = Fixture.draft(.equal, pool: .cashAndCard(cash: 10001, card: 5002), [
            ShiftParticipant(name: "Ava", role: "Server"),
            ShiftParticipant(name: "Marco"),
            ShiftParticipant(name: "Jo"),
            ShiftParticipant(name: "Lee", eligibility: .managerSupervisorOwner),
        ])
        draft.label = "Dinner"
        let text = ShareSummary.text(for: PoolCalculator.calculate(draft).result)
        #expect(text == """
        ShiftTips: Thu, Oct 8, 2026 \u{00B7} Dinner
        Pooled tips: $150.03 (cash $100.01 + card $50.02)
        Split: Equal (3 equal shares)

        Ava (Server): $50.02 (cash $33.34, card $16.68)
        Marco: $50.01 (cash $33.34, card $16.67)
        Jo: $50.00 (cash $33.33, card $16.67)

        Not in this pool: Lee (owner, manager or supervisor)

        Allocated $150.03 of $150.03, $0.00 remaining
        A calculation of how the pool is allocated, not a record of payment.
        """)
        #expect(!text.contains("\u{2014}"))
    }
}

@Suite struct CSVTests {
    @Test func oneRowPerPersonAndTotalsMatchTheSnapshot() {
        let form = ShiftForm.example(day: Fixture.day, method: .hours)
        let shift = FinishedShift(id: form.id, finishedAt: Date(timeIntervalSince1970: 1_791_500_000), result: form.calculation.result)
        let csv = CSVExporter.csv(for: [shift])
        let lines = csv.split(separator: "\r\n").map(String.init)
        #expect(lines.count == 1 + 6)
        #expect(lines[0].hasPrefix("Shift ID,Shift date,Shift label,Split method,Person,"))
        #expect(lines[1].contains(",Ava,Server,Yes,In pool,Eligible for pool,7:30,450,1,24,,,113.37,,,472.38,"))
        #expect(lines[6].contains(",Lee,Manager,No,Owner/manager,\"Owner, manager or supervisor\",9:00,540,1,0,,,0.00,,,472.38,"))
        // The CSV's per-person totals add back to the pool.
        let totals = lines.dropFirst().map { line -> Int64 in
            let cell = line.split(separator: ",", omittingEmptySubsequences: false)
            return try! Money.parse(String(cell[cell.count - 5])).get()
        }
        #expect(totals.reduce(0, +) == 47238)
    }

    @Test func escapesQuotesCommasAndFormulas() {
        #expect(CSVExporter.escape("plain") == "plain")
        #expect(CSVExporter.escape("a,b") == "\"a,b\"")
        #expect(CSVExporter.escape("say \"hi\"") == "\"say \"\"hi\"\"\"")
        #expect(CSVExporter.escape("=SUM(A1)") == "'=SUM(A1)")
        #expect(CSVExporter.escape("@me") == "'@me")
    }
}

@Suite struct BackupTests {
    func sampleLibrary() -> Library {
        let crew = Crew(name: "Dinner", employees: [Employee(name: "Ava"), Employee(name: "Lee", eligibility: .managerSupervisorOwner)])
        var form = ShiftForm(day: Fixture.day, method: .equal, crew: crew)
        form.tipsText = "100.01"
        let shift = FinishedShift(id: form.id, finishedAt: Date(timeIntervalSince1970: 1_791_500_000), result: form.calculation.result)
        return Library(crews: [crew], shifts: [shift], settings: AppSettings(defaultMethod: .equal, activeCrewId: crew.id, hasSeenWelcome: true))
    }

    func encoded(_ library: Library) throws -> Data {
        try BackupCodec.encode(BackupDocument(library: library, exportedAt: Date(timeIntervalSince1970: 1_791_600_000), appVersion: "1.0"))
    }

    @Test func roundTrips() throws {
        let library = sampleLibrary()
        let document = try BackupCodec.decode(encoded(library))
        #expect(document.crews == library.crews)
        #expect(document.shifts == library.shifts)
        #expect(document.settings == library.settings)
    }

    @Test func rejectsFilesThatArentBackups() {
        #expect(throws: BackupError.notABackup) { try BackupCodec.decode(Data("hello".utf8)) }
        #expect(throws: BackupError.notABackup) { try BackupCodec.decode(Data("{\"format\":\"other\",\"schemaVersion\":1}".utf8)) }
    }

    @Test func rejectsNewerBackups() {
        let json = "{\"format\":\"app.shifttips.backup\",\"schemaVersion\":99}"
        #expect(throws: BackupError.newerVersion) { try BackupCodec.decode(Data(json.utf8)) }
    }

    @Test func rejectsTruncatedFiles() throws {
        let data = try encoded(sampleLibrary())
        #expect(throws: BackupError.self) { try BackupCodec.decode(data.prefix(data.count / 2)) }
    }

    @Test func rejectsTamperedAmounts() throws {
        var library = sampleLibrary()
        library.shifts[0].result.allocations[0].totalCents += 1
        #expect(throws: BackupError.self) { try BackupCodec.decode(encoded(library)) }

        var shuffled = sampleLibrary()
        shuffled.shifts[0].result.allocations[0].totalCents += 1
        shuffled.shifts[0].result.allocations[1].totalCents -= 1 // still adds up, but isn't the split
        #expect(throws: BackupError.self) { try BackupCodec.decode(encoded(shuffled)) }
    }

    @Test func rejectsCashAndCardThatDontAddUp() throws {
        let json = try String(decoding: encoded(sampleLibrary()), as: UTF8.self)
            .replacingOccurrences(of: "\"totalCents\" : 10001", with: "\"cardCents\" : 1,\n\"cashCents\" : 1,\n\"totalCents\" : 10001")
        #expect(throws: BackupError.self) { try BackupCodec.decode(Data(json.utf8)) }
    }

    @Test func mergeAddsOnlyWhatsNewAndNeverOverwrites() throws {
        let library = sampleLibrary()
        let document = try BackupCodec.decode(encoded(library))

        var (merged, summary) = BackupCodec.merge(document, into: library)
        #expect(merged == library)
        #expect(summary.crewsAlreadyHere == 1 && summary.shiftsAlreadyHere == 1)

        var changed = library
        changed.crews[0].name = "Renamed here"
        (merged, summary) = BackupCodec.merge(document, into: changed)
        #expect(merged.crews.map(\.name) == ["Renamed here", "Dinner (from backup)"])
        #expect(Set(merged.crews[1].employees.map(\.id)).isDisjoint(with: merged.crews[0].employees.map(\.id)))
        #expect(summary.crewsAddedAsCopies == 1)

        (merged, summary) = BackupCodec.merge(document, into: Library())
        #expect(merged.crews == library.crews && merged.shifts == library.shifts)
        #expect(summary.message == "1 crew added, 1 shift added.")
    }

    @Test func replaceTakesTheBackupAndDropsAMissingActiveCrew() throws {
        var library = sampleLibrary()
        library.settings.activeCrewId = UUID()
        let document = BackupDocument(library: library, exportedAt: Date(), appVersion: nil)
        let replaced = BackupCodec.replacing(with: document, keeping: Library())
        #expect(replaced.crews == library.crews)
        #expect(replaced.settings.activeCrewId == nil)
        #expect(replaced.settings.hasSeenWelcome)
    }

    @Test func fileNamesAreSafe() {
        #expect(BackupCodec.fileName(exportedOn: Fixture.day) == "ShiftTips backup 2026-10-08.json")
        #expect(BackupCodec.safeFileName("Shift / Tips: \"x\"", ext: "pdf") == "Shift Tips x.pdf")
    }
}
