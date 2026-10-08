// Development harness (no Supabase, simulated accounts): sign-in first, onboarding,
// a full chapter, resume, persistence, first-day cap, review, and progress that
// belongs to the account (sign out, a second account, deletion).
import { questMap, CHAPTER_REVIEW_MAX, CHECKPOINT_CURVE, CURVE, REVIEW_XP, rightPositions, bodyText, button, check, completionFacts, exactButton, field, home, launch, onboard, playLevel, playReview, signIn, URL, coldLoad } from './helpers.mjs';

const progressKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('brainscroll.progress.')));

const { browser, page, errors } = await launch();
try {
  await home(page);
  const first = await bodyText(page);
  check(first.includes('Stop scrolling. Start leveling.') && /Continue with email/i.test(first), 'first run opens on the sign-in screen');
  check(['Apple', 'Google', 'phone', 'email'].every((m) => new RegExp(`Continue with ${m}`, 'i').test(first)), 'Apple, Google, phone and email are offered');
  check(/accounts are simulated/i.test(first), 'the development harness says its accounts are simulated');
  check((await page.getByTestId('mascot:sign-in').count()) === 1, 'Dr. Scroll appears on the sign-in screen, labeled by his spot');
  check((await progressKeys(page)).length === 0, 'nothing is saved before signing in (no guest progress)');
  await button(page, 'Continue with email').click();
  await field(page, 'Email').fill('Learner@Example.com');
  await exactButton(page, 'Send code').click();
  await field(page, 'Code').fill('000000');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(500);
  check(/wrong or has expired/.test(await bodyText(page)), 'a wrong code is refused with a clear message');
  await field(page, 'Code').fill('123456');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1200);
  check(/Hi, I'm Dr\. Scroll/.test(await bodyText(page)), 'signing in goes straight to onboarding');
  check((await page.getByTestId('mascot:onboarding.hello').count()) === 1, 'his hello is the onboarding.hello spot');
  await onboard(page, { start: true });
  check((await bodyText(page)).includes('Your Cosmic Address'), 'onboarding lands in Level 1');
  // Level 1 opens with no history behind it (onboarding replaced itself): the close X still leaves, after asking.
  await button(page, 'Continue').click();
  await page.waitForTimeout(300);
  await button(page, 'Leave level').click();
  await page.waitForTimeout(300);
  check(/Your first answers still count/.test(await bodyText(page)), 'leaving Level 1 right after onboarding asks first (and first answers still count)');
  await exactButton(page, 'Leave anyway').click();
  await page.waitForTimeout(1500);
  check(/\/skill\//.test(page.url()) && (await button(page, 'Start Level 1').count()) > 0, 'and Leave anyway goes to the skill map');
  await button(page, 'Start Level 1').click();
  await page.waitForTimeout(600);

  const l1Texts = [];
  const reinforced = await playLevel(page, { pick: (i) => (i === 0 ? 'wrong' : 'right'), texts: l1Texts });
  check(reinforced > 0, 'a missed question shows "Take another look" and must be answered correctly');
  const TIP_QUESTION = 'Pick one, then tap Check.';
  const TIP_MISS = 'Missing one costs you nothing.';
  check(l1Texts[0].includes(TIP_QUESTION), "Dr. Scroll's first-question tip appears on the first question");
  check(l1Texts.filter((t) => t.includes(TIP_QUESTION)).length === 1, 'and only there');
  const missAt = l1Texts.map((t) => t.includes(TIP_MISS));
  check(!missAt[0] && missAt.some(Boolean), 'the first-miss tip appears after the first miss, not before');
  check(missAt.lastIndexOf(true) < missAt.length - 2, 'and not on later questions');
  const l1 = await completionFacts(page);
  check(/LEVEL 1 COMPLETE/i.test(l1.text), 'Level 1 completes once every question is resolved');
  check(l1.total === 3 && l1.xp === CURVE[l1.firstTry], `XP follows the first-attempt curve (${l1.firstTry}/3 → ${l1.xp} XP)`);
  check(/Streak started/.test(l1.text), "the day's first level starts the learning streak");
  check(/Trophy earned[\s\S]*First Level/i.test(l1.text), 'the first level earns a trophy, shown on Level Complete');
  await page.getByRole('button', { name: /^Trophy earned: First Level(, plus \d+ Brainpower)?\. Share$/ }).click();
  await page.waitForTimeout(800);
  check(/I finished my first level on BrainScroll!/.test(await bodyText(page)), 'Share opens the trophy card with its line');
  await exactButton(page, 'Close').click();
  await page.waitForTimeout(600);
  // NEW tags: on the first visit to the Trophies screen, gone on the next.
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  await button(page, 'See all trophies').click();
  await page.waitForTimeout(1000);
  check((await page.getByRole('button', { name: /^First Level, new\. Share$/ }).count()) === 1, 'a new trophy carries a NEW tag on the Trophies screen');
  await page.goBack();
  await page.waitForTimeout(600);
  await button(page, 'See all trophies').click();
  await page.waitForTimeout(1000);
  check((await page.getByRole('button', { name: /^First Level\. Share$/ }).count()) === 1, 'and the tag is gone on the next visit');

  // Social (owner, 2026-10-01): the league banner, the feed and its hearts, friends and profiles.
  // In local play the league is simulated; your own row and moments are real.
  await home(page);
  await page.getByRole('tab', { name: /Social/ }).click();
  await page.waitForTimeout(1200);
  let social = await bodyText(page);
  check(/League/i.test(social) && /\d+(st|nd|rd|th) place/.test(social) && /XP this week/.test(social) && /XP to pass @|You’re leading/.test(social) && /\+1,000 XP[\s\S]*\+500 XP[\s\S]*\+250 XP/.test(social),
    // Early in a league week the simulated rivals have little XP yet, so you can be leading.
    'Social opens on the league banner: your place, your XP, how far the next place is (or that you lead), and the podium with its prizes');
  check(/You earned the First Level trophy/.test(social), 'your own trophy is in the feed');
  // Dr. Scroll: everyone's first friend, with a profile like no one else's.
  check(/Dr\. Scroll[\s\S]*Your first friend/.test(social), 'Dr. Scroll is everyone\'s first friend');
  await page.getByRole('button', { name: 'Dr. Scroll, your first friend. Open his profile' }).click();
  await page.waitForTimeout(800);
  const drProfile = await bodyText(page);
  check(/Official/.test(drProfile) && /Levels cleared/.test(drProfile) && /All \d+ trophies/.test(drProfile) && !/Block|Report/.test(drProfile), 'his profile: official, every level and trophy, no block or report');
  const firstLine = await page.getByRole('button', { name: /^Dr\. Scroll says:/ }).getAttribute('aria-label');
  await page.getByRole('button', { name: /^Dr\. Scroll says:/ }).click();
  await page.waitForTimeout(300);
  const secondLine = await page.getByRole('button', { name: /^Dr\. Scroll says:/ }).getAttribute('aria-label');
  check(secondLine && secondLine !== firstLine, 'tapping his line shows another');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(800);
  social = await bodyText(page);
  check(!/Your first friend/.test(social), 'once opened, his pinned card is gone');
  check((await page.getByRole('button', { name: /^Dr\. Scroll .+ ago\. Open his profile$/ }).count()) >= 2, 'and he turns up in the feed instead, one moment a day');
  check(/Friend requests[\s\S]*@priya/.test(social), 'friend requests show at the top');
  await exactButton(page, 'Accept').click();
  await page.waitForTimeout(1000);
  check(/This week with friends[\s\S]*@priya/.test(await bodyText(page)), 'accepting makes a friend, ranked by this week\'s XP with you');
  const liked = async () => page.getByRole('button', { name: /^Liked/ }).count();
  const before = await liked();
  await page.getByRole('button', { name: /^Like(,|$)/ }).first().click();
  await page.waitForTimeout(500);
  check((await liked()) === before + 1, 'tapping the heart likes a moment');
  await page.getByRole('button', { name: /^Liked/ }).first().click();
  await page.waitForTimeout(500);
  check((await liked()) === before, 'tapping it again takes the like back');
  await page.getByRole('button', { name: /^Like(,|$)/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /League: you're/ }).click();
  await page.waitForTimeout(1000);
  social = await bodyText(page);
  check(!/Ranked by XP earned this week/.test(social) && /1,000 XP prize/.test(social) && /250 XP prize/.test(social), 'the standings mark the top 3 prizes, with no rules paragraph');
  // The first rival in the standings (early in a week, 1st can be you).
  await page.getByRole('button', { name: /^\d+(st|nd|rd|th): @/ }).first().click();
  await page.waitForTimeout(1000);
  social = await bodyText(page);
  check(/Brain overview/i.test(social) && /Rarest trophies/.test(social), 'a league mate\'s profile shows their brain and rarest trophies');
  check(/You and them/.test(social) && (await page.locator('[aria-label*=" levels, them "]').count()) > 0, 'and compares subjects with yours, side by side');
  await page.goBack();
  await page.waitForTimeout(600);
  await page.goBack();
  await page.waitForTimeout(800);
  await exactButton(page, 'Edit your profile').click();
  await page.waitForTimeout(1000);
  check(/Edit profile/.test(await bodyText(page)) && (await field(page, 'Username').count()) === 1, 'your avatar opens Edit profile (username, avatar, title)');
  await exactButton(page, 'Change avatar').click();
  await page.waitForTimeout(1000);
  check((await page.getByRole('radio', { name: /, your avatar$/ }).count()) === 1 && !/Use my initial/.test(await bodyText(page)),
    'every account starts with a tree avatar, and there is no letter avatar to go back to');
  check((await page.getByRole('radio', { name: /^Astronomy(, your avatar)?$/ }).count()) === 1 && (await page.getByRole('radio', { name: /^Astronomy, locked\. Master Astronomy to unlock$/ }).count()) === 1,
    'every tree\'s avatar is open; its gold one is locked until mastery');
  check((await page.getByRole('radio', { name: /^Master of All, locked\. Earn the Master of All trophy to unlock$/ }).count()) === 1, 'legendary avatars wait for their trophy (golden Dr. Scroll for Master of All)');
  // The starter is random: wear Astronomy, or Ancient Rome if Astronomy was the starter.
  const pick = (await page.getByRole('radio', { name: /^Astronomy$/ }).count()) ? 'Astronomy' : 'Ancient Rome';
  await page.getByRole('radio', { name: new RegExp(`^${pick}$`) }).click();
  await page.waitForTimeout(600);
  check((await page.getByRole('radio', { name: new RegExp(`^${pick}, your avatar$`) }).count()) === 1, 'picking an avatar wears it');
  await page.goBack();
  await page.waitForTimeout(800);
  await field(page, 'Username').fill('e2e_learner');
  await exactButton(page, 'Save username').click();
  await page.waitForTimeout(600);
  check(/Saved\./.test(await bodyText(page)), 'Edit profile changes your username');
  await page.goBack();
  await page.waitForTimeout(800);
  await exactButton(page, 'Add friends').first().click();
  await page.waitForTimeout(1000);
  check(/Your code/i.test(await bodyText(page)), 'Add friends shows your invite code');
  check(/invite\/[A-Z0-9]{8}/.test(await bodyText(page)), 'and the invite link itself');
  if (!(await page.evaluate(() => typeof navigator.share === 'function'))) {
    // A desktop browser has no share sheet: Share copies the link and says so.
    await exactButton(page, 'Share invite').click();
    await page.waitForTimeout(500);
    check(/Link copied|Copy the link above/.test(await bodyText(page)), 'Share invite without a share sheet copies the link and says so');
  }
  await field(page, 'Find by username or code').fill('maya_reads');
  await exactButton(page, 'Find').click();
  await page.waitForTimeout(800);
  await exactButton(page, 'Add').click();
  await page.waitForTimeout(800);
  check(/You and @maya_reads are friends now/.test(await bodyText(page)), 'an exact username finds a learner to add');
  await field(page, 'Find by username or code').fill('SIM00002');
  await exactButton(page, 'Find').click();
  await page.waitForTimeout(800);
  check(/You and @leo_learns are friends now/.test(await bodyText(page)), 'an invite code makes friends at once');

  // Profiles opened cold (a refresh or a shared link) wait for the account, and a bad link says so (QA 2026-10-03).
  await coldLoad(page, errors, `${URL}person/sim-5`);
  await page.waitForTimeout(2000);
  let person = await bodyText(page);
  check(/@noor/.test(person) && /Brain overview/i.test(person) && !/Something went wrong|not ready/.test(person), 'a profile link opened cold shows the profile');
  // Report: a reason (username, cheating, something else) and an optional note.
  await exactButton(page, 'Report').click();
  await page.waitForTimeout(300);
  check((await page.getByRole('radio').count()) === 3 && /What’s wrong\?/i.test(await bodyText(page)), 'Report asks what’s wrong: username, cheating or something else');
  check(await exactButton(page, 'Send report').isDisabled(), 'and waits for a reason');
  await page.getByRole('radio', { name: 'Cheating' }).click();
  await field(page, 'Anything else? (optional)').fill('XP looks too fast');
  await exactButton(page, 'Send report').click();
  await page.waitForTimeout(500);
  check(/Thanks\. We’ll take a look\./.test(await bodyText(page)), 'the report is sent');
  // Block: noor becomes a hidden learner in the league, and Settings can unblock.
  await exactButton(page, 'Block').click();
  await page.waitForTimeout(300);
  await exactButton(page, 'Block').last().click();
  await page.waitForTimeout(1500);
  check(!/@noor/.test(await bodyText(page)), 'blocking leaves their profile');
  await page.getByRole('tab', { name: /Social/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /League: you're/ }).click();
  await page.waitForTimeout(1000);
  person = await bodyText(page);
  check(/Hidden learner/.test(person) && !/@noor/.test(person), 'a blocked learner is a hidden learner in the standings');
  await page.goBack();
  await page.waitForTimeout(1000);
  check(!/@noor/.test(await bodyText(page)), 'and nowhere on Social, the league banner included');
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
  check(/Blocked[\s\S]*@noor/i.test(await bodyText(page)), 'Settings lists who you blocked');
  await exactButton(page, 'Unblock').click();
  await page.waitForTimeout(600);
  check(/Unblocked @noor/.test(await bodyText(page)) && /You haven’t blocked anyone/.test(await bodyText(page)), 'and Unblock brings them back');
  // Private profile (owner, 2026-10-03): off by default, a switch in Settings.
  const priv = page.getByRole('switch', { name: 'Private profile' });
  check((await priv.getAttribute('aria-checked')) === 'false', 'profiles are public by default (Private profile off)');
  await priv.click();
  await page.waitForTimeout(400);
  check((await priv.getAttribute('aria-checked')) === 'true', 'and the Private profile switch turns on');
  await priv.click();
  await page.waitForTimeout(400);
  await coldLoad(page, errors, `${URL}person/nobody-here`);
  await page.waitForTimeout(2000);
  check(/We can’t find that profile/.test(await bodyText(page)), 'a profile link to no one shows a friendly not-found state');

  await home(page);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'progress persists across reload');
  check((await page.getByLabel('1-day learning streak').count()) === 1, 'the World Map header shows the streak flame');
  await page.getByRole('button', { name: /^1-day learning streak/ }).click();
  await page.waitForTimeout(800);
  check(/day streak/.test(await bodyText(page)) && /Today counts/.test(await bodyText(page)), 'tapping the flame opens the streak');
  await exactButton(page, 'Share your streak').click();
  await page.waitForTimeout(800);
  check(/I'm on a 1-day learning streak on BrainScroll!/.test(await bodyText(page)), 'and it can be shared as a card');
  await exactButton(page, 'Close').click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(500);
  await home(page);
  check(/Up next/i.test(await bodyText(page)) && (await page.getByRole('button', { name: /^Open Science, level 1, learning now$/ }).count()) === 1, 'Home shows each subject and its level, and what is up next');

  // Deep links (a refresh, a shared link) load straight into the screen, with no hydration errors (React #418).
  const errorsBefore = errors.length;
  await page.goto(`${URL}level/level.science.astronomy.002`);
  await page.waitForTimeout(2000);
  check(/Astronomy · Level 2/.test(await bodyText(page)) && errors.length === errorsBefore, `a deep link to a level opens it without page errors ${errors.slice(errorsBefore).join('; ')}`);
  await page.goto(`${URL}skill/skill.science.astronomy`);
  await page.waitForTimeout(1500);
  check((await button(page, 'Start Level 2').count()) > 0 && errors.length === errorsBefore, `a deep link to a skill map opens it without page errors ${errors.slice(errorsBefore).join('; ')}`);

  // Leaving a level partway: Dr. Scroll checks first, and the level starts over next time.
  await questMap(page);
  await button(page, 'Start Level 2').click();
  await page.waitForTimeout(400);
  const firstCard = (await bodyText(page)).slice(0, 200);
  await button(page, 'Continue').click();
  await button(page, 'Continue').click();
  const midway = (await bodyText(page)).slice(0, 200);
  // The browser's Back button asks too (web), instead of dropping the level silently.
  await page.goBack();
  await page.waitForTimeout(500);
  check(/this level starts over from the beginning next time/.test(await bodyText(page)), 'browser Back on a started level asks first');
  await exactButton(page, 'Keep going').click();
  await page.waitForTimeout(300);
  check((await bodyText(page)).slice(0, 200) === midway && /\/level\//.test(page.url()), 'and Keep going stays on the same card');
  await button(page, 'Leave level').click();
  await page.waitForTimeout(300);
  check(/this level starts over from the beginning next time/.test(await bodyText(page)), 'leaving partway, Dr. Scroll warns the level will start over');
  await exactButton(page, 'Keep going').click();
  await page.waitForTimeout(300);
  check((await bodyText(page)).slice(0, 200) === midway, 'Keep going stays on the same card');
  await button(page, 'Leave level').click();
  await page.waitForTimeout(300);
  await exactButton(page, 'Leave anyway').click();
  await page.waitForTimeout(800);
  check(!/Leave anyway/.test(await bodyText(page)) && (await page.getByRole('button', { name: 'Report a problem' }).count()) === 0, 'Leave anyway leaves the level');
  await questMap(page);
  await button(page, 'Start Level 2').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).slice(0, 200) === firstCard, 'a level left partway starts over from its first card');
  const l2Texts = [];
  await playLevel(page, { texts: l2Texts });
  check(!/Trophy earned/i.test(await bodyText(page)), 'a trophy is celebrated once, not again on the next level');
  check(!l2Texts.some((t) => t.includes(TIP_QUESTION) || t.includes(TIP_MISS)), 'seen tips never come back (saved per account)');

  // Brainpower: 5 to start, 1 per new level, +1 for trophies along the way. When it runs out, the
  // out-of-Brainpower screen says how to earn more and offers Unlimited quietly (∞ Brainpower).
  let sawPerfect = false;
  let ranOut = false;
  for (let n = 3; n <= 10; n++) {
    if (!ranOut && (await button(page, `Next: Level ${n}`).count()) === 0) {
      ranOut = true;
      await exactButton(page, 'Continue').click();
      await page.waitForTimeout(600);
      const out = await bodyText(page);
      check(/Brainpower used up/i.test(out) && out.includes('0 / 10') && /Earn more Brainpower/i.test(out), `running out of Brainpower (before Level ${n}) shows how to earn more`);
      await button(page, 'Want more today? See Unlimited').click();
      await page.waitForTimeout(800);
      const paywall = await bodyText(page);
      check(/Keep leveling today\./.test(paywall) && /Always free/i.test(paywall) && paywall.includes('$39.99') && paywall.includes('$4.99'), 'the Unlimited screen says what stays free and shows both plans');
      check(/∞ Brainpower/.test(paywall), 'Unlimited is ∞ Brainpower');
      check(/Sandbox: no money changes hands/.test(paywall), 'the development harness buys from a sandbox store');
      check(paywall.includes('All knowledge can be unlocked free over time.'), 'it says plainly that all knowledge is free over time');
      check(/Try Unlimited free/.test(out) && /Start free trial/.test(out), 'running out offers the free trial first');
      check(paywall.includes('7 days free') && /7 days free, then \$39\.99 per year\. Cancel anytime before the trial ends/.test(paywall), 'the paywall states the trial and what it costs after');
      await exactButton(page, 'Start free trial').click();
      await page.waitForTimeout(1000);
      check(/Unlimited is on\./.test(await bodyText(page)), 'buying turns Unlimited on (after the server re-reads the store)');
      await exactButton(page, 'Keep learning').click();
      await page.waitForTimeout(1000);
      check((await page.getByRole('button', { name: 'Unlimited Brainpower. Open' }).count()) === 1, 'with Unlimited, Brainpower is ∞ (beside the streak)');
      await questMap(page);
      await button(page, `Start Level ${n}`).click();
    } else {
      await button(page, `Next: Level ${n}`).click();
    }
    await page.waitForTimeout(400);
    await playLevel(page, { pick: (i) => i % 2 });
    const f = await completionFacts(page);
    if (f.firstTry === f.total) sawPerfect ||= /perfect recall/i.test(f.text);
    if (f.total === 3 && f.xp !== CURVE[f.firstTry]) throw new Error(`level ${n}: ${f.firstTry}/3 gave ${f.xp} XP`);
    if (n === 10) {
      check(/LEVEL 10 · CHECKPOINT COMPLETE/i.test(f.text), 'all ten Golden levels play from data; Level 10 is a checkpoint');
      check(f.total === 5 && f.xp === CHECKPOINT_CURVE[f.firstTry], `the checkpoint uses its own XP pool (${f.firstTry}/5 → ${f.xp} XP)`);
      // The recap is a screen of its own; Continue brings in the result.
      check(/10 levels ago, could you have explained this\?/.test(f.recap) && f.recap.includes('You know this now.') && !/could you have explained/.test(f.text), 'the checkpoint shows the chapter recap as proof of what was learned, then Continue shows the result');
      check(!f.text.includes('At Lv. 100:') && !/toward ★ Mastery/.test(f.text) && (await page.locator('[aria-label="10 of 100 toward Mastery I"]').count()) === 1, 'Level Complete stays lean: just the bar toward the next ★ (its place said to screen readers), no write-up');
    }
  }
  check(ranOut, 'a first day runs out of Brainpower before Level 10');
  {
    const at = [0, 1, 2, 3].map((k) => rightPositions.filter((p) => p === k).length);
    check(rightPositions.length >= 20 && at.filter((n) => n > 0).length >= 3 && Math.max(...at) < rightPositions.length * 0.6,
      `answer options are shuffled: right answers shown at A/B/C/D ${at.join('/')}`);
  }
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  check((await bodyText(page)).includes('@e2e_learner') && (await exactButton(page, 'Edit profile').count()) === 1, 'Profile shows your username, with the pencil to edit it');
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
  check(/Unlimited: ∞ Brainpower/.test(await bodyText(page)), 'Settings shows the plan');
  await exactButton(page, 'Unlimited details').click();
  await page.waitForTimeout(800);
  await exactButton(page, 'End sandbox plan').click();
  await page.waitForTimeout(1000);
  check(/Keep leveling today\./.test(await bodyText(page)), 'ending the plan turns Unlimited off');
  await exactButton(page, 'Restore purchases').click();
  await page.waitForTimeout(1000);
  check(/No Unlimited purchase was found/.test(await bodyText(page)), 'restore with nothing to restore says so');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await home(page);
  check((await page.getByRole('button', { name: '0 of 10 Brainpower. Open' }).count()) === 1, 'and Brainpower is back where it was (levels on Unlimited spent none)');

  // Time travel: every concept is due now.
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) => key.startsWith('brainscroll.progress.v2:'));
    const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.concepts)) c.dueAt = new Date(Date.now() - 60e3).toISOString();
    localStorage.setItem(k, JSON.stringify(s));
  });
  await home(page);
  check(!/refresh/i.test(await bodyText(page)) && (await button(page, 'Start review').count()) === 0, 'review never appears on the World Map (it lives in its tab)');
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(800);
  check(/ready to refresh/.test(await bodyText(page)), 'the Review tab shows what is ready (and settles: no refresh loop)');
  await button(page, 'Start review').click();
  await page.waitForTimeout(500);
  const corrected = await playReview(page);
  const t = await bodyText(page);
  check(/REVIEW COMPLETE/i.test(t), `a review session completes once every item is resolved (${corrected} corrected)`);
  // No first-try right: no "+0 XP" numeral, just the count.
  const [, xp = '0', right, total] = t.match(/(?:\+(\d+) XP[\s\S]*?)?(\d+) \/ (\d+) right first time/) ?? [];
  check(Number(xp) === REVIEW_XP * Number(right) && Number(total) - Number(right) === corrected,
    `review XP is ${REVIEW_XP} per first-try item; corrections earn nothing (${right}/${total} → +${xp})`);

  // Chapter reviews: any cleared chapter, any time, for a little XP.
  await home(page);
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(800);
  check(/Go back over a chapter/i.test(await bodyText(page)) && !/Counts toward quests/.test(await bodyText(page)), 'the Review tab offers cleared chapters (no quest credit while new levels remain)');
  await page.getByRole('button', { name: /^Review Astronomy, Chapter 1:/ }).click();
  await page.waitForTimeout(500);
  check(/Astronomy · Chapter 1, Level 1 · 1 of 10/.test(await bodyText(page)), 'a chapter review asks one question from each of its ten levels');
  const chapterCorrected = await playReview(page);
  const ct = await bodyText(page);
  const [, cright, ctotal] = ct.match(/(\d+) \/ (\d+) right first time/) ?? [];
  const cxp = ct.match(/\+(\d+) XP[\s\S]*?\d+ \/ \d+ right first time/)?.[1] ?? '0';
  check(/Chapter review complete/i.test(ct) && ctotal === '10' && Number(cxp) === Math.round((CHAPTER_REVIEW_MAX * Number(cright)) / 10),
    `a chapter review pays at most ${CHAPTER_REVIEW_MAX} XP, from first tries (${cright}/10 → +${cxp}, ${chapterCorrected} corrected)`);
  check(/Chapter review complete\s*\+1/.test(ct) && !/\d+ \/ 10\b/.test(ct.split('Chapter review complete')[1] ?? ''), 'a first chapter review earns +1 Brainpower (the balance stays in the chip)');
  await exactButton(page, 'Done').click();
  await page.waitForTimeout(600);
  await home(page);
  check((await page.getByRole('button', { name: '1 of 10 Brainpower. Open' }).count()) === 1 && (await exactButton(page, 'Choose for me').count()) === 1, 'Home shows the Brainpower earned beside the streak, and Choose for me is back');
  await page.getByRole('button', { name: '1 of 10 Brainpower. Open' }).click();
  await page.waitForTimeout(800);
  const bpScreen = await bodyText(page);
  check(/of 10 Brainpower/.test(bpScreen) && /Earn more/i.test(bpScreen) && /refill to 5/.test(bpScreen), 'tapping the brain opens Brainpower: the balance, the refill and how to earn more');
  await exactButton(page, 'Close').click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
  const profileText = await bodyText(page);
  check(profileText.includes('Signed in with email: learner@example.com') && !/guest/i.test(profileText), 'Settings shows the account (normalised email), and there is no guest anywhere');
  // Map chests (owner, 2026-10-05): one per chapter after its 5th level, opened once from the road.
  await page.goto(`${URL}skill/skill.science.astronomy`);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Chapter 1 chest. Open' }).click();
  await page.waitForTimeout(800);
  await page.getByTestId('open-chest').click();
  await page.getByTestId('chest-reward').waitFor({ timeout: 5_000 });
  const prize = (await page.getByTestId('chest-reward').innerText()).replace(/\s+/g, ' ').trim();
  check(prize.length > 0, `a chest pays one prize (${prize})`);
  const boosted = (await page.getByTestId('start-boost-now').count()) > 0;
  if (boosted) {
    await page.getByTestId('start-boost-now').click();
    await page.waitForTimeout(600);
  }
  await exactButton(page, boosted ? 'Done' : (await exactButton(page, 'Later').count()) ? 'Later' : 'Done').click();
  await page.waitForTimeout(800);
  check((await page.getByRole('button', { name: 'Chapter 1 chest, opened' }).count()) === 1, 'the chest stays open on the road (once ever)');
  await home(page);
  if (boosted) check((await page.getByTestId('boost-chip').count()) === 1, 'a started boost shows its 2x chip on Home');
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  if (boosted) check(/XP boost on/.test(await bodyText(page)), 'Profile shows the running boost');
  await exactButton(page, 'Edit profile').click();
  await page.waitForTimeout(1000);
  const wardrobe = await bodyText(page);
  check(/Glows/.test(wardrobe) && /Name styles/.test(wardrobe) && /Titles/.test(wardrobe), 'Edit profile lists glows, name styles and titles');
  // Opened straight from a link (a fresh launch), it waits for the account instead of failing.
  await page.goto(`${URL}edit-profile`);
  await page.waitForTimeout(2500);
  const linked = await bodyText(page);
  check(/Save username/.test(linked) && !/Couldn.t load/.test(linked), 'Edit profile opened from a link loads');
  // The app preview's shortcuts (local mode only, docs/app-preview.md): every look to try on.
  await page.goto(`${URL}settings`);
  await page.waitForTimeout(2000);
  check(/Preview only/i.test(await bodyText(page)), 'the preview shows its shortcuts in Settings');
  await exactButton(page, 'Own every look').click();
  await page.waitForTimeout(1000);
  await page.goto(`${URL}edit-profile`);
  await page.waitForTimeout(2500);
  await page.getByTestId('wear-ring.music').click();
  await page.waitForTimeout(1000);
  check((await page.getByTestId('wear-ring.music').getAttribute('aria-checked')) === 'true', 'Own every look makes every glow wearable (Sheet Music on)');

  // A second skill: opening it on the Skills tab shows its map, but Home keeps the tree last played.
  await home(page);
  await page.getByRole('tab', { name: /Skills/ }).click();
  await page.waitForTimeout(600);
  // Browsing a skill doesn't change Home's "Up next": only playing does (owner, 2026-10-01).
  await button(page, 'Open Ancient Rome').click();
  await page.waitForTimeout(800);
  check((await bodyText(page)).includes('Founding and the Kings'), 'opening a skill shows it as a map of chapters');
  await home(page);
  const afterBrowse = await bodyText(page);
  check(/Astronomy · Lv\. [1-9]/.test(afterBrowse) && !afterBrowse.includes('Ancient Rome · Lv. 0'), 'Up next stays on the tree last played after browsing another (a second tree plays from data)');
  // Progress belongs to the account: sign out, and it comes back with the same sign-in.
  // Account actions live in Settings, one tap from Profile.
  const profile = async () => { await home(page); await page.getByRole('tab', { name: /Profile/ }).click(); await page.waitForTimeout(800); await exactButton(page, 'Settings').click(); await page.waitForTimeout(800); };
  await profile();
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  check(/Continue with email/i.test(await bodyText(page)), 'signing out returns to the sign-in screen');
  await home(page);
  check(/Continue with email/i.test(await bodyText(page)), 'signed out, the app stays on the sign-in screen (no way around it)');
  // An invite link opened while signed out waits through sign-in, then opens.
  await page.goto(`${URL}invite/SIM00004`);
  await page.waitForTimeout(1500);
  check(/Continue with email/i.test(await bodyText(page)), 'an invite link opened signed out asks you to sign in first');
  await signIn(page, { method: 'email', email: 'learner@example.com' });
  check(/You and @sam_k are friends!/.test(await bodyText(page)), 'and opens the invite once you are in');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1000);
  check(/Astronomy · Lv\. [1-9]/.test(await bodyText(page)), 'signing back in restores that account\'s progress and skips onboarding');

  // A second account on the same device starts fresh and never sees the first one's progress.
  await profile();
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'phone', phone: '+1 555 555 0100' });
  check(/Hi, I'm Dr\. Scroll/.test(await bodyText(page)), 'a new account on the same device gets its own onboarding');
  await onboard(page, { start: false });
  check((await bodyText(page)).includes('Astronomy · Lv. 0'), 'and none of the first account\'s progress');
  // Choose For Me: a random skill with a level left; straight into its next level.
  await exactButton(page, 'Choose for me').click();
  // The pick is revealed after a short cycle of names (under 1.5 s).
  await page.waitForTimeout(150);
  await exactButton(page, 'Pick again').waitFor({ timeout: 5_000 });
  const pickName = async () => (await bodyText(page)).match(/Chosen for you · new\s*([^\n]+)/i)?.[1]?.trim();
  const pick1 = await pickName();
  check(!!pick1 && /Start Level 1/i.test(await bodyText(page)), `Choose for me offers a skill's next level (${pick1})`);
  await exactButton(page, 'Pick again').click();
  await page.waitForTimeout(150);
  await exactButton(page, 'Pick again').waitFor({ timeout: 5_000 });
  const pick2 = await pickName();
  check(!!pick2 && pick2 !== pick1, `"Pick again" offers a different one (${pick2})`);
  await exactButton(page, 'Start Level 1').click();
  await page.waitForTimeout(1000);
  check((await page.getByRole('button', { name: 'Report a problem' }).count()) > 0, 'Start drops straight into the level');
  await home(page);
  check((await bodyText(page)).includes(`${pick2} · Lv. 0`), 'and that skill becomes the Current Quest');
  await profile();
  check((await bodyText(page)).includes('Signed in with your phone number: +15 •••• 0100'), 'Profile shows the phone account, masked');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'email', email: 'learner@example.com' });

  // Deleting the account removes it and its progress, and returns to sign-in.
  const doomed = await progressKeys(page); // only this account has played, so these are all its keys
  check(doomed.length === 1, 'progress is stored under the account, not the device');
  await profile();
  await button(page, 'Delete account').click();
  check(/permanently deletes your account/.test(await bodyText(page)), 'deletion explains what will be lost before confirming');
  await button(page, 'Delete permanently').click();
  await page.waitForTimeout(1200);
  check(/Continue with email/i.test(await bodyText(page)), 'after deletion the app is back at the sign-in screen');
  check(!(await progressKeys(page)).some((k) => doomed.includes(k)), 'the deleted account\'s progress is gone from the device');
  await signIn(page, { method: 'email', email: 'learner@example.com' });
  check(/Hi, I'm Dr\. Scroll/.test(await bodyText(page)), 'signing in with the deleted email starts a brand-new account');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
