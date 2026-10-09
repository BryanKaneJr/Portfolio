import SwiftUI
import UniformTypeIdentifiers
import ShiftTipsCore
import ShiftTipsData

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var editingCrew: CrewEditorItem?
    @State private var backupFile: BackupFile?
    @State private var exportingBackup = false
    @State private var importing = false
    @State private var pendingImport: Data?
    @State private var notice: Notice?
    @State private var confirmDeleteAll = false
    @State private var csvFile: SharedFile?

    struct Notice: Identifiable {
        let id = UUID()
        let title: String
        let message: String
    }

    var body: some View {
        NavigationStack {
            Form {
                crewsSection
                splittingSection
                appearanceSection
                dataSection
                aboutSection
            }
            .navigationTitle("Crew & Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $editingCrew) { item in
                CrewEditorView(item: item)
            }
            .sheet(item: $csvFile) { file in
                ActivityView(items: [file.url])
                    .presentationDetents([.medium, .large])
                    .ignoresSafeArea()
            }
            .fileExporter(
                isPresented: $exportingBackup,
                document: backupFile,
                contentType: .json,
                defaultFilename: BackupCodec.fileName(exportedOn: store.today).replacingOccurrences(of: ".json", with: "")
            ) { result in
                if case .failure = result {
                    notice = Notice(title: "Backup Not Saved", message: "The backup couldn't be saved to Files. Try again, or pick another folder.")
                }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                readBackup(result)
            }
            .confirmationDialog(
                "Import this backup?",
                isPresented: Binding(get: { pendingImport != nil }, set: { if !$0 { pendingImport = nil } }),
                titleVisibility: .visible
            ) {
                Button("Add to My Data") { importBackup(.merge) }
                Button("Replace All My Data", role: .destructive) { importBackup(.replace) }
                Button("Cancel", role: .cancel) { pendingImport = nil }
            } message: {
                Text("Adding keeps everything on this iPhone and adds what's new. Replacing removes your current crews, saved shifts and settings first.")
            }
            .alert(item: $notice) { notice in
                Alert(title: Text(notice.title), message: Text(notice.message), dismissButton: .default(Text("OK")))
            }
            .alert("Delete all data?", isPresented: $confirmDeleteAll) {
                Button("Delete Everything", role: .destructive) {
                    store.deleteAllData()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Every crew, saved shift and setting will be removed from this iPhone. This can't be undone. Back up to Files first if you might need them.")
            }
        }
    }

    // MARK: - Sections

    private var crewsSection: some View {
        Section {
            ForEach(store.crews) { crew in
                HStack(spacing: 12) {
                    Button {
                        store.selectCrew(id: crew.id)
                    } label: {
                        Image(systemName: crew.id == store.settings.activeCrewId ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(crew.id == store.settings.activeCrewId ? Theme.accent : Theme.inkSecondary)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Use \(crew.name) for new shifts")
                    .accessibilityAddTraits(crew.id == store.settings.activeCrewId ? .isSelected : [])

                    Button {
                        editingCrew = .edit(crew)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(crew.name).foregroundStyle(Theme.ink)
                                Text(crew.employees.count == 1 ? "1 person" : "\(crew.employees.count) people")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Edit \(crew.name)")
                }
            }
            Button {
                editingCrew = .new
            } label: {
                Label("Add Crew", systemImage: "plus")
            }
        } header: {
            Text("Crews")
        } footer: {
            Text(store.crews.isEmpty ? "Save the people you work with so each shift starts with them." : "New shifts start with the checked crew.")
        }
    }

    private var splittingSection: some View {
        Section {
            Picker("Default method", selection: Binding(
                get: { store.settings.defaultMethod },
                set: { method in store.updateSettings { $0.defaultMethod = method } }
            )) {
                ForEach(SplitMethod.allCases, id: \.self) { method in
                    Text(method.title).tag(method)
                }
            }
            LabeledContent("Currency", value: "US dollars (USD)")
        } header: {
            Text("Splitting")
        } footer: {
            Text("ShiftTips 1.0 works in US dollars only, to the cent. The method you last used carries over to your next shift.")
        }
    }

    private var appearanceSection: some View {
        Section("Appearance") {
            Picker("Theme", selection: Binding(
                get: { store.settings.appearance },
                set: { appearance in store.updateSettings { $0.appearance = appearance } }
            )) {
                ForEach(Appearance.allCases, id: \.self) { appearance in
                    Text(appearance.title).tag(appearance)
                }
            }
            Toggle("Haptics", isOn: Binding(
                get: { store.settings.hapticsEnabled },
                set: { enabled in store.updateSettings { $0.hapticsEnabled = enabled } }
            ))
        }
    }

    private var dataSection: some View {
        Section {
            Button {
                do {
                    backupFile = BackupFile(data: try store.backupData(appVersion: AppInfo.version))
                    exportingBackup = true
                } catch {
                    notice = Notice(title: "Backup Not Made", message: "ShiftTips couldn't prepare the backup. Try again.")
                }
            } label: {
                Label("Back Up to Files", systemImage: "externaldrive")
            }
            Button {
                importing = true
            } label: {
                Label("Import a Backup", systemImage: "square.and.arrow.down")
            }
            Button {
                exportCSV()
            } label: {
                Label("Export All Shifts as CSV", systemImage: "tablecells")
            }
            .disabled(store.library.shifts.isEmpty)
            Button(role: .destructive) {
                confirmDeleteAll = true
            } label: {
                Label("Delete All Data", systemImage: "trash")
            }
        } header: {
            Text("Your data")
        } footer: {
            Text("Everything stays on this iPhone. ShiftTips has no account and no server, and never sends your data anywhere. Back up to Files to keep a copy.")
        }
    }

    private var aboutSection: some View {
        Section("About") {
            NavigationLink("How the Split Works") { HowItWorksView() }
            NavigationLink("Tip Pooling Rules") { TipRulesView() }
            NavigationLink("Privacy") { PrivacyView() }
            if let email = AppInfo.supportEmail, let url = URL(string: "mailto:\(email)") {
                Link("Contact Support", destination: url)
            }
            LabeledContent("Version", value: AppInfo.version)
        }
    }

    // MARK: - Actions

    private func readBackup(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else { return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            // Check it fully before asking how to import it.
            _ = try BackupCodec.decode(data)
            pendingImport = data
        } catch let error as BackupError {
            notice = Notice(title: "Not Imported", message: error.message)
        } catch {
            notice = Notice(title: "Not Imported", message: "ShiftTips couldn't open that file.")
        }
    }

    private func importBackup(_ mode: ImportMode) {
        guard let data = pendingImport else { return }
        pendingImport = nil
        do {
            let summary = try store.importBackup(data, mode: mode)
            notice = Notice(title: "Backup Imported", message: summary.message)
        } catch let error as BackupError {
            notice = Notice(title: "Not Imported", message: error.message)
        } catch {
            notice = Notice(title: "Not Imported", message: "ShiftTips couldn't import that file.")
        }
    }

    private func exportCSV() {
        let shifts = store.shiftsNewestFirst
        do {
            csvFile = SharedFile(url: try ExportFiles.write(Data(CSVExporter.csv(for: shifts).utf8), named: CSVExporter.fileName(for: shifts)))
        } catch {
            notice = Notice(title: "Couldn't Export", message: "ShiftTips couldn't create the file. Free up some storage and try again.")
        }
    }
}

/// The backup, as a document the Files exporter can save.
struct BackupFile: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }

    var data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
