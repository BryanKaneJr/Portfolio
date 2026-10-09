# Store listing

Copy and settings for App Store Connect and Google Play, ready to paste. Character limits are the stores' own; each count in *(italics)* was checked. Every claim here matches what the app does today (`product-rules.md`, `subscriptions.md`, `accounts.md`). Privacy answers and the age rating questionnaires are in [`store-privacy.md`](store-privacy.md).

**Rules for editing this copy:** no em dashes; don't promise anything the app doesn't do (friends and weekly leagues exist, but no chat or messages; the daily reminder is optional and off by default); never imply Unlimited adds knowledge, XP or trophies. It gives ∞ Brainpower (as many new levels a day as you like), nothing else. Describe Brainpower as the app does: 1 per new level, refills to 5 a day, up to 10, earned by learning; never say "energy" or imply mistakes cost it.

## App Store (App Store Connect)

### App name (30)

BrainScroll: Level Your Brain  *(29)*

(Plain "BrainScroll" is taken on the App Store; owner's pick, 2026-10-02. On the home screen the app is still just "BrainScroll".)

### Subtitle (30)

Short lessons on everything  *(27)*

### Promotional text (170)

26 skill trees, 2,600 short levels, from black holes to ancient Rome. Free, forever: your Brainpower refills every day. Then put the phone down and go tell someone.  *(164)*

### Description (4000)

```
Stop scrolling. Start leveling.

BrainScroll is short lessons in real subjects, built to level up your brain. Every skill runs from Level 1 to Level 100, and every level is a short, finished lesson: a hook, a few cards that make one idea stick, and three questions to lock it in.

26 SKILL TREES, 2,600 LEVELS
Astronomy, The Human Body, The Animal Kingdom, Chemistry, Ancient Rome, Ancient Greece, Ancient Egypt, The Middle Ages, US History, World Geography, The Oceans, Earth, Weather & Climate, How Money Works, Everyday Technology, How Government Works, Computers & the Internet, Logic & Critical Thinking, Probability & Statistics, Psychology, Philosophy, World Religions, Art History, Architecture, Music, Literature and Film & TV. Each one is 100 levels deep, in order, from the basics to the good stuff.

LEVEL UP YOUR BRAIN
Clear a level and your skill goes up. Your subjects rank up with it, and so does your overall Knowledge Level. Clear Level 100 in a skill to earn its Mastery star. Your profile shows it all.

WRONG ANSWERS TEACH, THEY DON'T PUNISH
Miss a question? "Take another look" shows you the card that explains it, and you try again. No lives, no failure screen, no starting over. Your first try sets your XP; getting it right sets your progress.

REVIEW THAT BRINGS IT BACK
Concepts you've learned come back for review on a schedule, sooner if you missed them. You can also go back over any chapter you've cleared, whenever you like. Review is unlimited and always free.

TROPHIES FOR WHAT YOU'VE LEARNED
Earn trophies for real milestones: your first chapter, 1,000 perfect lessons, every skill in a subject mastered, and Master of All for every skill to Level 100. Keep a learning streak if you like; streak trophies are yours for good, and a missed day never takes one away. Share any trophy with a tap.

MEET DR. SCROLL
A cheerful old genius with a violet bow tie. He points out the key ideas, cheers your level-ups and shrugs kindly when you miss one.

THE DEAL
BrainScroll is free, forever. Each new level uses 1 Brainpower. You refill to 5 every day and can hold up to 10, and you earn more by learning: keep your streak going, win a trophy, finish a chapter review, and sometimes a perfect level drops one. Review, replays and wrong answers never cost a thing. When your Brainpower is used up, we'll tell you, and you can go do something else.

Want more in one day? BrainScroll Unlimited ($4.99 a month or $39.99 a year) gives you unlimited Brainpower. That's all it does. Everyone earns the same XP, levels and stars, and every level can be unlocked free over time.

No ads. No streak punishment. No selling your data.

Your progress lives in your account, so it follows you to any phone where you sign in. Sign in with Apple or Google.

Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel them in your App Store account settings.
```

*(about 2,930 characters)*

**Weekly Quests:** if quests are scheduled at launch, add this section after the trophies one; if not, leave it out until they are (never describe a feature learners can't see):

```
WEEKLY QUESTS
Each week, a quest ties five subjects into one theme, like The Roman World. Learn new levels across them, then finish with a Final Round. Finish in its week for the trophy and a title for your profile.
```

The last paragraph is the auto-renewal disclosure. Keep it, and set the Privacy Policy URL and the licence agreement (Apple's standard EULA unless `EXPO_PUBLIC_TERMS_URL` points to your own) in App Store Connect.

### Keywords (100)

```
learn,trivia,history,science,facts,education,art,astronomy,rome,geography,study,smart,knowledge,quiz
```

*(100 characters, no spaces.)* The app name and subtitle are indexed already, so "brain", "scroll" and "level" aren't repeated here.

### What's new (version 1.0)

```
Welcome to BrainScroll: 26 skill trees and 2,600 levels, Dr. Scroll, unlimited review, trophies you can share, and Brainpower that refills free every day.
```

The app's version is `1.0.0` in `app/app.json`; EAS numbers each build itself.

### Categories

- **Primary:** Education.
- **Secondary:** Reference. (Games → Trivia is possible, but it would put BrainScroll next to quiz games, which it isn't.)

### Age rating

Draft answers are in [`store-privacy.md`](store-privacy.md#apple-age-rating). In short: no ads, no chat, no user-generated content visible to others, no gambling, no web browsing. Educational history, human body and government lessons touch war, disease, alcohol and politics factually, so the expected rating is **9+**, or **13+** if you answer the alcohol question "Infrequent". You decide.

## Google Play (Play Console)

### App name (30)

BrainScroll: Level Your Brain  *(29)*

(The same name as on the App Store. Play doesn't allow words like "free", "#1" or "best" in the name.)

### Short description (80)

Short lessons in real subjects, 100 levels deep. Level up your brain.  *(69)*

### Full description (4000)

Use the App Store description above, with two changes:

1. Sign-in line: unchanged (`Sign in with Apple or Google.`; both work on Android).
2. Last paragraph: `Subscriptions renew automatically until cancelled. Manage or cancel them in Google Play > Payments & subscriptions.`

### Category and tags

- **App category:** Education.
- **Tags** (pick up to 5 from Play's list in Store settings): Education, Trivia, Science, History, Reference. Play's tag list changes; choose the closest matches it offers.
- **Target audience:** 13 and over, unless you decide to design for children (see `privacy-policy.md`, *Children*). Choosing under 13 brings in Google's Families policy.
- **Ads:** "No, my app does not contain ads."

## Screenshots

**The iPhone set is made:** `store/app-store-iphone-6.9/`, nine PNGs at 1320 × 2868, taken by the owner on an iPhone with the TestFlight build (2026-10-09). That's the 6.9" display size, which App Store Connect also uses for the smaller iPhones. Upload them in their file order:

1. Home: every subject, and what's up next.
2. Astronomy's map.
3. A learning card: Ancient Greece's five eras as a timeline, with Dr. Scroll's tip.
4. A learning card with a Key idea: Ancient Egypt's peaks and valleys.
5. A missed fill-in-the-blank with "Take another look".
6. Level Complete: a perfect level, its XP and a level up.
7. Social: the league and this week with friends.
8. The profile: the subject ring, Knowledge Level and league.
9. Brainpower used up for the day, with Unlimited and ways to earn more.

The league and the friends in 7 are the screenshot test learners; removing them at launch (`docs/release.md`) doesn't change the uploaded images. The web-made set (`SHOT_OUT=store/app-store-iphone-6.9 bash e2e/run.sh store-shots`, 1290 × 2796) can still be made after a design change, but it replaces these.

Google Play wants a phone set too (for example 1080 × 2160: `SHOT_W=360 SHOT_H=720` with `npm run screens`), once there's an Android build. No captions, so there's nothing to keep honest beyond the app itself.

## Review notes (App Review / Play app access)

Paste into App Store Connect → App Review Information → Notes, and Play Console → App content → App access. Fill in the test account there only, never in this repo (see [`release.md`](release.md#app-review-sign-in)).

```
Sign in with Google using the test Google account in the sign-in fields of this form (App Store reviewers may also use Sign in with Apple with their own Apple ID).
Unlimited can be bought with a Sandbox account [keep this line only if the review account can get Unlimited, see release.md]. Its only effect is unlimited Brainpower: a free account refills to 5 Brainpower a day (up to 10, more earned by learning) and each new level uses 1. Review, replays and every subject stay free.
Account deletion: Profile > Delete account.
```
