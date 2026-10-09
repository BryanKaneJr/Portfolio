import SwiftUI
import ShiftTipsCore

// MARK: - Haptics

private struct HapticsEnabledKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    /// The Haptics setting, set once at the root so components can tick
    /// without reaching for the store.
    var hapticsEnabled: Bool {
        get { self[HapticsEnabledKey.self] }
        set { self[HapticsEnabledKey.self] = newValue }
    }
}

// MARK: - Labels and rules

/// A small monospaced label, optionally numbered: "01  TIPS TO SPLIT".
/// Pass natural-case text; it's set in capitals on screen and read as
/// written by VoiceOver.
struct SectionLabel: View {
    let text: String
    var index: String?

    init(_ text: String, index: String? = nil) {
        self.text = text
        self.index = index
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            if let index {
                Text(index).foregroundStyle(Theme.inkTertiary)
            }
            Text(text.uppercased()).foregroundStyle(Theme.inkSecondary)
        }
        .font(.mono(.caption, weight: .semibold))
        .tracking(1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}

/// A numbered section's head: the label, and anything that acts on the
/// section at the right.
struct SectionHeader<Trailing: View>: View {
    let title: String
    var index: String?
    let trailing: Trailing

    init(_ title: String, index: String? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.index = index
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            SectionLabel(title, index: index)
                .padding(.vertical, 6)
            Spacer(minLength: 8)
            trailing
        }
        .padding(.horizontal, 4)
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(_ title: String, index: String? = nil) {
        self.init(title, index: index) { EmptyView() }
    }
}

/// A rule across the page: a hairline by default.
struct Rule: View {
    var color: Color = Theme.rule
    var weight: CGFloat?
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: weight ?? 1 / displayScale)
            .accessibilityHidden(true)
    }
}

/// The dotted rule printed between parts of a receipt.
struct DashedRule: View {
    var color: Color = Theme.inkTertiary

    var body: some View {
        HorizontalLine()
            .stroke(color, style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
            .frame(height: 1)
            .accessibilityHidden(true)
    }
}

struct HorizontalLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}

// MARK: - Amounts

/// A dollar amount in tabular figures that rolls when it changes, read
/// aloud as words.
struct MoneyText: View {
    let cents: Int64
    var font: Font = .mono(.body, weight: .semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(Money.format(cents))
            .font(font)
            .monospacedDigit()
            .contentTransition(.numericText())
            .animation(reduceMotion ? nil : .snappy(duration: 0.3), value: cents)
            .accessibilityLabel(Money.spoken(cents))
    }
}

extension View {
    /// A yellow mark behind the number that matters. Decoration only: the
    /// number and its label carry the meaning.
    func highlighted() -> some View {
        padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(Theme.highlight, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

// MARK: - The receipt

/// Paper with rounded top corners and a scalloped bottom edge.
struct ReceiptShape: Shape {
    var cornerRadius: CGFloat = Theme.cardCorner
    /// The radius of each scallop.
    var scallop: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let r = min(cornerRadius, rect.width / 2)
        let bottom = rect.maxY - scallop
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + r))
        path.addArc(center: CGPoint(x: rect.minX + r, y: rect.minY + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.minY + r), radius: r, startAngle: .degrees(270), endAngle: .degrees(360), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: bottom))
        // Half circles bulging down, right to left.
        let count = max(1, Int((rect.width / (scallop * 2)).rounded()))
        let width = rect.width / CGFloat(count)
        for scallopIndex in 0..<count {
            let right = rect.maxX - CGFloat(scallopIndex) * width
            path.addArc(center: CGPoint(x: right - width / 2, y: bottom), radius: width / 2, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
        }
        path.closeSubpath()
        return path
    }
}

extension View {
    /// Sets content on a receipt slip.
    func receiptSlip() -> some View {
        padding(.horizontal, 18)
            .padding(.top, 20)
            .padding(.bottom, 30)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: ReceiptShape())
    }
}

/// Stamped on a slip once it's saved.
struct SavedStamp: View {
    let date: Date
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var landed = false

