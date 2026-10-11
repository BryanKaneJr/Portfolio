# ShiftTips on the App Store: listing, answers and review notes

Everything App Store Connect asks for, ready to paste. Character limits are Apple's; every field here fits. The steps that get a build there are in [`testflight.md`](testflight.md).

## App information

| Field | Value |
| --- | --- |
| Name (30) | `ShiftTips` (if it's taken: `ShiftTips: Tip Pool Split`) |
| Subtitle (30) | `Tip pools and tip-outs, exact` |
| Primary category | Business |
| Secondary category | Finance |
| Content rights | Doesn't contain, show or access third-party content |
| Age rating | Answer "None" or "No" to every question. Result: 4+ |
| Copyright | `2026 Your Name` (your legal name or company, as on your developer account) |
| Bundle ID | The one you registered, also set as `SHIFTTIPS_BUNDLE_ID` in GitHub |

## URLs

| Field | Value |
| --- | --- |
| Privacy Policy URL | `https://shifttips.pages.dev/privacy` |
| Support URL | `https://shifttips.pages.dev/support` |
| Marketing URL (optional) | `https://shifttips.pages.dev` |

These are the pages in [`../site`](../site), once Cloudflare Pages serves them (see "The website" below). If Cloudflare gives the project a different address, use that one.

## Pricing

Paid, one time. The plan's range is $5.99 to $7.99. Selling a paid app needs the Paid Apps agreement, bank account and tax form in **Business** first.

## App Privacy

**Data collection:** choose **"No, we do not collect data from this app."** That's accurate: the app has no network code, no analytics, no accounts and no third-party SDKs (see the privacy manifest, `ShiftTips/PrivacyInfo.xcprivacy`).

## Version 1.0

### Promotional text (170)

```
Close the shift in a minute. Type the tips and hours, and ShiftTips splits every cent, shows the working and shares a clear breakdown. No account, no ads, all offline.
```

### Description (4,000)

```
ShiftTips settles a shift's tips exactly, in about a minute.

Type the tips and everyone's hours. ShiftTips works out each person's share to the cent and shows a clear breakdown you can save and share. The shares always add up to exactly what came in, and you can tap anyone to see the working behind their amount.

SIMPLE OR ADVANCED
• Simple: list who worked and their hours. Tips are shared by hours. Nothing else to set up.
• Advanced: pick the tipping style closest to your house, then make every number match.
  · Equal pool: everyone on the shift gets the same share.
  · Hours pool: shares follow the hours each person worked.
  · Points pool: hours times points by role, like 1 for servers and 0.5 for support staff.
  · Tip-out by percent of tips or sales: servers keep their own tips and tip out bussers, the bar, runners and hosts, with each role's pot shared by hours.
• Separate cash and card amounts, each split on its own.

BUILT FOR CLOSING TIME
• Save your crew once. Every shift starts with them; just add tips and hours.
• Hours however you write them: 7.5, 7:30 or 7h 30m.
• Review shows exactly who gets what, and why, before you save.
• Share a text summary, a PDF report or a spreadsheet file.
• History keeps every shift exactly as it was saved.
• Totals by Person adds up a week, two weeks or a month for payroll.
• Dark mode, Dynamic Type and VoiceOver.

FAIR BY DESIGN
• Owners, managers and supervisors are never included in a pool.
• Eligibility is yours to set from your workplace's policy; a job title never decides it.
• Nothing is deducted. ShiftTips splits exactly the amount you enter.

PRIVATE
No account, no server, no ads, no tracking. ShiftTips works offline and keeps everything on your iPhone. Back up to Files whenever you like.

Good to know: ShiftTips calculates how tips are allocated from what you enter. It isn't payroll, doesn't record that anyone was paid and doesn't check legal compliance. Check your workplace policy and the tip pooling rules where you work.
```

### Keywords (100)

```
tip,tips,pool,tipout,split,calculator,server,bartender,restaurant,bar,payroll,hours,gratuity,busser
```

### Screenshots

Upload the framed 6.9-inch screenshots (1320 x 2868) in [`../store/app-store-iphone-6.9`](../store/app-store-iphone-6.9), in this order. App Store Connect scales them for smaller iPhones. The **ShiftTips App Store screenshots** workflow makes fresh ones whenever the app changes; copy them in from its artifact.

1. `01-review.png`: Every cent, accounted for.
2. `02-new-shift.png`: Tips and hours. Done.
3. `03-saved.png`: Save it. Share it.
4. `04-totals.png`: Pay-period totals in a tap.
5. `05-history.png`: Every shift, kept.
6. `06-tip-out.png`: Tip-outs, worked out.
7. `07-styles.png`: Run it your way.
8. `08-dark.png`: Easy on the eyes at close.
9. `09-points.png`: Points by role, built in.
10. `10-welcome.png`: Simple or Advanced.

Apple takes 1 to 10 per device size; all 10 fill every slot.

The unframed versions are in the workflow artifact's `raw/` folder if you'd rather use those.

### App Review information

- **Sign-in required:** No.
- **Contact:** your name, phone and email (only Apple sees these).
- **Notes:**

```
ShiftTips has no account or sign-in and works fully offline; it makes no network connections.

To see it work: on the first screen tap "Not Now", then "Try an Example" at the top of New Shift. It loads a made-up shift with $472.38 in tips and five people. Tap "Review Split" to see each person's share and the line showing every cent is allocated, then "Save Shift". History (clock icon) keeps saved shifts, and "Totals by Person" adds them up for a pay period.

Advanced (Settings, gear icon) adds equal and points pools and tip-outs by percent of tips or sales. To see a tip-out, switch to Advanced, choose "Tip Out" on New Shift, then "Try an Example" from the "..." menu.

ShiftTips calculates allocations only. It doesn't move money, run payroll or decide anyone's legal eligibility; owners and managers are never included in a pool.
```

## The website

The privacy policy and support page are static files in [`../site`](../site), with no scripts, web fonts or trackers. Serve them with Cloudflare Pages, like the BrainScroll site:

1. Cloudflare dashboard, **Workers & Pages**, **Create**, **Pages**, **Connect to Git**, pick `BryanKaneJr/Portfolio`.
2. Project name `shifttips`. Production branch `master`. Framework preset **None**. Build command: leave empty. Build output directory: `shifttips/site`.
3. **Save and Deploy**. The pages are then at `https://shifttips.pages.dev/privacy` and `/support`.
4. Optional: in the project's **Settings**, **Builds**, set **Build watch paths** to include only `shifttips/site/*`, so other commits don't redeploy it.

Before publishing, put the support email address in `site/privacy.html` and `site/support.html` (replace `SUPPORT_EMAIL`) and in `AppInfo.supportEmail` in `ShiftTips/App/ShiftTipsApp.swift`, which adds a Contact Support row to Settings.
