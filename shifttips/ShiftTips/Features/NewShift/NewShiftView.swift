import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// The screen the app opens on: the shift's date as the headline, then
/// numbered sections (tips, crew, method, people) and a dock that says
/// what's being distributed and what's still missing.
struct NewShiftView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @FocusState private var focus: ShiftForm.Field?
    @State private var showSettings = false
    @State private var editingCrew: CrewEditorItem?
    @State private var addingPerson = false
    @State private var infoRow: ShiftForm.Row?
    @State private var confirmStartOver = false
    @State private var editingRules = false
    @State private var pickingDate = false

    var body: some View {
        @Bindable var store = store
        let live = store.form.live
        let readiness = store.form.readiness(live)
        // With no saved crew and nothing entered, the first step leads the
        // screen and the crew section steps aside.
        let firstRun = store.crews.isEmpty && store.form.rows.isEmpty
        let crewOffset = firstRun ? 0 : 1

        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        if store.isFormSaved {
                            savedBanner
                        } else if store.form.isExample {
                            exampleBanner
                        } else if firstRun {
                            startHere
                        }
                        if !store.isSimple {
                            ModePicker(mode: store.form.mode) { mode in
                                focus = nil
                                withAnimation(.snappy) { store.setMode(mode) }
                            }
                            .disabled(store.isFormSaved)
                        }
                    }
                    Group {
                        switch live {
                        case .pool(let calculation):
                            TipsCard(form: $store.form, focus: $focus, allowsCashAndCard: !store.isSimple, number: number(1))
                            if !firstRun {
                                crewSection(number: number(2))
                            }
                            if !store.isSimple {
                                MethodPicker(method: $store.form.method, number: number(2 + crewOffset))
                            }
                            peopleSection(calculation, number: number((store.isSimple ? 2 : 3) + crewOffset))
                        case .tipOut(let calculation):
                            if !firstRun {
                                crewSection(number: number(1))
                            }
                            TipOutRulesCard(
                                rules: store.form.tipOutRules,
                                statuses: store.form.tipOutPlan.ruleStatuses,
                                crewName: store.form.crewName,
                                sectionNumber: number(1 + crewOffset),
                                onEdit: {
                                    focus = nil
                                    editingRules = true
                                }
                            )
                            tipOutPeopleSection(calculation, number: number(2 + crewOffset))
                        }
                    }
                    .disabled(store.isFormSaved)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 28)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: focus) { _, field in
                guard let field else { return }
                withAnimation { proxy.scrollTo(field, anchor: .center) }
            }
        }
        .background { Theme.background.ignoresSafeArea() }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            summaryBar(live: live, readiness: readiness)
        }
        .navigationTitle("ShiftTips")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(item: $editingCrew) { item in
            CrewEditorView(item: item)
        }
        .sheet(isPresented: $addingPerson) {
            AddPersonSheet(showsPoints: store.form.mode == .pool && store.form.method.usesPoints) { name, role, points in
                _ = store.form.addOneOff(name: name, role: role, pointsUnits: points)
            }
        }
        .sheet(item: $infoRow) { row in
            EligibilityInfoSheet(name: row.name, eligibility: row.eligibility)
        }
        .sheet(isPresented: $editingRules) {
            TipOutRulesSheet(rules: store.form.tipOutRules, roles: knownRoles)
        }
        .sheet(isPresented: $pickingDate) {
            ShiftDateSheet(day: $store.form.day)
        }
        .confirmationDialog("Start over?", isPresented: $confirmStartOver, titleVisibility: .visible) {
            Button("Clear This Shift", role: .destructive) {
                focus = nil
                store.startNewShift()
            }
        } message: {
            Text("The tips and hours you've entered for this shift will be cleared.")
        }
    }

    // MARK: - Header

    /// The date, big, as the screen's headline, and the shift's label.
    private var header: some View {
        @Bindable var store = store
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                SectionLabel("Shift")
                if store.form.day == store.today {
                    Tag("Today", style: .muted)
                }
            }
            Button {
                focus = nil
                pickingDate = true
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(dayTitle)
                        .font(.display(.largeTitle))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Image(systemName: "chevron.down")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(Theme.inkSecondary)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Shift date, \(store.form.day.longText)")
            .accessibilityHint("Changes the date")
            .accessibilityIdentifier("shiftDate")

            TextField("Add a label, like Dinner", text: $store.form.label)
                .textInputAutocapitalization(.words)
                .font(.body)
                .foregroundStyle(Theme.ink)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) { Rule(color: Theme.inkTertiary) }
                .accessibilityLabel("Shift label")
        }
        .disabled(store.isFormSaved)
    }

    private var dayTitle: String {
        store.form.day.date().formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private var savedBanner: some View {
        VStack(alignment: .leading, spacing: 12) {
            Banner(.success, "This shift is saved to History. Start the next one when you're ready.")
            Button("Start Next Shift") {
                store.startNewShift()
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    private var exampleBanner: some View {
        VStack(alignment: .leading, spacing: 12) {
            Banner(.info, store.form.mode == .pool
                ? "This is an example with made-up people. Try changing the tips, hours or method. Nothing here is added to your crews."
                : "This is an example with made-up people and rules. Try changing the amounts, hours or rules. Nothing here is added to your crews.")
            Button("Clear Example") {
                focus = nil
                store.startNewShift()
            }
            .buttonStyle(SecondaryButtonStyle())
        }
    }

    // MARK: - Sections

    /// First run: save a crew, or try the example. Boxed in ink, because
    /// it's the one thing to do before anything else on this screen works.
    private var startHere: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Start here")
            Text("Save your crew once and every shift starts with them. Then it's just tips and hours.")
                .font(.title3)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button("Add Your Crew") { editingCrew = .new }
                .buttonStyle(PrimaryButtonStyle())
            Button("Try an Example") {
                focus = nil
                store.loadExample()
            }
            .buttonStyle(SecondaryButtonStyle())
            .accessibilityIdentifier("tryExample")
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.corner))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.corner)
                .strokeBorder(Theme.ink, lineWidth: 1.5)
        }
    }

    /// "01", "02"...
    private func number(_ value: Int) -> String {
        value < 10 ? "0\(value)" : "\(value)"
    }

    private func crewSection(number: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader("Crew", index: number) {
                if let crewId = store.form.crewId, let crew = store.crew(id: crewId) {
                    Button("Edit Crew") { editingCrew = .edit(crew) }
                        .buttonStyle(TextButtonStyle())
                }
            }
            Menu {
                ForEach(store.crews) { crew in
                    Button {
                        store.selectCrew(id: crew.id)
                    } label: {
                        if crew.id == store.form.crewId {
                            Label(crew.name, systemImage: "checkmark")
                        } else {
                            Text(crew.name)
                        }
                    }
                }
                Divider()
                Button {
                    editingCrew = .new
                } label: {
                    Label("New Crew", systemImage: "plus")
                }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(crewTitle)
                        .font(.display(.title2, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Image(systemName: "chevron.down")
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(Theme.inkSecondary)
                }
                .frame(minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
            }
            .accessibilityLabel("Crew: \(crewTitle)")
            .accessibilityHint("Choose which saved crew this shift uses")
            if !store.isSimple, let crewId = store.form.crewId, let crew = store.crew(id: crewId) {
                Text("Starts as \(crew.setupTitle)")
                    .font(.mono(.caption))
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }

    private var crewTitle: String {
        if let name = store.form.crewName { return name }
        if store.form.isExample { return "Example crew" }
        return store.crews.isEmpty ? "No saved crew" : "Choose a crew"
    }

    private func peopleSection(_ calculation: ShiftCalculation, number: String) -> some View {
        @Bindable var store = store
        let allocations = Dictionary(uniqueKeysWithValues: calculation.allocations.map { ($0.participantId, $0) })
        let inPool = store.form.rows.filter(\.isInPool).count
        let tipsEntered = (try? store.form.parsedPool().get()) != nil

        return VStack(alignment: .leading, spacing: 0) {
            if !store.form.rows.isEmpty {
                SectionHeader("People", index: number) {
                    Text(inPool == 1 ? "1 in pool" : "\(inPool) in pool")
                        .font(.mono(.caption, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            ForEach($store.form.rows) { $row in
                ParticipantRow(
                    row: $row,
                    allocation: allocations[row.id],
                    method: store.form.method,
                    showAmounts: tipsEntered,
                    focus: $focus,
                    onToggle: { store.form.setIncluded(!row.included, rowId: row.id) },
                    onInfo: { infoRow = row },
                    onRemove: {
                        focus = nil
                        let id = row.id
                        withAnimation { store.form.removeRow(id: id) }
                    }
                )
                Rule()
            }
            if !store.form.rows.isEmpty || !store.crews.isEmpty {
                addSomeoneButton
            }
        }
    }

    private func tipOutPeopleSection(_ calculation: TipOutCalculation, number: String) -> some View {
        @Bindable var store = store
        let people = Dictionary(uniqueKeysWithValues: calculation.result.people.map { ($0.participantId, $0) })
        let plan = store.form.tipOutPlan
        let taking = calculation.result.takingPartCount

        return VStack(alignment: .leading, spacing: 0) {
            if !store.form.rows.isEmpty {
                SectionHeader("People", index: number) {
                    Text(taking == 1 ? "1 in tip-outs" : "\(taking) in tip-outs")
                        .font(.mono(.caption, weight: .semibold))
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
            ForEach($store.form.rows) { $row in
                TipOutParticipantRow(
                    row: $row,
                    person: people[row.id],
                    bases: plan.bases(forRole: row.role),
                    focus: $focus,
                    onToggle: { store.form.setIncluded(!row.included, rowId: row.id) },
                    onInfo: { infoRow = row },
                    onRemove: {
                        focus = nil
                        let id = row.id
                        withAnimation { store.form.removeRow(id: id) }
                    }
                )
                Rule()
            }
            if !store.form.rows.isEmpty || !store.crews.isEmpty {
                addSomeoneButton
            }
        }
    }

    /// An empty slot at the end of the list, drawn dashed.
    private var addSomeoneButton: some View {
        Button {
            focus = nil
            addingPerson = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.subheadline.weight(.heavy))
                    .accessibilityHidden(true)
                Text("Add someone for this shift")
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity, minHeight: 50)
            .overlay {
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(Theme.inkSecondary, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.top, 16)
    }

    /// Roles for the rule editor's menu: the crew's, this shift's, and the
    /// rules' own.
    private var knownRoles: [String] {
        var roles = store.form.knownRoles
        if let crewId = store.form.crewId, let crew = store.crew(id: crewId) {
            for role in crew.roles where !roles.contains(where: { TipOutRule.roleKey($0) == TipOutRule.roleKey(role) }) {
                roles.append(role)
            }
        }
        return roles
    }

    // MARK: - Dock

    private func summaryBar(live: ShiftForm.Live, readiness: ShiftForm.Readiness) -> some View {
        let pool = live.outcome.headlineCents
        return VStack(spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(store.form.mode == .pool ? "Distributing" : "Tipping out")
                Spacer()
                MoneyText(cents: pool, font: .display(.title2))
                    .foregroundStyle(Theme.ink)
                    .accessibilityIdentifier("distributingAmount")
            }
            .accessibilityElement(children: .combine)

            if store.isFormSaved {
                Button("Open Saved Split") { router.path.append(.review) }
                    .buttonStyle(SecondaryButtonStyle())
            } else if readiness.isReady {
                Button(store.form.mode == .pool ? "Review Split" : "Review Tip-Outs") {
                    focus = nil
                    router.path.append(.review)
                }
                .buttonStyle(PrimaryButtonStyle())
                .accessibilityIdentifier("reviewSplit")
            } else if case .blocked(let message) = readiness {
                Button(message) {
                    focus = store.form.nextMissingField(after: nil)
                }
                .buttonStyle(PendingButtonStyle())
                .accessibilityHint("Review Split is available once this is done")
                .accessibilityIdentifier("reviewSplit")
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background { Theme.background.ignoresSafeArea() }
        .overlay(alignment: .top) { Rule(color: Theme.ink, weight: 1) }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Wordmark()
        }
        ToolbarItem(placement: .topBarLeading) {
            Menu {
                Button {
                    focus = nil
                    store.loadExample()
                } label: {
                    Label("Try an Example", systemImage: "play")
                }
                Button(role: .destructive) {
                    confirmStartOver = true
                } label: {
                    Label("Start Over", systemImage: "arrow.counterclockwise")
                }
                .disabled(!store.form.hasEnteredValues || store.isFormSaved)
            } label: {
                Image(systemName: "ellipsis")
                    .fontWeight(.semibold)
            }
            .accessibilityLabel("More")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                focus = nil
                router.path.append(.history)
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .fontWeight(.semibold)
            }
            .accessibilityLabel("History")
            .accessibilityIdentifier("historyButton")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                focus = nil
                showSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .fontWeight(.semibold)
            }
            .accessibilityLabel("Crew and settings")
            .accessibilityIdentifier("settingsButton")
        }
        ToolbarItemGroup(placement: .keyboard) {
            Button("Next") {
                focus = store.form.nextMissingField(after: focus)
            }
            .disabled(store.form.nextMissingField(after: focus) == nil)
            Spacer()
            Button("Done") { focus = nil }
                .fontWeight(.semibold)
        }
    }
}

/// Picks the shift's date on a full calendar.
struct ShiftDateSheet: View {
    @Binding var day: CalendarDay
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(day.longText)
                    .font(.display(.title3, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Rule(color: Theme.ink, weight: 1)
                DatePicker(
                    "Shift date",
                    selection: Binding(get: { day.date() }, set: { day = CalendarDay($0) }),
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .labelsHidden()
                .tint(Theme.ink)
                Spacer(minLength: 0)
            }
            .padding(20)
            .background { Theme.background.ignoresSafeArea() }
            .navigationTitle("Shift Date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
    }
}
