# Invite links

A learner shares their invite link from Social → Add friends. Whoever opens it becomes their friend (sharing it was the inviter's yes).

## How a link behaves

The link is `https://<your domain>/invite/AB12CD34` once the app is built with an invite domain (otherwise `brainscroll://invite/AB12CD34`, which only works with the app installed).

- **BrainScroll installed:** the phone opens the app straight to the invite (iOS Universal Links, Android App Links). Signed out, the app asks them to sign in first, then opens the invite (`app/src/social/pendingInvite.ts`).
- **Not installed:** the link opens a small web page (`site/src/invite.html`) with the App Store or Google Play button (whichever fits the phone), the code in large type, and how to use it: open the link again after installing, or enter the code in Social → Add friends. Store installs don't carry the link through, so the code is the fallback.
- **The page is private by design:** no trackers or analytics, nothing from other sites, and no referrer sent onward.

## What's in the repo

- `site/src/`: the landing page, the invite page, styles and Dr. Scroll.
- `npm run site:build`: builds `site/dist/` (gitignored) and adds:
  - `.well-known/apple-app-site-association`, which lets iPhones open the app for `/invite/*`;
  - `.well-known/assetlinks.json`, the same for Android;
  - `_redirects` and `_headers` for Cloudflare Pages or Netlify. Every `/invite/CODE` serves the invite page, and the Apple file is served as JSON.
- `app/app.config.ts`: with `EXPO_PUBLIC_INVITE_DOMAIN` set, the build declares the domain:
  - `associatedDomains` on iOS;
  - a verified `intentFilter` for `/invite/` on Android;
  - and the app shares `https://` links.

## Owner setup (once)

Every value below is public; none is a secret.

1. **Get a domain**, for example `brainscroll.app`. Any registrar works. Cloudflare Registrar is at-cost and keeps everything in one place.
2. **Find the four values:**
   - `APPLE_TEAM_ID`: developer.apple.com → Account → Membership details → Team ID (10 characters).
   - `ANDROID_CERT_SHA256`: Play Console → your app → Test and release → App integrity → App signing key certificate → SHA-256 fingerprint. If you also install EAS builds outside Play, add the upload key's fingerprint too, comma-separated (`eas credentials` shows it).
   - `APP_STORE_URL` and `PLAY_STORE_URL`: the store listing links. Until the app is live, leave them out: the page says "coming soon".
3. **Host the site on Cloudflare Pages** (free):
   - Pages → Create → Connect to Git → this repository.
   - Build command `npm run site:build`, output directory `site/dist`.
   - Add the four values as environment variables.
   - Then Custom domains → add your domain.
   - Netlify works the same way with the same build settings.
4. **Build the app with the domain:** set `EXPO_PUBLIC_INVITE_DOMAIN=brainscroll.app` (no `https://`) in the EAS environment. EAS turns on the Associated Domains capability for the iOS build. Older builds keep sharing `brainscroll://` links, which still work with the app installed.
5. **Check it:**
   - Open `https://<domain>/.well-known/apple-app-site-association` and `.../assetlinks.json` in a browser. Both should show JSON.
   - Google's Statement List Tester (developers.google.com/digital-asset-links/tools/generator) confirms the Android side.
   - On a phone with the new build, tap an invite link in Messages: it should open the app.

`npm run site:build` warns about anything missing or malformed. The site still builds without the IDs; links then open the page instead of the app.
