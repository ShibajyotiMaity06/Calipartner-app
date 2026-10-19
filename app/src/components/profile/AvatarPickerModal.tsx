import React, { useState } from 'react';
import { View, StyleSheet, Modal, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Avatar,
  ChevronLeftIcon,
  space,
  dark,
  radius,
  type IdentityHue,
} from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';

export interface AvatarOption {
  id: string;
  name: string;
  hue: IdentityHue;
}

// 24 illustrated/colored avatars in the 6 identity hues (Spec B05)
export const AVATAR_PRESETS: AvatarOption[] = [
  // Iris (4)
  { id: 'iris-1', name: 'Alex', hue: 'iris' },
  { id: 'iris-2', name: 'Arya', hue: 'iris' },
  { id: 'iris-3', name: 'Aditi', hue: 'iris' },
  { id: 'iris-4', name: 'Aman', hue: 'iris' },

  // Teal (4)
  { id: 'teal-1', name: 'Priya', hue: 'teal' },
  { id: 'teal-2', name: 'Pranav', hue: 'teal' },
  { id: 'teal-3', name: 'Pooja', hue: 'teal' },
  { id: 'teal-4', name: 'Paras', hue: 'teal' },

  // Rose (4)
  { id: 'rose-1', name: 'Rohan', hue: 'rose' },
  { id: 'rose-2', name: 'Riya', hue: 'rose' },
  { id: 'rose-3', name: 'Rahul', hue: 'rose' },
  { id: 'rose-4', name: 'Rani', hue: 'rose' },

  // Mint (4)
  { id: 'mint-1', name: 'Meera', hue: 'mint' },
  { id: 'mint-2', name: 'Manav', hue: 'mint' },
  { id: 'mint-3', name: 'Maya', hue: 'mint' },
  { id: 'mint-4', name: 'Mohit', hue: 'mint' },

  // Sky (4)
  { id: 'sky-1', name: 'Siddharth', hue: 'sky' },
  { id: 'sky-2', name: 'Sneha', hue: 'sky' },
  { id: 'sky-3', name: 'Samir', hue: 'sky' },
  { id: 'sky-4', name: 'Simran', hue: 'sky' },

  // Orchid (4)
  { id: 'orchid-1', name: 'Kavya', hue: 'orchid' },
  { id: 'orchid-2', name: 'Karan', hue: 'orchid' },
  { id: 'orchid-3', name: 'Kiran', hue: 'orchid' },
  { id: 'orchid-4', name: 'Kabir', hue: 'orchid' },
];

export interface AvatarPickerModalProps {
  visible: boolean;
  selectedAvatarId?: string;
  onSelectAvatar: (avatar: AvatarOption) => void;
  onClose: () => void;
  testID?: string;
}

export function AvatarPickerModal({
  visible,
  selectedAvatarId = 'iris-1',
  onSelectAvatar,
  onClose,
  testID = 'avatar-picker-modal',
}: AvatarPickerModalProps) {
  const [currentSelected, setCurrentSelected] = useState(selectedAvatarId);

  const handlePick = (option: AvatarOption) => {
    playClickSound();
    setCurrentSelected(option.id);
  };

  const handleConfirm = () => {
    const chosen = AVATAR_PRESETS.find((a) => a.id === currentSelected) ?? AVATAR_PRESETS[0]!;
    onSelectAvatar(chosen);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-avatar-picker-back"
            >
              <ChevronLeftIcon size={20} color={dark.textHi} />
              <Text variant="body" color={dark.textHi}>
                Back
              </Text>
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi} style={styles.topTitle}>
              Choose Avatar
            </Text>
            <View style={styles.spacer} />
          </View>

          {/* Subtitle & Privacy Notice (Spec B05) */}
          <View style={styles.noticeSection}>
            <Text variant="body" color={dark.textMid} style={styles.noticeText}>
              Pick an identity avatar or upload a photo. Photo is never shown to strangers in
              Partner Finder.
            </Text>
          </View>

          {/* Grid of 24 avatars */}
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {AVATAR_PRESETS.map((avatar) => {
              const isSelected = currentSelected === avatar.id;
              return (
                <TouchableOpacity
                  key={avatar.id}
                  onPress={() => handlePick(avatar)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Avatar ${avatar.name}, ${avatar.hue}`}
                  testID={`avatar-preset-${avatar.id}`}
                  style={[styles.avatarCell, isSelected && styles.avatarCellSelected]}
                >
                  <Avatar name={avatar.name} identityHue={avatar.hue} size="lg" />
                  <Text
                    variant="label"
                    color={isSelected ? dark.apricot : dark.textLo}
                    style={styles.avatarLabel}
                  >
                    {avatar.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              label="Select avatar"
              onPress={handleConfirm}
              testID="btn-confirm-avatar"
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
    justifyContent: 'space-between',
    paddingBottom: space[4],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingTop: space[1],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minWidth: 44,
    minHeight: 44,
  },
  topTitle: {
    fontWeight: '600',
  },
  spacer: {
    width: 60,
  },
  noticeSection: {
    paddingVertical: space[2],
  },
  noticeText: {
    lineHeight: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    gap: space[3],
  },
  avatarCell: {
    width: '22%',
    alignItems: 'center',
    padding: space[2],
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: space[1],
  },
  avatarCellSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  avatarLabel: {
    fontWeight: '500',
  },
  footer: {
    paddingTop: space[2],
  },
});
