import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FastingSafetyCheckInModalProps {
  visible: boolean;
  variant: 'checkIn20' | 'checkIn24' | 'unwell';
  onEndFast: () => void | Promise<void>;
  onKeepGoing?: () => void;
  onClose: () => void;
  testID?: string;
}

export function FastingSafetyCheckInModal({
  visible,
  variant: initialVariant,
  onEndFast,
  onKeepGoing,
  onClose,
  testID = 'fasting-safety-modal',
}: FastingSafetyCheckInModalProps) {
  const [currentVariant, setCurrentVariant] = useState<'checkIn20' | 'checkIn24' | 'unwell'>(
    initialVariant,
  );

  React.useEffect(() => {
    setCurrentVariant(initialVariant);
  }, [initialVariant, visible]);

  if (!visible) return null;

  const is24h = currentVariant === 'checkIn24';
  const isUnwell = currentVariant === 'unwell';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID={`${testID}-content`}>
          {/* Header Icon */}
          <View style={[styles.iconCircle, isUnwell && styles.iconCircleDanger]}>
            <Ionicons
              name={
                isUnwell
                  ? 'heart-dislike-outline'
                  : is24h
                    ? 'restaurant-outline'
                    : 'shield-checkmark-outline'
              }
              size={28}
              color={isUnwell ? dark.danger : dark.apricot}
            />
          </View>

          {/* Title and Subtitle */}
          <View style={styles.header}>
            <Text style={styles.title} testID="fasting-safety-title">
              {isUnwell
                ? t('fasting.checkInFeelingUnwell')
                : is24h
                  ? t('fasting.checkIn24Title')
                  : t('fasting.checkIn20Title')}
            </Text>
            <Text style={styles.subtitle} testID="fasting-safety-subtitle">
              {isUnwell
                ? t('fasting.unwellHelp')
                : is24h
                  ? t('fasting.checkIn24Subtitle')
                  : t('fasting.checkIn20Subtitle')}
            </Text>
          </View>

          {/* Neutral supportive notes */}
          <View style={styles.adviceBox}>
            <Ionicons name="information-circle-outline" size={16} color={dark.textMid} />
            <Text style={styles.adviceText}>
              {is24h
                ? 'Hydrate with plain water and have a small, easily digestible meal.'
                : 'Drink water, stay mindful of energy levels, and stop anytime you feel dizzy.'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Primary End Fast Button */}
            <Pressable
              testID="button-safety-end-fast"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={onEndFast}
              accessibilityRole="button"
              accessibilityLabel={t('fasting.endFast')}
            >
              <Text style={styles.primaryButtonText}>{t('fasting.endFast')}</Text>
            </Pressable>

            {/* Keep Going Option for 20h */}
            {!is24h && !isUnwell && onKeepGoing && (
              <Pressable
                testID="button-safety-keep-going"
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={onKeepGoing}
                accessibilityRole="button"
                accessibilityLabel={t('fasting.checkIn20Keep')}
              >
                <Text style={styles.secondaryButtonText}>{t('fasting.checkIn20Keep')}</Text>
              </Pressable>
            )}

            {/* I feel unwell toggle (only in 20h mode) */}
            {!is24h && !isUnwell && (
              <Pressable
                testID="button-safety-unwell"
                style={({ pressed }) => [styles.textButton, pressed && styles.buttonPressed]}
                onPress={() => setCurrentVariant('unwell')}
                accessibilityRole="button"
                accessibilityLabel={t('fasting.checkInFeelingUnwell')}
              >
                <Text style={styles.textButtonLabel}>{t('fasting.checkInFeelingUnwell')}</Text>
              </Pressable>
            )}

            {/* Unwell mode close/back */}
            {isUnwell && (
              <Pressable
                testID="button-safety-cancel"
                style={styles.textButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.textButtonLabel}>Dismiss</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[4],
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 179, 138, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space[3],
  },
  iconCircleDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  header: {
    alignItems: 'center',
    marginBottom: space[4],
  },
  title: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    textAlign: 'center',
    marginBottom: space[1],
  },
  subtitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textMid,
    textAlign: 'center',
    lineHeight: 22,
  },
  adviceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: dark.s1,
    borderRadius: radius.control,
    padding: space[3],
    marginBottom: space[5],
    gap: space[2],
    width: '100%',
  },
  adviceText: {
    flex: 1,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
    gap: space[2],
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: dark.apricot,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[4],
  },
  primaryButtonText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.onBrand,
  },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  secondaryButtonText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButtonLabel: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
