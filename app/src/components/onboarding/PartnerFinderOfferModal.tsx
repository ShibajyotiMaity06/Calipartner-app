import React, { useState } from 'react';
import { View, StyleSheet, Modal, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Text,
  Button,
  SwitchRow,
  space,
  dark,
  radius,
  Avatar,
  useReducedMotion,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound, playToggleSound, playSuccessSound } from '@/lib/sound';

export interface PartnerFinderOfferModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  onSetPreferences?: () => void;
  testID?: string;
}

export function PartnerFinderOfferModal({
  visible,
  onClose,
  onAccept,
  onSetPreferences,
  testID = 'partner-finder-offer-modal',
}: PartnerFinderOfferModalProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [openToPartner, setOpenToPartner] = useState(false);

  const handleToggle = (val: boolean) => {
    playToggleSound();
    setOpenToPartner(val);
  };

  const handlePartnerCardPress = () => {
    playClickSound();
    onClose();
    router.push('/paywall' as never);
  };

  const handleConfirm = () => {
    playSuccessSound();
    if (openToPartner && onAccept) {
      onAccept();
    }
    onClose();
  };

  const handleSetPreferences = () => {
    playClickSound();
    onSetPreferences?.();
    onClose();
  };

  const handleMaybeLater = () => {
    playClickSound();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              variant="title1"
              color={dark.textHi}
              style={styles.title}
              testID="partner-offer-title"
            >
              Want a workout partner?
            </Text>
            <Text variant="body" color={dark.textMid} style={styles.subtitle}>
              We can suggest people with similar goals. You choose who to say hi to.
            </Text>
          </View>

          {/* Demo Partner Preview Card (Tappable to Paywall) */}
          <View style={styles.cardPreviewWrapper}>
            <TouchableOpacity
              onPress={handlePartnerCardPress}
              activeOpacity={0.85}
              style={styles.matchCard}
              accessibilityRole="button"
              accessibilityLabel="Demo partner card. Tap to view room plan."
              testID="demo-partner-card"
            >
              <View style={styles.matchCardTop}>
                <Avatar
                  name="Partner"
                  identityHue="teal"
                  size="md"
                  testID="partner-preview-avatar"
                />
                <View style={styles.matchBadgeRow}>
                  <Text variant="bodyS" color={dark.textHi}>
                    {t('onboarding.goal.cutTitle')}
                  </Text>
                  <View style={styles.adherenceBadge}>
                    <Text variant="label" color={dark.teal} style={styles.adherenceText}>
                      88% adherence
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.bandedFields}>
                <Text variant="body" color={dark.textHi} style={styles.bandedTitle}>
                  25–34 · Strength & walks · Bangalore
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.bioLine}>
                  &ldquo;Working towards consistency and looking for a daily accountability
                  partner.&rdquo;
                </Text>
              </View>

              {/* Gentle indication to upgrade/view room plan */}
              <View style={styles.privacyPill}>
                <Text variant="label" color={dark.apricot}>
                  Demo Partner · Tap to explore Room Plan ›
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* SwitchRow for Open to Partner (off by default) */}
          <View style={styles.switchSection}>
            <SwitchRow
              title="Open to a partner"
              consequence="You can change this or turn it off anytime in settings."
              value={openToPartner}
              onValueChange={handleToggle}
              testID="toggle-open-to-partner"
              style={styles.switchCard}
            />

            <Text variant="label" color={dark.textLo} style={styles.smallDisclaimer}>
              Browsing and sending needs a room plan. Anyone can accept.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {openToPartner ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  label="Enable & Continue"
                  onPress={handleConfirm}
                  testID="btn-enable-partner-continue"
                />
                <Button
                  variant="secondary"
                  size="md"
                  label="Set preferences"
                  onPress={handleSetPreferences}
                  testID="btn-set-partner-preferences"
                />
              </>
            ) : (
              <Button
                variant="primary"
                size="lg"
                label="Continue to CaliPartner"
                onPress={handleConfirm}
                testID="btn-continue-partner"
              />
            )}

            <Button
              variant="secondary"
              size="md"
              label="Maybe later"
              onPress={handleMaybeLater}
              testID="btn-maybe-later-partner"
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[4],
    justifyContent: 'space-between',
  },
  header: {
    gap: space[2],
  },
  title: {
    letterSpacing: -0.4,
  },
  subtitle: {
    lineHeight: 22,
  },
  cardPreviewWrapper: {
    marginVertical: space[4],
  },
  matchCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    padding: space[4],
    gap: space[3],
  },
  matchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  adherenceBadge: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  adherenceText: {
    fontWeight: '600',
  },
  bandedFields: {
    gap: space[1],
  },
  bandedTitle: {
    fontWeight: '600',
  },
  bioLine: {
    lineHeight: 20,
    fontStyle: 'italic',
  },
  privacyPill: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
    marginTop: space[1],
  },
  switchSection: {
    gap: space[2],
  },
  switchCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
  },
  smallDisclaimer: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: space[2],
  },
  actions: {
    gap: space[3],
    paddingTop: space[2],
  },
});
