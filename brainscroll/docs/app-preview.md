# App preview

A web build of the app on every branch, so you can tap through a change before it merges. It runs in local mode: play is offline, sign-in is simulated (email only; every code is 123456, as the sign-in screen says), and nothing reaches Supabase. Progress lives in that browser only.

`npm run app:preview` builds it into `app/dist-preview` (`app/preview.sh`), with a `_redirects` file that sends each dynamic route (`/level/ID`) to its page.

## Owner setup (once)

A second Cloudflare Pages project, next to the site's (`docs/invite-links.md`):

1. Workers & Pages → Create → Pages → Connect to Git → this repository, production branch `master`.
2. Project name `brainscroll-app`. Root directory `brainscroll`, build command `npm run app:preview`, output directory `app/dist-preview`. No environment variables.
3. Save and deploy.

After that, every pull request gets a second Cloudflare comment, for `brainscroll-app`, whose Preview URL opens the app. `master` is at `https://brainscroll-app.pages.dev`.
