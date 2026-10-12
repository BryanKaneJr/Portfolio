import SwiftUI
import RandomizerCore

/// Sound, haptics, animation speed and how the lottery works.
struct SettingsView: View {
    @AppStorage(PreferenceKey.sound) private var soundOn = true
    @AppStorage(PreferenceKey.haptics) private var hapticsOn = true
    @AppStorage(PreferenceKey.speed) private var speed = AnimationSpeed.standard.rawValue
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Sound effects", isOn: $soundOn)
                        .accessibilityIdentifier("soundToggle")
                    Toggle("Haptics", isOn: $hapticsOn)
                        .accessibilityIdentifier("hapticsToggle")
                    Picker("Reveal speed", selection: $speed) {
                        ForEach(AnimationSpeed.allCases) { speed in
                            Text(speed.title).tag(speed.rawValue)
                        }
                    }
                    .accessibilityIdentifier("speedPicker")
                } header: {
                    Text("Feel")
                } footer: {
                    Text("Sounds follow your ringer switch. With Reduce Motion on in iOS Settings, every reveal is a simple fade.")
                }
                .listRowBackground(Theme.surface)

                Section("Three ways to run it") {
                    ForEach(LotteryType.allCases, id: \.self) { type in
                        infoRow(type.title, type.explanation)
                    }
                }
                .listRowBackground(Theme.surface)

                Section("Fair and on the record") {
                    infoRow(
                        "Fair draw",
                        "Picks are drawn by your iPhone's secure random number generator, using exactly the odds in the odds table. Each drawn team leaves the drum before the next pick."
                    )
                    infoRow(
                        "Drawn before the reveal",
                        "The whole order is drawn and saved the moment you run the lottery. The balls and cards only show it, and skipping or closing the app never changes it."
                    )
                    infoRow(
                        "Every run counts",
                        "Running the lottery again replaces the order and bumps the run number (Run #2), which shows on everything you share."
                    )
                }
                .listRowBackground(Theme.surface)

                Section("Privacy") {
                    infoRow(
                        "Stays on this iPhone",
                        "No account, no ads, no tracking and no internet needed. Your leagues leave the device only when you share a draft order."
                    )
                }
                .listRowBackground(Theme.surface)

                Section {
                    LabeledContent("Version", value: Self.version)
                } header: {
                    Text("About")
                }
                .listRowBackground(Theme.surface)
            }
            .themedList()
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("settingsDoneButton")
                }
            }
        }
    }

    private func infoRow(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(Theme.rounded(.subheadline, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    private static var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }
}
