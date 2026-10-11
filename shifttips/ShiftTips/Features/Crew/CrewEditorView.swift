import SwiftUI
import ShiftTipsCore
import ShiftTipsData

enum CrewEditorItem: Identifiable {
    case new
    /// A new crew set up in a chosen style (Advanced).
    case newWithStyle(TipStyle)
    case edit(Crew)

    var id: String {
        switch self {
        case .new: "new"
        case .newWithStyle(let style): "new-\(style.rawValue)"
        case .edit(let crew): crew.id.uuidString
        }
    }
}

/// Creates or edits a saved crew. Changes apply when Save is tapped; a
/// shift that's open with this crew keeps the hours already typed.
/// In Advanced it also holds the crew's tip style: how its shifts start,
/// points by role and tip-out rules.
struct CrewEditorView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var crew: Crew
    @State private var addingPerson = false
    @State private var confirmDelete = false
    @State private var choosingStyle = false
    @State private var pendingStyle: TipStyle?
    private let isNew: Bool

    init(item: CrewEditorItem) {
        switch item {
        case .new:
            _crew = State(initialValue: Crew(name: ""))
            isNew = true
        case .newWithStyle(let style):
            var crew = Crew(name: "")
            crew.adopt(style)
            _crew = State(initialValue: crew)
            isNew = true
        case .edit(let crew):
            _crew = State(initialValue: crew)
            isNew = false
        }
    }

    private var isAdvanced: Bool { store.settings.experience == .advanced }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("e.g. Thursday Dinner", text: $crew.name)
                        .textInputAutocapitalization(.words)
                        .font(.display(.title3, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .accessibilityIdentifier("crewName")
                } header: {
                    SectionLabel("Crew name")
                }
                .ledgerRows()

                if isAdvanced {
                    styleSection
                }

                peopleSection

                if isAdvanced && crew.mode == .pool && crew.method == .weightedHours {
                    rolePointsSection
                }

                if isAdvanced && crew.mode == .tipOut {
                    Section {
                        NavigationLink {
                            TipOutRulesEditor(rules: $crew.tipOutRules, roles: ruleRoles)
                        } label: {
                            LabeledContent("Tip-out rules") {
                                Text(crew.tipOutRules.isEmpty ? "None yet" : "\(crew.tipOutRules.count)")
                                    .font(.mono(.body, weight: .semibold))
                            }
                        }
                        .accessibilityIdentifier("crewTipOutRules")
                        ForEach(crew.tipOutRules) { rule in
                            RuleLine(rule: rule)
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel(rule.spokenSummary)
                        }
                    } header: {
                        SectionLabel("Make it yours: tip-outs")
                    } footer: {
                        LedgerFootnote("Match each rule to your house policy. Roles match people's role labels above.")
                    }
                    .ledgerRows()
                }

                Section {
                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .ledgerRows()

                if !isNew {
                    Section {
                        Button("Delete Crew", role: .destructive) { confirmDelete = true }
                            .foregroundStyle(Theme.danger)
                    } footer: {
                        LedgerFootnote("Saved shifts keep their own copy of everyone, so deleting a crew never changes History.")
                    }
                    .ledgerRows()
                }
            }
            .ledgerList()
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
                AddEmployeeSheet(showsPoints: isAdvanced, roleSuggestions: roleSuggestions, rolePoints: crew.rolePoints) { employee in
                    crew.employees.append(employee)
                }
            }
            .sheet(isPresented: $choosingStyle) {
                NavigationStack {
                    StylePickerView(current: crew.style) { style in
                        choosingStyle = false
                        if crew.style == nil && crew.tipOutRules.isEmpty && crew.rolePoints.isEmpty {
                            crew.adopt(style)
                        } else {
                            pendingStyle = style
                        }
                    }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { choosingStyle = false }
                        }
                    }
                }
            }
            .confirmationDialog(
                "Switch to \(pendingStyle?.title ?? "this style")?",
                isPresented: Binding(get: { pendingStyle != nil }, set: { if !$0 { pendingStyle = nil } }),
                titleVisibility: .visible
            ) {
                Button("Use This Style") {
                    if let style = pendingStyle { crew.adopt(style) }
                    pendingStyle = nil
                }
                Button("Cancel", role: .cancel) { pendingStyle = nil }
            } message: {
                Text("Its starting rules or role points replace this crew's current ones. Saved shifts don't change.")
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

    // MARK: - Sections

    private var styleSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                if let style = crew.style {
                    Text(style.title)
                        .font(.display(.title3, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text(style.summary)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("Choose the style closest to how this team splits tips. You can change every number after.")
                        .foregroundStyle(Theme.ink)
                }
                Button(crew.style == nil ? "Choose a Style" : "Change Style") { choosingStyle = true }
                    .buttonStyle(TextButtonStyle())
                    .accessibilityIdentifier("chooseStyle")
            }
            .padding(.top, 4)
            Picker("Tips are", selection: $crew.mode) {
                Text("Pooled").tag(ShiftMode.pool)
                Text("Tipped out").tag(ShiftMode.tipOut)
            }
            .pickerStyle(.menu)
            .tint(Theme.ink)
            if crew.mode == .pool {
                Picker("Pool split", selection: $crew.method) {
                    ForEach(SplitMethod.allCases, id: \.self) { method in
                        Text(method.title).tag(method)
                    }
                }
                .pickerStyle(.menu)
                .tint(Theme.ink)
            }
        } header: {
            SectionLabel("Tip style")
        } footer: {
            LedgerFootnote("Every new shift with this crew starts this way. You can still change a single shift.")
        }
        .ledgerRows()
    }

    private var peopleSection: some View {
        Section {
            ForEach($crew.employees) { $employee in
                NavigationLink {
                    EmployeeEditorView(
                        employee: $employee,
                        showsPoints: isAdvanced,
                        roleSuggestions: roleSuggestions,
                        rolePoints: crew.rolePoints
                    )
                    .navigationTitle(employee.name.isEmpty ? "Person" : employee.name)
                    .navigationBarTitleDisplayMode(.inline)
                } label: {
                    EmployeeSummaryRow(employee: employee, showsPoints: isAdvanced)
                }
            }
            .onDelete { crew.employees.remove(atOffsets: $0) }
            .onMove { crew.employees.move(fromOffsets: $0, toOffset: $1) }

            Button {
                addingPerson = true
            } label: {
                Label("Add Person", systemImage: "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.ink)
            }
            .accessibilityIdentifier("addPerson")
        } header: {
            HStack {
                SectionLabel(crew.employees.count == 1 ? "People, 1" : "People, \(crew.employees.count)")
                Spacer()
                if crew.employees.count > 1 {
                    EditButton()
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                }
            }
        } footer: {
            LedgerFootnote("This order is the order on every shift. If two shares tie exactly, the leftover cent goes to whoever is higher on the list.")
        }
        .ledgerRows()
    }

    private var rolePointsSection: some View {
        Section {
            ForEach(crew.pointRoles, id: \.self) { role in
                RolePointsRow(role: role, units: crew.points(forRole: role)) { units in
                    crew.setPoints(units, forRole: role)
                }
            }
        } header: {
            SectionLabel("Make it yours: points by role")
        } footer: {
            LedgerFootnote("Each role's points go to everyone in it, and to people you add later. You can still change one person's points on their page.")
        }
        .ledgerRows()
    }

    // MARK: - Helpers

    /// Common roles plus this crew's own, each once.
    private var roleSuggestions: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for role in crew.roles + TipStyle.commonRoles + crew.rolePoints.map(\.role) {
            guard let key = TipOutRule.roleKey(role), !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(role)
        }
        return result
    }

    /// Roles for the rule editor: the crew's and its rules'.
    private var ruleRoles: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for role in crew.roles + crew.tipOutRules.flatMap({ [$0.fromRole, $0.toRole] }) + TipStyle.commonRoles {
            guard let key = TipOutRule.roleKey(role), !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(role)
        }
        return result
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

