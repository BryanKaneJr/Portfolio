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
                VStack(alignment: .leading, spacing: 24) {
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
                    .padding(.top, 24)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("How does your team split tips?")
                            .font(.title3.weight(.bold))
                            .accessibilityAddTraits(.isHeader)
                        ExperienceOption(
                            experience: .simple,
                            icon: "person.2.fill",
                            detail: "Add who worked and their hours. Tips are shared by hours. Nothing else to set up.",
                            isSelected: choice == .simple
                        ) { choice = .simple }
                        ExperienceOption(
                            experience: .advanced,
                            icon: "slider.horizontal.3",
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
                        .frame(minHeight: 44)
                    }

                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .padding(24)
            }
            .background(Theme.background.ignoresSafeArea())
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

/// One of the two ways to use ShiftTips, as a selectable card.
struct ExperienceOption: View {
    let experience: Experience
    let icon: String
    let detail: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(Theme.accent)
                    .frame(width: 32)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(experience.title)
                        .font(.headline)
                        .foregroundStyle(Theme.ink)
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isSelected ? Theme.accent : Theme.inkSecondary)
                    .accessibilityHidden(true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .stroke(isSelected ? Theme.accent : Color.clear, lineWidth: 2)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("experience-\(experience.rawValue)")
    }
}
