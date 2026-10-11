import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// Each person's tips across the saved shifts in a pay period, for payroll.
struct PeriodTotalsView: View {
    @Environment(AppStore.self) private var store
    @State private var preset: PeriodPreset? = .thisWeek
    @State private var from: CalendarDay
    @State private var through: CalendarDay
    @State private var expanded: Set<String> = []
    @State private var file: SharedFile?
    @State private var problem: String?

    init() {
        let range = PeriodPreset.thisWeek.range(today: CalendarDay(Date()), firstWeekday: Calendar.current.firstWeekday)
        _from = State(initialValue: range.from)
        _through = State(initialValue: range.through)
    }

    var body: some View {
        let summary = PeriodTotals.summarize(store.library.shifts, from: from, through: through)
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
                periodSection
                totalSection(summary)
                peopleSection(summary)
                Text("Totals of saved calculations, not a record of payment. Crew members are matched across shifts even if renamed; people added for one shift are matched by name. Tip Out totals include the tips people kept as well as tip-outs they received.")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background { Theme.background.ignoresSafeArea() }
        .navigationTitle("Totals by Person")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ShareLink(item: PeriodTotals.text(summary)) {
                        Label("Share as Text", systemImage: "text.alignleft")
                    }
                    Button {
                        exportCSV(summary)
                    } label: {
                        Label("Export CSV", systemImage: "tablecells")
                    }
                } label: {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                .disabled(summary.people.isEmpty)
            }
        }
        .sheet(item: $file) { file in
            ActivityView(items: [file.url])
                .presentationDetents([.medium, .large])
                .ignoresSafeArea()
        }
        .alert("Couldn't Export", isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })) {
            Button("OK") { problem = nil }
        } message: {
            Text(problem ?? "")
        }
    }

    private var periodSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Pay period")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PeriodPreset.allCases, id: \.self) { option in
                        PeriodChip(title: option.title, isSelected: preset == option) {
                            presetBinding.wrappedValue = option
                        }
                    }
                    PeriodChip(title: "Custom", isSelected: preset == nil) {
                        preset = nil
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Period")
            VStack(spacing: 0) {
                dateRow("From", selection: fromBinding, range: nil)
                Rule()
                dateRow("Through", selection: throughBinding, range: from.date()...)
            }
            .padding(.horizontal, 16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
            Text("Adds up every saved shift dated in this period, Tip Pool and Tip Out.")
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
                .padding(.horizontal, 4)
        }
    }

    private func dateRow(_ title: String, selection: Binding<Date>, range: PartialRangeFrom<Date>?) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.mono(.caption, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Theme.inkSecondary)
            Spacer()
            if let range {
                DatePicker(title, selection: selection, in: range, displayedComponents: .date)
                    .labelsHidden()
            } else {
                DatePicker(title, selection: selection, displayedComponents: .date)
                    .labelsHidden()
            }
        }
        .frame(minHeight: 52)
    }

    private func totalSection(_ summary: PeriodSummary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader("Total to people")
            VStack(alignment: .leading, spacing: 12) {
                MoneyText(cents: summary.totalCents, font: .display(.largeTitle))
                    .foregroundStyle(Theme.ink)
                HStack(alignment: .top, spacing: 0) {
                    StatCell(title: "Saved shifts", value: "\(summary.shiftCount)")
                    Rectangle().fill(Theme.rule).frame(width: 1).accessibilityHidden(true)
                    StatCell(title: "Pool", value: Money.format(summary.poolCents))
                    Rectangle().fill(Theme.rule).frame(width: 1).accessibilityHidden(true)
                    StatCell(title: "Tipped out", value: Money.format(summary.tippedOutCents))
                }
                .fixedSize(horizontal: false, vertical: true)
                .overlay(alignment: .top) { Rule() }
            }
            .card()
        }
    }

    @ViewBuilder
    private func peopleSection(_ summary: PeriodSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("People") {
                Text(summary.people.count == 1 ? "1 PERSON" : "\(summary.people.count) PEOPLE")
                    .font(.mono(.caption, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
            }
            if summary.people.isEmpty {
                Text("No saved shifts in this period.")
                    .foregroundStyle(Theme.inkSecondary)
                    .card()
            } else {
                VStack(spacing: 0) {
                    ForEach(summary.people) { person in
                        PersonTotalRow(
                            person: person,
                            isExpanded: expanded.contains(person.id),
                            toggle: {
                                withAnimation(.snappy) {
                                    if expanded.contains(person.id) { expanded.remove(person.id) } else { expanded.insert(person.id) }
                                }
                            }
                        )
                        if person.id != summary.people.last?.id {
                            Rule()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
            }
        }
    }

    private var presetBinding: Binding<PeriodPreset?> {
        Binding(
            get: { preset },
            set: { newValue in
                preset = newValue
                if let newValue {
                    let range = newValue.range(today: store.today, firstWeekday: Calendar.current.firstWeekday)
                    from = range.from
                    through = range.through
                }
            }
        )
    }

    private var fromBinding: Binding<Date> {
        Binding(
            get: { from.date() },
            set: { date in
                from = CalendarDay(date)
                if through < from { through = from }
                preset = nil
            }
        )
    }

    private var throughBinding: Binding<Date> {
        Binding(
            get: { through.date() },
            set: { date in
                through = CalendarDay(date)
                preset = nil
            }
        )
    }

    private func exportCSV(_ summary: PeriodSummary) {
        do {
            let name = BackupCodec.safeFileName("ShiftTips totals \(summary.from.isoString) to \(summary.through.isoString)", ext: "csv")
            file = SharedFile(url: try ExportFiles.write(Data(PeriodTotals.csv(summary).utf8), named: name))
        } catch {
            problem = "ShiftTips couldn't create the file. Free up some storage and try again."
        }
    }
}

/// One preset period, as a chip.
struct PeriodChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .frame(minHeight: 40)
                .foregroundStyle(isSelected ? Theme.onInk : Theme.ink)
                .background(isSelected ? Theme.ink : Theme.surface, in: Capsule())
                .padding(.vertical, 2)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A figure with a small label over it.
struct StatCell: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.mono(.caption2, weight: .semibold))
                .foregroundStyle(Theme.inkSecondary)
            Text(value)
                .font(.mono(.subheadline, weight: .bold))
                .foregroundStyle(Theme.ink)
                .minimumScaleFactor(0.8)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.top, 12)
        .accessibilityElement(children: .combine)
    }
}