    var body: some View {
        VStack(spacing: 1) {
            Text("SAVED")
                .font(.mono(.footnote, weight: .heavy))
                .tracking(2)
            Text(date.formatted(date: .omitted, time: .shortened))
                .font(.mono(.caption2, weight: .semibold))
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.ink, lineWidth: 2))
        .rotationEffect(.degrees(-5))
        .scaleEffect(landed || reduceMotion ? 1 : 1.7)
        .opacity(landed || reduceMotion ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.6)) { landed = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Saved at \(date.formatted(date: .omitted, time: .shortened))")
    }
}

// MARK: - Notes, tags, checks

/// A note in the flow of a screen. The words carry the meaning; the
/// round chip and the tint only reinforce it.
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
        HStack(alignment: .top, spacing: 12) {
            IconChip(kind: kind)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(fill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var fill: Color {
        switch kind {
        case .info: Theme.surface
        case .warning: Theme.warningSoft
        case .success: Theme.highlightSoft
        }
    }
}

/// The round chip that starts a note: ink for information, warning for a
/// problem, yellow for done.
struct IconChip: View {
    let kind: Banner.Kind
    @ScaledMetric(relativeTo: .subheadline) private var size: CGFloat = 22

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .black))
            .foregroundStyle(foreground)
            .frame(width: size, height: size)
            .background(fill, in: Circle())
            .accessibilityHidden(true)
    }

    private var symbol: String {
        switch kind {
        case .info: "info"
        case .warning: "exclamationmark"
        case .success: "checkmark"
        }
    }

    private var fill: Color {
        switch kind {
        case .info: Theme.ink
        case .warning: Theme.warning
        case .success: Theme.highlight
        }
    }

    private var foreground: Color {
        switch kind {
        case .info: Theme.onInk
        case .warning: Theme.background
        case .success: Theme.onHighlight
        }
    }
}

/// A short status in small capitals, in a pill.
struct Tag: View {
    enum Style {
        case outline, highlight, warning, muted
    }

    let text: String
    var style: Style = .outline

    init(_ text: String, style: Style = .outline) {
        self.text = text
        self.style = style
    }

    var body: some View {
        Text(text.uppercased())
            .font(.mono(.caption2, weight: .bold))
            .tracking(0.6)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(foreground)
            .background(fill, in: Capsule())
            .overlay(Capsule().strokeBorder(style == .outline ? Theme.ink : Color.clear, lineWidth: 1))
            .accessibilityLabel(text)
    }

    private var foreground: Color {
        switch style {
        case .outline: Theme.ink
        case .highlight: Theme.onHighlight
        case .warning: Theme.warning
        case .muted: Theme.inkSecondary
        }
    }

    private var fill: Color {
        switch style {
        case .outline: Color.clear
        case .highlight: Theme.highlight
        case .warning: Theme.warningSoft
        case .muted: Theme.sunken
        }
    }
}

/// A round check (many can be on) or a round radio (one is on).
struct SelectionMark: View {
    enum Kind {
        case check, radio
    }

    let isOn: Bool
    var kind: Kind = .check
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 24

