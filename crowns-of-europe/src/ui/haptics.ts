/** A light tap on the phone (never on the web): on selections and on every order that goes through. */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function buzz() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}
