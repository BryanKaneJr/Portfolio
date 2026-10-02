# Invite links

A learner shares their invite link from Social → Add friends. Whoever opens it becomes their friend (sharing it was the inviter's yes).

## How a link behaves

The link is `https://<your domain>/invite/AB12CD34` once the app is built with an invite domain (otherwise `brainscroll://invite/AB12CD34`, which only works with the app installed).

- **BrainScroll installed:** the phone opens the app straight to the invite (iOS Universal Links, Android App Links). Signed out, the app asks them to sign in first, then opens the invite (`app/src/social/pendingInvite.ts`).
- **Not installed:** the link opens a small web page (`site/src/invite.html`) with the App Store or Google Play button (whichever fits the phone), the code in large type, and how to use it: open the link again after installing, or enter the code in Social → Add friends. Store installs don't carry the link through, so the code is the fallback.
- **The page is private by design:** no trackers or analytics, nothing from other sites, and no referrer sent onward.

## What's in the repo

- `site/src/`: the landing page, the invite page, the privacy policy page (rendered from `docs/privacy-policy.md`), the account-deletion page both stores ask for, styles and Dr. Scroll.
- `npm run site:build`: builds `site/dist/` (gitignored) and adds:
  - `.well-known/apple-app-site-association`, which lets iPhones open the app for `/invite/*`;
  - `.well-known/assetlinks.json`, the same for Android;
  - `_redirects` and `_headers` for Cloudflare Pages or Netlify. Every `/invite/CODE` serves the invite page, and the Apple file is served as JSON.
- `app/app.config.ts`: with `EXPO_PUBLIC_INVITE_DOMAIN` set, the build declares the domain:
  - `associatedDomains` on iOS;
  - a verified `intentFilter` for `/invite/` on Android;
  - and the app shares `https://` links.

## Owner setup (once)

BrainScroll's domain is **`brainscroll.app`**, registered on Cloudflare (owner, 2026-10-02):
- **`brainscroll.app`** is the home page, made in Canva;
- **`invite.brainscroll.app`** serves the invite links from this repo on Cloudflare Pages.

Canva can't serve the files that let phones open the app, which is why the invite links get their own subdomain. The app's builds already use `invite.brainscroll.app` (`EXPO_PUBLIC_INVITE_DOMAIN` in `app/eas.json`).

Every value below is public; none is a secret.

1. **The home page (Canva):**
   - In the Canva website, choose Publish → Use a domain you already own, and enter `brainscroll.app`.
   - Add the DNS records Canva shows in Cloudflare (your domain → DNS → Records → Add record).
   - Set each one to **DNS only** (grey cloud), not Proxied. Canva's check can fail behind Cloudflare's proxy.
2. **Find the four values:**
   - `APPLE_TEAM_ID`: developer.apple.com → Account → Membership details → Team ID (10 characters).
   - `ANDROID_CERT_SHA256`: Play Console → your app → Test and release → App integrity → App signing key certificate → SHA-256 fingerprint. If you also install EAS builds outside Play, add the upload key's fingerprint too, comma-separated (`eas credentials` shows it).
   - `APP_STORE_URL` and `PLAY_STORE_URL`: the store listing links. Until the app is live, leave them out: the page says "coming soon".
3. **The invite site (Cloudflare Pages, free):**
   - Workers & Pages → Create → Pages → Connect to Git → this repository, on the branch you release from.
   - Root directory `brainscroll`, build command `npm run site:build`, output directory `site/dist`.
   - Add the four values as environment variables. Leaving some out for now is fine; add them and choose Retry deployment when you have them.
   - Also add the privacy policy's details, which never go in the repo:
     - `SITE_OPERATOR`: who runs BrainScroll (your company, or your name);
     - `SITE_ADDRESS`: a postal address (city and country at least);
     - `SITE_CONTACT_EMAIL`: where privacy and deletion requests go. An address on your domain works well, such as `privacy@brainscroll.app`: Cloudflare Email Routing (free) forwards it to your own inbox;
     - `SITE_EFFECTIVE_DATE`: the date the policy takes effect, as you want it written.
   - Then Custom domains → `invite.brainscroll.app`. Cloudflare adds its DNS record itself.
4. **Check it:**
   - `https://invite.brainscroll.app/invite/AB12CD34` shows the invite page.
   - `https://invite.brainscroll.app/privacy` and `/delete-account` show the policy and the deletion steps, with no "[not set]" left.
   - `https://invite.brainscroll.app/.well-known/apple-app-site-association` and `.../assetlinks.json` show JSON once their values are set.
   - Google's Statement List Tester (developers.google.com/digital-asset-links/tools/generator) confirms the Android side.
   - On a phone with a new build, tap an invite link in Messages: it should open the app. Apple caches the file, so a change can take a day to reach phones.

`npm run site:build` warns about anything missing or malformed. The site still builds without the IDs; links then open the page instead of the app.
