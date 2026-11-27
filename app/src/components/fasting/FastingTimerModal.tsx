import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeftIcon,
  Chip,
  EditIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  Ring,
  Text,
  borders,
  colors,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { Button } from '@calipartner/ui';
import {
  fastingWindowForProtocol,
  getProtocolPlannedMinutes,
  type FastingProtocol,
} from '@calipartner/core';
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

const PROTOCOLS: readonly FastingProtocol[] = ['12:12', '14:10', '16:8', '18:6', '20:4', 'custom'];

function formatClock12(hhmm: string): string {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? '0');
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatClockShort(hhmm: string): string {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? '0');
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatRelativeStamp(dateObj: Date): string {
  if (Number.isNaN(dateObj.getTime())) return '—';
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const yest = new Date(now.getTime() - 86_400_000);
  const yestKey = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;
  const tom = new Date(now.getTime() + 86_400_000);
  const tomKey = `${tom.getFullYear()}-${tom.getMonth()}-${tom.getDate()}`;
  const targetKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (targetKey === todayKey) return `Today, ${timeStr}`;
  if (targetKey === yestKey) return `Yesterday, ${timeStr}`;
  if (targetKey === tomKey) return `Tomorrow, ${timeStr}`;
  const dayStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dayStr}, ${timeStr}`;
}

function formatRemainingDuration(remainingMinutes: number): string {
  const safe = Math.max(0, Math.round(remainingMinutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function FastingTimerModal({
  visible,
  onClose,
  userId: propUserId,
  testID = 'fasting-timer-modal',
}: FastingTimerModalProps) {
  const insets = useSafeAreaInsets();
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

  if (!loading && !planLoading && !hasPaidAccess && !activeSession) {
    return (
      <PremiumFeatureModal feature="fasting_tracker" visible onClose={onClose}>
        {null}
      </PremiumFeatureModal>
    );
  }

  const active = Boolean(activeSession && computedState.isActive);
  const eligible = hasPaidAccess && gating.canAccess && screeningReady;
  const duration =
    activeSession?.planned_minutes ??
    getProtocolPlannedMinutes(settings.protocol, settings.custom_fasting_hours);
  const elapsedHours = Math.floor(computedState.elapsedMinutes / 60);
  const elapsedMins = computedState.elapsedMinutes % 60;
  const elapsed = `${String(elapsedHours).padStart(2, '0')}:${String(elapsedMins).padStart(2, '0')}`;
  const ringProgress = active
    ? Math.max(0, Math.min(1, computedState.elapsedMinutes / Math.max(1, duration)))
    : 0;

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
    endTime?: string,
  ) => {
    await fasting.updateSettings({
      protocol,
      custom_fasting_hours: customHours,
      eating_window_start: start,
      eating_window_end: endTime,
    });
  };

  const handleSelectChip = (proto: FastingProtocol) => {
    if (!eligible || busy) return;
    if (proto === 'custom' || proto === settings.protocol) {
      setPanel('protocol');
      return;
    }
    const nextWindow = fastingWindowForProtocol(
      proto,
      settings.custom_fasting_hours ?? 16,
      settings.eating_window_end,
    );
    void perform(() => saveProtocol(proto, undefined, nextWindow.start, nextWindow.end));
  };

  const startedAtDate = activeSession?.start_at ? new Date(activeSession.start_at) : null;
  const endsAtDate =
    startedAtDate && !Number.isNaN(startedAtDate.getTime())
      ? new Date(startedAtDate.getTime() + duration * 60_000)
      : null;

  const timelineProgress = active
    ? Math.max(0.05, Math.min(0.95, ringProgress))
    : scheduledState.isEatingWindow
      ? 0.85
      : 0.25;
  const fillPercent = Math.round(timelineProgress * 100);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
      testID={testID}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + layout.topContentOffset,
            paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm),
          },
        ]}
      >
        {/* Top nav bar */}
        <View style={styles.topNav}>
          <IconButton
            icon={<ChevronLeftIcon size={20} color={colors.textHi} />}
            onPress={onClose}
            accessibilityLabel={t('common.back')}
            testID="button-close-timer-modal"
          />
          <View style={styles.topRight}>
            {hasPaidAccess ? (
              <IconButton
                icon={<EditIcon size={17} color={colors.textMid} />}
                size={40}
                onPress={() => setPanel('settings')}
                accessibilityLabel={t('fastingRefresh.configure')}
                testID="button-fasting-settings"
              />
            ) : null}
            {hasPaidAccess ? (
              <LinkButton
                title={t('fastingV1.historyShort')}
                variant="default"
                onPress={() => setPanel('history')}
                testID="button-open-fasting-history"
              />
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.titleBlock}>
            <Text variant="eyebrow" color="textLo">
              {t('fastingV1.eyebrow')}
            </Text>
            <Text variant="title" color="textHi">
              {t('fasting.title')}
            </Text>
          </View>

          {loading || planLoading ? (
            <LoadingState />
          ) : (
            <>
              {error ? (
                <View style={styles.errorCard}>
                  <Text
                    variant="meta"
                    color="danger"
                    accessibilityRole="alert"
                    testID="fasting-error"
                  >
                    {t(message)}
                  </Text>
                  <Button
                    variant="secondary"
                    label={t('common.retry')}
                    onPress={() => void fasting.refresh()}
                    testID="fasting-retry"
                  />
                </View>
              ) : null}

              {!hasPaidAccess && active ? (
                <Text variant="meta" color="textMid">
                  {t('fastingRefresh.recovery')}
                </Text>
              ) : null}

              {/* Protocol chips */}
              {hasPaidAccess ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.protocolRow}
                >
                  {PROTOCOLS.map((proto) => {
                    const isSelected = settings.protocol === proto;
                    const label = proto === 'custom' ? t('fastingV1.protocolCustom') : proto;
                    return (
                      <Chip
                        key={proto}
                        label={label}
                        selected={isSelected}
                        disabled={!eligible || busy}
                        onPress={() => handleSelectChip(proto)}
                        testID={isSelected ? 'button-protocol-chip' : `chip-protocol-${proto}`}
                      />
                    );
                  })}
                </ScrollView>
              ) : null}

              {!eligible && !active ? (
                <View style={styles.screeningSection}>
                  <Text variant="body" color="textMid" testID="fasting-safety-blocked">
                    {t(
                      !screeningReady
                        ? 'fastingRefresh.screeningRequired'
                        : gating.isPaused
                          ? 'fastingRefresh.paused'
                          : 'fastingRefresh.blocked',
                    )}
                  </Text>
                  {!screeningReady && gating.reason !== 'under_18' ? (
                    <View style={styles.card} testID="fasting-screening-form">
                      {(
                        [
                          ['pregnant_or_breastfeeding', 'onboarding.healthScreening.pregnantLabel'],
                          [
                            'has_diabetes_or_medication',
                            'onboarding.healthScreening.diabetesLabel',
                          ],
                          ['has_eating_disorder_history', 'onboarding.healthScreening.edLabel'],
                        ] as const
                      ).map(([key, label]) => (
                        <View key={key} style={styles.screeningField}>
                          <Text variant="label" color="textHi">
                            {t(label)}
                          </Text>
                          <View style={styles.rowGap}>
                            {([true, false] as const).map((value) => (
                              <Button
                                key={String(value)}
                                variant="secondary"
                                fullWidth={false}
                                size="sm"
                                label={t(value ? 'fastingRefresh.yes' : 'fastingRefresh.no')}
                                accessibilityLabel={`${t(label)}: ${t(
                                  value ? 'fastingRefresh.yes' : 'fastingRefresh.no',
                                )}`}
                                style={{
                                  borderColor:
                                    answers[key] === value ? colors.apricot : colors.hairline,
                                }}
                                onPress={() =>
                                  setAnswers((current) => ({ ...current, [key]: value }))
                                }
                                testID={`fasting-screening-${key}-${String(value)}`}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                      <PrimaryButton
                        title={t('fastingRefresh.saveScreening')}
                        disabled={busy || Object.values(answers).some((answer) => answer === null)}
                        loading={busy}
                        onPress={() =>
                          void perform(() =>
                            fasting.completeScreening({
                              pregnant_or_breastfeeding: answers.pregnant_or_breastfeeding === true,
                              has_diabetes_or_medication:
                                answers.has_diabetes_or_medication === true,
                              has_eating_disorder_history:
                                answers.has_eating_disorder_history === true,
                            }),
                          )
                        }
                        testID="fasting-save-screening"
                      />
                    </View>
                  ) : null}
                </View>
              ) : (
                <>
                  {/* Hero Ring */}
                  <View style={styles.ringSection}>
                    <Ring
                      progress={ringProgress}
                      size={220}
                      strokeWidth={14}
                      trackColor={colors.s2}
                      color={colors.apricot}
                      accessibilityLabel={
                        active ? t('fastingV1.fastedFor') : t('fastingV1.readyToFast')
                      }
                    >
                      <View style={styles.ringInner}>
                        <Text variant="meta" color="textLo">
                          {active
                            ? t('fastingV1.fastedFor')
                            : settings.enabled
                              ? t('fastingV1.readyToFast')
                              : t('fastingRefresh.disabled')}
                        </Text>
                        <Text variant="numXL" tabular color="textHi" testID="fasting-elapsed-time">
                          {active ? elapsed : '00:00'}
                        </Text>
                        <Text variant="label" color="apricot" testID="fasting-next-change-text">
                          {active
                            ? computedState.isPastPlanned
                              ? t('fastingRefresh.targetReached')
                              : t('fastingV1.toGo', {
                                  duration: formatRemainingDuration(computedState.remainingMinutes),
                                })
                            : t(
                                scheduledState.isEatingWindow
                                  ? 'fasting.fastStartsAt'
                                  : 'fasting.eatingWindowOpensAt',
                                {
                                  time: formatClock12(
                                    scheduledState.isEatingWindow
                                      ? settings.eating_window_end
                                      : settings.eating_window_start,
                                  ),
                                },
                              )}
                        </Text>
                      </View>
                    </Ring>
                    <Text variant="micro" color="textLo" tabular testID="fasting-of-hours">
                      {t('fastingRefresh.planned', { hours: Math.round(duration / 60) })}
                    </Text>
                  </View>

                  {/* Eating window timeline card */}
                  <View style={styles.card}>
                    <View style={styles.windowHeaderRow}>
                      <Text variant="rowTitle" color="textHi">
                        {t('fastingV1.eatingWindowTitle')}
                      </Text>
                      <Text variant="meta" color="textLo" tabular>
                        {`${formatClock12(settings.eating_window_start)} – ${formatClock12(
                          settings.eating_window_end,
                        )}`}
                      </Text>
                    </View>
                    <View style={styles.timelineTrackWrap}>
                      <View style={styles.timelineTrack}>
                        <View style={[styles.timelineFill, { width: `${fillPercent}%` }]} />
                        <View style={[styles.timelineThumb, { left: `${fillPercent}%` }]} />
                      </View>
                    </View>
                    <View style={styles.timelineLabelsRow}>
                      <Text variant="micro" color="textLo" tabular>
                        {formatClockShort(settings.eating_window_end)}
                      </Text>
                      <Text variant="micro" color="textLo" tabular>
                        {formatClockShort(settings.eating_window_start)}
                      </Text>
                      <Text variant="micro" color="textLo" tabular>
                        {formatClockShort(settings.eating_window_end)}
                      </Text>
                    </View>
                  </View>

                  {/* Started / Ends 2-column cards */}
                  <View style={styles.statRow}>
                    <View style={styles.statCard}>
                      <Text variant="meta" color="textLo">
                        {t('fastingV1.startedLabel')}
                      </Text>
                      <Text variant="rowTitle" color="textHi" tabular>
                        {startedAtDate
                          ? formatRelativeStamp(startedAtDate)
                          : formatClock12(settings.eating_window_end)}
                      </Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text variant="meta" color="textLo">
                        {t('fastingV1.endsLabel')}
                      </Text>
                      <Text variant="rowTitle" color="textHi" tabular>
                        {endsAtDate
                          ? formatRelativeStamp(endsAtDate)
                          : formatClock12(settings.eating_window_start)}
                      </Text>
                    </View>
                  </View>

                  {/* Primary CTA & Edit start time */}
                  <View style={styles.ctaSection}>
                    <PrimaryButton
                      title={t(
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
                    {active ? (
                      <LinkButton
                        title={t('fastingV1.editStartTime')}
                        variant="default"
                        onPress={() => setPanel('times')}
                        disabled={busy}
                        testID="button-edit-times-chip"
                      />
                    ) : (
                      <LinkButton
                        title={t('fasting.chooseProtocol')}
                        variant="default"
                        onPress={() => setPanel('protocol')}
                        disabled={!eligible || busy}
                        testID="button-edit-protocol-link"
                      />
                    )}
                  </View>

                  <Text variant="micro" color="textOff" style={styles.safeNotice}>
                    {t('fasting.safeFastingNotice')}
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>

        {panel === 'protocol' ? (
          <FastingProtocolModal
            visible
            currentProtocol={settings.protocol}
            currentCustomHours={settings.custom_fasting_hours}
            eatingWindowStart={settings.eating_window_start}
            eatingWindowEnd={settings.eating_window_end}
            onSelectProtocol={saveProtocol}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'times' ? (
          <FastingEditTimesModal
            visible
            session={activeSession}
            onSave={async (values) => {
              if (activeSession)
                await fasting.editSession({ sessionId: activeSession.id, ...values });
            }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'history' ? (
          <FastingHistoryModal
            visible
            history={history.filter((session) => session.status !== 'active')}
            stats={stats}
            streak={streak}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'settings' ? (
          <FastingIntroModal
            visible
            enabled={settings.enabled}
            gating={{ ...gating, canAccess: eligible }}
            onToggleEnabled={async (enabled) => {
              await fasting.updateSettings({ enabled });
            }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {safety && active ? (
          <FastingSafetyCheckInModal
            visible
            variant={safety}
            onEndFast={() => perform(end)}
            onKeepGoing={() => setSafety(null)}
            onClose={() => setSafety(null)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
    paddingHorizontal: layout.screenPaddingX,
  },
  topNav: {
    height: layout.navRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  scrollContent: {
    gap: space.lg,
    paddingBottom: space.xl,
  },
  titleBlock: {
    gap: space.xs,
  },
  protocolRow: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  ringSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  card: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: space.md,
  },
  windowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  timelineTrackWrap: {
    paddingVertical: space.xs,
  },
  timelineTrack: {
    height: 6,
    borderRadius: radius.bar,
    backgroundColor: colors.s3,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineFill: {
    height: 6,
    borderRadius: radius.bar,
    backgroundColor: colors.apricot,
  },
  timelineThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: radius.full,
    backgroundColor: colors.textHi,
    borderWidth: borders.selectedWidth,
    borderColor: colors.bg0,
  },
  timelineLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: space.xs,
  },
  ctaSection: {
    gap: space.sm,
    alignItems: 'center',
  },
  safeNotice: {
    textAlign: 'center',
  },
  errorCard: {
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.card,
  },
  screeningSection: {
    gap: space.md,
  },
  screeningField: {
    gap: space.sm,
  },
  rowGap: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
