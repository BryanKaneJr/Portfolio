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
            Form {
                Section {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                        .focused($nameFocused)
                        .accessibilityIdentifier("oneOffName")
                    TextField("Role (optional)", text: $role)
                        .textInputAutocapitalization(.words)
                } footer: {
                    Text("Added to this shift only. They won't join your saved crew.")
                }
                if showsPoints {
                    Section {
                        TextField("Points", text: $pointsText)
                            .keyboardType(.decimalPad)
                        if let error = pointsError {
                            Text(error).foregroundStyle(Theme.warning)
                        }
                    } header: {
                        Text("Points")
                    } footer: {
                        Text("From your workplace's policy. Everyone starts at 1.")
                    }
                }
            }
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
