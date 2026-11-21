import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { requestCustomAvatar, type CustomAvatar } from '@/services/aiAvatarService';

export function useCustomAvatar(owner: string | undefined, avatarExists: boolean) {
  const { currentTier, hasPlan, entitlement } = useSubscription(owner);
  const hasPaidPro = Boolean(
    owner && entitlement?.user_id === owner && currentTier === 'pro' && hasPlan,
  );
  const activeOwner = hasPaidPro && avatarExists ? owner : undefined;
  const [result, setResult] = useState<{ owner: string; avatar: CustomAvatar }>();
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const acknowledge = useCallback(
    (avatar: CustomAvatar) => {
      if (activeOwner) {
        generation.current++;
        setResult({ owner: activeOwner, avatar });
      }
    },
    [activeOwner],
  );
  const avatar = activeOwner && result?.owner === activeOwner ? result.avatar : undefined;

  useEffect(() => {
    if (!activeOwner) {
      setResult(undefined);
      return;
    }
    const request = ++generation.current;
    let active = true;
    void requestCustomAvatar({ action: 'read' }).then(
      (value) => {
        if (active && request === generation.current)
          setResult(value ? { owner: activeOwner, avatar: value } : undefined);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [activeOwner, revision]);
  useEffect(() => {
    if (!avatar) return;
    const refreshTimer = setTimeout(
      refresh,
      Math.max(1000, avatar.expires_at - Date.now() - 10000),
    );
    const expiryTimer = setTimeout(
      () => {
        setResult((value) => (value?.avatar === avatar ? undefined : value));
      },
      Math.max(0, avatar.expires_at - Date.now()),
    );
    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(expiryTimer);
    };
  }, [avatar, refresh]);
  useEffect(() => {
    if (!activeOwner) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => listener.remove();
  }, [activeOwner, refresh]);

  return {
    hasPaidPro,
    customBase:
      avatar && avatar.expires_at > Date.now() ? { ...avatar, owner: activeOwner } : undefined,
    acknowledge,
  };
}
