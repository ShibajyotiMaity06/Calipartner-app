import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Sheet,
  Text,
  homeLayout,
  radius,
  space,
  type as typeTokens,
} from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFasting } from '@/hooks/useFasting';
import { t } from '@/i18n';
import { FastingTimerModal } from './FastingTimerModal';
import { FastingProgressRing } from './FastingProgressRing';

export interface FastingCardProps {
  testID?: string;
}

export function FastingCard({ testID = 'fasting-card' }: FastingCardProps) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const { user } = useAuth();
  const userId = user?.id ?? '';

  const {
    settings,
    activeSession,
    computedState,
    scheduledState,
    gating,
    hasPaidAccess,
    loading,
    error,
    startFast,
    endFast,
  } = useFasting({
    userId,
  });

  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (loading || (!activeSession && (!settings.enabled || !gating.canAccess || !hasPaidAccess))) {
    return null;
  }

  const isFasting = Boolean(activeSession && computedState.isActive);
  const plannedHours = Math.round((computedState.session?.planned_minutes || 960) / 60);
  const elapsedHours = Math.floor(computedState.elapsedMinutes / 60);
  const elapsedMinutes = computedState.elapsedMinutes % 60;
  const elapsedText = t('homeRefresh.fastingElapsed', {
    hours: elapsedHours,
    minutes: elapsedMinutes,
  });

  const remainingHours = Math.floor(computedState.remainingMinutes / 60);
  const remainingMinutes = computedState.remainingMinutes % 60;

  const nextTransitionText = isFasting
    ? computedState.isCompleted
      ? t('homeRefresh.fastingTargetReached')
      : t('homeRefresh.fastingRemaining', { hours: remainingHours, minutes: remainingMinutes })
    : scheduledState.isEatingWindow
      ? t('fasting.fastStartsAt', { time: settings.eating_window_end || '20:00' })
      : t('fasting.eatingWindowOpensAt', { time: settings.eating_window_start || '12:00' });

  const handleQuickToggle = async () => {
    try {
      setBusy(true);
      if (isFasting) {
        await endFast();
      } else {
        await startFast();
      }
    } catch {
      // The hook exposes its request error beside the action.
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = () => {
    if (!isFasting) {
      void handleQuickToggle();
      return;
    }
    setConfirmEnd(true);
  };

  return (
    <>
      <Pressable
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setTimerModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('fasting.title')}: ${isFasting ? t('fasting.fastingState') : t('fasting.eatingWindowState')}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View
              style={[styles.statusDot, { backgroundColor: isFasting ? dark.iris : dark.teal }]}
            />
            <Text style={styles.cardTitle}>{t('fasting.title')}</Text>
            <View style={styles.protocolBadge}>
              <Text style={styles.protocolBadgeText}>{settings.protocol.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>
              {isFasting ? t('fasting.fastingState') : t('fasting.eatingWindowState')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {isFasting && <FastingProgressRing percent={computedState.progressPercentage} />}
          <View style={styles.timeInfo}>
            <Text style={styles.elapsedText} testID="fasting-card-elapsed">
              {isFasting ? elapsedText : t('fasting.eatingWindowState')}
            </Text>
            <Text style={styles.targetSubtext} testID="fasting-card-target">
              {isFasting ? t('fasting.ofHours', { hours: plannedHours }) : nextTransitionText}
            </Text>
          </View>

          <Pressable
            testID="button-fasting-card-action"
            style={({ pressed }) => [
              styles.quickActionButton,
              pressed && styles.cardPressed,
              busy && styles.buttonDisabled,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              confirmToggle();
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={isFasting ? t('fasting.endFast') : t('fasting.startFast')}
          >
            <Text style={styles.quickActionText}>
              {busy ? '…' : isFasting ? t('fasting.endFast') : t('fasting.startFast')}
            </Text>
          </Pressable>
        </View>

        {isFasting && (
          <Text variant="micro" color={dark.textMid}>
            {t(
              computedState.isCompleted
                ? 'homeRefresh.fastingPlannedCheckpoint'
                : computedState.progressPercentage >= 50
                  ? 'homeRefresh.fastingHalfCheckpoint'
                  : 'homeRefresh.fastingStartedCheckpoint',
            )}
          </Text>
        )}

        {error && <Text accessibilityRole="alert">{t('homeRefresh.fastingSaveError')}</Text>}
      </Pressable>

      <Sheet
        visible={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        snapPoint="half"
        accessibilityLabel={t('fasting.endFast')}
      >
        <View style={{ padding: space[3], gap: space[3] }}>
          <Text>{t('homeRefresh.endFastConfirm')}</Text>
          <Button
            variant="secondary"
            label={t('fasting.endFast')}
            disabled={busy}
            onPress={() => {
              setConfirmEnd(false);
              void handleQuickToggle();
            }}
            testID="fasting-card-confirm-end"
          />
          <Button
            variant="tertiary"
            label={t('common.cancel')}
            onPress={() => setConfirmEnd(false)}
            testID="fasting-card-cancel-end"
          />
        </View>
      </Sheet>

      <FastingTimerModal
        visible={timerModalVisible}
        onClose={() => setTimerModalVisible(false)}
        userId={userId}
      />
    </>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: dark.s1,
      borderRadius: radius.card,
      padding: space[3],
      borderWidth: 1,
      borderColor: dark.hairline,
      marginBottom: space[2],
    },
    cardPressed: {
      opacity: 0.88,
    },
    cardHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[2],
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: space[2],
    },
    titleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space[1],
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    cardTitle: {
      fontSize: typeTokens.body.fontSize,
      fontFamily: typeTokens.body.fontFamily,
      fontWeight: '700',
      color: dark.textHi,
    },
    protocolBadge: {
      backgroundColor: dark.s2,
      paddingHorizontal: space[1],
      paddingVertical: 1,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: dark.hairline,
    },
    protocolBadgeText: {
      fontSize: 10,
      fontFamily: typeTokens.label.fontFamily,
      color: dark.textLo,
    },
    stateBadge: {
      paddingHorizontal: space[1],
      paddingVertical: 2,
      backgroundColor: dark.s2,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: dark.hairline,
    },
    stateBadgeText: {
      fontSize: 11,
      fontFamily: typeTokens.label.fontFamily,
      color: dark.textMid,
    },
    cardBody: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[2],
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timeInfo: {
      flex: 1,
      minWidth: homeLayout.ringSize,
    },
    elapsedText: {
      fontSize: typeTokens.numeralM.fontSize,
      fontFamily: typeTokens.numeralM.fontFamily,
      fontWeight: '700',
      color: dark.textHi,
      fontVariant: ['tabular-nums'],
    },
    targetSubtext: {
      fontSize: typeTokens.bodyS.fontSize,
      fontFamily: typeTokens.bodyS.fontFamily,
      color: dark.textMid,
      marginTop: 2,
    },
    quickActionButton: {
      minHeight: 44,
      paddingHorizontal: space[3],
      backgroundColor: dark.apricot,
      borderRadius: radius.button,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActionText: {
      fontSize: typeTokens.bodyS.fontSize,
      fontFamily: typeTokens.bodyS.fontFamily,
      fontWeight: '700',
      color: dark.onBrand,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
