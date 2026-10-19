import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space } from '@calipartner/ui';
import { Text } from '@calipartner/ui';
import { Button } from '@calipartner/ui';

export interface WhatTheyCanSeeSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
  partnerName?: string;
  roomName?: string;
  itemType?: 'meal' | 'steps' | 'water' | 'workout' | 'general';
}

/**
 * J04 · What they can see (sheet from the 14px visibility eye glyph)
 * Explains exactly who sees this and why, with a link to privacy settings (PRV-1, CMP-23).
 */
export function WhatTheyCanSeeSheet({
  visible,
  onClose,
  onOpenPrivacy,
  partnerName = 'Your partner',
  roomName = 'your room',
  itemType = 'meal',
}: WhatTheyCanSeeSheetProps): React.JSX.Element {
  const explanation = React.useMemo(() => {
    switch (itemType) {
      case 'meal':
        return `${partnerName} can see that you logged your meal, but not what you ate or your calorie breakdown.`;
      case 'steps':
        return `${partnerName} can see your daily step count progress bar in ${roomName}.`;
      case 'water':
        return `${partnerName} can see your total water intake progress for today.`;
      case 'workout':
        return `${partnerName} can see your active workout status and duration.`;
      default:
        return `${partnerName} can see that you completed your daily logging in ${roomName}.`;
    }
  }, [partnerName, roomName, itemType]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} testID="sheet-who-sees-this">
          <View style={styles.grabber} />

          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <View style={styles.iconCircle}>
                <Ionicons name="eye-outline" size={18} color={dark.apricot} />
              </View>
              <Text variant="heading" color={dark.textHi}>
                Who sees this
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              testID="btn-close-who-sees-this"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <View style={styles.contentBox}>
            <Text variant="bodyS" color={dark.textHi} style={styles.explanationText}>
              {explanation}
            </Text>

            <View style={styles.privacyNoteRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={dark.teal} />
              <Text variant="micro" color={dark.textMid} style={styles.privacyNoteText}>
                Your raw calorie limits, weight entries, and personal notes are never shared without explicit consent.
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {onOpenPrivacy && (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenPrivacy();
                }}
                style={styles.privacyLink}
                accessibilityRole="button"
                accessibilityLabel="Change privacy settings"
                testID="btn-change-privacy-link"
              >
                <Ionicons name="lock-closed-outline" size={16} color={dark.apricot} />
                <Text variant="label" color={dark.apricot}>
                  Change privacy
                </Text>
              </Pressable>
            )}

            <Button
              variant="secondary"
              size="md"
              label="Done"
              onPress={onClose}
              style={styles.doneBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: dark.hairlineLit,
    padding: space[4],
    paddingBottom: space[7],
    gap: space[3],
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[1],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBox: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[3],
  },
  explanationText: {
    lineHeight: 20,
  },
  privacyNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[1],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  privacyNoteText: {
    flex: 1,
    lineHeight: 16,
  },
  actionRow: {
    marginTop: space[2],
    gap: space[3],
  },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[2],
    minHeight: 44,
  },
  doneBtn: {
    width: '100%',
  },
});
