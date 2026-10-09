import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// The full split before saving, then the saved snapshot after.
struct ReviewSplitView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var changedSinceLastReview = false
    @State private var confirmZeroPool = false
    @State private var savedCount = 0

    var body: some View {
        let saved = store.shift(id: store.form.id)
        let calculation = store.form.calculation
        let result = saved?.result ?? calculation.result
        let readiness = store.form.readiness(calculation)

        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SplitHeader(result: result, savedAt: saved?.finishedAt)
                if saved == nil {
                    if changedSinceLastReview {
                        Banner(.info, "You changed the inputs since your last review. These amounts are recalculated.")
                    }
                    if case .blocked(let message) = readiness {
                        Banner(.warning, message)
                    }
                }
                if result.draft.pool.totalCents == 0 {
                    Banner(.warning, "The pool is $0.00, so everyone is allocated $0.00.")
                }
                BreakdownList(result: result)
                AllocationNote()
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(saved == nil ? "Review Split" : "Shift Saved")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareMenu(result: result, shift: saved)
            }
        }
        .safeAreaInset(edge: .bottom) {
            bottomBar(saved: saved, readiness: readiness, result: result)
        }
        .onAppear {
            let draft = store.form.draft
            changedSinceLastReview = store.lastReviewedDraft != nil && store.lastReviewedDraft != draft
            store.lastReviewedDraft = draft
        }
        .confirmationDialog("Save a $0.00 shift?", isPresented: $confirmZeroPool, titleVisibility: .visible) {
            Button("Save $0.00 Shift") { save() }
        } message: {
            Text("Everyone in the pool is allocated $0.00.")
        }
        .sensoryFeedback(trigger: savedCount) { _, _ in
            store.settings.hapticsEnabled ? .success : nil
        }
    }

    @ViewBuilder
    private func bottomBar(saved: FinishedShift?, readiness: ShiftForm.Readiness, result: SplitResult) -> some View {
        VStack(spacing: 10) {
            if saved != nil {
                Label("Saved to History", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.positive)
                    .accessibilityIdentifier("savedLabel")
                HStack(spacing: 10) {
                    ShareLink(item: ShareSummary.text(for: result)) {
                        Text("Share Breakdown")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    Button("Start Next Shift") {
                        store.startNewShift()
                        router.popToRoot()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("startNextShift")
                }
            } else {
                HStack(spacing: 10) {
                    Button("Edit") { dismiss() }
                        .buttonStyle(SecondaryButtonStyle())
                        .frame(maxWidth: 120)
                    Button("Save Shift") {
                        if result.draft.pool.totalCents == 0 {
                            confirmZeroPool = true
                        } else {
                            save()
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!readiness.isReady)
                    .accessibilityIdentifier("saveShift")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
    }

    private func save() {
        if case .saved = store.finishShift() {
            savedCount += 1
        }
    }
}
