/** Unknown paths (for example the web build served from a sub-path) go to the title screen. */
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/" />;
}
