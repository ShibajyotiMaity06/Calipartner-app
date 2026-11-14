import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, space, radius, avatarLayout } from '@calipartner/ui';
import { avatarProgress } from '@calipartner/core';
import { useAvatar } from '@/hooks/useAvatar';
import { AvatarPage } from '@/components/avatar/AvatarPage';
import { AvatarView } from '@/components/avatar/AvatarView';
import { t, type TranslationKey } from '@/i18n';
export default function AvatarProgressScreen() {
  const { state } = useAvatar();
  const { colors } = useTheme();
  const profile = state?.profile;
  const progress =
    profile && state ? avatarProgress(profile.xp, state.levels, state.config.level_cap) : null;
  return (
    <AvatarPage title={t('avatar.progress')}>
      {state && profile && progress ? (
        <>
          <AvatarView profile={profile} products={state.products} tints={state.tints} />
          <Text variant="title2">
            {t('avatar.level', { level: profile.level, form: profile.form })}
          </Text>
          <Text tabular>{t('avatar.xp', { xp: profile.xp })}</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}
            style={[styles.track, { backgroundColor: colors.s3 }]}
          >
            <View
              style={[
                styles.fill,
                { backgroundColor: colors.apricot, width: `${progress.fraction * 100}%` },
              ]}
            />
          </View>
          <Text>
            {progress.next
              ? t('avatar.nextLevel', {
                  xp: progress.next.xp_required - profile.xp,
                  level: progress.next.level,
                })
              : t('avatar.banked')}
          </Text>
          <Text variant="heading">{t('avatar.starterPath')}</Text>
          <Text>{t('avatar.starterExpires')}</Text>
          <Text tabular>
            {t('avatar.starterDone', {
              done: state.starter_progress.length,
              total: state.config.starter_path.length,
            })}
          </Text>
          {state.config.starter_path.map((step) => (
            <View
              key={step.key}
              style={[styles.step, { backgroundColor: colors.s1, borderColor: colors.hairline }]}
            >
              <Text>{t(`avatar.starter_${step.key}` as TranslationKey)}</Text>
              <Text tabular>
                {t(state.starter_progress.includes(step.key) ? 'avatar.owned' : 'avatar.price', {
                  amount: step.cc,
                })}
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text>{t('avatar.notCreated')}</Text>
      )}
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  track: { height: space[2], borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%' },
  step: {
    padding: space[4],
    borderWidth: avatarLayout.borderWidth,
    borderRadius: radius.card,
    gap: space[2],
  },
});
