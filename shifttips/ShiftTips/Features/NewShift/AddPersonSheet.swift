import SwiftUI
import ShiftTipsCore

/// Adds someone to this shift only. They never join a saved crew.
struct AddPersonSheet: View {
    let showsPoints: Bool
    let onAdd: (_ name: String, _ role: String?, _ pointsUnits: Int64) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var role = ""
    @State private var pointsText = "1"
    @FocusState private var nameFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                        .font(.display(.title3, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .focused($nameFocused)
                        .accessibilityIdentifier("oneOffName")
                    TextField("Role (optional)", text: $role)
                        .textInputAutocapitalization(.words)
                        .foregroundStyle(Theme.ink)
                } header: {
                    SectionLabel("This shift only")
                } footer: {
                    LedgerFootnote("Added to this shift only. They won't join your saved crew.")
                }
                .ledgerRows()
                if showsPoints {
                    Section {
                        TextField("Points", text: $pointsText)
                            .keyboardType(.decimalPad)
                            .font(.mono(.body, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        if let error = pointsError {
                            Text(error).foregroundStyle(Theme.warning)
                        }
                    } header: {
                        SectionLabel("Points")
                    } footer: {
                        LedgerFootnote("From your workplace's policy. Everyone starts at 1.")
                    }
                    .ledgerRows()
                }
            }
            .ledgerList()
            .navigationTitle("Add Someone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let trimmedRole = role.trimmingCharacters(in: .whitespacesAndNewlines)
                        onAdd(trimmedName, trimmedRole.isEmpty ? nil : trimmedRole, pointsUnits ?? Limits.defaultPointsUnits)
                        dismiss()
                    }
                    .disabled(trimmedName.isEmpty || (showsPoints && pointsUnits == nil))
                }
            }
            .onAppear { nameFocused = true }
        }
        .presentationDetents([.medium, .large])
    }

    private var trimmedName: String {
        String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Limits.maxNameLength))
    }

    private var pointsUnits: Int64? {
        guard case .success(let units) = Points.parse(pointsText), units >= Limits.minPointsUnits else { return nil }
        return units
    }

    private var pointsError: String? {
        switch Points.parse(pointsText) {
        case .success(0): return "Points must be more than 0."
        case .success: return nil
        case .failure(let error): return error.message
        }
    }
}
