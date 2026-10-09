import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// A saved shift, shown exactly as it was saved. It can be shared,
/// duplicated into a new shift, or deleted, but never edited in place.
struct ShiftDetailView: View {
    let shiftId: UUID
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false
    @State private var confirmReplace = false

    var body: some View {
        if let shift = store.shift(id: shiftId) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let sourceId = shift.duplicatedFrom, let source = store.shift(id: sourceId) {
                        Banner(.info, "Duplicated from the shift on \(source.draft.title).")
                    }
                    OutcomeView(outcome: shift.outcome, savedAt: shift.finishedAt)
                    VStack(spacing: 10) {
                        let canDuplicate = !store.isSimple || shift.isSimpleCompatible
                        Button("Duplicate as New Shift") {
                            if store.form.hasEnteredValues && !store.isFormSaved {
                                confirmReplace = true
                            } else {
                                duplicate(shift)
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(!canDuplicate)
                        if !canDuplicate {
                            Text("This shift used Advanced settings. Switch to Advanced in Settings to duplicate it.")
                                .font(.footnote)
                                .foregroundStyle(Theme.inkSecondary)
                                .multilineTextAlignment(.center)
                        }
                        Button("Delete Shift", role: .destructive) { confirmDelete = true }
                            .buttonStyle(TextButtonStyle(color: Theme.danger))
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background { Theme.background.ignoresSafeArea() }
            .navigationTitle(shift.day.mediumText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareMenu(outcome: shift.outcome, shift: shift)
                }
            }
            .alert("Delete this shift?", isPresented: $confirmDelete) {
                Button("Delete", role: .destructive) {
                    store.deleteShift(id: shift.id)
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("It will be removed from this iPhone. To keep a copy, share the PDF or CSV first.")
            }
            .alert("Replace the shift you're entering?", isPresented: $confirmReplace) {
                Button("Replace", role: .destructive) { duplicate(shift) }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The tips and hours you've typed on the New Shift screen will be replaced by a copy of this shift.")
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Shift deleted")
                Text("This shift is no longer on this iPhone.")
                    .font(.title3)
                    .foregroundStyle(Theme.ink)
                Spacer()
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background { Theme.background.ignoresSafeArea() }
        }
    }

    private func duplicate(_ shift: FinishedShift) {
        store.duplicate(shift)
        router.popToRoot()
    }
}
