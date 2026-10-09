import SwiftUI
import ShiftTipsCore
import ShiftTipsData

enum CrewEditorItem: Identifiable {
    case new
    case edit(Crew)

    var id: String {
        switch self {
        case .new: "new"
        case .edit(let crew): crew.id.uuidString
        }
    }
}

/// Creates or edits a saved crew. Changes apply when Save is tapped; a
/// shift that's open with this crew keeps the hours already typed.
struct CrewEditorView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var crew: Crew
    @State private var addingPerson = false
    @State private var confirmDelete = false
    private let isNew: Bool

    init(item: CrewEditorItem) {
        switch item {
        case .new:
            _crew = State(initialValue: Crew(name: ""))
            isNew = true
        case .edit(let crew):
            _crew = State(initialValue: crew)
            isNew = false
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Crew name") {
                    TextField("e.g. Thursday Dinner", text: $crew.name)
                        .textInputAutocapitalization(.words)
                        .accessibilityIdentifier("crewName")
                }

                Section {
                    ForEach($crew.employees) { $employee in
                        NavigationLink {
                            EmployeeEditorView(employee: $employee)
                                .navigationTitle(employee.name.isEmpty ? "Person" : employee.name)
                                .navigationBarTitleDisplayMode(.inline)
                        } label: {
                            EmployeeSummaryRow(employee: employee)
                        }
                    }
                    .onDelete { crew.employees.remove(atOffsets: $0) }
                    .onMove { crew.employees.move(fromOffsets: $0, toOffset: $1) }

                    Button {
                        addingPerson = true
                    } label: {
                        Label("Add Person", systemImage: "person.badge.plus")
                    }
                    .accessibilityIdentifier("addPerson")
                } header: {
                    HStack {
                        Text("People")
                        Spacer()
                        if crew.employees.count > 1 {
                            EditButton()
                                .font(.footnote)
                        }
                    }
                } footer: {
                    Text("This order is the order on every shift. If two shares tie exactly, the leftover cent goes to whoever is higher on the list.")
                }

                Section {
                    NavigationLink {
                        TipOutRulesEditor(rules: $crew.tipOutRules, roles: crew.roles)
                    } label: {
                        LabeledContent("Tip-out rules", value: crew.tipOutRules.isEmpty ? "None" : "\(crew.tipOutRules.count)")
                    }
                } footer: {
                    Text("Used when a shift is in Tip Out mode, like \u{201C}Server \u{2192} Busser: 2% of sales.\u{201D} Roles come from each person's role label.")
                }

                Section {
                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }

                if !isNew {
                    Section {
                        Button("Delete Crew", role: .destructive) { confirmDelete = true }
                    } footer: {
                        Text("Saved shifts keep their own copy of everyone, so deleting a crew never changes History.")
                    }
                }
            }
            .navigationTitle(isNew ? "New Crew" : "Edit Crew")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        store.saveCrew(cleaned)
                        dismiss()
                    }
                    .disabled(!isValid)
                    .accessibilityIdentifier("saveCrew")
                }
            }
            .sheet(isPresented: $addingPerson) {
                AddEmployeeSheet { employee in
                    crew.employees.append(employee)
                }
            }
            .alert("Delete \(crew.name.isEmpty ? "this crew" : crew.name)?", isPresented: $confirmDelete) {
                Button("Delete", role: .destructive) {
                    store.deleteCrew(id: crew.id)
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The crew is removed from this iPhone. Saved shifts aren't affected.")
            }
            .sensoryFeedback(trigger: crew.employees.count) { old, new in
                new > old && store.settings.hapticsEnabled ? .impact(weight: .light) : nil
            }
        }
    }

    private var isValid: Bool {
        !cleaned.name.isEmpty && cleaned.employees.allSatisfy { !$0.name.isEmpty }
    }

    private var cleaned: Crew {
        var copy = crew
        copy.name = String(crew.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Limits.maxNameLength))
        copy.employees = crew.employees.map { employee in
            var e = employee
            e.name = String(employee.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Limits.maxNameLength))
            let role = employee.role?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            e.role = role.isEmpty ? nil : String(role.prefix(Limits.maxNameLength))
            return e
        }
        return copy
    }
}

struct EmployeeSummaryRow: View {
    let employee: Employee

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(employee.name.isEmpty ? "Unnamed" : employee.name)
                .foregroundStyle(employee.name.isEmpty ? Theme.warning : Theme.ink)
            Text(details)
                .font(.footnote)
                .foregroundStyle(Theme.inkSecondary)
        }
        .accessibilityElement(children: .combine)
    }

    private var details: String {
        var parts: [String] = []
        if let role = employee.role, !role.isEmpty { parts.append(role) }
        parts.append("\(Points.format(units: employee.pointsUnits)) pt")
        if employee.role == nil || employee.role?.isEmpty == true { parts.append("No role") }
        if employee.eligibility != .eligible { parts.append(employee.eligibility.title) }
        return parts.joined(separator: " \u{00B7} ")
    }
}

/// A new crew member, added when the crew is saved.
struct AddEmployeeSheet: View {
    let onAdd: (Employee) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var employee = Employee(name: "")

    var body: some View {
        NavigationStack {
            EmployeeEditorView(employee: $employee, focusName: true)
                .navigationTitle("Add Person")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") {
                            onAdd(employee)
                            dismiss()
                        }
                        .disabled(employee.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("addEmployee")
                    }
                }
        }
    }
}
