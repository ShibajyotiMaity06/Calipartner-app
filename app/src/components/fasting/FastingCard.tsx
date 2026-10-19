import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFasting } from '@/hooks/useFasting';
import { t } from '@/i18n';
import { FastingTimerModal } from './FastingTimerModal';

export interface FastingCardProps {
  testID?: string;
}

export function FastingCard({ testID = 'fasting-card' }: FastingCardProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const {
    settings,
    activeSession,
    computedState,
    scheduledState,
    gating,
    loading,
    startFast,
    endFast,
  } = useFasting({
    userId,
    age: 25,
    healthScreening: null,
  });

  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || !settings.enabled || !gating.canAccess) {
    return null;
  }

  const isFasting = Boolean(activeSession && computedState.isActive);
  const plannedHours = Math.round((computedState.session?.planned_minutes || 960) / 60);
  const elapsedHours = Math.floor(computedState.elapsedMinutes / 60);
  const elapsedMinutes = computedState.elapsedMinutes % 60;
  const elapsedText = `${elapsedHours}h ${elapsedMinutes}m`;

  const remainingHours = Math.floor(computedState.remainingMinutes / 60);
  const remainingMinutes = computedState.remainingMinutes % 60;

  const nextTransitionText = isFasting
    ? computedState.isCompleted
      ? 'Target reached'
      : `${remainingHours}h ${remainingMinutes}m remaining`
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
      // Handled in hook
    } finally {
      setBusy(false);
    }
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
              style={[
                styles.statusDot,
                { backgroundColor: isFasting ? dark.iris : dark.teal },
              ]}
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
          <View style={styles.timeInfo}>
            <Text style={styles.elapsedText} testID="fasting-card-elapsed">
              {isFasting ? elapsedText : 'Eating Window'}
            </Text>
            <Text style={styles.targetSubtext} testID="fasting-card-target">
              {isFasting
                ? t('fasting.ofHours', { hours: plannedHours })
                : nextTransitionText}
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
              handleQuickToggle();
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
      </Pressable>

      <FastingTimerModal
        visible={timerModalVisible}
        onClose={() => setTimerModalVisible(false)}
        userId={userId}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  titleRow: {
    flexDirection: 'row',
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfo: {
    flex: 1,
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
