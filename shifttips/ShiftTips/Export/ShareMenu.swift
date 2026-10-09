import SwiftUI
import UIKit
import ShiftTipsCore

/// Share a split as text, a PDF report, or (once saved) a CSV row set.
/// Everything is generated on the device.
struct ShareMenu: View {
    let outcome: ShiftOutcome
    /// The saved shift, when there is one. CSV needs its saved time.
    let shift: FinishedShift?
    @State private var file: SharedFile?
    @State private var problem: String?

    var body: some View {
        Menu {
            ShareLink(item: ShareSummary.text(for: outcome)) {
                Label("Share as Text", systemImage: "text.alignleft")
            }
            Button {
                sharePDF()
            } label: {
                Label("Share PDF Report", systemImage: "doc.richtext")
            }
            if let shift {
                Button {
                    share(Data(CSVExporter.csv(for: [shift]).utf8), named: CSVExporter.fileName(for: [shift]))
                } label: {
                    Label("Export CSV", systemImage: "tablecells")
                }
            }
        } label: {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        .accessibilityIdentifier("shareMenu")
        .sheet(item: $file) { file in
            ActivityView(items: [file.url])
                .presentationDetents([.medium, .large])
                .ignoresSafeArea()
        }
        .alert("Couldn't Export", isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })) {
            Button("OK") { problem = nil }
        } message: {
            Text(problem ?? "")
        }
    }

    private func sharePDF() {
        let data = PDFReportRenderer.render(outcome, savedAt: shift?.finishedAt)
        let draft = outcome.draft
        let name = BackupCodec.safeFileName("ShiftTips \(draft.day.isoString) \(draft.label ?? "")", ext: "pdf")
        share(data, named: name)
    }

    private func share(_ data: Data, named name: String) {
        do {
            file = SharedFile(url: try ExportFiles.write(data, named: name))
        } catch {
            problem = "ShiftTips couldn't create the file. Free up some storage and try again."
        }
    }
}

struct SharedFile: Identifiable {
    let id = UUID()
    let url: URL
}

enum ExportFiles {
    /// Writes into a temporary Exports folder that iOS clears on its own.
    static func write(_ data: Data, named name: String) throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Exports", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent(name)
        try data.write(to: url, options: .atomic)
        return url
    }
}

/// The system share sheet, for files.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
