import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, challengeLayout, dark } from '@calipartner/ui';
import type { ChallengeCatalog } from '@calipartner/core';
import { challengeText, ct } from '@/i18n/challenges';
import { t } from '@/i18n';
import { CButton, CSheet, cs } from './ChallengeUI';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { sendChatMessage } from '@/services/chatService';
import { generateClientUuid } from '@/services/foodService';

export function BadgeShelf({
  catalog,
  userId,
  onClose,
}: {
  catalog: ChallengeCatalog;
  userId: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ChallengeCatalog['badges'][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(new Map<string, string>());
  const lock = useRef(false);
  const share = async (roomId: string) => {
    if (!selected?.earned || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    const key = `${selected.id}:${roomId}`;
    if (!pending.current.has(key)) pending.current.set(key, generateClientUuid());
    try {
      await sendChatMessage(getSupabase(), await getDb(), roomId, userId, {
        clientId: pending.current.get(key),
        text: t('homeRefresh.badgeShareText', { badge: challengeText(catalog, selected.text_key) }),
      });
      setShared(true);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <CSheet visible title={ct('trophies')} onClose={onClose} testID="challenge-trophy-shelf">
      {!catalog.badges.length && <Text style={cs.body}>{ct('noBadges')}</Text>}
      {selected ? (
        <View style={cs.card} testID="badge-share-preview">
          <Text style={cs.heading}>{challengeText(catalog, selected.text_key)}</Text>
          <Text>{ct('earned', { count: selected.earned })}</Text>
          <Text>{t('homeRefresh.badgeSharePrompt')}</Text>
          {!catalog.rooms.length && <Text>{t('homeRefresh.noSquads')}</Text>}
          {catalog.rooms.map((room) => (
            <CButton
              key={room.id}
              label={room.name}
              disabled={busy || shared}
              onPress={() => void share(room.id)}
              testID={`badge-share-room-${room.id}`}
            />
          ))}
          {shared && <Text accessibilityLiveRegion="polite">{t('homeRefresh.badgeShared')}</Text>}
          {error && <Text accessibilityRole="alert">{t('homeRefresh.mealActionError')}</Text>}
          <CButton
            label={t('repairs.back')}
            disabled={busy}
            onPress={() => setSelected(null)}
            testID="badge-share-back"
          />
        </View>
      ) : (
        catalog.badges.map((badge) => (
          <Pressable
            key={badge.id}
            style={cs.card}
            accessibilityRole="button"
            accessibilityLabel={challengeText(catalog, badge.text_key)}
            accessibilityState={{ disabled: badge.earned === 0 }}
            disabled={badge.earned === 0}
            onPress={() => {
              setSelected(badge);
              setShared(false);
              setError(false);
            }}
            testID={`badge-${badge.id}`}
          >
            <View style={cs.row}>
              <Ionicons
                name={badge.earned ? 'trophy-outline' : 'lock-closed-outline'}
                size={challengeLayout.icon}
                color={badge.earned ? dark.copper : dark.textLo}
              />
              <Text style={cs.heading}>{challengeText(catalog, badge.text_key)}</Text>
            </View>
            <Text style={cs.small}>
              {badge.earned ? ct('earned', { count: badge.earned }) : t('homeRefresh.badgeLocked')}
            </Text>
            {!badge.earned && (
              <>
                <Text>
                  {t(
                    badge.rule?.duration_min
                      ? 'homeRefresh.badgeDuration'
                      : badge.rule?.cover_used
                        ? 'homeRefresh.badgeCover'
                        : badge.rule?.season
                          ? 'homeRefresh.badgeSeason'
                          : 'homeRefresh.badgeComplete',
                    { days: badge.rule?.duration_min ?? 0 },
                  )}
                </Text>
                {badge.plan_required !== 'free' && <Text>{t('homeRefresh.badgePaid')}</Text>}
              </>
            )}
          </Pressable>
        ))
      )}
    </CSheet>
  );
}
