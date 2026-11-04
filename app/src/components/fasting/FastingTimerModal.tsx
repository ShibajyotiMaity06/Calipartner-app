import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Sheet, Text, dark, homeLayout, radius, space } from '@calipartner/ui';
import { getProtocolPlannedMinutes, type FastingProtocol } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useFasting } from '@/hooks/useFasting';
import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import { LoadingState } from '@/components/LoadingState';
import { t } from '@/i18n';
import { FastingProtocolModal } from './FastingProtocolModal';
import { FastingEditTimesModal } from './FastingEditTimesModal';
import { FastingHistoryModal } from './FastingHistoryModal';
import { FastingIntroModal } from './FastingIntroModal';
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
  const fasting = useFasting({ userId: propUserId ?? user?.id ?? '' });
  const {
    settings,
    activeSession,
    computedState,
    scheduledState,
    history,
    stats,
    streak,
    gating,
    loading,
    error,
    hasPaidAccess,
    planLoading,
    screeningReady,
  } = fasting;
  const [panel, setPanel] = useState<'protocol' | 'times' | 'history' | 'settings' | null>(null);
  const [safety, setSafety] = useState<'checkIn20' | 'checkIn24' | null>(null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({
    pregnant_or_breastfeeding: null,
    has_diabetes_or_medication: null,
    has_eating_disorder_history: null,
  });
  useEffect(() => {
    if (visible && computedState.strongEndFastPrompt) setSafety('checkIn24');
    else if (visible && computedState.checkInPrompt) setSafety('checkIn20');
  }, [visible, computedState.strongEndFastPrompt, computedState.checkInPrompt]);
  if (!visible) return null;
  if (!loading && !planLoading && !hasPaidAccess && !activeSession)
    return (
      <PremiumFeatureModal feature="fasting_tracker" visible onClose={onClose}>
        {null}
      </PremiumFeatureModal>
    );
  const active = Boolean(activeSession && computedState.isActive);
  const eligible = hasPaidAccess && gating.canAccess && screeningReady;
  const duration =
    activeSession?.planned_minutes ??
    getProtocolPlannedMinutes(settings.protocol, settings.custom_fasting_hours);
  const elapsed = `${String(Math.floor(computedState.elapsedMinutes / 60)).padStart(2, '0')}:${String(computedState.elapsedMinutes % 60).padStart(2, '0')}`;
  const message =
    error === 'PLUS_REQUIRED'
      ? 'fastingRefresh.plus'
      : error === 'SCREENING_REQUIRED'
        ? 'fastingRefresh.screeningRequired'
        : error === 'INVALID_FASTING_SETTINGS'
          ? 'fastingRefresh.invalidWindow'
          : error === 'INVALID_FASTING_TIMES'
            ? 'fastingRefresh.invalidTimes'
            : error === 'LOW_INTAKE_PAUSED'
              ? 'fastingRefresh.paused'
              : error === 'SCREENING_INELIGIBLE' || error === 'UNDER_18_BLOCKED'
                ? 'fastingRefresh.blocked'
                : 'fastingRefresh.saveError';
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch {
      /* Hook exposes actionable error. */
    } finally {
      setBusy(false);
    }
  };
  const end = async () => {
    await fasting.endFast();
    setSafety(null);
  };
  const saveProtocol = async (
    protocol: FastingProtocol,
    customHours?: number,
    start?: string,
    end?: string,
  ) => {
    await fasting.updateSettings({
      protocol,
      custom_fasting_hours: customHours,
      eating_window_start: start,
      eating_window_end: end,
    });
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      snapPoint="tall"
      testID={testID}
      accessibilityLabel={t('fastingRefresh.title')}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <Text variant="title1" style={styles.flex}>
            {t('fastingRefresh.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={styles.touch}
            onPress={onClose}
            testID="button-close-timer-modal"
          >
            <Ionicons name="close" color={dark.textHi} size={homeLayout.iconSize} />
          </Pressable>
        </View>
        {loading || planLoading ? (
          <LoadingState />
        ) : (
          <>
            {error && (
              <View style={styles.stack}>
                <Text color={dark.danger} accessibilityRole="alert" testID="fasting-error">
                  {t(message)}
                </Text>
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void fasting.refresh()}
                  testID="fasting-retry"
                />
              </View>
            )}
            {!hasPaidAccess && active && <Text>{t('fastingRefresh.recovery')}</Text>}
            {!eligible && !active ? (
              <View style={styles.stack}>
                <Text testID="fasting-safety-blocked">
                  {t(
                    !screeningReady
                      ? 'fastingRefresh.screeningRequired'
                      : gating.isPaused
                        ? 'fastingRefresh.paused'
                        : 'fastingRefresh.blocked',
                  )}
                </Text>
                {!screeningReady && gating.reason !== 'under_18' && (
                  <View style={styles.card} testID="fasting-screening-form">
                    {(
                      [
                        ['pregnant_or_breastfeeding', 'onboarding.healthScreening.pregnantLabel'],
                        ['has_diabetes_or_medication', 'onboarding.healthScreening.diabetesLabel'],
                        ['has_eating_disorder_history', 'onboarding.healthScreening.edLabel'],
                      ] as const
                    ).map(([key, label]) => (
                      <View key={key} style={styles.stack}>
                        <Text>{t(label)}</Text>
                        <View style={styles.row}>
                          {([true, false] as const).map((value) => (
                            <Button
                              key={String(value)}
                              variant="secondary"
                              fullWidth={false}
                              size="sm"
                              label={t(value ? 'fastingRefresh.yes' : 'fastingRefresh.no')}
                              accessibilityLabel={
                                t(label) +
                                ': ' +
                                t(value ? 'fastingRefresh.yes' : 'fastingRefresh.no')
                              }
                              style={{
                                borderColor: answers[key] === value ? dark.copper : dark.hairline,
                              }}
                              onPress={() =>
                                setAnswers((current) => ({ ...current, [key]: value }))
                              }
                              testID={'fasting-screening-' + key + '-' + String(value)}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                    <Button
                      label={t('fastingRefresh.saveScreening')}
                      disabled={busy || Object.values(answers).some((answer) => answer === null)}
                      loading={busy}
                      onPress={() =>
                        void perform(() =>
                          fasting.completeScreening({
                            pregnant_or_breastfeeding: answers.pregnant_or_breastfeeding === true,
                            has_diabetes_or_medication: answers.has_diabetes_or_medication === true,
                            has_eating_disorder_history:
                              answers.has_eating_disorder_history === true,
                          }),
                        )
                      }
                      testID="fasting-save-screening"
                    />
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={styles.hero}>
                  <Text variant="label" color={dark.iris}>
                    {active
                      ? t('fasting.fastingState')
                      : settings.enabled
                        ? t('fastingRefresh.ready')
                        : t('fastingRefresh.disabled')}
                  </Text>
                  <Text variant="numeralXL" tabular testID="fasting-elapsed-time">
                    {active ? elapsed : '00:00'}
                  </Text>
                  <Text tabular testID="fasting-of-hours">
                    {t('fastingRefresh.planned', { hours: duration / 60 })}
                  </Text>
                  <Text variant="bodyS" testID="fasting-next-change-text">
                    {active
                      ? computedState.isPastPlanned
                        ? t('fastingRefresh.targetReached')
                        : t('fastingRefresh.remaining', {
                            hours: Math.floor(computedState.remainingMinutes / 60),
                            minutes: computedState.remainingMinutes % 60,
                          })
                      : t(
                          scheduledState.isEatingWindow
                            ? 'fasting.fastStartsAt'
                            : 'fasting.eatingWindowOpensAt',
                          {
                            time: scheduledState.isEatingWindow
                              ? settings.eating_window_end
                              : settings.eating_window_start,
                          },
                        )}
                  </Text>
                </View>
                <Button
                  label={t(
                    active
                      ? 'fasting.endFast'
                      : settings.enabled
                        ? 'fasting.startFast'
                        : 'fastingRefresh.enable',
                  )}
                  loading={busy}
                  disabled={busy || (!active && !eligible)}
                  onPress={() =>
                    void perform(
                      active
                        ? end
                        : settings.enabled
                          ? () => fasting.startFast()
                          : () => fasting.updateSettings({ enabled: true }),
                    )
                  }
                  testID={
                    active
                      ? 'button-end-fast'
                      : settings.enabled
                        ? 'button-start-fast'
                        : 'button-enable-fasting'
                  }
                />
              </>
            )}
            {hasPaidAccess && (
              <>
                <View style={styles.card}>
                  <Button
                    variant="secondary"
                    label={t('fasting.protocol') + ': ' + settings.protocol}
                    disabled={!eligible || busy}
                    onPress={() => setPanel('protocol')}
                    testID="button-protocol-chip"
                  />
                  <Text variant="label">{t('fastingRefresh.schedule')}</Text>
                  <Text tabular>
                    {settings.eating_window_start} - {settings.eating_window_end}
                  </Text>
                  {active && (
                    <Button
                      variant="tertiary"
                      label={t('fasting.editTimes')}
                      disabled={busy}
                      onPress={() => setPanel('times')}
                      testID="button-edit-times-chip"
                    />
                  )}
                  <Button
                    variant="tertiary"
                    label={t('fastingRefresh.configure')}
                    disabled={busy}
                    onPress={() => setPanel('settings')}
                    testID="button-fasting-settings"
                  />
                </View>
                <Button
                  variant="secondary"
                  label={t('fasting.history')}
                  onPress={() => setPanel('history')}
                  testID="button-open-fasting-history"
                />
                <Text variant="bodyS">{t('fasting.safeFastingNotice')}</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
      {panel === 'protocol' && (
        <FastingProtocolModal
          visible
          currentProtocol={settings.protocol}
          currentCustomHours={settings.custom_fasting_hours}
          eatingWindowStart={settings.eating_window_start}
          eatingWindowEnd={settings.eating_window_end}
          onSelectProtocol={saveProtocol}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'times' && (
        <FastingEditTimesModal
          visible
          session={activeSession}
          onSave={async (values) => {
            if (activeSession)
              await fasting.editSession({ sessionId: activeSession.id, ...values });
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'history' && (
        <FastingHistoryModal
          visible
          history={history.filter((session) => session.status !== 'active')}
          stats={stats}
          streak={streak}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'settings' && (
        <FastingIntroModal
          visible
          enabled={settings.enabled}
          gating={{ ...gating, canAccess: eligible }}
          onToggleEnabled={async (enabled) => {
            await fasting.updateSettings({ enabled });
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {safety && active && (
        <FastingSafetyCheckInModal
          visible
          variant={safety}
          onEndFast={() => perform(end)}
          onKeepGoing={() => setSafety(null)}
          onClose={() => setSafety(null)}
        />
      )}
    </Sheet>
  );
}
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[4], paddingBottom: space[7] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
  touch: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { gap: space[2] },
  hero: { alignItems: 'center', gap: space[3], paddingVertical: space[6] },
  card: {
    padding: space[4],
    gap: space[3],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
});
