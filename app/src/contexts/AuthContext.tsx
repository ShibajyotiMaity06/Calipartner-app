import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import {
  isDisposableEmail,
  type CreateProfileInput,
  type Profile,
  type UpdateProfileInput,
} from '@calipartner/core';
import { getDb } from '@/db';
import { createLogger } from '@/lib/logger';
import { AUTH_STORAGE_KEY, getSupabase, sessionStorage } from '@/lib/supabase';
import { secureStoreAdapter } from '@/lib/secureStore';
import { readOfflineSession } from '@/services/sessionPersistence';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { migrateGuestData } from '@/services/guestMigration';

const log = createLogger('auth-context');

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isGuest: boolean;
  needsProfileSetup: boolean;
  profileError: string | null;
  signInWithOtp: (email: string, shouldCreateUser?: boolean) => Promise<{ error: Error | null }>;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [profileCheckedUserId, setProfileCheckedUserId] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const { isOnline } = useNetworkStatus();

  const fetchProfile = useCallback(async (userId: string) => {
    const cacheKey = `calipartner.profile.${userId}`;
    setProfileError(null);
    try {
      const cached = await secureStoreAdapter.getItem(cacheKey);
      if (activeUserId.current !== userId) return;
      if (cached) setProfile(JSON.parse(cached) as Profile);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (activeUserId.current === userId) setProfileError(error.message);
        log.warn('Failed to fetch profile', error.message);
        return;
      }
      if (activeUserId.current !== userId) return;
      setProfile((data as Profile) ?? null);
      setProfileCheckedUserId(userId);
      if (data) await secureStoreAdapter.setItem(cacheKey, JSON.stringify(data));
    } catch (e: unknown) {
      if (activeUserId.current === userId)
        setProfileError(e instanceof Error ? e.message : String(e));
      log.error('Error fetching profile', e instanceof Error ? e.message : String(e));
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

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      activeUserId.current = nextSession?.user.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession) setIsGuest(false);
      else setProfile(null);
      setIsLoading(false);
    };

    // Auth callbacks must finish synchronously. Database requests here can deadlock refresh.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (_event === 'INITIAL_SESSION') return; // restoreSession handles expired offline sessions.
      applySession(newSession);
    });

    const restoreSession = async () => {
      try {
        if (isOnline === false) {
          applySession(await readOfflineSession(sessionStorage, AUTH_STORAGE_KEY));
          return;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error && isAuthRetryableFetchError(error)) {
          applySession(await readOfflineSession(sessionStorage, AUTH_STORAGE_KEY));
        } else {
          applySession(data.session);
        }
      } catch (error) {
        log.warn('Session restore failed', error instanceof Error ? error.message : String(error));
        if (mounted) setIsLoading(false);
      }
    };
    void restoreSession();

    const handleAppState = (state: string) => {
      if (state === 'active') {
        // Checking storage also enforces the inactivity window after a long background period.
        void restoreSession();
        if (isOnline !== false) supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };
    const appStateListener =
      Platform.OS === 'web' ? null : AppState.addEventListener('change', handleAppState);
    if (Platform.OS !== 'web' && AppState.currentState === 'active' && isOnline !== false) {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      appStateListener?.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, [isOnline]);

  useEffect(() => {
    setProfile(null);
    setProfileCheckedUserId(null);
    if (user?.id) void fetchProfile(user.id);
  }, [fetchProfile, user?.id]);

  const signInWithOtp = useCallback(async (email: string, shouldCreateUser = false) => {
    const cleanEmail = email.trim();
    if (isDisposableEmail(cleanEmail)) {
      return { error: new Error('DISPOSABLE_EMAIL') };
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser,
        },
      });
      if (error) {
        const rawMsg = error.message || '';
        if (
          rawMsg.toLowerCase().includes('security purposes') ||
          rawMsg.toLowerCase().includes('rate limit') ||
          rawMsg.toLowerCase().includes('seconds')
        ) {
          const match = rawMsg.match(/(\d+)\s*sec/i);
          const parsedSecs = match && match[1] ? parseInt(match[1], 10) : 30;
          const cappedSecs = Math.min(30, Math.max(5, parsedSecs));
          return { error: new Error(`Retry after ${cappedSecs} seconds`) };
        }
        return { error: new Error(rawMsg) };
      }
      return { error: null };
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
      const browserOrigin =
        typeof globalThis !== 'undefined' && 'window' in globalThis
          ? (globalThis as unknown as { window: { location: { origin: string } } }).window?.location
              ?.origin
          : undefined;
      const redirectTo =
        Platform.OS === 'web'
          ? browserOrigin
            ? `${browserOrigin}/`
            : undefined
          : 'calipartner://auth/callback';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
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
      const browserOrigin =
        typeof globalThis !== 'undefined' && 'window' in globalThis
          ? (globalThis as unknown as { window: { location: { origin: string } } }).window?.location
              ?.origin
          : undefined;
      const redirectTo =
        Platform.OS === 'web'
          ? browserOrigin
            ? `${browserOrigin}/`
            : undefined
          : 'calipartner://auth/callback';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
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
      activeUserId.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsGuest(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (error) {
        return { error: new Error(error.message) };
      }
      if (data && data.success === false) {
        return { error: new Error(data.error || 'Failed to delete account') };
      }

      // Wipe all on-device SQLite database records and caches (H21 fix)
      if (user?.id) await secureStoreAdapter.removeItem(`calipartner.profile.${user.id}`);
      try {
        const { clearAllLocalData } = await import('@/db');
        await clearAllLocalData();
      } catch (dbErr) {
        log.warn('clearAllLocalData error during deletion:', String(dbErr));
      }

      await signOut();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [signOut, user?.id]);

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
          place: input.place?.trim() || null,
          discoverable: input.discoverable ?? true,
        };

        const { error } = await supabase.from('profiles').upsert(profileRow);
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
      // Optimistically apply update to in-memory profile
      setProfile((prev) => (prev ? { ...prev, ...input } : null));

      if (!user?.id) {
        return { error: new Error('User not authenticated') };
      }

      try {
        const supabase = getSupabase();
        const { error } = await supabase.from('profiles').update(input).eq('id', user.id);

        if (error) {
          log.warn('updateProfile error:', error.message);
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

  const needsProfileSetup = Boolean(
    user && !profile && profileCheckedUserId === user.id && !isLoading,
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isGuest,
        needsProfileSetup,
        profileError,
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
