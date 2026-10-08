import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  isDisposableEmail,
  type CreateProfileInput,
  type Profile,
  type UpdateProfileInput,
} from '@calipartner/core';
import { getDb } from '@/db';
import { createLogger } from '@/lib/logger';
import { getSupabase } from '@/lib/supabase';
import { migrateGuestData } from '@/services/guestMigration';

const log = createLogger('auth-context');

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isGuest: boolean;
  needsProfileSetup: boolean;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  createProfile: (input: CreateProfileInput) => Promise<{ error: Error | null }>;
  updateProfile: (input: UpdateProfileInput) => Promise<{ error: Error | null }>;
  changeUsername: (newUsername: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        log.warn('Failed to fetch profile', error.message);
        setProfile(null);
        return;
      }
      setProfile((data as Profile) ?? null);
    } catch (e: unknown) {
      log.error('Error fetching profile', e instanceof Error ? e.message : String(e));
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          setIsGuest(false);
          await fetchProfile(session.user.id);
        }
      })
      .catch((err) => {
        log.warn('getSession error', String(err));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user?.id) {
        setIsGuest(false);
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithOtp = useCallback(async (email: string) => {
    const cleanEmail = email.trim();
    if (isDisposableEmail(cleanEmail)) {
      return { error: new Error('DISPOSABLE_EMAIL') };
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: 'email',
        });
        if (error) {
          return { error: new Error(error.message) };
        }
        if (data.user?.id) {
          setIsGuest(false);
          await fetchProfile(data.user.id);
        }
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [fetchProfile],
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'calipartner://auth/callback',
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'calipartner://auth/callback',
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (e) {
      log.warn('signOut error', String(e));
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsGuest(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (error) {
        return { error: new Error(error.message) };
      }
      await signOut();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [signOut]);

  const createProfile = useCallback(
    async (input: CreateProfileInput) => {
      if (!user?.id) {
        return { error: new Error('User not authenticated') };
      }

      try {
        const supabase = getSupabase();
        const profileRow = {
          id: user.id,
          username: input.username,
          nickname: input.nickname,
          avatar_url: input.avatar_url ?? null,
          date_of_birth: input.date_of_birth,
          sex: input.sex,
          height_cm: input.height_cm,
          units: input.units ?? 'metric',
          timezone: input.timezone ?? 'UTC',
          country: input.country ?? null,
          discoverable: input.discoverable ?? true,
        };

        const { error } = await supabase.from('profiles').insert(profileRow);
        if (error) {
          return { error: new Error(error.message) };
        }

        // Migrate local guest data if any
        try {
          const db = await getDb();
          const migrationResult = await migrateGuestData(db, user.id);
          log.info(
            'Guest migration completed',
            `migrated ${migrationResult.migratedCount} entries`,
          );
        } catch (migErr) {
          log.warn('Guest migration non-fatal warning', String(migErr));
        }

        await fetchProfile(user.id);
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [fetchProfile, user?.id],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!user?.id) {
        return { error: new Error('User not authenticated') };
      }

      try {
        const supabase = getSupabase();
        const { error } = await supabase.from('profiles').update(input).eq('id', user.id);

        if (error) {
          return { error: new Error(error.message) };
        }

        await fetchProfile(user.id);
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [fetchProfile, user?.id],
  );

  const changeUsername = useCallback(
    async (newUsername: string) => {
      if (!user?.id) {
        return { error: new Error('User not authenticated') };
      }

      try {
        const supabase = getSupabase();
        const { error } = await supabase
          .from('profiles')
          .update({ username: newUsername })
          .eq('id', user.id);

        if (error) {
          return { error: new Error(error.message) };
        }

        await fetchProfile(user.id);
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [fetchProfile, user?.id],
  );

  const needsProfileSetup = Boolean(user && !profile && !isLoading);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isGuest,
        needsProfileSetup,
        signInWithOtp,
        verifyOtp,
        signInWithGoogle,
        signInWithApple,
        continueAsGuest,
        signOut,
        deleteAccount,
        createProfile,
        updateProfile,
        changeUsername,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
