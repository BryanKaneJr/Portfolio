import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Adds native sign-in on top of app.json. Public ids only; secrets live in
 * Supabase (docs/supabase-setup.md). Without a Google iOS client id the Google
 * plugin is left out and the app simply doesn't offer Google on iOS: there is
 * never a guest fallback.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  // The native Google SDK needs the reversed iOS client id as a URL scheme.
  const googleScheme = googleIos ? googleIos.split('.').reverse().join('.') : undefined;
  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, usesAppleSignIn: true },
    plugins: [
      ...(config.plugins ?? []),
      'expo-apple-authentication',
      ...(googleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }] as [string, unknown]] : []),
    ],
  };
};
