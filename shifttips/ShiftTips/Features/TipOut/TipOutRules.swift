import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// The house's tip-out rules on New Shift, with a note on any rule that
/// isn't used this shift.
struct TipOutRulesCard: View {
    let rules: [TipOutRule]
    let statuses: [TipOutRuleOutcome.Status]
    let crewName: String?
    var sectionNumber: String?
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Tip-out rules", index: sectionNumber) {
                if !rules.isEmpty {
                    Button("Edit Rules", action: onEdit)
                        .buttonStyle(TextButtonStyle())
                        .accessibilityIdentifier("editTipOutRules")
                }
            }
            if rules.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Add your house rules, like \u{201C}Server \u{2192} Busser: 2% of sales.\u{201D}" + (crewName.map { " They're saved with \($0)." } ?? ""))
                        .foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Add Tip-Out Rules", action: onEdit)
                        .buttonStyle(PrimaryButtonStyle())
                        .accessibilityIdentifier("addTipOutRules")
                }
                .card()
            } else {
                VStack(spacing: 0) {
                    ForEach(rules.indices, id: \.self) { position in
                        let rule = rules[position]
                        VStack(alignment: .leading, spacing: 3) {
                            RuleLine(rule: rule)
                            if position < statuses.count, let note = Explainer.skippedNote(for: rule, status: statuses[position]) {
                                Text(note)
                                    .font(.caption)
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                        }
                        .padding(.vertical, 12)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(rule.spokenSummary)
                        if position < rules.count - 1 {
                            Rule()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
            }
        }
    }
}

/// "Server → Busser" with "2% of sales" set like a price.
struct RuleLine: View {
    let rule: TipOutRule

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(rule.fromRole.trimmingCharacters(in: .whitespaces)) \u{2192} \(rule.toRole.trimmingCharacters(in: .whitespaces))")
                .font(.body.weight(.semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 8)
            Text("\(Percent.format(basisPoints: rule.rateBasisPoints)) of \(rule.basis.phrase)")
                .font(.mono(.subheadline, weight: .medium))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.trailing)
        }
    }
}

/// Edits the rules as a sheet over New Shift. Done saves them to the shift
/// and to its crew.
struct TipOutRulesSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var rules: [TipOutRule]
    let roles: [String]

    init(rules: [TipOutRule], roles: [String]) {
        _rules = State(initialValue: rules)
        self.roles = roles
    }

    var body: some View {
        NavigationStack {
            TipOutRulesEditor(rules: $rules, roles: roles, savedWith: store.form.crewName)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            store.setTipOutRules(rules)
                            dismiss()
                        }
                        .accessibilityIdentifier("saveTipOutRules")
                    }
                }
        }
    }
}

/// The list of rules: add, edit, reorder, delete.
struct TipOutRulesEditor: View {
    @Binding var rules: [TipOutRule]
    let roles: [String]
    var savedWith: String?
    @State private var editing: RuleEditorItem?

    enum RuleEditorItem: Identifiable {
        case new
        case edit(TipOutRule)

        var id: String {
            switch self {
            case .new: "new"
            case .edit(let rule): rule.id.uuidString
            }
        }
    }

    var body: some View {
        List {
            Section {
                ForEach(rules) { rule in
                    Button {
                        editing = .edit(rule)
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            RuleLine(rule: rule)
                            if let problem = rule.problem {
                                Text(problem.message)
                                    .font(.footnote)
                                    .foregroundStyle(Theme.warning)
                            }
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(rule.spokenSummary)
                    .accessibilityHint("Edit this rule")
                }
                .onDelete { rules.remove(atOffsets: $0) }
                .onMove { rules.move(fromOffsets: $0, toOffset: $1) }

                Button {
                    editing = .new
                } label: {
                    Label("Add Rule", systemImage: "plus")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                }
                .accessibilityIdentifier("addTipOutRule")
            } header: {
                HStack {
                    SectionLabel("Rules")
                    Spacer()
                    if rules.count > 1 {
                        EditButton()
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.ink)
                    }
                }
            } footer: {
                LedgerFootnote("A rule takes a percentage of what each person in the paying role collected themselves: their own tips or sales, never tip-outs they received. Everything paid to a role is shared among its people by hours worked. Nobody tips out more than the tips they collected." + (savedWith.map { " Rules are saved with \($0)." } ?? ""))
            }
            .ledgerRows()

            Section {
                Text(PolicyCopy.disclaimer)
                    .font(.footnote)
                    .foregroundStyle(Theme.inkSecondary)
            }
            .ledgerRows()
        }
        .ledgerList()
        .navigationTitle("Tip-Out Rules")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { item in
            switch item {
            case .new:
                TipOutRuleEditor(rule: nil, roles: roles) { rules.append($0) }
            case .edit(let rule):
                TipOutRuleEditor(rule: rule, roles: roles) { updated in
                    if let index = rules.firstIndex(where: { $0.id == updated.id }) { rules[index] = updated }
                }
            }
        }
    }
}

