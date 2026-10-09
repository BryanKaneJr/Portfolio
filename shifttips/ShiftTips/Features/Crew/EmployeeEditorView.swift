import SwiftUI
import ShiftTipsCore

/// Name, role, points and pool eligibility for one crew member.
///
/// Eligibility rules (build plan, section 5D): an owner, manager or
/// supervisor never takes part and there is no override; making anyone
/// eligible again is a separate, deliberate edit that says ShiftTips can't
/// determine legal status. A role label never changes eligibility.
struct EmployeeEditorView: View {
    @Binding var employee: Employee
    var focusName = false
    /// Advanced shows points; Simple splits by hours only.
    var showsPoints = true
    /// Quick picks for the role, so names match the crew's rules.
    var roleSuggestions: [String] = TipStyle.commonRoles
    /// The crew's points by role: picking a role gives its points, until
    /// points are typed here.
    var rolePoints: [RolePoints] = []

    @State private var pointsText = ""
    @State private var pointsEdited = false
    @State private var confirmEligible = false
    @FocusState private var nameFocused: Bool

    var body: some View {
        List {
            Section {
                TextField("Name", text: $employee.name)
                    .textInputAutocapitalization(.words)
                    .font(.display(.title3, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .focused($nameFocused)
                    .accessibilityIdentifier("employeeName")
            } header: {
                SectionLabel("Name", index: "01")
            }
            .ledgerRows()

            Section {
                RoleField(
                    placeholder: "e.g. Server",
                    text: Binding(get: { employee.role ?? "" }, set: { setRole($0) }),
                    roles: roleSuggestions
                )
                .accessibilityIdentifier("employeeRole")
            } header: {
                SectionLabel("Role", index: "02")
            } footer: {
                LedgerFootnote(showsPoints
                     ? "Tip-out rules and role points match people by role. A role never decides who is in the pool."
                     : "Optional. A label only; it never decides who is in the pool.")
            }
            .ledgerRows()

            if showsPoints {
                Section {
                    TextField("1", text: Binding(
                        get: { pointsText },
                        set: { text in
                            pointsText = text
                            pointsEdited = true
                            if case .success(let units) = Points.parse(text), units >= Limits.minPointsUnits {
                                employee.pointsUnits = units
                            }
                        }
                    ))
                    .keyboardType(.decimalPad)
                    .font(.mono(.body, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .accessibilityLabel("Points")
                    if let error = pointsError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Theme.warning)
                    }
                } header: {
                    SectionLabel("Points", index: "03")
                } footer: {
                    LedgerFootnote("Used only by Hours \u{00D7} Points. Set from your workplace's own policy.")
                }
                .ledgerRows()
            }

            Section {
                Picker("Pool eligibility", selection: Binding(
                    get: { employee.eligibility },
                    set: { newValue in
                        if newValue == .eligible && employee.eligibility != .eligible {
                            confirmEligible = true
                        } else {
                            employee.eligibility = newValue
                        }
                    }
                )) {
                    ForEach(Eligibility.allCases, id: \.self) { eligibility in
                        Text(eligibility.title).tag(eligibility)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
                .tint(Theme.ink)
            } header: {
                SectionLabel("Pool eligibility", index: showsPoints ? "04" : "03")
            } footer: {
                eligibilityFooter
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .ledgerRows()
        }
        .ledgerList()
        .onAppear {
            pointsText = Points.format(units: employee.pointsUnits)
            if focusName { nameFocused = true }
        }
        .alert("Mark as eligible?", isPresented: $confirmEligible) {
            Button("Mark Eligible") { employee.eligibility = .eligible }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("ShiftTips can't determine legal status. Only mark \(employee.name.isEmpty ? "this person" : employee.name) eligible if your workplace policy and the tip pooling rules where you work allow it.")
        }
    }

    private func setRole(_ role: String) {
        employee.role = role
        guard !pointsEdited, let key = TipOutRule.roleKey(role),
              let units = rolePoints.first(where: { TipOutRule.roleKey($0.role) == key })?.pointsUnits else { return }
        employee.pointsUnits = units
        pointsText = Points.format(units: units)
    }

    @ViewBuilder
    private var eligibilityFooter: some View {
        switch employee.eligibility {
        case .managerSupervisorOwner:
            VStack(alignment: .leading, spacing: 6) {
                Text(PolicyCopy.managersNote)
                Link("Read DOL Fact Sheet #15B", destination: PolicyCopy.factSheet15B)
            }
        case .notEligible:
            Text("Left out of every split until this changes. \(PolicyCopy.disclaimer)")
        case .eligible:
            Text(PolicyCopy.disclaimer)
        }
    }

    private var pointsError: String? {
        switch Points.parse(pointsText) {
        case .success(0): return "Points must be more than 0. The saved value hasn't changed."
        case .success: return nil
        case .failure(let error): return error.message + " The saved value hasn't changed."
        }
    }
}
