> Owner brief, added 2026-09-28. The roadmap plan, status and rule notes are in `PRODUCT_ROADMAP.md` §14; where this brief and the product rules differ, the rules win (see §14 "Rules this pass must keep").

# BrainScroll Premium Polish Pass

## Goal

BrainScroll already has enough features and gamification. The next step is not adding more systems. The goal of this pass is to make the app feel intentional, cohesive, responsive, and premium.

The guiding rule should be:

> **I learned something -> I proved I learned it -> BrainScroll rewarded me.**

Do not let the experience become:

> I tapped things -> twelve meters went up.

Knowledge should remain the star. The polish should make learning feel better, not bury it under effects.

---

# 1. Build a consistent motion language

The app should have a recognizable animation personality.

Buttons, cards, answers, XP, streaks, map nodes, skill unlocks, checkpoints, and navigation should feel like they belong to the same product.

### Suggested direction

- Fast interactions: roughly 150-220 ms
- Larger transitions: roughly 220-350 ms
- Use subtle spring behavior where it feels natural
- Avoid aggressive bouncing
- Avoid instant state changes when a small transition would make the action easier to understand
- Prefer elements moving, filling, counting, or transforming instead of simply appearing

### Examples

- Selected answer slightly compresses and settles
- Correct answer gets a short positive movement/glow
- Wrong answer gets a subtle negative response without feeling punishing
- Progress bars animate to the new value
- XP counts upward instead of instantly changing
- Completed map nodes settle into their completed state
- Newly unlocked nodes softly wake up
- Skill level numbers transition instead of snapping

Motion should reinforce cause and effect:

> I did this, therefore this changed.

Respect Reduce Motion accessibility settings.

---

# 2. Add intentional haptics

Haptics can make BrainScroll feel dramatically more expensive if used selectively.

Do not vibrate on everything.

### Good haptic moments

- Selecting an answer: light
- Confirming an answer: light/medium
- Correct answer: satisfying positive feedback
- Wrong answer: short soft warning
- Level complete: medium confirmation
- Skill level-up: stronger impact
- Checkpoint/milestone reached: premium celebratory pattern
- Streak increased: short satisfying confirmation
- Choose For You selection lands: impact
- Major unlock: stronger impact

### Avoid

- Haptic on every card scroll
- Repeated buzzing during animations
- Strong haptics for normal navigation
- Punishing haptics when the learner gets something wrong

The user should begin associating certain physical feedback with specific BrainScroll events.

---

# 3. Add premium sound design

This should be treated as part of the same feedback system as motion and haptics.

BrainScroll should have a small, intentional sound palette rather than generic game sounds.

The sounds should feel smart, warm, clean, and satisfying. Not childish, arcade-like, or casino-like.

### Core sound set

Consider creating a small family of sounds for:

- Answer selected
- Correct answer
- Wrong answer
- XP gained
- Level complete
- Skill level-up
- Streak increased
- New skill/tree unlocked
- Milestone/checkpoint reached
- Choose For You selection cycling
- Choose For You landing
- Major mastery achievement

### Reward sounds matter most

The most premium sound work should go into:

1. Checkpoint completion
2. Skill level-up
3. Major milestone
4. Streak achievement
5. Choose For You landing

These should feel memorable without being loud.

### Sound identity

Ideally, BrainScroll develops a recognizable sonic language.

For example:

- Short soft tonal ticks for small progress
- Warmer rising tones for correct answers
- A compact layered chime for level completion
- A richer ascending motif for a major knowledge checkpoint
- A distinctive reveal sound for Choose For You

The best case is that a user could eventually hear a reward sound without looking and know:

> That was BrainScroll.

### Controls

- Sound effects should be easy to disable
- Consider keeping sound effects on by default if testing shows users like them
- Never make the user hunt through settings to silence the app
- Respect silent mode/platform expectations where appropriate
- Haptics and sound should be separately configurable

### Avoid

- Confetti sound effects everywhere
- Slot-machine sounds
- Overly loud success stingers
- Long audio clips that slow down the flow
- Too many unique sounds
- Cartoon boings unless they genuinely fit Dr. Scroll's personality

A small polished sound library is better than dozens of inconsistent effects.

---

# 4. Make the "You actually know this now" checkpoint the premium signature moment

This is probably the single interaction worth over-polishing.

