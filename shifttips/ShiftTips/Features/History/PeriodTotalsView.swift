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
        List {
            Section {
                Picker("Period", selection: presetBinding) {
                    ForEach(PeriodPreset.allCases, id: \.self) { preset in
                        Text(preset.title).tag(Optional(preset))
                    }
                    Text("Custom").tag(PeriodPreset?.none)
                }
                DatePicker("From", selection: fromBinding, displayedComponents: .date)
                DatePicker("Through", selection: throughBinding, in: from.date()..., displayedComponents: .date)
            } footer: {
                Text("Adds up every saved shift dated in this period, Tip Pool and Tip Out.")
            }

            Section {
                LabeledContent("Saved shifts", value: "\(summary.shiftCount)")
                LabeledContent("Pool allocations", value: Money.format(summary.poolCents))
                LabeledContent("Tipped out", value: Money.format(summary.tippedOutCents))
                LabeledContent("Total to people", value: Money.format(summary.totalCents))
                    .fontWeight(.semibold)
            }
            .monospacedDigit()

            if summary.people.isEmpty {
                Section {
                    Text("No saved shifts in this period.")
                        .foregroundStyle(Theme.inkSecondary)
                }
            } else {
                Section("People") {
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
                    }
                }
            }

            Section {
                Text("Totals of saved calculations, not a record of payment. Crew members are matched across shifts even if renamed; people added for one shift are matched by name. Tip Out totals include the tips people kept as well as tip-outs they received.")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
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

struct PersonTotalRow: View {
    let person: PersonTotal
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: toggle) {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(person.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                        Text(subtitle)
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer(minLength: 8)
                    MoneyText(cents: person.totalCents, font: .headline)
                        .foregroundStyle(Theme.ink)
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
            .accessibilityHint(isExpanded ? "Hides the breakdown" : "Shows the breakdown")

            if isExpanded {
                VStack(spacing: 6) {
                    if person.poolCents != 0 {
                        LabeledContent("Pool allocations", value: Money.format(person.poolCents))
                        if person.poolCashCents != 0 || person.poolCardCents != 0 {
                            LabeledContent("  Cash", value: Money.format(person.poolCashCents))
                            LabeledContent("  Card", value: Money.format(person.poolCardCents))
                        }
                    }
                    if person.tipsCollectedCents != 0 || person.tippedOutCents != 0 {
                        LabeledContent("Tips collected", value: Money.format(person.tipsCollectedCents))
                        LabeledContent("Tipped out", value: "-" + Money.format(person.tippedOutCents))
                    }
                    if person.receivedCents != 0 {
                        LabeledContent("Tip-outs received", value: "+" + Money.format(person.receivedCents))
                    }
                    LabeledContent("Total", value: Money.format(person.totalCents))
                        .fontWeight(.semibold)
                }
                .font(.footnote)
                .monospacedDigit()
            }
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String {
        var parts: [String] = []
        if let role = person.role, !role.isEmpty { parts.append(role) }
        parts.append(person.shiftCount == 1 ? "1 shift" : "\(person.shiftCount) shifts")
        if person.isOneOff { parts.append("Added per shift") }
        return parts.joined(separator: " \u{00B7} ")
    }
}
