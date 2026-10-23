import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, dark, radius, space, Text } from '@calipartner/ui';
import { useWater } from '@/hooks/useWater';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/services/notificationSettingsService';
import { syncAllLocalReminders } from '@/services/localNotificationService';

export interface WaterAlarmModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate?: string;
  testID?: string;
}

export function WaterAlarmModal({
  visible,
  onClose,
  selectedDate,
  testID = 'water-alarm-modal',
}: WaterAlarmModalProps) {
  const { totalMl, goalMl, addWater } = useWater(selectedDate);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(2);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('20:00');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customAmountText, setCustomAmountText] = useState('');

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const settings = await getNotificationSettings();
        if (mounted && settings) {
          setRemindersEnabled(settings.water_reminders_enabled ?? true);
          setIntervalHours(settings.water_interval_hours ?? 2);
          setStartTime(settings.water_start_time ?? '08:00');
          setEndTime(settings.water_end_time ?? '20:00');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const handleQuickAdd = async (amount: number) => {
    try {
      await addWater(amount);
      setToastMessage(`Added ${amount} ml!`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // Ignored
    }
  };

  const handleCustomAdd = async () => {
    const val = parseInt(customAmountText.trim(), 10);
    if (!isNaN(val) && val > 0 && val <= 5000) {
      await handleQuickAdd(val);
      setCustomAmountText('');
    }
  };

  const handleSaveAlarms = async () => {
    try {
      setSaving(true);
      const updated = await updateNotificationSettings({
        water_reminders_enabled: remindersEnabled,
        water_interval_hours: intervalHours,
        water_start_time: startTime,
        water_end_time: endTime,
      });

      if (updated) {
        await syncAllLocalReminders(updated);
      }

      setToastMessage(
        remindersEnabled
          ? `Water alarm notifications set every ${intervalHours} hours on your phone.`
          : 'Water reminders paused.',
      );
      setTimeout(() => {
        setToastMessage(null);
        onClose();
      }, 1500);
    } catch {
      setToastMessage('Could not save reminder settings.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = Math.min(100, Math.round(goalMl > 0 ? (totalMl / goalMl) * 100 : 0));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="water" size={20} color={dark.teal} />
              </View>
              <View>
                <Text variant="heading" color={dark.textHi}>
                  Water & Hydration
                </Text>
                <Text variant="micro" color={dark.textLo}>
                  Track intake & schedule phone alarms
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressTopRow}>
                <View>
                  <Text variant="bodyS" color={dark.textLo}>
                    Today's Intake
                  </Text>
                  <Text variant="numeralL" color={dark.textHi}>
                    {(totalMl / 1000).toFixed(1)} / {(goalMl / 1000).toFixed(1)} L
                  </Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text variant="numeralM" color={dark.teal}>
                    {progressPercent}%
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>

              {/* Quick Add Buttons */}
              <View style={styles.quickAddRow}>
                <Pressable
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickAdd(250)}
                  accessibilityLabel="Add 250 ml glass"
                >
                  <Ionicons name="pint-outline" size={16} color={dark.teal} />
                  <Text variant="bodyS" color={dark.textHi}>
                    +250 ml
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickAdd(500)}
                  accessibilityLabel="Add 500 ml bottle"
                >
                  <Ionicons name="water-outline" size={16} color={dark.teal} />
                  <Text variant="bodyS" color={dark.textHi}>
                    +500 ml
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.quickAddBtn}
                  onPress={() => handleQuickAdd(750)}
                  accessibilityLabel="Add 750 ml flask"
                >
                  <Ionicons name="flask-outline" size={16} color={dark.teal} />
                  <Text variant="bodyS" color={dark.textHi}>
                    +750 ml
                  </Text>
                </Pressable>
              </View>

              {/* Custom Quantity Input */}
              <View style={styles.customWaterRow}>
                <TextInput
                  value={customAmountText}
                  onChangeText={setCustomAmountText}
                  placeholder="Or enter custom ml (e.g. 350)"
                  placeholderTextColor={dark.textLo}
                  keyboardType="numeric"
                  style={styles.customWaterInput}
                />
                <TouchableOpacity
                  onPress={handleCustomAdd}
                  style={styles.customWaterAddBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom water amount"
                >
                  <Text variant="bodyS" color={dark.onBrand} style={{ fontWeight: '700' }}>
                    + Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Phone Notification Alarm Section */}
            <View style={styles.alarmSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="notifications" size={18} color={dark.apricot} />
                <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                  Phone Hydration Alarms
                </Text>
              </View>
              <Text variant="bodyS" color={dark.textLo} style={styles.sectionDesc}>
                Receive audible phone reminders so you never forget to drink water.
              </Text>

              {loading ? (
                <ActivityIndicator color={dark.apricot} style={{ marginVertical: 20 }} />
              ) : (
                <>
                  {/* Enable Alarm Toggle */}
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '600' }}>
                        Drink Water Notifications
                      </Text>
                      <Text variant="micro" color={dark.textLo}>
                        Phone alarm sound and notification banner
                      </Text>
                    </View>
                    <Switch
                      value={remindersEnabled}
                      onValueChange={setRemindersEnabled}
                      trackColor={{ false: dark.s2, true: dark.teal }}
                      thumbColor={dark.textHi}
                    />
                  </View>

                  {remindersEnabled && (
                    <View style={styles.optionsContainer}>
                      <Text variant="bodyS" color={dark.textMid} style={styles.optionLabel}>
                        Reminder Frequency:
                      </Text>
                      <View style={styles.chipsRow}>
                        {[
                          { hours: 1, label: 'Every 1 hr' },
                          { hours: 2, label: 'Every 2 hrs' },
                          { hours: 3, label: 'Every 3 hrs' },
                          { hours: 4, label: 'Every 4 hrs' },
                        ].map((item) => (
                          <Pressable
                            key={item.hours}
                            style={[
                              styles.chip,
                              intervalHours === item.hours && styles.chipActive,
                            ]}
                            onPress={() => setIntervalHours(item.hours)}
                            accessibilityLabel={item.label}
                          >
                            <Text
                              variant="bodyS"
                              color={intervalHours === item.hours ? dark.onBrand : dark.textMid}
                              style={{ fontWeight: intervalHours === item.hours ? '700' : '500' }}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Daily Window */}
                      <View style={styles.timeWindowBox}>
                        <Ionicons name="time-outline" size={16} color={dark.textLo} />
                        <Text variant="micro" color={dark.textLo}>
                          Active daily from {startTime} to {endTime} (quiet hours respected)
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            {toastMessage && (
              <View style={styles.toastBox}>
                <Ionicons name="checkmark-circle" size={16} color={dark.teal} />
                <Text variant="bodyS" color={dark.textHi} style={{ marginLeft: 6 }}>
                  {toastMessage}
                </Text>
              </View>
            )}

            {/* Action Button */}
            <View style={styles.actionRow}>
              <Button
                variant="primary"
                label="Save Alarm Settings"
                onPress={handleSaveAlarms}
                loading={saving}
                fullWidth
              />
            </View>
          </ScrollView>
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
  sheetContainer: {
    backgroundColor: dark.bg0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 178, 172, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dark.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  progressCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    marginBottom: space[4],
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  percentBadge: {
    backgroundColor: 'rgba(56, 178, 172, 0.15)',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: space[4],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: dark.teal,
    borderRadius: radius.full,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  quickAddBtn: {
    flex: 1,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingVertical: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  customWaterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
  },
  customWaterInput: {
    flex: 1,
    height: 44,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: 14,
  },
  customWaterAddBtn: {
    height: 44,
    paddingHorizontal: space[4],
    backgroundColor: dark.apricot,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmSection: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    marginBottom: space[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[1],
  },
  sectionDesc: {
    marginBottom: space[3],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  optionsContainer: {
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  optionLabel: {
    marginBottom: space[2],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[3],
  },
  chip: {
    flex: 1,
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  timeWindowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    padding: space[2],
    borderRadius: radius.control,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    padding: space[3],
    borderRadius: radius.control,
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: dark.teal,
  },
  actionRow: {
    paddingVertical: space[2],
    marginBottom: space[4],
  },
});
