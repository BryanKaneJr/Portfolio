# Store listing

Copy and settings for App Store Connect and Google Play, ready to paste. Character limits are the stores' own; each count in *(italics)* was checked. Every claim here matches what the app does today (`product-rules.md`, `subscriptions.md`, `accounts.md`). Privacy answers and the age rating questionnaires are in [`store-privacy.md`](store-privacy.md).

**Rules for editing this copy:** no em dashes; don't promise anything the app doesn't do (no reminders, streaks, friends, leaderboards or quests yet); never imply Unlimited adds knowledge, XP or trophies. It removes the daily cap on new levels, nothing else.

## App Store (App Store Connect)

### App name (30)

BrainScroll  *(11)*

### Subtitle (30)

Level up your brain  *(19)*

### Promotional text (170)

26 skill trees, 2,600 short levels, from black holes to ancient Rome. Five new levels a day are free, forever. Then put the phone down and go tell someone.  *(155)*

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
Concepts you've learned come back for review on a schedule, sooner if you missed them. Review is unlimited and always free.

MEET DR. SCROLL
A cheerful old genius with a violet bow tie. He points out the key ideas, cheers your level-ups and shrugs kindly when you miss one.

THE DEAL
Five new levels a day are free, forever (ten on your very first day), with unlimited review. When you're done for the day, we'll tell you, and you can go do something else.

Want more in one day? BrainScroll Unlimited ($4.99 a month or $39.99 a year) removes the daily limit on new levels. That's all it does. Everyone earns the same XP, levels and stars, and every level can be unlocked free over time.

No ads. No streak punishment. No selling your data.

Your progress lives in your account, so it follows you to any phone where you sign in. Sign in with Apple or Google.

Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel them in your App Store account settings.
```

*(about 2,320 characters)*

The last paragraph is the auto-renewal disclosure. Keep it, and set the Privacy Policy URL and the licence agreement (Apple's standard EULA unless `EXPO_PUBLIC_TERMS_URL` points to your own) in App Store Connect.

### Keywords (100)

```
learn,trivia,history,science,facts,education,art,astronomy,rome,geography,study,smart,knowledge,quiz
```

*(100 characters, no spaces.)* The app name and subtitle are indexed already, so "brain", "scroll" and "level" aren't repeated here.

### What's new (version 1.0)

```
Welcome to BrainScroll: 26 skill trees and 2,600 levels, Dr. Scroll, unlimited review, and five new levels a day, free.
```

The app's version is `0.1.0` in `app/app.json`. Set it to `1.0.0` (or whatever you choose) before the first store build.

### Categories

- **Primary:** Education.
- **Secondary:** Reference. (Games → Trivia is possible, but it would put BrainScroll next to quiz games, which it isn't.)

### Age rating

Draft answers are in [`store-privacy.md`](store-privacy.md#apple-age-rating). In short: no ads, no chat, no user-generated content visible to others, no gambling, no web browsing. Educational history, human body and government lessons touch war, disease, alcohol and politics factually, so the expected rating is **9+**, or **13+** if you answer the alcohol question "Infrequent". You decide.

## Google Play (Play Console)

### App name (30)

BrainScroll: Learn & Level Up  *(29)*

(Plain "BrainScroll" also works. Play doesn't allow words like "free", "#1" or "best" in the name.)

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

Suggested set (6.9" iPhone, and a phone for Play), in this order:

1. The World Map.
2. A skill's map.
3. A learning card with a Key idea.
4. A question with "Take another look".
5. Level Complete with a level up.
6. The profile: your subjects and Knowledge Level.

Use real content from the app; no mock-up claims. `npm run screens` saves every screen as a phone-size PNG (`SHOT_W=430 SHOT_H=932` for App Store sizes) as a starting point; it uses the web build, so check the frames against a real device. Captions, if any, follow the same honesty rules as the copy above.

## Review notes (App Review / Play app access)

Paste into App Store Connect → App Review Information → Notes, and Play Console → App content → App access. Fill in the test account there only, never in this repo (see [`release.md`](release.md#app-review-sign-in)).

```
Sign in with Google using the test Google account in the sign-in fields of this form (App Store reviewers may also use Sign in with Apple with their own Apple ID).
Unlimited can be bought with a Sandbox account [keep this line only if the review account can get Unlimited, see release.md]. Its only effect is removing the limit of 5 new levels a day (10 on the first day). Review, replays and every subject stay free.
Account deletion: Profile > Delete account.
```
