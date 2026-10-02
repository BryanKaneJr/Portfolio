/**
 * Public, build-time sign-in configuration (never secrets). Missing values
 * just hide that method; there is no fallback to a guest mode.
 *
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  Google OAuth "Web application" client id. Native Google
 *                                     sign-in asks for an ID token for this audience; the same id
 *                                     goes in Supabase → Auth → Providers → Google.
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  Google OAuth "iOS" client id (iOS builds only). app.config.ts
 *                                     derives the URL scheme the native SDK needs from it.
 *
 *   EXPO_PUBLIC_SIGN_IN_METHODS       Which methods this build offers, comma-separated. Defaults to
 *                                     `apple,google` (the launch set, owner decision 2026-09-29). The
 *                                     phone and email code flows still exist; list them here to bring
 *                                     them back (the e2e and screen runs do).
 *
 * Sign in with Apple needs no public value: on iOS the bundle id is the client id.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;

/** The methods this build may offer. A method also has to be switched on in the project to appear. */
export const OFFERED_METHODS: ReadonlySet<string> = new Set(
  String(process.env.EXPO_PUBLIC_SIGN_IN_METHODS || 'apple,google')
    .split(',')
    .map((m: string) => m.trim())
    .filter(Boolean),
);
