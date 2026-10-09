import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// First launch only: what ShiftTips does, Simple or Advanced, then
/// straight into a crew (and, in Advanced, a tip style).
struct WelcomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var choice: Experience = .simple
    @State private var creatingCrew: CrewEditorItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
                    VStack(alignment: .leading, spacing: 18) {
                        Wordmark(style: .headline)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Close the shift.")
                            Text("Split every cent.")
                                .foregroundStyle(Theme.onHighlight)
                                .highlighted()
                            Text("Share a clear breakdown.")
                        }
                        .font(.display(.largeTitle))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityElement(children: .combine)
                        Text("Exact to the cent, on this iPhone only. No account, no server.")
                            .font(.body)
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .padding(.top, 20)

                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeader("How does your team split tips?", index: "01")
                        ExperienceOption(
                            experience: .simple,
                            detail: "Add who worked and their hours. Tips are shared by hours. Nothing else to set up.",
                            isSelected: choice == .simple
                        ) { choice = .simple }
                        ExperienceOption(
                            experience: .advanced,
                            detail: "Pools by role points, tip-outs to bussers and the bar, cash and card. Pick the style closest to yours, then make every number match.",
                            isSelected: choice == .advanced
                        ) { choice = .advanced }
                        Text("You can switch anytime in Settings.")
                            .font(.footnote)
                            .foregroundStyle(Theme.inkSecondary)
                    }

                    VStack(spacing: 10) {
                        if choice == .simple {
                            Button("Set Up My Crew") {
                                store.setExperience(.simple)
                                creatingCrew = .new
                            }
                            .buttonStyle(PrimaryButtonStyle())
                        } else {
                            NavigationLink {
                                StylePickerView { style in
                                    store.setExperience(.advanced)
                                    creatingCrew = .newWithStyle(style)
                                }
                            } label: {
                                Text("Choose My Style")
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .accessibilityIdentifier("chooseMyStyle")
                        }
                        Button("Try an Example") {
                            store.setExperience(choice)
                            store.loadExample()
                            dismiss()
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        Button("Not Now") {
                            store.setExperience(choice)
                            dismiss()
                        }
                        .buttonStyle(TextButtonStyle())
                    }

                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
            .background { Theme.background.ignoresSafeArea() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .onAppear { choice = store.settings.experience }
        .sheet(item: $creatingCrew, onDismiss: {
            if !store.crews.isEmpty { dismiss() }
        }) { item in
            CrewEditorView(item: item)
        }
    }
}

/// One of the two ways to use ShiftTips: a card with a radio, outlined in
/// ink when chosen.
struct ExperienceOption: View {
    let experience: Experience
    let detail: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: 14) {
                SelectionMark(isOn: isSelected, kind: .radio)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 6) {
                    Text(experience.title)
                        .font(.display(.title3, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous)
                    .strokeBorder(Theme.ink, lineWidth: isSelected ? 2 : 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("experience-\(experience.rawValue)")
    }
}
