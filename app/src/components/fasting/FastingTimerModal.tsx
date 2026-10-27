import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FastingProtocol } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFasting } from '@/hooks/useFasting';
import { t } from '@/i18n';
import { FastingEditTimesModal } from './FastingEditTimesModal';
import { FastingHistoryModal } from './FastingHistoryModal';
import { FastingIntroModal } from './FastingIntroModal';
import { FastingProtocolModal } from './FastingProtocolModal';
import { FastingSafetyCheckInModal } from './FastingSafetyCheckInModal';

export interface FastingTimerModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  testID?: string;
}

export function FastingTimerModal({
  visible,
  onClose,
  userId: propUserId,
  testID = 'fasting-timer-modal',
}: FastingTimerModalProps) {
  const { user } = useAuth();
  const { hasActiveAccess, loading: planLoading } = useSubscription();
  const userId = propUserId ?? user?.id ?? '';

  const {
    settings,
    activeSession,
    computedState,
    scheduledState,
    stats,
    streak,
    gating,
    history,
    startFast,
    endFast,
    editSession,
    updateSettings,
  } = useFasting({
    userId,
    age: 25,
    healthScreening: null,
  });

  const [showIntro, setShowIntro] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);
  const [showEditTimes, setShowEditTimes] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [safetyCheckInVariant, setSafetyCheckInVariant] = useState<
    'checkIn20' | 'checkIn24' | 'unwell' | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);

  React.useEffect(() => {
    if (visible && computedState.strongEndFastPrompt) {
      setSafetyCheckInVariant('checkIn24');
    } else if (visible && computedState.checkInPrompt && !safetyCheckInVariant) {
      setSafetyCheckInVariant('checkIn20');
    }
  }, [visible, computedState.strongEndFastPrompt, computedState.checkInPrompt]);

  if (!visible) return null;
  if ((planLoading || !hasActiveAccess) && !activeSession)
    return (
      <PremiumFeatureModal feature="fasting_tracker" visible={visible} onClose={onClose}>
        {null}
      </PremiumFeatureModal>
    );

  const isFasting = Boolean(activeSession && computedState.isActive);
  const plannedHours = Math.round((computedState.session?.planned_minutes || 960) / 60);
  const elapsedHours = Math.floor(computedState.elapsedMinutes / 60);
  const elapsedMinutes = computedState.elapsedMinutes % 60;
  const elapsedStr = `${elapsedHours.toString().padStart(2, '0')}:${elapsedMinutes.toString().padStart(2, '0')}`;

  const remainingHours = Math.floor(computedState.remainingMinutes / 60);
  const remainingMinutes = computedState.remainingMinutes % 60;

  const getNextChangeText = () => {
    if (isFasting) {
      if (computedState.isCompleted) {
        return 'Target fasting goal reached. End fast whenever you are ready.';
      }
      return `${remainingHours}h ${remainingMinutes}m remaining until target`;
    }

    if (scheduledState.isEatingWindow) {
      const windowEnd = settings.eating_window_end || '20:00';
      return t('fasting.fastStartsAt', { time: windowEnd });
    }
    const windowStart = settings.eating_window_start || '12:00';
    return t('fasting.eatingWindowOpensAt', { time: windowStart });
  };

  const handleStartFast = async () => {
    try {
      setActionBusy(true);
      await startFast();
    } catch {
      // error handled in hook
    } finally {
      setActionBusy(false);
    }
  };

  const handleEndFast = async () => {
    try {
      setActionBusy(true);
      await endFast();
      setSafetyCheckInVariant(null);
    } catch {
      // error handled in hook
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveTimes = async ({
    startAt,
    endAt,
  }: {
    startAt: string;
    endAt?: string | null;
  }) => {
    if (activeSession) {
      await editSession({
        sessionId: activeSession.id,
        startAt,
        endAt,
      });
    }
  };

  const handleSaveProtocol = async (
    proto: FastingProtocol,
    customH?: number,
    startW?: string,
    endW?: string,
  ) => {
    await updateSettings({
      protocol: proto,
      custom_fasting_hours: customH,
      eating_window_start: startW,
      eating_window_end: endW,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID={`${testID}-content`}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Pressable
              testID="button-fasting-settings"
              onPress={() => setShowIntro(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Fasting Settings"
            >
              <Ionicons name="settings-outline" size={20} color={dark.textMid} />
            </Pressable>

            <View style={styles.statePill}>
              <View
                style={[styles.stateDot, { backgroundColor: isFasting ? dark.iris : dark.teal }]}
              />
              <Text style={styles.statePillText}>
                {isFasting ? t('fasting.fastingState') : t('fasting.eatingWindowState')}
              </Text>
            </View>

            <Pressable
              testID="button-close-timer-modal"
              onPress={onClose}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Big Circular Progress Hero */}
            <View style={styles.heroCircleContainer}>
              <View style={styles.heroOuterCircle}>
                <View style={styles.heroInnerCircle}>
                  <Text style={styles.heroElapsedNumeral} testID="fasting-elapsed-time">
                    {isFasting ? elapsedStr : '00:00'}
                  </Text>
                  <Text style={styles.heroOfHours} testID="fasting-of-hours">
                    {t('fasting.ofHours', { hours: plannedHours })}
                  </Text>
                </View>
              </View>

              <Text style={styles.nextChangeLabel} testID="fasting-next-change-text">
                {getNextChangeText()}
              </Text>
            </View>

            {/* Protocol & Times Quick Cards */}
            <View style={styles.cardsRow}>
              {/* Protocol Chip */}
              <Pressable
                testID="button-protocol-chip"
                style={styles.metaCard}
                onPress={() => setShowProtocol(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose protocol"
              >
                <Ionicons name="repeat-outline" size={16} color={dark.apricot} />
                <View>
                  <Text style={styles.metaCardLabel}>{t('fasting.protocol')}</Text>
                  <Text style={styles.metaCardValue}>{settings.protocol.toUpperCase()}</Text>
                </View>
              </Pressable>

              {/* Start & End Times Chip */}
              <Pressable
                testID="button-edit-times-chip"
                style={styles.metaCard}
                onPress={() => setShowEditTimes(true)}
                accessibilityRole="button"
                accessibilityLabel={t('fasting.editTimes')}
              >
                <Ionicons name="calendar-outline" size={16} color={dark.iris} />
                <View>
                  <Text style={styles.metaCardLabel}>Schedule</Text>
                  <Text style={styles.metaCardValue}>
                    {activeSession
                      ? new Date(activeSession.start_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : `${settings.eating_window_start} - ${settings.eating_window_end}`}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Primary Action Button (Apricot Action) */}
            <Pressable
              testID={isFasting ? 'button-end-fast' : 'button-start-fast'}
              style={({ pressed }) => [
                styles.primaryActionBtn,
                pressed && styles.buttonPressed,
                actionBusy && styles.buttonDisabled,
              ]}
              onPress={isFasting ? handleEndFast : handleStartFast}
              disabled={actionBusy}
              accessibilityRole="button"
              accessibilityLabel={isFasting ? t('fasting.endFast') : t('fasting.startFast')}
            >
              <Text style={styles.primaryActionText}>
                {actionBusy ? 'Saving…' : isFasting ? t('fasting.endFast') : t('fasting.startFast')}
              </Text>
            </Pressable>

            {/* Safety Check-in Row (if 20h reached) */}
            {computedState.checkInPrompt && isFasting && (
              <Pressable
                testID="button-open-safety-checkin"
                style={styles.safetyCheckInBanner}
                onPress={() => setSafetyCheckInVariant('checkIn20')}
                accessibilityRole="button"
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={dark.apricot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.safetyBannerTitle}>{t('fasting.checkIn20Title')}</Text>
                  <Text style={styles.safetyBannerSub}>{t('fasting.checkIn20Subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textMid} />
              </Pressable>
            )}

            {/* History and Stats Entry Row */}
            <Pressable
              testID="button-open-fasting-history"
              style={styles.historyEntryRow}
              onPress={() => setShowHistory(true)}
              accessibilityRole="button"
              accessibilityLabel={t('fasting.history')}
            >
              <View style={styles.historyEntryLeft}>
                <Ionicons name="time-outline" size={18} color={dark.textMid} />
                <Text style={styles.historyEntryTitle}>{t('fasting.history')}</Text>
              </View>
              <View style={styles.historyEntryRight}>
                <Text style={styles.historyStreakText}>
                  {streak.current_streak > 0 ? `${streak.current_streak}d streak` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </View>
            </Pressable>
          </ScrollView>

          {/* Sub Modals */}
          <FastingIntroModal
            visible={showIntro}
            enabled={settings.enabled}
            gating={gating}
            onToggleEnabled={async (val) => {
              await updateSettings({ enabled: val });
            }}
            onClose={() => setShowIntro(false)}
          />

          <FastingProtocolModal
            visible={showProtocol}
            currentProtocol={settings.protocol}
            currentCustomHours={settings.custom_fasting_hours}
            eatingWindowStart={settings.eating_window_start}
            eatingWindowEnd={settings.eating_window_end}
            onSelectProtocol={handleSaveProtocol}
            onClose={() => setShowProtocol(false)}
          />

          <FastingEditTimesModal
            visible={showEditTimes}
            session={activeSession}
            onSave={handleSaveTimes}
            onClose={() => setShowEditTimes(false)}
          />

          <FastingHistoryModal
            visible={showHistory}
            history={history}
            stats={stats}
            streak={streak}
            onClose={() => setShowHistory(false)}
          />

          {safetyCheckInVariant && (
            <FastingSafetyCheckInModal
              visible={Boolean(safetyCheckInVariant)}
              variant={safetyCheckInVariant}
              onEndFast={handleEndFast}
              onKeepGoing={() => setSafetyCheckInVariant(null)}
              onClose={() => setSafetyCheckInVariant(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space[4],
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    backgroundColor: dark.s1,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statePillText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    fontWeight: '600',
    color: dark.textHi,
  },
  scroll: {
    gap: space[4],
    alignItems: 'center',
    paddingBottom: space[4],
  },
  heroCircleContainer: {
    alignItems: 'center',
    marginTop: space[2],
  },
  heroOuterCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    borderColor: dark.s1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space[3],
  },
  heroInnerCircle: {
    alignItems: 'center',
  },
  heroElapsedNumeral: {
    fontSize: 40,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
    fontVariant: ['tabular-nums'],
  },
  heroOfHours: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textLo,
    marginTop: 2,
  },
  nextChangeLabel: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    textAlign: 'center',
    paddingHorizontal: space[4],
  },
  cardsRow: {
    flexDirection: 'row',
    gap: space[3],
    width: '100%',
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  metaCardLabel: {
    fontSize: 11,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
  metaCardValue: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
    marginTop: 2,
  },
  primaryActionBtn: {
    width: '100%',
    height: 52,
    backgroundColor: dark.apricot,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.onBrand,
  },
  safetyCheckInBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 138, 0.08)',
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 138, 0.25)',
    gap: space[2],
  },
  safetyBannerTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
  },
  safetyBannerSub: {
    fontSize: 11,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  historyEntryRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 48,
  },
  historyEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  historyEntryTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '600',
    color: dark.textHi,
  },
  historyEntryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  historyStreakText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
