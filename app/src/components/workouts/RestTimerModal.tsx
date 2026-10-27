import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface RestTimerModalProps {
  visible: boolean;
  initialSeconds?: number;
  onClose: () => void;
  onComplete?: () => void;
  testID?: string;
}

const PRESET_INTERVALS = [30, 60, 90, 120, 180];

function RestTimerModalContent({
  visible,
  initialSeconds = 90,
  onClose,
  onComplete,
  testID = 'rest-timer-modal',
}: RestTimerModalProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setRemainingSeconds(initialSeconds);
      setIsRunning(true);
    }
  }, [visible, initialSeconds]);

  useEffect(() => {
    if (!visible || !isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, isRunning, onComplete]);

  if (!visible) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAdd15 = () => {
    setRemainingSeconds((prev) => prev + 15);
  };

  const handleSelectPreset = (secs: number) => {
    setRemainingSeconds(secs);
    setIsRunning(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />

        <View style={styles.card} testID="rest-timer-content">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="timer-outline" size={20} color={dark.apricot} />
              <Text style={styles.title}>{t('workouts.restTimerTitle')}</Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close rest timer"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          {/* Large Countdown Display */}
          <View style={styles.timerDisplayBox} testID="rest-timer-countdown">
            <Text style={styles.numeralTime}>{formatTime(remainingSeconds)}</Text>
            <Text style={styles.timerSubtitle}>
              {remainingSeconds === 0 ? t('workouts.restTimerDone') : 'Resting before next set'}
            </Text>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetsRow}>
            {PRESET_INTERVALS.map((secs) => (
              <Pressable
                key={secs}
                testID={`btn-preset-${secs}`}
                style={[styles.presetChip, remainingSeconds === secs && styles.presetChipActive]}
                onPress={() => handleSelectPreset(secs)}
                accessibilityRole="button"
                accessibilityLabel={`${secs} seconds rest`}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    remainingSeconds === secs && styles.presetChipTextActive,
                  ]}
                >
                  {`${secs}s`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Action Row: +15s and Skip */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-rest-timer-add15"
              style={styles.add15Btn}
              onPress={handleAdd15}
              accessibilityRole="button"
              accessibilityLabel={t('workouts.add15s')}
            >
              <Ionicons name="add" size={18} color={dark.textHi} />
              <Text style={styles.add15BtnText}>{t('workouts.add15s')}</Text>
            </Pressable>

            <Pressable
              testID="btn-rest-timer-skip"
              style={styles.skipBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('workouts.skipRest')}
            >
              <Text style={styles.skipBtnText}>{t('workouts.skipRest')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
  card: {
    width: '100%',
    backgroundColor: dark.s1,
    borderRadius: radius.sheet,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDisplayBox: {
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    paddingVertical: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 4,
  },
  numeralTime: {
    fontSize: 54,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerSubtitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[1],
  },
  presetChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  presetChipText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: dark.onBrand, // #1C1109
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  add15Btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 4,
  },
  add15BtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  skipBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
});

export function RestTimerModal(props: RestTimerModalProps) {
  return (
    <PremiumFeatureModal feature="rest_timer_prs" visible={props.visible} onClose={props.onClose}>
      <RestTimerModalContent {...props} />
    </PremiumFeatureModal>
  );
}