/// One role's points, typed as text and committed when valid.
struct RolePointsRow: View {
    let role: String
    let units: Int64?
    let onCommit: (Int64) -> Void
    @State private var text = ""

    var body: some View {
        HStack {
            Text(role)
                .foregroundStyle(Theme.ink)
            Spacer()
            TextField("1", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.mono(.body, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(width: 72)
                .accessibilityLabel("Points for \(role)")
            Text("PTS")
                .font(.mono(.caption2, weight: .bold))
                .foregroundStyle(Theme.inkSecondary)
        }
        .onAppear { text = Points.format(units: units ?? Limits.defaultPointsUnits) }
        .onChange(of: text) { _, newValue in
            if case .success(let parsed) = Points.parse(newValue), parsed >= Limits.minPointsUnits {
                onCommit(parsed)
            }
        }
    }
}

struct EmployeeSummaryRow: View {
    let employee: Employee
    var showsPoints = true

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(employee.name.isEmpty ? "Unnamed" : employee.name)
                .font(.body.weight(.semibold))
                .foregroundStyle(employee.name.isEmpty ? Theme.warning : Theme.ink)
            if !details.isEmpty {
                Text(details)
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var details: String {
        var parts: [String] = []
        if let role = employee.role, !role.isEmpty {
            parts.append(role.uppercased())
        } else if showsPoints {
            parts.append("No role")
        }
        if showsPoints { parts.append("\(Points.format(units: employee.pointsUnits)) pt") }
        if employee.eligibility != .eligible { parts.append(employee.eligibility.title) }
        return parts.joined(separator: " \u{00B7} ")
    }
}

/// A new crew member, added when the crew is saved.
struct AddEmployeeSheet: View {
    var showsPoints = true
    var roleSuggestions: [String] = TipStyle.commonRoles
    var rolePoints: [RolePoints] = []
    let onAdd: (Employee) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var employee = Employee(name: "")

    var body: some View {
        NavigationStack {
            EmployeeEditorView(employee: $employee, focusName: true, showsPoints: showsPoints, roleSuggestions: roleSuggestions, rolePoints: rolePoints)
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