The emotional goal is:

> "Wait. I actually learned that."

This is more important than a normal XP reward.

### Suggested sequence

1. Normal lesson ends
2. Screen visually settles
3. Short haptic
4. A milestone title appears
5. Knowledge statements reveal one at a time
6. Optional proof interaction or recap
7. "You know this now."
8. XP / skill progress / milestone reward appears
9. Premium checkpoint sound plays
10. Continue back into the journey

### Example

**LOOK WHAT YOU KNOW NOW**

You can explain:

- Why Rome became a republic
- How the Republic differed from the Empire
- Why Mediterranean geography mattered
- What Augustus changed
- Why the Roman world eventually split

**You know this now.**

The app should make the learner stop for a second and appreciate the result.

### Do not

- Turn it into a long exam
- Use giant confetti every time
- Add five reward currencies
- Make the user tap through ten screens
- Let the XP animation overpower the actual learning achievement

The knowledge proof should be the reward. XP supports it.

---

# 5. Give the world map more life

The skill map is one of BrainScroll's strongest identity surfaces.

It should feel like a journey, not a vertical list of numbered circles.

### States should be visually distinct

- Completed
- Current
- Available
- Locked
- Milestone
- Chapter boundary
- Mastered

### Possible polish

- Completed nodes become quieter and clearly resolved
- Current node has subtle life or motion
- Locked nodes fade into the background
- Chapter milestones use a different node shape or scale
- Path lines visually change after completion
- Unlocking a node has a small animation
- Reaching a new chapter feels meaningfully different
- Major milestone nodes visually interrupt the rhythm
- The user's current location is obvious within one second

The map does not need to become a giant game world. Small differences in shape, scale, motion, lighting, and spacing can make it feel much richer.

---

# 6. Make Dr. Scroll feel alive

Dr. Scroll should feel like a character who reacts to the learner, not a static illustration attached to messages.

A small expression library is enough.

### Suggested states

- Neutral
- Encouraging
- Pleased
- Thinking
- Surprised
- Curious
- Sympathetic after a mistake
- Celebratory for major progress

You do not need dozens of poses.

Five to eight strong reusable states can create a lot of personality.

### Use expressions contextually

- Correct answer -> pleased
- Wrong answer -> thoughtful/encouraging, not disappointed
- Interesting fact -> curious/excited
- Checkpoint -> proud/celebratory
- Streak recovery -> encouraging
- Choose For You -> playful/curious

Avoid having Dr. Scroll react to every minor tap. His reactions should feel earned.

---

# 7. Make Choose For You feel more premium than its logic actually is

The underlying selector can remain extremely simple.

The presentation should make it feel deliberate.

### Suggested flow

1. User taps **Choose For You**
2. Button responds immediately
3. Short haptic
4. Subject icons/names cycle briefly
5. Sound ticks subtly while cycling
6. Selection slows
7. Final tree lands
8. Stronger haptic
9. Distinct landing sound
10. "You're learning Astronomy"
11. User enters the next appropriate lesson

The logic can still be simple random/weighted selection.

Do not expose that simplicity visually.

### Avoid

- Instant random redirect
- Long roulette animation
- Casino imagery
- Making the learner wait more than a second or two

It should feel playful, not like gambling.

---

# 8. Perfect every UI state

Premium apps rarely leave the user wondering whether something worked.

Every reusable interaction should have designed states.

### Buttons

- Default
- Pressed
- Disabled
- Loading
- Success where appropriate

### Cards

- Default
- Pressed
- Selected
- Completed
- Locked where applicable

### Questions

- Unanswered
- Selected
- Checking
- Correct
- Incorrect
- Retry/review

### Data surfaces

- Loading
- Empty
- Error
- Offline if relevant
- Retry

Avoid default platform-looking loading behavior if it clashes with the BrainScroll style.

Prefer skeletons or branded loading states where they improve the experience.

---

# 9. Create a strict typography and spacing system

Premium does not mean more decoration.

Premium often means fewer visual decisions, applied consistently.

### Typography

Define a small set such as:

- Display
- Screen title
- Section title
- Card title
- Body
- Supporting text
- Tiny metadata

Do not invent a new font size for every screen.

### Spacing

Use a small spacing scale consistently.

Example:

- 4
- 8
- 12
- 16
- 24
- 32
- 48

