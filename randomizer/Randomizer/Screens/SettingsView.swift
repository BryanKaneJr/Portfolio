import SwiftUI
import RandomizerCore

/// Sound, haptics, animation speed and how draws work. The removal toggle
/// is deliberately not here: it lives on every draw screen.
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
                    Picker("Animation speed", selection: $speed) {
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

                Section("How draws work") {
                    infoRow(
                        "One fair engine",
                        "Every reveal style shows a result picked by the same engine, using your iPhone's secure random number generator and the odds you can see."
                    )
                    infoRow(
                        "Picked before the show",
                        "The winner is chosen and saved before any animation plays. Skipping, closing the app or switching styles never changes it."
                    )
                    infoRow(
                        "Remove",
                        "On: winners leave the pool for this session. Off: winners stay in and can repeat. It's the switch at the bottom right of the draw screen, saved per list."
                    )
                    infoRow(
                        "Weights are relative",
                        "A chance is an entry's weight divided by the total weight of everyone still eligible, so chances rise as others are removed."
                    )
                }
                .listRowBackground(Theme.surface)

                Section("Privacy") {
                    infoRow(
                        "Stays on this iPhone",
                        "No account, no ads, no tracking and no internet needed. Your lists leave the device only when you share them."
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
