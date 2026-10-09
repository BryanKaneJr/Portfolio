import SwiftUI
import ShiftTipsCore

/// Small caps label above a section.
struct SectionLabel: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(Theme.inkSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A dollar amount in tabular figures, read aloud as words.
struct MoneyText: View {
    let cents: Int64
    var font: Font = .body.weight(.semibold)

    var body: some View {
        Text(Money.format(cents))
            .font(font)
            .monospacedDigit()
            .accessibilityLabel(Money.spoken(cents))
    }
}

/// A note in the flow of a screen. The icon and words carry the meaning;
/// color only reinforces it.
struct Banner: View {
    enum Kind {
        case info, warning, success
    }

    let kind: Kind
    let text: String

    init(_ kind: Kind, _ text: String) {
        self.kind = kind
        self.text = text
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .accessibilityHidden(true)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var icon: String {
        switch kind {
        case .info: "info.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .success: "checkmark.circle.fill"
        }
    }

    private var tint: Color {
        switch kind {
        case .info: Theme.accent
        case .warning: Theme.warning
        case .success: Theme.positive
        }
    }

    private var background: Color {
        switch kind {
        case .info, .success: Theme.accentSoft
        case .warning: Theme.warningSoft
        }
    }
}

/// Shared copy that must read the same everywhere.
enum PolicyCopy {
    static let disclaimer = "ShiftTips calculates allocations from your inputs. Check your workplace policy and applicable tip pooling rules. It does not verify legal eligibility, wages, or payroll compliance."

    static let allocationNote = "This is a calculation of how the pool is allocated. It isn't a record that anyone has been paid, and it isn't a payroll or legal compliance document."

    static let managersNote = "Owners, managers and supervisors are never included in a pool in ShiftTips, and there is no override. US Department of Labor guidance says employers, including managers and supervisors, may not keep employees' tips."

    static let factSheet15 = URL(string: "https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa")!
    static let factSheet15B = URL(string: "https://www.dol.gov/agencies/whd/fact-sheets/15b-managers-supervisors-tips-flsa")!
    static let tipRegulations = URL(string: "https://www.dol.gov/agencies/whd/flsa/tips")!
}

/// Why a person can't be in the pool, with the official guidance.
struct EligibilityInfoSheet: View {
    let name: String
    let eligibility: Eligibility
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch eligibility {
                    case .managerSupervisorOwner:
                        Text("\(name) is marked as an owner, manager or supervisor.")
                            .font(.headline)
                        Text(PolicyCopy.managersNote)
                        Link("Read DOL Fact Sheet #15B", destination: PolicyCopy.factSheet15B)
                    case .notEligible:
                        Text("\(name) is marked not eligible for the pool.")
                            .font(.headline)
                        Text("That comes from your crew settings. ShiftTips leaves them out of every split until their eligibility is changed.")
                    case .eligible:
                        Text("\(name) is eligible for the pool.")
                            .font(.headline)
                    }
                    Text("To change this, edit \(name) in your crew. ShiftTips can't determine anyone's legal status.")
                        .foregroundStyle(Theme.inkSecondary)
                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            .navigationTitle("Not in the Pool")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
