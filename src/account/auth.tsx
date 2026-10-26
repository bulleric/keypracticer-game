import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'apple' | 'google';

interface AuthCtx {
  /** False when this build has no Supabase project: guest play only. */
  enabled: boolean;
  session: Session | null;
  email: string | null;
  name: string | null;
  loading: boolean;
  /** Sends a 6 digit code to the email. */
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  signInWith(provider: Provider): Promise<void>;
  signOut(): Promise<void>;
  /** Deletes the account and everything saved in it (not this device's progress). */
  deleteAccount(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function fail(e: { message: string } | null) {
  if (e) throw new Error(friendly(e.message));
}

/** Supabase messages, in words a player understands. */
export function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('invalid') || m.includes('token')) return 'That code did not work. Check it, or send a new one.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many tries. Wait a minute, then try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  if (m.includes('email')) return 'That email address does not look right.';
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      enabled: !!supabase,
      session,
      email: session?.user.email ?? null,
      name: (session?.user.user_metadata?.full_name as string | undefined) ?? (session?.user.user_metadata?.name as string | undefined) ?? null,
      loading,
      async sendEmailCode(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
        fail(error);
      },
      async verifyEmailCode(email, code) {
        if (!supabase) return;
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        fail(error);
      },
      async signInWith(provider) {
        if (!supabase) return;
        if (provider === 'apple' && Platform.OS === 'ios') {
          // Native Sign in with Apple, as the App Store expects.
          const Apple = await import('expo-apple-authentication');
          const cred = await Apple.signInAsync({
            requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
          });
          if (!cred.identityToken) throw new Error('Apple did not return a sign-in token. Try again.');
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
          fail(error);
          return;
        }
        if (Platform.OS === 'web') {
          // The page goes to Google or Apple and comes back signed in.
          const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href } });
          fail(error);
          return;
        }
        const redirectTo = Linking.createURL('auth-callback');
        const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
        fail(error);
        if (!data?.url) return;
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') return; // cancelled: stay where we are
        const code = new URL(res.url).searchParams.get('code');
        if (!code) throw new Error('Sign-in was not finished. Try again.');
        const out = await supabase.auth.exchangeCodeForSession(code);
        fail(out.error);
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      async deleteAccount() {
        if (!supabase) return;
        const { error } = await supabase.rpc('delete_my_account');
        fail(error);
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
