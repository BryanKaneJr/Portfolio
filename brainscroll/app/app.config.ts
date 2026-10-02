import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Adds native sign-in on top of app.json. Public ids only; secrets live in
 * Supabase (docs/supabase-setup.md). Without a Google iOS client id the Google
 * plugin is left out and the app simply doesn't offer Google on iOS: there is
 * never a guest fallback.
 *
 * With EXPO_PUBLIC_INVITE_DOMAIN (e.g. brainscroll.app), invite links are web
 * links (https://<domain>/invite/CODE) that open the app straight to the
 * invite: iOS Universal Links and Android App Links, verified by the files the
 * invite site serves (docs/invite-links.md).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  // The native Google SDK needs the reversed iOS client id as a URL scheme.
  const googleScheme = googleIos ? googleIos.split('.').reverse().join('.') : undefined;
  const inviteDomain = process.env.EXPO_PUBLIC_INVITE_DOMAIN || undefined;
  // Android push (social notifications) goes through Firebase: EAS provides the
  // google-services.json file as a file environment variable (docs/notifications.md).
  const googleServices = process.env.GOOGLE_SERVICES_JSON || undefined;
  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, usesAppleSignIn: true, ...(inviteDomain ? { associatedDomains: [`applinks:${inviteDomain}`] } : {}) },
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
      ...(inviteDomain
        ? { intentFilters: [{ action: 'VIEW', autoVerify: true, data: [{ scheme: 'https', host: inviteDomain, pathPrefix: '/invite/' }], category: ['BROWSABLE', 'DEFAULT'] }] }
        : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      'expo-apple-authentication',
      ...(googleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }] as [string, unknown]] : []),
      // Crash reporting's native setup, only when a Sentry DSN is configured (docs/release.md).
      ...(process.env.EXPO_PUBLIC_SENTRY_DSN ? ['@sentry/react-native/expo'] : []),
    ],
  };
};