/// One rule: who pays, who receives, how much of what.
struct TipOutRuleEditor: View {
    let original: TipOutRule?
    let roles: [String]
    let onSave: (TipOutRule) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var fromRole: String
    @State private var toRole: String
    @State private var basis: TipOutBasis
    @State private var percentText: String

    init(rule: TipOutRule?, roles: [String], onSave: @escaping (TipOutRule) -> Void) {
        original = rule
        self.roles = roles
        self.onSave = onSave
        _fromRole = State(initialValue: rule?.fromRole ?? "")
        _toRole = State(initialValue: rule?.toRole ?? "")
        _basis = State(initialValue: rule?.basis ?? .tips)
        _percentText = State(initialValue: rule.map { Percent.format(basisPoints: $0.rateBasisPoints).replacingOccurrences(of: "%", with: "") } ?? "")
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    RoleField(placeholder: "e.g. Server", text: $fromRole, roles: roles)
                        .accessibilityIdentifier("ruleFromRole")
                } header: {
                    SectionLabel("Who pays", index: "01")
                }
                .ledgerRows()
                Section {
                    RoleField(placeholder: "e.g. Busser", text: $toRole, roles: roles)
                        .accessibilityIdentifier("ruleToRole")
                } header: {
                    SectionLabel("Who receives", index: "02")
                }
                .ledgerRows()
                Section {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        TextField("2", text: $percentText)
                            .keyboardType(.decimalPad)
                            .font(.display(.title))
                            .monospacedDigit()
                            .foregroundStyle(Theme.ink)
                            .accessibilityLabel("Percentage")
                            .accessibilityIdentifier("rulePercent")
                        Text("%")
                            .font(.display(.title))
                            .foregroundStyle(Theme.inkSecondary)
                            .accessibilityHidden(true)
                    }
                    Picker("Of their", selection: $basis) {
                        ForEach(TipOutBasis.allCases, id: \.self) { basis in
                            Text(basis.phrase).tag(basis)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(Theme.ink)
                } header: {
                    SectionLabel("How much", index: "03")
                } footer: {
                    LedgerFootnote(preview)
                }
                .ledgerRows()
                if let problem {
                    Section {
                        Label(problem, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.warning)
                    }
                    .ledgerRows()
                }
            }
            .ledgerList()
            .navigationTitle(original == nil ? "New Rule" : "Edit Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let rule = draftRule, rule.isValid {
                            onSave(rule)
                            dismiss()
                        }
                    }
                    .disabled(draftRule?.isValid != true)
                    .accessibilityIdentifier("saveRule")
                }
            }
        }
    }

    private var draftRule: TipOutRule? {
        guard case .success(let points) = Percent.parse(percentText) else { return nil }
        return TipOutRule(
            id: original?.id ?? UUID(),
            fromRole: fromRole.trimmingCharacters(in: .whitespacesAndNewlines),
            toRole: toRole.trimmingCharacters(in: .whitespacesAndNewlines),
            basis: basis,
            rateBasisPoints: points
        )
    }

    private var problem: String? {
        let blank = fromRole.trimmingCharacters(in: .whitespaces).isEmpty
            || toRole.trimmingCharacters(in: .whitespaces).isEmpty
            || percentText.trimmingCharacters(in: .whitespaces).isEmpty
        if blank { return nil }
        if case .failure(let error) = Percent.parse(percentText) { return error.message }
        return draftRule?.problem?.message
    }

    private var preview: String {
        guard let rule = draftRule, rule.isValid else {
            return "For example: each Server pays 2% of their own sales to the Bussers."
        }
        return "Each \(rule.fromRole) pays \(Percent.format(basisPoints: rule.rateBasisPoints)) of their own \(rule.basis.phrase). Everything paid to \(rule.toRole) is shared among the \(rule.toRole) staff by hours worked."
    }
}

/// A role name, typed or picked from the roles already in use.
struct RoleField: View {
    let placeholder: String
    @Binding var text: String
    let roles: [String]

    var body: some View {
        HStack {
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.words)
            if !roles.isEmpty {
                Menu {
                    ForEach(roles, id: \.self) { role in
                        Button(role) { text = role }
                    }
                } label: {
                    Image(systemName: "chevron.up.chevron.down")
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Choose a role")
            }
        }
    }
}

extension TipOutRule {
    /// For VoiceOver, without the arrow.
    var spokenSummary: String {
        "\(fromRole) pays \(toRole) \(Percent.format(basisPoints: rateBasisPoints)) of \(basis.phrase)"
    }
}

extension ShiftForm {
    /// Every role in use on this shift or in its rules, each once, for the
    /// rule editor's role menu.
    var knownRoles: [String] {
        var seen = Set<String>()
        var roles: [String] = []
        let candidates = rows.compactMap(\.role) + tipOutRules.flatMap { [$0.fromRole, $0.toRole] }
        for role in candidates {
            guard let key = TipOutRule.roleKey(role), !seen.contains(key) else { continue }
            seen.insert(key)
            roles.append(role.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return roles
    }
}
