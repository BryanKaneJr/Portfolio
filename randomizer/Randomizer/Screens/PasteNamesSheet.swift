import SwiftUI
import RandomizerCore

/// Paste many names, one per line, with a preview before anything is added.
struct PasteNamesSheet: View {
    let listID: UUID
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var editorFocused: Bool

    var body: some View {
        let existing = appState.list(listID)?.entries.count ?? 0
        let parsed = NameRules.parsePaste(text, existingCount: existing)

        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("One name per line. Blank lines are skipped.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)

                ZStack(alignment: .topLeading) {
                    TextEditor(text: $text)
                        .focused($editorFocused)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .accessibilityIdentifier("pasteTextEditor")
                    if text.isEmpty {
                        Text("Pizza\nTacos\nSushi")
                            .foregroundStyle(Theme.textTertiary)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 16)
                            .allowsHitTesting(false)
                    }
                }
                .frame(minHeight: 180)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.stroke))

                PasteButton(payloadType: String.self) { strings in
                    let pasted = strings.joined(separator: "\n")
                    Task { @MainActor in
                        text = text.isEmpty ? pasted : text + "\n" + pasted
                    }
                }
                .labelStyle(.titleAndIcon)
                .buttonBorderShape(.capsule)
                .tint(Theme.accent)

                preview(parsed)
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Paste names")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(parsed.names.isEmpty ? "Add" : "Add \(parsed.names.count)") {
                        appState.update(listID) { $0.addEntries(named: parsed.names) }
                        dismiss()
                    }
                    .disabled(parsed.names.isEmpty)
                    .accessibilityIdentifier("confirmPasteButton")
                }
            }
            .onAppear { editorFocused = true }
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private func preview(_ parsed: PasteParseResult) -> some View {
        if !parsed.names.isEmpty || parsed.overLimit > 0 {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(parsed.names.count) \(parsed.names.count == 1 ? "name" : "names") will be added")
                    .font(Theme.rounded(.headline, weight: .semibold))
                    .accessibilityIdentifier("pastePreviewCount")
                if parsed.overLimit > 0 {
                    Text("\(parsed.overLimit) more won't fit: lists hold up to \(Limits.maxEntries) entries.")
                        .font(.footnote)
                        .foregroundStyle(Theme.caution)
                }
                Text(parsed.names.prefix(8).joined(separator: ", ") + (parsed.names.count > 8 ? ", \u{2026}" : ""))
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(3)
            }
            .card(padding: 14)
        }
    }
}
