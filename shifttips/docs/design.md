# ShiftTips design: a receipt, softened

ShiftTips settles money at the end of a long shift, usually in a dim back room. It should feel calm, sure and friendly, like a well-made receipt in a soft folder: warm paper, rounded white cards, big rounded numbers, monospaced figures like a printed slip, and one plain yellow for the next step and the result.

This is a mix of the app's first look (rounded cards, the dark tips card, a rounded number face) and a printed-receipt look (small-caps labels, monospaced figures, the receipt slip and its stamp). It deliberately avoids the generic app look of gradients, glows, sparkles and pastel everything, and it avoids sharp, pointy shapes.

## Principles

1. **Soft shapes, clear structure.** Rounded corners everywhere (continuous curves), round checks, pill tabs and tags. Structure comes from small-caps section labels and hairlines inside cards, not from heavy outlines. Sections aren't numbered.
2. **One yellow.** Yellow marks the one thing to do next (the primary button) and the result that matters (Reconciled, the total, the wordmark, the focus ring on the tips card). Use it nowhere else, so it keeps its meaning.
3. **Numbers are the headline.** The pool, the total and each person's share are the biggest type on their screens, in SF Pro Rounded. Labels and details step well back, in small monospaced capitals.
4. **The receipt is the reward.** Every result prints on a receipt slip with a scalloped bottom edge, dotted rules, a double-ruled TOTAL and, once saved, a SAVED stamp.
5. **Meaning never rides on color alone.** Every colored state also has words or an icon: "Needs hours", "Reconciled", the warning chip.

## Color

All tokens live in `ShiftTips/DesignSystem/Theme.swift`. Text pairs meet WCAG AA in both modes.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F2F1EC` | `#0D0D0D` | The paper. Every screen. |
| `surface` | `#FFFFFF` | `#1A1A1A` | Cards, list rows, the receipt slip. |
| `sunken` | `#E9E8E2` | `#262626` | Fields, secondary buttons, the segmented track. |
| `ink` | `#141414` | `#F2F1EC` | Text, the chosen segment, checks, the tint. |
| `inkSecondary` | `#5C5B56` | `#A6A5A0` | Labels, details, footnotes. |
| `inkTertiary` | `#8A8984` | `#75746F` | Placeholders and decoration. Never the only carrier of information. |
| `onInk` | `#F2F1EC` | `#0D0D0D` | Text on an ink fill. |
| `rule` | `#DEDDD6` | `#2E2E2C` | Hairlines between rows. |
| `highlight` | `#FFD60A` | `#FFD60A` | The yellow. A fill only, always with ink on it. |
| `highlightSoft` | `#FFF3C4` | `#3A3110` | Success notes. |
| `hero` | `#161616` | `#1F1F1F` | The tips card. |
| `warning` / `warningSoft` | `#9A4400` / `#FBEBDA` | `#FFA14A` / `#3A2A16` | Something's missing or doesn't add up. |
| `danger` | `#C12A1B` | `#FF6E5E` | Deleting. |

## Type

System fonts only, so Dynamic Type, every language and the PDF just work.

- **Display** (`Font.display`): SF Pro Rounded, heavy or bold. The shift's date, big amounts, button labels and navigation bar titles (set once in `Chrome.apply()`).
- **Mono** (`Font.mono`): SF Mono. Figures in lists, small-capitals labels (`SectionLabel`), tags and the receipt's fine detail.
- **Text**: SF Pro for names, sentences and footnotes.

Labels are passed in natural case and set in capitals on screen; VoiceOver reads the natural case.

## Components

All in `ShiftTips/DesignSystem/`.

- `card()`: a rounded white card (`Theme.cardCorner`). Groups of rows share one card with hairlines between them.
- `SectionHeader`: a small-caps label ("TIPS TO SPLIT") and anything that acts on the section, like "Edit Crew". Screens are a stack of these, `Theme.sectionSpacing` apart.
- `PrimaryButtonStyle`: the yellow button. One per screen. `SecondaryButtonStyle`: soft gray. `PendingButtonStyle`: dashed, for "here's what's still missing"; tapping it goes there. `TextButtonStyle`: underlined words.
- `SegmentedTabs`: a soft gray track with the chosen option in an ink pill that slides.
- `SelectionMark`: a round check (many on) or round radio (one on). `CheckboxToggleStyle` uses it.
- `fieldBox()`: a soft gray field, outlined in ink when focused and in the warning color when what's typed can't be used.
- `Tag`: small capitals in a pill: outline, yellow, warning or muted.
- `Banner`: a rounded note with a round chip (ink "i", warning "!", yellow check) on a soft tint.
- `receiptSlip()`: the receipt, rounded at the top and scalloped at the bottom, for every breakdown. Inside: `SlipTitle`, `ReconciliationLine`, `SlipColumns`, dotted `DashedRule`s, and `SlipTotal` (double rule, yellow amount). `SavedStamp` lands on it once saved.
- `ledgerList()` and `ledgerRows()`: lists and forms as rounded white groups on the paper.
- `MoneyText`: tabular figures that roll to new values (off with Reduce Motion), read aloud as words.
- `Wordmark`: "SHIFT" and "TIPS" on yellow.

## Layout and motion

- 20pt side margins on full screens, 16pt around the receipt. Left-aligned throughout.
- Corners: 14pt for buttons and fields, 20pt for cards and the receipt, pills for tags and chips, circles for checks.
- No drop shadows or gradients; cards separate from the paper by color alone.
- Motion is short and physical: segments slide, amounts roll, the SAVED stamp lands, buttons dip when pressed. Everything respects Reduce Motion.
- iOS 26 draws its own glass navigation bars and sheets; the paper and cards sit underneath, with no glass of our own.

## The icon and the PDF

- `tools/make_icon.py` draws the icon: a white receipt on ink, rounded and scalloped, its total highlighted yellow.
- The PDF report (`Export/PDFReportRenderer.swift`) follows the same rules in print: the wordmark masthead, a rounded heavy title, monospaced figures, hairline rows, yellow behind the reconciliation line and a double rule over the totals.
