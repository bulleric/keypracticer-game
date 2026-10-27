# Accounts and sign-up

The game works without an account: progress is saved on the device. Signing
in (Apple, Google, or a 6 digit code by email) saves it to Supabase so it is on
every device. When someone signs in, the device copy and the account copy are
merged, so nothing earned is lost (`mergeProgress` in `src/store/model.ts`).

Until the two environment variables below are set, the sign-up screens say
accounts are not switched on yet, and everything else works as a guest.

## 1. Create the Supabase project

1. Create a free project at https://supabase.com (pick an EU region).
2. SQL editor: paste and run `supabase/migrations/0001_profiles.sql`. It
   creates the `profiles` table (one row per player, row level security on) and
   the `delete_my_account` function used by "Delete account".
3. Project settings > API: copy the project URL and the `anon` public key into
   `.env` (see `.env.example`):

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   For EAS builds, add the same two values as EAS environment variables.

## 2. Email codes

Authentication > Providers > Email: on. Authentication > Email templates >
Magic link: make the email show the code, for example
`Your Keypracticer code: {{ .Token }}`. The app asks for the 6 digit code, so
it works the same on phones and the web.

## 3. Google

1. Google Cloud console > APIs and services > Credentials: create an OAuth
   client (type "Web application"). Authorised redirect URI:
   `https://xxxx.supabase.co/auth/v1/callback`.
2. Supabase > Authentication > Providers > Google: paste the client ID and
   secret.

## 4. Apple

Apple requires Sign in with Apple in iOS apps that offer Google sign-in.

1. Apple developer account > Identifiers: enable "Sign in with Apple" for
   `de.sidibe.keypracticergame`.
2. For the web and Android: create a Services ID and a key, as described in
   https://supabase.com/docs/guides/auth/social-login/auth-apple, and paste them
   into Supabase > Authentication > Providers > Apple.
3. On iPhone the app uses the native Apple sheet (`expo-apple-authentication`);
   add `de.sidibe.keypracticergame` to the Apple provider's client IDs in
   Supabase.

## 5. Redirect URLs

Supabase > Authentication > URL configuration > Redirect URLs, add:

- `keypracticer-game://auth-callback` (phones)
- your web address, for example `https://game.keypracticer.com/**`
- `http://localhost:8081/**` for local development

## What is stored

`profiles.data` holds the game profile: stars and best scores per lesson,
lesson steps done, badges, streak, practice minutes, onboarding answers and
settings. Mic audio is never stored or sent.
