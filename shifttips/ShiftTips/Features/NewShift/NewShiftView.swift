import SwiftUI
import ShiftTipsCore
import ShiftTipsData

/// The screen the app opens on: tips, crew, method, people, and a sticky
/// bar that says what's being distributed and what's still missing.
struct NewShiftView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @FocusState private var focus: ShiftForm.Field?
    @State private var showSettings = false
    @State private var editingCrew: CrewEditorItem?
    @State private var addingPerson = false
    @State private var infoRow: ShiftForm.Row?
    @State private var confirmStartOver = false

    var body: some View {
        @Bindable var store = store
        let calculation = store.form.calculation
        let readiness = store.form.readiness(calculation)

        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if store.isFormSaved {
                        savedBanner
                    } else if store.form.isExample {
                        exampleBanner
                    }
                    Group {
                        TipsCard(form: $store.form, focus: $focus)
                        crewSection
                        MethodPicker(method: $store.form.method)
                        peopleSection(calculation)
                    }
                    .disabled(store.isFormSaved)
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: focus) { _, field in
                guard let field else { return }
                withAnimation { proxy.scrollTo(field, anchor: .center) }
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            summaryBar(calculation: calculation, readiness: readiness)
        }
        .navigationTitle("ShiftTips")
        .toolbar { toolbar }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(item: $editingCrew) { item in
            CrewEditorView(item: item)
        }
        .sheet(isPresented: $addingPerson) {
            AddPersonSheet(showsPoints: store.form.method.usesPoints) { name, role, points in
                store.form.addOneOff(name: name, role: role, pointsUnits: points)
            }
        }
        .sheet(item: $infoRow) { row in
            EligibilityInfoSheet(name: row.name, eligibility: row.eligibility)
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

    // MARK: - Sections

    private var header: some View {
        @Bindable var store = store
        return HStack(spacing: 12) {
            DatePicker(
                "Shift date",
                selection: Binding(get: { store.form.day.date() }, set: { store.form.day = CalendarDay($0) }),
                displayedComponents: .date
            )
            .labelsHidden()
            TextField("Label, e.g. Dinner", text: $store.form.label)
                .textInputAutocapitalization(.words)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .frame(minHeight: 40)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .accessibilityLabel("Shift label")
        }
        .disabled(store.isFormSaved)
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
        VStack(alignment: .leading, spacing: 10) {
            Banner(.info, "This is an example with made-up people. Try changing the tips, hours or method. Nothing here is added to your crews.")
            Button("Clear Example") {
                focus = nil
                store.startNewShift()
            }
            .buttonStyle(SecondaryButtonStyle())
        }
    }

    @ViewBuilder
    private var crewSection: some View {
        if store.crews.isEmpty && store.form.rows.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionLabel("CREW")
                Text("Save your crew once and every shift starts with them. Just add tips and hours.")
                    .foregroundStyle(Theme.ink)
                Button("Add Your Crew") { editingCrew = .new }
                    .buttonStyle(PrimaryButtonStyle())
                Button("Try an Example") { store.loadExample() }
                    .buttonStyle(SecondaryButtonStyle())
                    .accessibilityIdentifier("tryExample")
            }
            .card()
        } else {
            HStack(alignment: .center, spacing: 12) {
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
                    VStack(alignment: .leading, spacing: 2) {
                        SectionLabel("CREW")
                        HStack(spacing: 4) {
                            Text(crewTitle)
                                .font(.headline)
                                .foregroundStyle(Theme.ink)
                                .multilineTextAlignment(.leading)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    .frame(minHeight: 44)
                }
                .accessibilityLabel("Crew: \(crewTitle)")
                .accessibilityHint("Choose which saved crew this shift uses")
                Spacer()
                if let crewId = store.form.crewId, let crew = store.crew(id: crewId) {
                    Button("Edit Crew") { editingCrew = .edit(crew) }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
        }
    }

    private var crewTitle: String {
        if let name = store.form.crewName { return name }
        if store.form.isExample { return "Example crew" }
        return store.crews.isEmpty ? "No saved crew" : "Choose a crew"
    }

    private func peopleSection(_ calculation: ShiftCalculation) -> some View {
        @Bindable var store = store
        let allocations = Dictionary(uniqueKeysWithValues: calculation.allocations.map { ($0.participantId, $0) })
        let inPool = store.form.rows.filter(\.isInPool).count
        let tipsEntered = (try? store.form.parsedPool().get()) != nil

        return VStack(alignment: .leading, spacing: 10) {
            if !store.form.rows.isEmpty {
                HStack {
                    SectionLabel("PEOPLE")
                    Spacer()
                    Text(inPool == 1 ? "1 in pool" : "\(inPool) in pool")
                        .font(.footnote)
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
            }
            if !store.form.rows.isEmpty || !store.crews.isEmpty {
                Button {
                    focus = nil
                    addingPerson = true
                } label: {
                    Label("Add someone for this shift", systemImage: "person.badge.plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderless)
            }
        }
    }

    // MARK: - Bottom bar

    private func summaryBar(calculation: ShiftCalculation, readiness: ShiftForm.Readiness) -> some View {
        let pool = calculation.draft.pool.totalCents
        return VStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Distributing")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                Spacer()
                MoneyText(cents: pool, font: .title3.weight(.bold))
                    .accessibilityIdentifier("distributingAmount")
            }
            .accessibilityElement(children: .combine)

            if store.isFormSaved {
                Button("Open Saved Split") { router.path.append(.review) }
                    .buttonStyle(SecondaryButtonStyle())
            } else if readiness.isReady {
                Button("Review Split") {
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
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Menu {
                Button {
                    focus = nil
                    store.loadExample()
                } label: {
                    Label("Try an Example", systemImage: "wand.and.stars")
                }
                Button(role: .destructive) {
                    confirmStartOver = true
                } label: {
                    Label("Start Over", systemImage: "arrow.counterclockwise")
                }
                .disabled(!store.form.hasEnteredValues || store.isFormSaved)
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                focus = nil
                router.path.append(.history)
            } label: {
                Image(systemName: "clock.arrow.circlepath")
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
            }
            .accessibilityLabel("Crew and settings")
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
