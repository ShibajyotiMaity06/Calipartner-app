import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text } from '@calipartner/ui';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  LockIcon,
  borders,
  colors,
  fonts,
  radius,
  space,
} from '@calipartner/ui/v1';
import { isFeatureAllowed } from '@calipartner/core';
import { useSubscription } from '@/hooks/useSubscription';
import { PhotoVault } from '@/components/trackers/ProgressPhotosModal';
import { LoadingState } from '@/components/LoadingState';
import { t } from '@/i18n';

const PHOTO_FEATURES = [
  'progressV1.photosFeature1',
  'progressV1.photosFeature2',
  'progressV1.photosFeature3',
] as const;

export function ProgressPhotosView({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const { currentTier, hasActiveAccess, loading, error, refresh } = useSubscription();
  const router = useRouter();
  if (loading && !hasActiveAccess) return <LoadingState />;
  if (error && !hasActiveAccess)
    return (
      <Button
        variant="secondary"
        label={t('common.retry')}
        onPress={() => void refresh()}
        testID="photos-access-retry"
      />
    );
  if (!isFeatureAllowed('progress_photos', hasActiveAccess ? currentTier : 'free')) {
    return (
      <View style={[styles.lockedCardSurface, styles.lockedCard]} testID="progress-photos-locked">
        <View style={styles.silhouettesWrap}>
          <View style={styles.silhouetteBox}>
            <View style={styles.silHead} />
            <View style={styles.silShoulders} />
            <View style={styles.labelPill}>
              <Text style={styles.pillText}>{t('progressV1.photosBefore')}</Text>
            </View>
          </View>

          <View style={styles.silhouetteBox}>
            <View style={styles.silHead} />
            <View style={styles.silShoulders} />
            <View style={styles.labelPill}>
              <Text style={styles.pillText}>{t('progressV1.photosNow')}</Text>
            </View>
          </View>

          <View style={styles.lockMedallion}>
            <LockIcon size={18} color={colors.apricot} />
          </View>
        </View>

        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>{t('onboardingV1.paywallColPro')}</Text>
        </View>

        <Text style={styles.title}>
          <Text style={styles.titleBase}>{t('progressV1.photosTitleLead')}</Text>
          <Text style={styles.titleAccent}>{t('progressV1.photosTitleAccent')}</Text>
        </Text>

        <Text style={styles.bodyText}>{t('progressV1.photosBody')}</Text>

        <View style={styles.featuresList}>
          {PHOTO_FEATURES.map((key) => (
            <View key={key} style={styles.featureRow}>
              <CheckCircleIcon size={16} color={colors.apricot} />
              <Text style={[styles.featureText, styles.flexOne]}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Button
          variant="primary"
          label={t('progressV1.unlockWithPro')}
          icon={<ArrowRightIcon size={18} color={colors.onBrand} />}
          onPress={() => router.push('/paywall')}
          testID="progress-photos-upgrade"
        />
      </View>
    );
  }
  return (
    <PhotoVault
      embedded
      visible
      startDate={startDate}
      endDate={endDate}
      onClose={() => {}}
      testID="progress-photo-vault"
    />
  );
}

const styles = StyleSheet.create({
  lockedCardSurface: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
  },
  lockedCard: {
    padding: space.lg,
    gap: space.md,
  },
  silhouettesWrap: {
    flexDirection: 'row',
    gap: space.sm + 2,
    position: 'relative',
  },
  silhouetteBox: {
    flex: 1,
    height: 156,
    borderRadius: radius.optionCard,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  silHead: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.s3,
    marginBottom: space.md,
  },
  silShoulders: {
    width: 94,
    height: 70,
    borderTopLeftRadius: radius.tabBar,
    borderTopRightRadius: radius.tabBar,
    backgroundColor: colors.s3,
    position: 'absolute',
    bottom: -14,
  },
  labelPill: {
    position: 'absolute',
    left: space.sm + 2,
    bottom: space.sm + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMid,
  },
  lockMedallion: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    backgroundColor: colors.apricot,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  proBadgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: colors.onBrand,
  },
  title: {
    marginTop: space.xs,
  },
  titleBase: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    color: colors.textHi,
    letterSpacing: -0.6,
  },
  titleAccent: {
    fontFamily: fonts.displayItalic,
    fontSize: 28,
    lineHeight: 33,
    color: colors.apricot,
    letterSpacing: -0.6,
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMid,
  },
  featuresList: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  featureText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMid,
  },
  flexOne: {
    flex: 1,
  },
});