struct PersonTotalRow: View {
    let person: PersonTotal
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(person.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(subtitle)
                            .font(.mono(.caption))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer(minLength: 8)
                    MoneyText(cents: person.totalCents, font: .mono(.body, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    ExpandChevron(isExpanded: isExpanded)
                }
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint(isExpanded ? "Hides the breakdown" : "Shows the breakdown")

            if isExpanded {
                WorkingView(summary: "Across \(person.shiftCount == 1 ? "1 saved shift" : "\(person.shiftCount) saved shifts") in this period.", lines: lines)
                    .padding(.bottom, 12)
            }
        }
    }

    private var lines: [(String, String)] {
        var lines: [(String, String)] = []
        if person.poolCents != 0 {
            lines.append(("Pool allocations", Money.format(person.poolCents)))
            if person.poolCashCents != 0 || person.poolCardCents != 0 {
                lines.append(("  Cash", Money.format(person.poolCashCents)))
                lines.append(("  Card", Money.format(person.poolCardCents)))
            }
        }
        if person.tipsCollectedCents != 0 || person.tippedOutCents != 0 {
            lines.append(("Tips collected", Money.format(person.tipsCollectedCents)))
            lines.append(("Tipped out", "-" + Money.format(person.tippedOutCents)))
        }
        if person.receivedCents != 0 {
            lines.append(("Tip-outs received", "+" + Money.format(person.receivedCents)))
        }
        lines.append(("Total", Money.format(person.totalCents)))
        return lines
    }

    private var subtitle: String {
        var parts: [String] = []
        if let role = person.role, !role.isEmpty { parts.append(role.uppercased()) }
        parts.append(person.shiftCount == 1 ? "1 shift" : "\(person.shiftCount) shifts")
        if person.isOneOff { parts.append("Added per shift") }
        return parts.joined(separator: " \u{00B7} ").uppercased()
    }
}