    var body: some View {
        ZStack {
            Circle()
                .fill(isOn && kind == .check ? Theme.ink : Color.clear)
            Circle()
                .strokeBorder(isOn ? Theme.ink : Theme.inkSecondary, lineWidth: 1.5)
            if isOn {
                switch kind {
                case .check:
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.48, weight: .bold))
                        .foregroundStyle(Theme.onInk)
                case .radio:
                    Circle()
                        .fill(Theme.ink)
                        .padding(size * 0.26)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A checkbox toggle: a round check and its label in one 44pt row.
struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(spacing: 12) {
                SelectionMark(isOn: configuration.isOn)
                configuration.label
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(configuration.isOn ? "On" : "Off")
        .accessibilityAddTraits(.isToggle)
    }
}

// MARK: - Inputs

/// Choose one of a few: a soft gray track with the chosen option in an
/// ink pill that slides.
struct SegmentedTabs<Value: Hashable>: View {
    let options: [Value]
    let selection: Value
    let title: (Value) -> String
    var spokenTitle: (Value) -> String
    let identifier: (Value) -> String
    let onSelect: (Value) -> Void
    @Namespace private var namespace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.hapticsEnabled) private var hapticsEnabled

    init(
        _ options: [Value],
        selection: Value,
        title: @escaping (Value) -> String,
        spokenTitle: ((Value) -> String)? = nil,
        identifier: @escaping (Value) -> String,
        onSelect: @escaping (Value) -> Void
    ) {
        self.options = options
        self.selection = selection
        self.title = title
        self.spokenTitle = spokenTitle ?? title
        self.identifier = identifier
        self.onSelect = onSelect
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                let selected = option == selection
                Button {
                    onSelect(option)
                } label: {
                    Text(title(option))
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(selected ? Theme.onInk : Theme.ink)
                        .background {
                            if selected {
                                RoundedRectangle(cornerRadius: Theme.corner - 3, style: .continuous)
                                    .fill(Theme.ink)
                                    .matchedGeometryEffect(id: "selection", in: namespace)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(spokenTitle(option))
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier(identifier(option))
            }
        }
        .padding(3)
        .background(Theme.sunken, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        .animation(reduceMotion ? nil : .snappy(duration: 0.25), value: selection)
        .sensoryFeedback(trigger: selection) { _, _ in
            hapticsEnabled ? .selection : nil
        }
    }
}

/// A text field's box: filled soft gray, outlined in ink when focused and
/// in the warning color when what's typed can't be used.
struct FieldBox: ViewModifier {
    var isFocused = false
    var isError = false

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(Theme.sunken, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(isError ? Theme.warning : (isFocused ? Theme.ink : Color.clear), lineWidth: 1.5)
            }
    }
}

extension View {
    func fieldBox(focused: Bool = false, error: Bool = false) -> some View {
        modifier(FieldBox(isFocused: focused, isError: error))
    }

    /// Lists and forms on the paper: rounded white groups with hairlines
    /// between rows. Pair with `ledgerRows()` on each section.
    func ledgerList() -> some View {
        listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background { Theme.background.ignoresSafeArea() }
    }

    func ledgerRows() -> some View {
        listRowBackground(Theme.surface)
            .listRowSeparatorTint(Theme.rule)
            .listSectionSeparatorTint(Theme.rule)
    }
}

/// A footnote under a ledger section.
struct LedgerFootnote: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(Theme.inkSecondary)
    }
}

/// "SHIFT" and "TIPS" on yellow.
struct Wordmark: View {
    var style: Font.TextStyle = .subheadline

    var body: some View {
        HStack(spacing: 2) {
            Text("SHIFT")
                .foregroundStyle(Theme.ink)
            Text("TIPS")
                .foregroundStyle(Theme.onHighlight)
                .padding(.horizontal, 4)
                .background(Theme.highlight, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
        }
        .font(.display(style, weight: .black))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("ShiftTips")
    }
}

// MARK: - Policy

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
                    Tag(eligibility.title, style: .outline)
                    switch eligibility {
                    case .managerSupervisorOwner:
                        Text("\(name) is marked as an owner, manager or supervisor.")
                            .font(.display(.title3, weight: .bold))
                        Text(PolicyCopy.managersNote)
                        Link("Read DOL Fact Sheet #15B", destination: PolicyCopy.factSheet15B)
                            .buttonStyle(TextButtonStyle())
                    case .notEligible:
                        Text("\(name) is marked not eligible for the pool.")
                            .font(.display(.title3, weight: .bold))
                        Text("That comes from your crew settings. ShiftTips leaves them out of every split until their eligibility is changed.")
                    case .eligible:
                        Text("\(name) is eligible for the pool.")
                            .font(.display(.title3, weight: .bold))
                    }
                    Rule()
                    Text("To change this, edit \(name) in your crew. ShiftTips can't determine anyone's legal status.")
                        .foregroundStyle(Theme.inkSecondary)
                    Text(PolicyCopy.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSecondary)
                }
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            .background { Theme.background.ignoresSafeArea() }
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