The exact values can differ, but they should be deliberate.

### Standardize

- Card radius
- Button radius
- Border weight
- Icon sizes
- Icon stroke weight
- Horizontal screen padding
- Card padding
- Section gaps
- Button heights
- Touch target sizes
- Shadow/glow usage

Users may never consciously notice this. They absolutely feel it.

---

# 10. Use restrained celebration

BrainScroll now has enough progression systems.

Do not celebrate every event at maximum intensity.

Create reward tiers.

### Tier 1 - Tiny

Examples:
- Answer selection
- Minor XP
- Normal progress

Feedback:
- Motion
- Tiny sound
- Light haptic

### Tier 2 - Normal achievement

Examples:
- Correct answer
- Level complete
- Streak day gained

Feedback:
- Slightly stronger motion
- Short reward sound
- Medium haptic

### Tier 3 - Major achievement

Examples:
- Knowledge checkpoint
- Skill milestone
- New chapter
- Major mastery level

Feedback:
- Dedicated presentation
- Premium sound
- Stronger haptic
- More visual breathing room

### Tier 4 - Rare achievement

Examples:
- Level 100
- Major mastery tier
- Rare long-term achievement

These can be the moments where BrainScroll is allowed to go big.

This hierarchy makes major rewards feel major.

---

# 11. Polish navigation transitions

Screens should feel spatially connected.

Examples:

- Skill card -> skill map
- Skill map node -> lesson
- Lesson -> completion
- Completion -> map
- Choose For You -> selected skill
- Home -> Review
- Milestone -> updated map

Avoid unnecessary cinematic animation.

The goal is for users to understand where they came from and where they went.

---

# 12. Make loading and empty states feel authored

Do not allow blank space to communicate system state.

### Review empty state

> **You're caught up.**
>
> Nothing needs review right now. Go learn something new.

### Loading a skill

Show a subtle skeleton shaped like the actual content.

### Network problem

> **Couldn't load this one.**
>
> Your progress is safe. Try again.

### No started skills

Use Dr. Scroll and direct the user toward their first tree or Choose For You.

Every dead state should still feel like BrainScroll.

---

# 13. Make progress bars and numbers feel physical

Anywhere a number changes, consider whether it should visibly travel to the new value.

Good examples:

- XP
- Knowledge Level
- Skill Level
- Streak
- Mastery
- Daily progress
- Checkpoint progress

Do not animate every number for a full second.

Fast, controlled interpolation is enough.

Important progress should feel gained rather than replaced.

---

# 14. Keep iconography and illustrations coherent

Generated lesson imagery can make the app feel premium or immediately make it feel inconsistent.

Be strict about:

- Palette
- Line weight
- Shape language
- Perspective
- Character treatment
- Background transparency
- Lighting
- Level of detail
- Cropping
- Subject scale

The same applies to interface icons.

Do not mix unrelated icon families or stroke weights.

---

# 15. Accessibility should survive the polish

Premium polish should not break usability.

Check:

- Minimum touch targets
- Dynamic Type / font scaling
- VoiceOver labels
- Color contrast
- Meaning not conveyed by color alone
- Reduce Motion
- Sound-off experience
- Haptics-off experience
- Clear selected states
- Readable disabled states

The app should still make complete sense with sound and haptics disabled.

---

# Recommended implementation order

If we are doing a dedicated pre-launch premium polish sprint, prioritize:

1. **Motion system**
2. **Haptic system**
3. **Sound system**
4. **Knowledge checkpoint / "You know this now" experience**
5. **World map polish**
6. **Dr. Scroll reaction states**
7. **Loading, empty, error, and pressed states**
8. **Typography and spacing consistency pass**
9. **Choose For You presentation**
10. **Navigation transitions**
11. **Reward-tier consistency**
12. **Accessibility and Reduce Motion audit**

Do not build all twelve as giant projects.

Create a small system for each and reuse it everywhere.

---

# Final quality bar

Before launch, run through the app and ask this after every important action:

> Did BrainScroll clearly acknowledge what I just did?

Then:

> Did that acknowledgment feel appropriately important?

And finally:

> Did the knowledge remain more important than the reward system?

The premium version of BrainScroll should feel calm, responsive, intelligent, playful, and satisfying.

It should not feel noisy.

It should feel like someone cared about every tap.
