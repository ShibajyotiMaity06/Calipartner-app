import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FastingGatingResult } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FastingIntroModalProps {
  visible: boolean;
  enabled: boolean;
  gating: FastingGatingResult;
  onToggleEnabled: (enabled: boolean) => Promise<void>;
  onClose: () => void;
  testID?: string;
}

export function FastingIntroModal({
  visible,
  enabled,
  gating,
  onToggleEnabled,
  onClose,
  testID = 'fasting-intro-modal',
}: FastingIntroModalProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const handleToggle = async (val: boolean) => {
    try {
      setBusy(true);
      setErrorMsg(null);
      await onToggleEnabled(val);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to update fasting settings.');
    } finally {
      setBusy(false);
    }
  };

  const getGatingMessage = () => {
    switch (gating.reason) {
      case 'under_18':
        return t('fasting.screeningWarningUnder18');
      case 'pregnant_or_breastfeeding':
        return t('fasting.screeningWarningPregnant');
      case 'diabetes_or_medication':
        return t('fasting.screeningWarningDiabetes');
      case 'eating_disorder_history':
        return t('fasting.screeningWarningDisorder');
      case 'low_intake_paused':
        return 'Fasting is currently paused while low-intake check-in is active.';
      default:
        return t('fasting.healthScreeningRisk');
    }
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title} testID="fasting-intro-title">
                {t('fasting.fastingIntroTitle')}
              </Text>
              <Text style={styles.subtitle}>{t('fasting.fastingIntroSubtitle')}</Text>
            </View>
            <Pressable
              testID="button-close-intro-modal"
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={dark.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* If Gated Out: Explain risk and provide no enable toggle */}
            {!gating.canAccess ? (
              <View style={styles.gatedBox} testID="fasting-gating-warning">
                <Ionicons name="shield-outline" size={24} color={dark.cream} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gatedTitle}>{t('fasting.healthScreeningRisk')}</Text>
                  <Text style={styles.gatedDesc}>{getGatingMessage()}</Text>
                </View>
              </View>
            ) : (
              /* If Allowed: Switch Row */
              <View style={styles.switchCard}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel} testID="label-turn-on-fasting">
                    {t('fasting.turnOnFasting')}
                  </Text>
                  <Text style={styles.switchSublabel}>
                    Track your daily eating windows and fasting intervals.
                  </Text>
                </View>
                <Switch
                  testID="switch-turn-on-fasting"
                  value={enabled}
                  onValueChange={handleToggle}
                  disabled={busy}
                  trackColor={{ false: dark.s2, true: dark.apricot }}
                  thumbColor={dark.textHi}
                  accessibilityLabel={t('fasting.turnOnFasting')}
                />
              </View>
            )}

            {/* Informational Guidance */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionHeading}>{t('fasting.whoShouldNotFast')}</Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletRow}>
                  <Ionicons name="ellipse" size={6} color={dark.textMid} style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    Anyone who is pregnant, nursing, or trying to conceive.
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Ionicons name="ellipse" size={6} color={dark.textMid} style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    Individuals with a current or prior history of eating disorders.
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Ionicons name="ellipse" size={6} color={dark.textMid} style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    Anyone with diabetes or taking blood-sugar regulating medications.
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Ionicons name="ellipse" size={6} color={dark.textMid} style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    Children and adolescents under the age of 18.
                  </Text>
                </View>
              </View>
            </View>

            {/* Supportive Notice */}
            <View style={styles.neutralCard}>
              <Ionicons name="heart-outline" size={18} color={dark.teal} />
              <Text style={styles.neutralCardText}>
                Fasting is an optional scheduling rhythm. It is never included in room leaderboards,
                consistency points, or partner comparisons.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Done Button */}
          <View style={styles.footer}>
            <Pressable
              testID="button-intro-done"
              style={({ pressed }) => [styles.doneButton, pressed && styles.buttonPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space[4],
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[4],
  },
  title: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    gap: space[4],
    paddingBottom: space[3],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    padding: space[3],
    borderRadius: radius.control,
    gap: space[2],
  },
  errorText: {
    flex: 1,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.danger,
  },
  gatedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 248, 230, 0.08)',
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 230, 0.25)',
    gap: space[3],
  },
  gatedTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.cream,
    marginBottom: 2,
  },
  gatedDesc: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    lineHeight: 18,
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  switchInfo: {
    flex: 1,
    paddingRight: space[3],
  },
  switchLabel: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
    marginBottom: 2,
  },
  switchSublabel: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  infoSection: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  sectionHeading: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
    marginBottom: space[2],
  },
  bulletList: {
    gap: space[2],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[1],
  },
  bulletDot: {
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    lineHeight: 18,
  },
  neutralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[2],
  },
  neutralCardText: {
    flex: 1,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
    lineHeight: 18,
  },
  footer: {
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  doneButton: {
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  doneButtonText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '600',
    color: dark.textHi,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
