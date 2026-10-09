import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// Saved shifts by month, newest first.
struct HistoryView: View {
    @Environment(AppStore.self) private var store
    @State private var pendingDelete: FinishedShift?
    @State private var file: SharedFile?
    @State private var problem: String?

    var body: some View {
        let shifts = store.shiftsNewestFirst
        Group {
            if shifts.isEmpty {
                ContentUnavailableView(
                    "No Saved Shifts",
                    systemImage: "clock",
                    description: Text("Shifts you save are kept here, on this iPhone.")
                )
            } else {
                List {
                    Section {
                        NavigationLink(value: Route.totals) {
                            Label("Totals by Person", systemImage: "person.2")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                        }
                        .accessibilityHint("Each person's tips for a pay period")
                        .accessibilityIdentifier("totalsByPerson")
                    } footer: {
                        Text("Add up a week, two weeks or a month for payroll.")
                    }
                    ForEach(monthGroups(shifts), id: \.title) { group in
                        Section(group.title) {
                            ForEach(group.shifts) { shift in
                                NavigationLink(value: Route.shift(shift.id)) {
                                    HistoryRow(shift: shift)
                                }
                                .swipeActions {
                                    Button {
                                        pendingDelete = shift
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    .tint(.red)
                                }
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("History")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    exportAll(shifts)
                } label: {
                    Label("Export CSV", systemImage: "square.and.arrow.up")
                }
                .disabled(shifts.isEmpty)
            }
        }
        .alert(
            "Delete this shift?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            presenting: pendingDelete
        ) { shift in
            Button("Delete", role: .destructive) { store.deleteShift(id: shift.id) }
            Button("Cancel", role: .cancel) {}
        } message: { shift in
            Text("\(shift.draft.title) will be removed from this iPhone. To keep a copy, open it and share the PDF or CSV first.")
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

    private func exportAll(_ shifts: [FinishedShift]) {
        do {
            let data = Data(CSVExporter.csv(for: shifts).utf8)
            file = SharedFile(url: try ExportFiles.write(data, named: CSVExporter.fileName(for: shifts)))
        } catch {
            problem = "ShiftTips couldn't create the file. Free up some storage and try again."
        }
    }

    private struct MonthGroup {
        let title: String
        let shifts: [FinishedShift]
    }

    private func monthGroups(_ shifts: [FinishedShift]) -> [MonthGroup] {
        var groups: [MonthGroup] = []
        for shift in shifts {
            let title = shift.day.monthText
            if let last = groups.last, last.title == title {
                groups[groups.count - 1] = MonthGroup(title: title, shifts: last.shifts + [shift])
            } else {
                groups.append(MonthGroup(title: title, shifts: [shift]))
            }
        }
        return groups
    }
}

struct HistoryRow: View {
    let shift: FinishedShift

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(shift.day.mediumText)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer()
            MoneyText(cents: shift.outcome.headlineCents, font: .headline)
                .foregroundStyle(Theme.ink)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        let outcome = shift.outcome
        var parts: [String] = []
        if let label = outcome.draft.label { parts.append(label) }
        parts.append(outcome.mode == .pool ? outcome.draft.method.title : "Tip Out")
        parts.append(outcome.peopleCount == 1 ? "1 person" : "\(outcome.peopleCount) people")
        return parts.joined(separator: " \u{00B7} ")
    }
}
