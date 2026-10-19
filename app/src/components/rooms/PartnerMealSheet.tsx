import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealSection, RoomReactionType } from '@calipartner/core';
import { dark, radius, space, Text, Button, HiddenMetric } from '@calipartner/ui';

export interface PartnerMealItem {
  id: string;
  name: string;
  portion: string;
  calories?: number;
}

export interface PartnerMealSheetProps {
  visible: boolean;
  onClose: () => void;
  partnerName: string;
  mealSection: MealSection;
  isLogged: boolean;
  isDataHidden?: boolean;
  items?: PartnerMealItem[];
  isTaggedMeal?: boolean;
  onAddToMyDiary?: () => void;
  onSendReaction?: (reaction: RoomReactionType) => void;
}

const REACTIONS: { type: RoomReactionType; emoji: string; label: string }[] = [
  { type: 'clap', emoji: '👏', label: 'Applause' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'muscle', emoji: '💪', label: 'Muscle' },
  { type: 'heart', emoji: '❤️', label: 'Heart' },
  { type: 'party', emoji: '🎉', label: 'Party' },
];

/**
 * J07 · Partner's meal viewer (sheet)
 * Displays partner's meal details, portions, reaction picker, and optional "Add to my diary" (RV-5, SOC-2).
 */
export function PartnerMealSheet({
  visible,
  onClose,
  partnerName,
  mealSection,
  isLogged,
  isDataHidden = false,
  items = [],
  isTaggedMeal = false,
  onAddToMyDiary,
  onSendReaction,
}: PartnerMealSheetProps): React.JSX.Element {
  const sectionTitle = mealSection.charAt(0).toUpperCase() + mealSection.slice(1);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} testID="sheet-partner-meal">
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text variant="heading" color={dark.textHi}>
                {`${partnerName}'s ${sectionTitle}`}
              </Text>
              <Text variant="micro" color={dark.textMid}>
                {isLogged ? 'Logged today' : 'Not logged yet'}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              testID="btn-close-partner-meal"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          {/* Meal Contents or Hidden State */}
          <View style={styles.contentBox}>
            {isDataHidden ? (
              <View style={styles.hiddenStateBox}>
                <HiddenMetric label="Meal details are private" />
                <Text variant="bodyS" color={dark.textMid} style={styles.hiddenSubtext}>
                  {`${partnerName} has kept food names and calories private.`}
                </Text>
              </View>
            ) : !isLogged ? (
              <View style={styles.unloggedBox}>
                <Ionicons name="restaurant-outline" size={32} color={dark.textLo} />
                <Text variant="bodyS" color={dark.textMid} style={styles.unloggedText}>
                  {`${partnerName} hasn't logged ${mealSection} yet today.`}
                </Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="checkmark-circle-outline" size={28} color={dark.teal} />
                <Text variant="bodyS" color={dark.textHi}>
                  {`${sectionTitle} was logged.`}
                </Text>
                <Text variant="micro" color={dark.textMid}>
                  Items are summarized for privacy.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {items.map((it) => (
                  <View key={it.id} style={styles.itemRow}>
                    <View style={styles.itemBullet} />
                    <View style={styles.itemTextWrap}>
                      <Text variant="bodyS" color={dark.textHi}>
                        {it.name}
                      </Text>
                      <Text variant="micro" color={dark.textMid}>
                        {it.portion}
                      </Text>
                    </View>
                    {it.calories != null && (
                      <Text variant="label" color={dark.textMid}>
                        {`${it.calories} kcal`}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Reaction Picker Row (SOC-2: 5 fixed reactions) */}
          <View style={styles.reactionsSection}>
            <Text variant="micro" color={dark.textMid} style={styles.reactionTitle}>
              Send a reaction:
            </Text>
            <View style={styles.reactionRow}>
              {REACTIONS.map((r) => (
                <TouchableOpacity
                  key={r.type}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSendReaction?.(r.type);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${r.label}`}
                  style={styles.reactionBtn}
                  testID={`btn-react-${r.type}`}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            {isTaggedMeal && onAddToMyDiary && (
              <Button
                variant="primary"
                size="md"
                label={`Add to ${mealSection}`}
                onPress={() => {
                  onClose();
                  onAddToMyDiary();
                }}
                style={styles.actionBtn}
                testID="btn-add-partner-meal-diary"
              />
            )}

            <Button
              variant="secondary"
              size="md"
              label="Close"
              onPress={onClose}
              style={styles.actionBtn}
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
    minHeight: 90,
    justifyContent: 'center',
  },
  hiddenStateBox: {
    alignItems: 'center',
    paddingVertical: space[2],
    gap: space[2],
  },
  hiddenSubtext: {
    textAlign: 'center',
  },
  unloggedBox: {
    alignItems: 'center',
    paddingVertical: space[3],
    gap: space[2],
  },
  unloggedText: {
    textAlign: 'center',
  },
  emptyItemsBox: {
    alignItems: 'center',
    paddingVertical: space[2],
    gap: space[1],
  },
  itemsList: {
    gap: space[2],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  itemBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.teal,
  },
  itemTextWrap: {
    flex: 1,
  },
  reactionsSection: {
    gap: space[2],
  },
  reactionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  actionRow: {
    gap: space[2],
    marginTop: space[2],
  },
  actionBtn: {
    width: '100%',
  },
});
