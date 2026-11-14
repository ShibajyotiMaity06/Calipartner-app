import React, { useCallback, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Text, useTheme, space, radius, avatarLayout } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { claimAvatarDrop } from '@/services/avatarService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { AvatarView } from './AvatarView';
import { avatarProgress } from '@calipartner/core';

export function AvatarHero({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { state, loading, error, refresh, acknowledge } = useAvatar();
  const router = useRouter();
  const { colors } = useTheme();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const busy = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  if (!user) return null;
  if (loading && !state) return <Text>{t('common.loading')}</Text>;
  if (error && !state)
    return (
      <Button
        variant="secondary"
        label={t('avatar.retry')}
        onPress={() => void refresh()}
        testID="avatar-hero-retry"
      />
    );
  if (!state?.enabled) return null;
  const profile = state.profile;
  const progress = profile
    ? avatarProgress(profile.xp, state.levels, state.config.level_cap)
    : null;
  const claim = async () => {
    if (busy.current) return;
    busy.current = true;
    setClaiming(true);
    setClaimError(false);
    try {
      acknowledge(await claimAvatarDrop(getSupabase()));
    } catch {
      setClaimError(true);
    } finally {
      busy.current = false;
      setClaiming(false);
    }
  };
  return (
    <View
      style={[styles.card, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
      testID={compact ? 'you-avatar' : 'home-avatar-hero'}
    >
      <View style={styles.row}>
        {profile ? (
          <View style={styles.art}>
            <AvatarView
              profile={profile}
              products={state.products}
              tints={state.tints}
              height={avatarLayout.heroHeight}
            />
          </View>
        ) : null}
        <View style={styles.info}>
          <Text variant="heading">{t('avatar.title')}</Text>
          {profile ? (
            <>
              <Text variant="bodyS" tabular>
                {t('avatar.level', { level: profile.level, form: profile.form })}
              </Text>
              <Text variant="label" tabular>
                {t('avatar.xp', { xp: profile.xp })}
              </Text>
              <View
                style={[styles.track, { backgroundColor: colors.s3 }]}
                accessibilityRole="progressbar"
                accessibilityLabel={t('avatar.progress')}
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round((progress?.fraction ?? 0) * 100),
                }}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${(progress?.fraction ?? 0) * 100}%`,
                      backgroundColor: colors.apricot,
                    },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text variant="bodyS">{t('avatar.notCreated')}</Text>
          )}
          <Button
            variant="secondary"
            size="sm"
            label={t('avatar.cc', { amount: state.balances.earned + state.balances.purchased })}
            onPress={() => router.push('/wallet')}
            testID="avatar-cc-chip"
          />
          <Button
            size="sm"
            label={t(profile ? 'avatar.customize' : 'avatar.create')}
            onPress={() => router.push(profile ? '/avatar' : '/avatar/create')}
            testID="avatar-customize"
          />
        </View>
      </View>
      {profile && !compact ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={!state.daily_drop.available || state.daily_drop.claimed}
          loading={claiming}
          label={t(
            state.daily_drop.claimed
              ? 'avatar.dropClaimed'
              : state.daily_drop.available
                ? 'avatar.dailyDrop'
                : 'avatar.dropLocked',
            { amount: state.daily_drop.amount },
          )}
          onPress={() => void claim()}
          testID="avatar-daily-drop"
        />
      ) : null}
      {claimError ? <Text accessibilityRole="alert">{t('avatar.purchaseError')}</Text> : null}
      {profile && !compact && state.starter_active ? (
        <Button
          variant="tertiary"
          size="sm"
          label={t('avatar.starterDone', {
            done: state.starter_progress.length,
            total: state.config.starter_path.length,
          })}
          onPress={() => router.push('/avatar/progress')}
          testID="home-starter-path"
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: avatarLayout.borderWidth,
    padding: space[3],
    gap: space[2],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  art: { flex: 1 },
  info: { flex: 1, gap: space[2] },
  track: { height: space[2], borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%' },
});
