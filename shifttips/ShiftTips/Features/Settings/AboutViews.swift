import SwiftUI
import ShiftTipsCore

private struct AboutPage<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AboutSection: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            Text(text)
                .foregroundStyle(Theme.ink)
        }
    }
}

struct HowItWorksView: View {
    var body: some View {
        AboutPage(title: "How the Split Works") {
            AboutSection(title: "Three methods", text: "Equal gives everyone in the pool one share. By Hours gives each person a share in proportion to the hours they worked. Hours \u{00D7} Points multiplies each person's hours by the points your policy gives them, then shares in proportion to that.")
            AboutSection(title: "Exact to the cent", text: "Amounts are kept as whole cents and hours as whole minutes, so nothing is lost to rounding errors. Each person first gets their exact share rounded down to the cent. The few cents left over go one at a time to the people whose exact shares were closest to the next cent. If two are exactly tied, the person higher on the crew list goes first.")
            AboutSection(title: "Always reconciled", text: "The amounts always add up to the pool exactly, and every breakdown shows it: Allocated $X of $X, $0.00 remaining. Tap anyone on the review screen to see their working.")
            AboutSection(title: "Cash and card", text: "With separate cash and card amounts, each is split on its own with the same shares, so cash, card and the combined total all reconcile.")
            AboutSection(title: "Hours", text: "Type hours as 7.5, 7:30 or 7h 30m. Decimal hours are read to the nearest minute (7.33 is 7h 20m) and always shown back so you can check them.")
            AboutSection(title: "Saved shifts never change", text: "A saved shift keeps its own copy of everyone's names, hours, points and amounts. Editing your crew later never changes it. To redo a shift, duplicate it as a new one.")
        }
    }
}

struct TipRulesView: View {
    var body: some View {
        AboutPage(title: "Tip Pooling Rules") {
            Text(PolicyCopy.disclaimer)
                .font(.headline)
            AboutSection(title: "Your policy, your rules", text: "Tip pooling is regulated and the rules vary by place. ShiftTips doesn't know who may take part where you work, and a role label never decides it. You choose each person's eligibility and points from your workplace's policy.")
            AboutSection(title: "Owners, managers and supervisors", text: PolicyCopy.managersNote)
            AboutSection(title: "No deductions", text: "ShiftTips never subtracts card fees, withholding or anything else. It splits exactly the amount you enter. Service charges aren't the same as tips; check how your workplace treats them.")
            AboutSection(title: "Allocation, not payment", text: PolicyCopy.allocationNote)
            VStack(alignment: .leading, spacing: 10) {
                Text("US Department of Labor guidance")
                    .font(.headline)
                Link("Fact Sheet #15: Tipped employees", destination: PolicyCopy.factSheet15)
                Link("Fact Sheet #15B: Managers, supervisors and tips", destination: PolicyCopy.factSheet15B)
                Link("Tips under the FLSA", destination: PolicyCopy.tipRegulations)
                Text("State and local rules can be more protective. These links open in your browser.")
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }
}

struct PrivacyView: View {
    var body: some View {
        AboutPage(title: "Privacy") {
            AboutSection(title: "Everything stays on this iPhone", text: "ShiftTips has no account, no server, no analytics and no ads. It makes no network connections. Crews, shifts and settings are stored only on this device, and are included in your iPhone's own backups like any other app data.")
            AboutSection(title: "What it stores", text: "Names, optional role labels, points, hours and the amounts you enter. It never asks for Social Security numbers, bank details, addresses or tax information, so please don't type them into names or labels.")
            AboutSection(title: "Sharing is up to you", text: "Text, PDF, CSV and backup files are made on this iPhone and go only where you send them with the share sheet or Files.")
            AboutSection(title: "Deleting", text: "Delete All Data in Settings removes every crew, shift and setting. Deleting the app does the same.")
        }
    }
}
