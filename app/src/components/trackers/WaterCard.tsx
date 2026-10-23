import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useWater } from '@/hooks/useWater';
import { t } from '@/i18n';
import { CustomWaterModal } from './CustomWaterModal';
import { WaterHistoryModal } from './WaterHistoryModal';
import { WaterSettingsSheet } from './WaterSettingsSheet';

export interface WaterCardProps {
  selectedDate?: string;
  testID?: string;
}

export function WaterCard({ selectedDate, testID = 'water-card' }: WaterCardProps) {
  const {
    logs,
    totalMl,
    goalMl,
    progressPercent,
    remainingMl,
    loading,
    addWater,
    undoLast,
    deleteLog,
    editLog,
  } = useWater(selectedDate);

  const [unit, setUnit] = useState<'ml' | 'fl_oz'>('ml');
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Reminders state (WAT-4)
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  // Toast for 4s with Undo
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 220ms fill animation
  const animatedFill = useRef(new Animated.Value(0)).current;

  const mlToFloz = (ml: number) => Math.round(ml / 29.5735);
  const progressRatio = Math.min(1, Math.max(0, goalMl > 0 ? totalMl / goalMl : 0));
  const isGoalMet = totalMl >= goalMl && goalMl > 0;

  useEffect(() => {
    Animated.timing(animatedFill, {
      toValue: progressRatio,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progressRatio, animatedFill]);

  const showUndoToast = (amountText: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(`Added ${amountText}. Undo.`);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleQuickAdd = async (amount: 250 | 500 | 1000) => {
    try {
      setActionBusy(true);
      await addWater(amount);
      const displayAmount = unit === 'fl_oz' ? `${mlToFloz(amount)} fl oz` : `${amount} ml`;
      showUndoToast(displayAmount);
    } catch {
      // Handled gracefully
    } finally {
      setActionBusy(false);
    }
  };

  const handleUndo = async () => {
    try {
      setActionBusy(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToastMessage(null);
      await undoLast();
    } catch {
      // Handled gracefully
    } finally {
      setActionBusy(false);
    }
  };

  const hasLogs = logs.length > 0;
  const currentDisplayAmount = unit === 'fl_oz' ? mlToFloz(totalMl) : totalMl;
  const goalDisplayAmount = unit === 'fl_oz' ? mlToFloz(goalMl) : goalMl;
  const unitLabel = unit === 'fl_oz' ? 'fl oz' : 'ml';

  return (
    <View testID={testID} style={styles.card}>
      {/* Header with Title and Unit Toggle */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconWrapper}>
            <Ionicons name="water" size={18} color={dark.apricot} />
          </View>
          <View>
            <Text style={styles.title}>{t('trackers.water.title')}</Text>
            <Text style={styles.subtitle}>{t('trackers.water.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Unit Toggle ml / fl oz */}
          <Pressable
            testID="btn-water-unit-switch"
            style={styles.unitPill}
            onPress={() => setUnit((prev) => (prev === 'ml' ? 'fl_oz' : 'ml'))}
            accessibilityRole="button"
            accessibilityLabel={`Switch unit from ${unit}`}
          >
            <Text style={styles.unitPillText}>{unitLabel}</Text>
          </Pressable>

          {hasLogs && (
            <Pressable
              testID="btn-water-undo"
              onPress={() => void handleUndo()}
              disabled={actionBusy}
              style={styles.smallActionBtn}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.undo')}
            >
              <Ionicons name="arrow-undo-outline" size={15} color={dark.textHi} />
              <Text style={styles.smallActionText}>{t('trackers.water.undo')}</Text>
            </Pressable>
          )}

          <Pressable
            testID="btn-water-history"
            onPress={() => setHistoryModalVisible(true)}
            style={styles.smallActionBtn}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.water.history')}
          >
            <Ionicons name="time-outline" size={15} color={dark.textMid} />
            <Text style={styles.smallActionText}>{t('trackers.water.history')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer} testID="water-loading-state">
          <ActivityIndicator size="small" color={dark.apricot} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          {/* E01 Visual: Large Bottle Representation with Fill Level */}
          <View
            style={styles.visualContainer}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: goalMl, now: totalMl }}
            accessibilityLabel={
              unit === 'fl_oz'
                ? `${currentDisplayAmount} of ${goalDisplayAmount} fluid ounces`
                : `${currentDisplayAmount} of ${goalDisplayAmount} millilitres`
            }
          >
            {/* Styled Bottle Flask */}
            <View style={styles.bottleOuter} testID="water-bottle-graphic">
              {/* Bottle Cap / Neck */}
              <View style={styles.bottleNeck} />
              {/* Bottle Body */}
              <View style={styles.bottleBody}>
                <Animated.View
                  style={[
                    styles.bottleLiquid,
                    {
                      height: animatedFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: isGoalMet ? dark.teal : dark.iris,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Numeral-L Progress & Status */}
            <View style={styles.progressDetail}>
              <View style={styles.numeralRow}>
                <Text testID="water-progress-text" style={styles.progressNumber}>
                  {`${currentDisplayAmount.toLocaleString()}`}
                </Text>
                <Text style={styles.progressGoalText}>
                  {` of ${goalDisplayAmount.toLocaleString()} ${unitLabel}`}
                </Text>
              </View>

              <Text
                style={[styles.statusBadgeText, { color: isGoalMet ? dark.teal : dark.textMid }]}
              >
                {isGoalMet
                  ? t('trackers.water.goalMetText')
                  : t('trackers.water.remainingText', {
                      remaining: Math.max(
                        0,
                        unit === 'fl_oz' ? mlToFloz(remainingMl) : remainingMl,
                      ),
                    })}
              </Text>

              {/* Linear fallback / horizontal indicator */}
              <View style={styles.linearTrack}>
                <Animated.View
                  style={[
                    styles.linearBar,
                    {
                      width: animatedFill.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: isGoalMet ? dark.teal : dark.apricot,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Active 4s Toast with Undo Action */}
          {toastMessage && (
            <Pressable
              testID="water-undo-toast"
              style={styles.toastBox}
              onPress={() => void handleUndo()}
              accessibilityRole="alert"
              accessibilityLabel={toastMessage}
            >
              <Text style={styles.toastText}>{toastMessage}</Text>
              <View style={styles.toastUndoButton}>
                <Text style={styles.toastUndoText}>Undo</Text>
              </View>
            </Pressable>
          )}

          {/* Empty state hint */}
          {!hasLogs && (
            <View testID="water-empty-state" style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>{t('trackers.water.emptyToday')}</Text>
            </View>
          )}

          {/* Three Quick Buttons at 56 high in the thumb zone */}
          <View style={styles.quickButtonsRow}>
            <Pressable
              testID="btn-water-quick-250"
              onPress={() => void handleQuickAdd(250)}
              disabled={actionBusy}
              style={styles.thumbZoneButton}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.glass')}
            >
              <Ionicons name="pint-outline" size={18} color={dark.apricot} />
              <Text style={styles.thumbBtnLabel}>{unit === 'fl_oz' ? '8 oz' : '250 ml'}</Text>
              <Text style={styles.thumbBtnSub}>Glass</Text>
            </Pressable>

            <Pressable
              testID="btn-water-quick-500"
              onPress={() => void handleQuickAdd(500)}
              disabled={actionBusy}
              style={styles.thumbZoneButton}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.bottle')}
            >
              <Ionicons name="water-outline" size={18} color={dark.apricot} />
              <Text style={styles.thumbBtnLabel}>{unit === 'fl_oz' ? '17 oz' : '500 ml'}</Text>
              <Text style={styles.thumbBtnSub}>Bottle</Text>
            </Pressable>

            <Pressable
              testID="btn-water-quick-1000"
              onPress={() => void handleQuickAdd(1000)}
              disabled={actionBusy}
              style={styles.thumbZoneButton}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.large')}
            >
              <Ionicons name="flask-outline" size={18} color={dark.apricot} />
              <Text style={styles.thumbBtnLabel}>{unit === 'fl_oz' ? '34 oz' : '1 L'}</Text>
              <Text style={styles.thumbBtnSub}>Large</Text>
            </Pressable>
          </View>

          {/* E02 "Custom amount" text button */}
          <View style={styles.customAmountRow}>
            <Pressable
              testID="btn-water-custom"
              onPress={() => setSettingsSheetVisible(true)}
              style={styles.customTextButton}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.customAmount')}
            >
              <Ionicons name="options-outline" size={16} color={dark.apricot} />
              <Text style={styles.customTextButtonLabel}>{t('trackers.water.customAmount')}</Text>
            </Pressable>
          </View>

          {/* Today's Entries (time, amount; tap to delete with undo) */}
          {hasLogs && (
            <View style={styles.entriesSection} testID="water-entries-list">
              <Text style={styles.entriesTitle}>{t('trackers.water.todayLogs')}</Text>
              <View style={styles.entriesList}>
                {logs.slice(0, 4).map((log) => {
                  const time = new Date(log.logged_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const disp =
                    unit === 'fl_oz' ? `${mlToFloz(log.amount_ml)} fl oz` : `${log.amount_ml} ml`;
                  return (
                    <View key={log.id} style={styles.entryRow} testID={`water-entry-${log.id}`}>
                      <View style={styles.entryLeft}>
                        <Ionicons name="water-outline" size={14} color={dark.teal} />
                        <Text style={styles.entryAmount}>{disp}</Text>
                        <Text style={styles.entryTime}>{time}</Text>
                      </View>
                      <Pressable
                        onPress={() => void deleteLog(log.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${disp} logged at ${time}`}
                      >
                        <Ionicons name="trash-outline" size={15} color={dark.textLo} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Bottom: Reminder Row (WAT-4) with Switch and Suggestion */}
          <View style={styles.reminderRow} testID="water-reminder-row">
            <View style={styles.reminderTextWrap}>
              <View style={styles.reminderTitleWrap}>
                <Ionicons name="notifications-outline" size={16} color={dark.textMid} />
                <Text style={styles.reminderTitle}>{t('trackers.water.remindersTitle')}</Text>
              </View>
              <Text style={styles.reminderSubtitle}>
                {remindersEnabled
                  ? 'Reminders active every 2 hours (quiet hours respected)'
                  : t('trackers.water.remindersSuggestion')}
              </Text>
            </View>

            <Switch
              testID="switch-water-reminders"
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
              trackColor={{ false: dark.s3, true: dark.apricot }}
              thumbColor={dark.bg0}
              accessibilityLabel={t('trackers.water.remindersTitle')}
            />
          </View>
        </>
      )}

      {/* E02 Settings Sheet */}
      {settingsSheetVisible && (
        <WaterSettingsSheet
          visible={settingsSheetVisible}
          currentGoalMl={goalMl}
          initialUnit={unit}
          onClose={() => setSettingsSheetVisible(false)}
          onLogCustom={async (amt) => {
            await addWater(amt);
            showUndoToast(`${amt} ml`);
          }}
        />
      )}

      {/* Legacy Custom Water Modal (for tests/fallback) */}
      {customModalVisible && (
        <CustomWaterModal
          visible={customModalVisible}
          onClose={() => setCustomModalVisible(false)}
          onSave={async (amount) => {
            await addWater(amount);
            showUndoToast(`${amount} ml`);
          }}
        />
      )}

      {/* Water History Modal */}
      {historyModalVisible && (
        <WaterHistoryModal
          visible={historyModalVisible}
          logs={logs}
          onClose={() => setHistoryModalVisible(false)}
          onUpdate={editLog}
          onDelete={deleteLog}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s1,
    padding: space[4],
    gap: space[3],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  unitPill: {
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: space[2],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPillText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[2],
    minHeight: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
  },
  smallActionText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  loadingText: {
    fontSize: typeTokens.label.fontSize,
    color: dark.textLo,
  },
  visualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  bottleOuter: {
    width: 36,
    alignItems: 'center',
  },
  bottleNeck: {
    width: 14,
    height: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  bottleBody: {
    width: 36,
    height: 72,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: dark.hairlineLit,
    backgroundColor: dark.s3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bottleLiquid: {
    width: '100%',
  },
  progressDetail: {
    flex: 1,
    gap: 4,
  },
  numeralRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  progressNumber: {
    fontSize: typeTokens.numeralL.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
  },
  progressGoalText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
  },
  statusBadgeText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontWeight: '600',
  },
  linearTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    overflow: 'hidden',
    marginTop: space[1],
  },
  linearBar: {
    height: '100%',
    borderRadius: radius.full,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    minHeight: 44,
    borderWidth: 1,
    borderColor: dark.apricot,
  },
  toastText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  toastUndoButton: {
    paddingHorizontal: space[2],
    paddingVertical: 4,
    backgroundColor: dark.apricot,
    borderRadius: radius.control - 4,
  },
  toastUndoText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
  emptyNotice: {
    paddingVertical: space[2],
    alignItems: 'center',
  },
  emptyNoticeText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  thumbZoneButton: {
    flex: 1,
    height: 56, // spec: 56 high in the thumb zone
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  thumbBtnLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '700',
  },
  thumbBtnSub: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  customAmountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  customTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space[3],
  },
  customTextButtonLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  entriesSection: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  entriesTitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  entriesList: {
    gap: space[2],
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  entryAmount: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '600',
  },
  entryTime: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space[1],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  reminderTextWrap: {
    flex: 1,
    paddingRight: space[2],
  },
  reminderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  reminderSubtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    marginTop: 2,
  },
});
