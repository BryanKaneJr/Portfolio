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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let saved = store.shift(id: store.form.id)
        let live = store.form.live
        let outcome = saved?.outcome ?? live.outcome
        let readiness = store.form.readiness(live)

        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if saved == nil {
                    if changedSinceLastReview {
                        Banner(.info, "You changed the inputs since your last review. These amounts are recalculated.")
                    }
                    if case .blocked(let message) = readiness {
                        Banner(.warning, message)
                    }
                }
                OutcomeView(outcome: outcome, savedAt: saved?.finishedAt)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background { Theme.background.ignoresSafeArea() }
        .navigationTitle(saved == nil ? (outcome.mode == .pool ? "Review Split" : "Review Tip-Outs") : "Shift Saved")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareMenu(outcome: outcome, shift: saved)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar(saved: saved, readiness: readiness, outcome: outcome)
        }
        .onAppear {
            let draft = store.form.draft
            changedSinceLastReview = store.lastReviewedDraft != nil && store.lastReviewedDraft != draft
            store.lastReviewedDraft = draft
        }
        .confirmationDialog("Save a $0.00 shift?", isPresented: $confirmZeroPool, titleVisibility: .visible) {
            Button("Save $0.00 Shift") { save() }
        } message: {
            Text(outcome.mode == .pool ? "Everyone in the pool is allocated $0.00." : "Nothing is tipped out on this shift.")
        }
        .sensoryFeedback(trigger: savedCount) { _, _ in
            store.settings.hapticsEnabled ? .success : nil
        }
    }

    @ViewBuilder
    private func bottomBar(saved: FinishedShift?, readiness: ShiftForm.Readiness, outcome: ShiftOutcome) -> some View {
        // Side by side, or stacked at accessibility text sizes.
        let stacked = dynamicTypeSize.isAccessibilitySize
        let buttons = stacked ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))
        VStack(spacing: 12) {
            if saved != nil {
                HStack(spacing: 10) {
                    IconChip(kind: .success)
                    Text("Saved to History")
                        .font(.display(.subheadline, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("savedLabel")
                buttons {
                    ShareLink(item: ShareSummary.text(for: outcome)) {
                        Text("Share")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(maxWidth: stacked ? .infinity : 130)
                    Button("Start Next Shift") {
                        store.startNewShift()
                        router.popToRoot()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("startNextShift")
                }
            } else {
                buttons {
                    Button("Edit") { dismiss() }
                        .buttonStyle(SecondaryButtonStyle())
                        .frame(maxWidth: stacked ? .infinity : 110)
                    Button("Save Shift") {
                        if outcome.headlineCents == 0 {
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
        .background { Theme.background.ignoresSafeArea() }
        .overlay(alignment: .top) { Rule() }
    }

    private func save() {
        if case .saved = store.finishShift() {
            savedCount += 1
        }
    }
}
