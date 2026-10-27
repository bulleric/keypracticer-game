import { Redirect } from 'expo-router';

/** Phones come back here after signing in with Google or Apple in the browser. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
