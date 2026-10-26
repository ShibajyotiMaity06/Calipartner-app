import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type {
  FriendAction,
  FriendInbox,
  SocialProfile,
  SocialProfileDraft,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import {
  flushSocialOutbox,
  loadFriendInbox,
  loadSocialProfile,
  searchSocialProfiles,
  saveSocialProfile,
  queueFriendRequest,
  queueFriendAction,
  queueSocialBlock,
  queueSocialReport,
  dismissSocialFailure,
  socialOutbox,
  type SocialOutboxItem,
  type SocialDb,
} from '@/services/friendsService';

export function useFriends({ profileOnly = false }: { profileOnly?: boolean } = {}) {
  const { user, profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const id = user?.id;
  const owner = useRef(id);
  owner.current = id;
  const [dataOwner, setDataOwner] = useState<string | null>(null);
  const [inbox, setInbox] = useState<FriendInbox | null>(null);
  const [ownProfile, setOwnProfile] = useState<SocialProfile | null>(null);
  const [results, setResults] = useState<SocialProfile[]>([]);
  const [selected, setSelected] = useState<SocialProfile | null>(null);
  const [outbox, setOutbox] = useState<SocialOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const searchVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const db = await getDb();
      const client = getSupabase();
      if (isOnline) await flushSocialOutbox(db, client, id);
      const [friends, me] = await Promise.allSettled([
        profileOnly ? Promise.resolve(null) : loadFriendInbox(db, client, id, Boolean(isOnline)),
        loadSocialProfile(db, client, id, id, Boolean(isOnline)),
      ]);
      if (owner.current !== id) return;
      const pending = await socialOutbox(db, id);
      if (owner.current !== id) return;
      setDataOwner(id);
      setOutbox(pending);
      if (friends.status === 'fulfilled' && friends.value) {
        setInbox(friends.value.data);
        setCached(friends.value.cached);
        setError(null);
      } else if (friends.status === 'rejected') {
        setError(friends.reason instanceof Error ? friends.reason.message : String(friends.reason));
        setCached(true);
      } else {
        setError(null);
      }
      if (me.status === 'fulfilled') setOwnProfile(me.value.data);
      else if (profile)
        setOwnProfile({
          id,
          username: profile.username,
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
          bio: '',
          training_style: '',
          instagram_handle: '',
          website_url: '',
          is_public: false,
          relationship: 'self',
          request_id: null,
        });
    } catch (e) {
      if (owner.current === id) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (owner.current === id) setLoading(false);
    }
  }, [id, isOnline, profile, profileOnly]);
  useEffect(() => {
    setInbox(null);
    setOwnProfile(null);
    setResults([]);
    setSelected(null);
    setOutbox([]);
    setError(null);
    setLoading(true);
    setBusy(false);
    searchVersion.current++;
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const search = async (query: string) => {
    if (!id) return;
    const version = ++searchVersion.current;
    setSearching(true);
    setError(null);
    try {
      const result = await searchSocialProfiles(
        await getDb(),
        getSupabase(),
        id,
        query,
        Boolean(isOnline),
      );
      if (owner.current === id && version === searchVersion.current) {
        setResults(result.data);
        setCached(result.cached);
      }
    } catch (e) {
      if (owner.current === id && version === searchVersion.current) {
        setResults([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (owner.current === id && version === searchVersion.current) setSearching(false);
    }
  };
  const openProfile = async (person: SocialProfile) => {
    if (!id) return;
    setError(null);
    // Search and inbox results already contain only the allowed projection.
    setSelected(person);
    try {
      const result = await loadSocialProfile(
        await getDb(),
        getSupabase(),
        id,
        person.id,
        Boolean(isOnline),
      );
      if (owner.current === id)
        setSelected((current) => (current?.id === person.id ? result.data : current));
    } catch (e) {
      if (
        owner.current === id &&
        e instanceof Error &&
        /PROFILE_UNAVAILABLE|NOT_AUTHORIZED/.test(e.message)
      ) {
        setSelected((current) => (current?.id === person.id ? null : current));
        setError(e.message);
      }
    }
  };
  const perform = async (
    operation: (db: SocialDb, actor: string) => Promise<unknown>,
    target?: string,
  ) => {
    if (!id || acting.current) return false;
    acting.current = true;
    setBusy(true);
    setError(null);
    try {
      const db = await getDb();
      await operation(db, id);
      if (isOnline) await flushSocialOutbox(db, getSupabase(), id);
      if (owner.current !== id) return false;
      await refresh();
      if (target && isOnline) {
        try {
          const latest = await loadSocialProfile(db, getSupabase(), id, target, true);
          if (owner.current === id)
            setSelected((current) => (current?.id === target ? latest.data : current));
        } catch {
          if (owner.current === id) setSelected(null);
        }
      }
      return true;
    } catch (e) {
      if (owner.current === id) setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      acting.current = false;
      if (owner.current === id) setBusy(false);
    }
  };
  return {
    signedIn: Boolean(id),
    inbox: dataOwner === id ? inbox : null,
    ownProfile: dataOwner === id ? ownProfile : null,
    results: dataOwner === id ? results : [],
    selected: dataOwner === id ? selected : null,
    outbox: dataOwner === id ? outbox : [],
    loading: loading || Boolean(id && dataOwner !== id),
    searching,
    busy,
    cached,
    error,
    isOnline,
    refresh,
    search,
    openProfile,
    closeProfile: () => setSelected(null),
    send: (target: string) => perform((db, actor) => queueFriendRequest(db, actor, target), target),
    respond: (request: string, action: FriendAction, target: string) =>
      perform((db, actor) => queueFriendAction(db, actor, request, action), target),
    save: (draft: SocialProfileDraft) =>
      ownProfile
        ? perform((db, actor) => saveSocialProfile(db, actor, ownProfile, draft))
        : Promise.resolve(false),
    block: async (target: string) => {
      const result = await perform((db, actor) => queueSocialBlock(db, actor, target), target);
      if (owner.current === id) {
        setSelected(null);
        setResults((current) => current.filter((person) => person.id !== target));
      }
      return result;
    },
    report: (target: string, reason: string, details?: string) =>
      perform((db, actor) => queueSocialReport(db, actor, target, reason, details)),
    dismiss: (operationId: string) =>
      perform((db, actor) => dismissSocialFailure(db, actor, operationId)),
  };
}
