import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// First launch only: what ShiftTips does, then straight into setting up a
/// crew or trying the example.
struct WelcomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var creatingCrew = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(Theme.accent)
                        .accessibilityHidden(true)
                    Text("ShiftTips")
                        .font(.largeTitle.weight(.bold))
                    Text("Close the shift. Split every cent. Share a clear breakdown.")
                        .font(.title3)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .padding(.top, 32)

                VStack(alignment: .leading, spacing: 20) {
                    feature("person.3.fill", "Save your crew once", "Every shift starts with your team. Add the tips and hours, and you're done.")
                    feature("divide.circle.fill", "Your method", "Equal, by hours, or hours \u{00D7} points: whichever your workplace already uses.")
                    feature("checkmark.seal.fill", "Every cent accounted for", "Amounts always add up to the pool exactly, with the working for each person.")
                    feature("lock.fill", "Private and offline", "No account, no internet. Everything stays on this iPhone.")
                }

                VStack(spacing: 10) {
                    Button("Set Up My Crew") { creatingCrew = true }
                        .buttonStyle(PrimaryButtonStyle())
                    Button("Try an Example") {
                        store.loadExample()
                        dismiss()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    Button("Not Now") { dismiss() }
                        .frame(minHeight: 44)
                }

                Text(PolicyCopy.disclaimer)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .padding(24)
        }
        .background(Theme.background.ignoresSafeArea())
        .sheet(isPresented: $creatingCrew, onDismiss: {
            if !store.crews.isEmpty { dismiss() }
        }) {
            CrewEditorView(item: .new)
        }
    }

    private func feature(_ icon: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
