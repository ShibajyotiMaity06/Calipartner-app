import React, { useState } from 'react';
import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';
import { Sheet } from './Sheet';
import { Button } from './Button';

export interface VisibilityEyeProps {
  /** Who can see this item (e.g. "Room members", "Only you", "Partners") */
  audience?: string;
  /** Explanatory description */
  description?: string;
  /** Optional callback to open privacy settings */
  onOpenPrivacySettings?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function VisibilityEye({
  audience = 'Room members',
  description = 'Your room partners can see this item in today’s feed.',
  onOpenPrivacySettings,
  accessibilityLabel = 'Sharing privacy indicator',
  testID,
  style,
}: VisibilityEyeProps): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: visible to ${audience}`}
        testID={testID}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} // 44x44 minimum touch target
        style={[styles.hitArea, style]}
      >
        <View style={styles.eyeGlyph}>
          {/* 14px minimalist line-art eye glyph */}
          <View style={styles.eyeOutline}>
            <View style={styles.pupil} />
          </View>
        </View>
      </Pressable>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        snapPoint="half"
        accessibilityLabel="Privacy explanation sheet"
      >
        <View style={styles.sheetContent}>
          <Text variant="title2" color={dark.textHi}>
            Who can see this?
          </Text>

          <View style={styles.audienceChip}>
            <Text variant="label" color={dark.apricot}>
              {audience}
            </Text>
          </View>

          <Text variant="body" color={dark.textMid} style={styles.sheetDescription}>
            {description}
          </Text>

          <View style={styles.buttonRow}>
            {onOpenPrivacySettings ? (
              <Button
                variant="secondary"
                size="md"
                label="Privacy settings"
                onPress={() => {
                  setSheetOpen(false);
                  onOpenPrivacySettings();
                }}
              />
            ) : null}

            <Button
              variant="primary"
              size="md"
              label="Got it"
              onPress={() => setSheetOpen(false)}
            />
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeGlyph: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeOutline: {
    width: 14,
    height: 9,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: dark.textLo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: dark.textLo,
  },
  sheetContent: {
    padding: space[5], // 20
    gap: space[3], // 12
  },
  audienceChip: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    alignSelf: 'flex-start',
  },
  sheetDescription: {
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[3],
  },
});
