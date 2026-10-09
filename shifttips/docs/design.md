# ShiftTips design: highlighter on a receipt

ShiftTips settles money at the end of a long shift, usually in a dim back room, often on a phone with a cracked screen. It should feel like a well-made tool for that job: a printed receipt someone has run a highlighter over. Black ink on white paper, the numbers that matter set big and wide, everything else small and exact, and one fluorescent color for the next step and the result.

The look is deliberately not the generic app look of soft rounded cards, pastel tints, gradients, glows and sparkles. If a new screen starts to drift that way, come back here.

## Principles

1. **Ink and paper first.** Most of every screen is black text on the paper color, organized by rules and space, not by boxes.
2. **One highlighter.** The fluorescent green marks the one thing to do next (the primary button) and the result that matters (Reconciled, the total, the wordmark). Use it nowhere else, so it keeps its meaning.
3. **Numbers are the headline.** The pool, the total and each person's share are the biggest type on their screens. Secondary text and labels step well back.
4. **Printed, not decorated.** Section numbers, monospaced labels, dotted rules and a torn receipt edge come from real slips and tickets. No shadows, gradients, glass panels of our own, or rounded pills.
5. **Meaning never rides on color alone.** Every colored state also has words or an icon: "Needs hours", "Reconciled", the warning chip.

## Color

All tokens live in `ShiftTips/DesignSystem/Theme.swift`. Text pairs meet WCAG AA in both modes.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F2F2EF` | `#0C0C0C` | The paper. Every screen. |
| `surface` | `#FFFFFF` | `#181818` | Fields, list rows, the receipt slip. |
| `sunken` | `#E7E7E3` | `#222222` | Pressed states. |
| `ink` | `#0E0E0E` | `#F2F2EF` | Text, rules, borders, the selected segment, the tint. |
| `inkSecondary` | `#5A5A56` | `#A3A3A0` | Labels, details, footnotes. |
| `inkTertiary` | `#8A8A85` | `#737370` | Placeholders, section numbers, field edges. Never the only carrier of information. |
| `onInk` | `#F2F2EF` | `#0C0C0C` | Text on an ink fill. |
| `rule` | `#D3D3CE` | `#2E2E2C` | Hairlines between rows. |
| `highlight` | `#D4FF3A` | `#D4FF3A` | The highlighter. A fill only, always with ink on it. |
| `highlightEdge` | ink | highlight | In light mode the highlighter is about as bright as the paper, so highlighted fills get an ink outline. |
| `warning` | `#9E4300` | `#FFA14A` | Something's missing or doesn't add up. |
| `danger` | `#C12A1B` | `#FF6E5E` | Deleting. |

## Type

All system fonts, so Dynamic Type, every language and the PDF just work.

- **Display** (`Font.display`): SF Pro Expanded, heavy or bold. Screen headlines (the shift's date), big amounts, button labels, titles in the navigation bar (set once in `Chrome.apply()`).
- **Mono** (`Font.mono`): SF Mono. Every figure in a list, every small capitals label (`SectionLabel`), tags and the receipt's fine detail.
- **Text**: SF Pro for names, sentences and footnotes.

Labels are passed in natural case and set in capitals on screen; VoiceOver reads the natural case.

## Components

All in `ShiftTips/DesignSystem/`.

- `SectionHeader`: a 1pt ink rule across the page, then a numbered label ("01  TIPS TO SPLIT") and anything that acts on the section, like "Edit Crew". Screens are a stack of these, `Theme.sectionSpacing` apart.
- `PrimaryButtonStyle`: the highlighter key. Inverts to highlighter on black while pressed. One per screen.
- `SecondaryButtonStyle`: outlined in ink. `PendingButtonStyle`: dashed, for "here's what's still missing"; tapping it goes there. `TextButtonStyle`: underlined words.
- `SegmentedTabs`: an ink-bordered strip; the chosen segment fills with ink and slides.
- `CheckSquare`: square check (many on) or square radio (one on). `CheckboxToggleStyle` uses it.
- `fieldBox()`: white field with a gray edge, ink when focused, warning when what's typed can't be used.
- `Tag`: small capitals in a box, like a stamp: outline, highlight, warning or muted.
- `Banner`: a note with a square chip (ink "i", warning "!", highlighter check).
- `receiptSlip()`: white paper with a torn zigzag bottom, for every breakdown. Inside: `SlipTitle`, `ReconciliationLine`, `SlipColumns`, dotted `DashedRule`s between lines, and `SlipTotal` (double rule, highlighted amount). `SavedStamp` lands on it, rotated, once saved.
- `ledgerList()` and `ledgerRows()`: lists and forms as full-width rows on the paper, never rounded inset cards.
- `MoneyText`: tabular figures that roll to new values (off with Reduce Motion), read aloud as words.
- `Wordmark`: "SHIFT" in ink and "TIPS" highlighted.

## Layout and motion

- 20pt side margins on full screens, 16pt around a slip. Left-aligned throughout.
- Rows sit on the page separated by hairlines. Boxes are for things you type in or pick.
- Corners are 4pt or less.
- Motion is short and physical: segments slide, amounts roll, the saved stamp lands, the primary key inverts when pressed. Everything respects Reduce Motion.
- iOS 26 draws its own glass navigation bars and sheets; we keep the paper and ink underneath and don't add glass of our own.

## The icon and the PDF

- `tools/make_icon.py` draws the icon: a white receipt on ink with its total highlighted.
- The PDF report (`Export/PDFReportRenderer.swift`) follows the same rules in print: the wordmark masthead, a wide heavy title, monospaced figures, hairline rows, the highlighter behind the reconciliation line, a double rule over the totals.
