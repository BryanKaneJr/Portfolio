# Getting ShiftTips onto your iPhone without a Mac

GitHub builds, signs and uploads ShiftTips to TestFlight for you. You do the Apple side once in a web browser, add four secrets to GitHub, then press **Run workflow** whenever you want a new build on your phone.

The workflow is `.github/workflows/shifttips-testflight.yml`. It builds with Xcode 26, which App Store Connect requires for uploads. Every normal CI run also builds the Release version unsigned with the same Xcode, so by the time you run it, the only new step is signing.

## 1. Apple Developer Program

You need a paid membership (US $99 a year) at <https://developer.apple.com/programs/>. Enrollment can take a day or two to be approved.

## 2. Decide the name and bundle ID

The bundle ID is permanent once a build is uploaded. The project uses the placeholder `app.shifttips`. If you want a different one (for example `com.yourcompany.tipclose`), note it now; you'll set it in GitHub in step 5.

## 3. Register the app

1. In **Certificates, Identifiers & Profiles** (<https://developer.apple.com/account/resources/identifiers/list>), tap **+**, choose **App IDs**, then **App**. Description: ShiftTips. Bundle ID: **Explicit**, your bundle ID. No capabilities are needed. Register.
2. In **App Store Connect** (<https://appstoreconnect.apple.com>), go to **Apps**, tap **+**, **New App**. Platform iOS, your app name, English (U.S.), the bundle ID you just registered, and any SKU (for example `shifttips`). Full access. Create.

## 4. Create an API key for GitHub

1. App Store Connect, **Users and Access**, **Integrations**, **App Store Connect API**, **Team Keys**.
2. Tap **+**. Name it "GitHub TestFlight". Access: **Admin** (signing needs to create a distribution certificate and profile, which lower roles can't do).
3. **Download** the key file (`AuthKey_XXXXXXXXXX.p8`). Apple only lets you download it once; keep it somewhere safe.
4. Note the **Key ID** (next to the key) and the **Issuer ID** (above the list).
5. Your **Team ID** is under **Membership details** at <https://developer.apple.com/account>.

## 5. Add the secrets to GitHub

In the repository on GitHub: **Settings**, **Secrets and variables**, **Actions**.

On the **Secrets** tab, add four repository secrets:

| Name | Value |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | the Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | the Issuer ID |
| `APP_STORE_CONNECT_KEY` | the whole contents of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `APPLE_TEAM_ID` | the Team ID |

Only if your bundle ID isn't `app.shifttips`: on the **Variables** tab, add `SHIFTTIPS_BUNDLE_ID` with your bundle ID.

## 6. Run it

The **Run workflow** button only appears once the workflow file is on the default branch, so merge the ShiftTips branch first.

1. **Actions** tab, **ShiftTips TestFlight**, **Run workflow**, Run.
2. It takes about 15 minutes. Each run gets the next build number automatically.
3. Apple then processes the build, usually 10 to 30 minutes. It appears in App Store Connect under **TestFlight**.
4. In **TestFlight**, **Internal Testing**, create a group, add yourself, and add the build.
5. Install **TestFlight** from the App Store on your iPhone and accept the invite. ShiftTips installs like any app.

The app already declares that it uses no encryption beyond Apple's, so TestFlight won't stop to ask about export compliance.

## If a run fails

- **"Missing secrets"**: one of the four secrets in step 5 is missing or misspelled.
- **"No profiles for ... were found" or "Cloud signing permission error"**: the API key needs the **Admin** role (step 4).
- **"No suitable application records were found"**: the app hasn't been created in App Store Connect with exactly this bundle ID (step 3), or `SHIFTTIPS_BUNDLE_ID` doesn't match it.
- **"The bundle version must be higher"**: a build with that number was already uploaded; run the workflow again.

The key file stays only in GitHub's encrypted secrets and is deleted from the build machine at the end of every run. To revoke it, delete the key in App Store Connect.
