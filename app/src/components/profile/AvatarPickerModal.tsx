import React, { useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  ChevronLeftIcon,
  dark,
  radius,
  space,
  Text,
  type IdentityHue,
} from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface AvatarOption {
  id: string;
  name: string;
  hue: IdentityHue;
  uri?: string;
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
  currentAvatarUri?: string | null;
  onSelectAvatar: (avatar: AvatarOption) => void;
  onSelectCustomPhoto?: (uri: string) => void;
  onClose: () => void;
  testID?: string;
}

export function AvatarPickerModal({
  visible,
  selectedAvatarId = 'iris-1',
  currentAvatarUri,
  onSelectAvatar,
  onSelectCustomPhoto,
  onClose,
  testID = 'avatar-picker-modal',
}: AvatarPickerModalProps) {
  const [currentSelected, setCurrentSelected] = useState<string>(
    currentAvatarUri ? 'custom-photo' : selectedAvatarId,
  );
  const [customPhotoUri, setCustomPhotoUri] = useState<string | null>(currentAvatarUri ?? null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePickPreset = (option: AvatarOption) => {
    playClickSound();
    setCurrentSelected(option.id);
  };

  const handleTriggerUpload = () => {
    playClickSound();
    setUploadError(null);

    if (Platform.OS === 'web') {
      const doc = (
        globalThis as unknown as {
          document?: {
            createElement: (tag: string) => {
              type: string;
              accept: string;
              onchange:
                | ((e: {
                    target?: {
                      files?: ArrayLike<{
                        name: string;
                        type?: string;
                      }>;
                    };
                  }) => void)
                | null;
              click: () => void;
            };
          };
        }
      ).document;

      if (doc) {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp,image/heic';
        input.onchange = (e) => {
          const file = e?.target?.files?.[0];
          if (file) {
            const FileReaderClass = (
              globalThis as unknown as {
                FileReader?: new () => {
                  onload: (ev: { target?: { result?: string } }) => void;
                  onerror: () => void;
                  readAsDataURL: (f: unknown) => void;
                };
              }
            ).FileReader;

            if (FileReaderClass) {
              const reader = new FileReaderClass();
              reader.onload = (ev) => {
                const dataUrl = ev?.target?.result;
                if (dataUrl && typeof dataUrl === 'string') {
                  setCustomPhotoUri(dataUrl);
                  setCurrentSelected('custom-photo');
                }
              };
              reader.onerror = () => {
                setUploadError('Failed to read image file');
              };
              reader.readAsDataURL(file);
            }
          }
        };
        input.click();
        return;
      }
    }

    // Default sample/fallback avatar image for testing/platforms without web input
    const demoPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
    setCustomPhotoUri(demoPhoto);
    setCurrentSelected('custom-photo');
  };

  const handleConfirm = () => {
    playSuccessSound();
    if (currentSelected === 'custom-photo' && customPhotoUri) {
      if (onSelectCustomPhoto) {
        onSelectCustomPhoto(customPhotoUri);
      }
      onSelectAvatar({
        id: 'custom-photo',
        name: 'Profile',
        hue: 'teal',
        uri: customPhotoUri,
      });
    } else {
      const chosen = AVATAR_PRESETS.find((a) => a.id === currentSelected) ?? AVATAR_PRESETS[0]!;
      onSelectAvatar(chosen);
    }
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
              Profile Picture
            </Text>
            <View style={styles.spacer} />
          </View>

          {/* Subtitle & Privacy Notice (Spec B05) */}
          <View style={styles.noticeSection}>
            <Text variant="body" color={dark.textMid} style={styles.noticeText}>
              Upload your own photo or pick an identity avatar. Your photo is only visible to
              members in your squad.
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Custom Photo Upload Card */}
            <View style={styles.uploadCard}>
              <View style={styles.uploadHeaderRow}>
                <TouchableOpacity
                  onPress={handleTriggerUpload}
                  style={[
                    styles.customAvatarCircle,
                    currentSelected === 'custom-photo' && styles.customAvatarSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload custom profile photo"
                  testID="btn-upload-avatar-circle"
                >
                  <Avatar
                    uri={customPhotoUri}
                    name="You"
                    identityHue="apricot"
                    size="lg"
                  />
                  <View style={styles.uploadBadge}>
                    <Ionicons name="camera" size={14} color={dark.onBrand} />
                  </View>
                </TouchableOpacity>

                <View style={styles.uploadInfoCol}>
                  <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                    {customPhotoUri ? 'Custom Photo' : 'Upload Your Photo'}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid} style={{ marginTop: 2 }}>
                    JPEG, PNG, HEIC or WebP
                  </Text>
                  <TouchableOpacity
                    onPress={handleTriggerUpload}
                    style={styles.uploadActionBtn}
                    accessibilityRole="button"
                    testID="btn-pick-custom-photo"
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={dark.apricot} />
                    <Text variant="bodyS" color={dark.apricot} style={{ fontWeight: '700' }}>
                      {customPhotoUri ? 'Change Photo' : 'Upload from Device'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {uploadError && (
                <Text variant="bodyS" color="#FF6B6B" style={{ marginTop: space[2] }}>
                  {uploadError}
                </Text>
              )}
            </View>

            {/* Presets Title */}
            <View style={styles.presetsTitleRow}>
              <Text variant="label" color={dark.textHi} style={{ fontWeight: '700' }}>
                Or Choose an Identity Avatar
              </Text>
            </View>

            {/* Grid of 24 avatars */}
            <View style={styles.gridContainer}>
              {AVATAR_PRESETS.map((avatar) => {
                const isSelected = currentSelected === avatar.id;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() => handlePickPreset(avatar)}
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
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              label={currentSelected === 'custom-photo' ? 'Save photo' : 'Select avatar'}
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
    fontWeight: '700',
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
  scrollContent: {
    paddingBottom: space[6],
  },
  uploadCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    padding: space[4],
    marginBottom: space[4],
  },
  uploadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  customAvatarCircle: {
    position: 'relative',
    borderRadius: radius.full,
    padding: 3,
  },
  customAvatarSelected: {
    borderWidth: 2,
    borderColor: dark.apricot,
  },
  uploadBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: dark.bg0,
  },
  uploadInfoCol: {
    flex: 1,
  },
  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[2],
    paddingVertical: space[1],
  },
  presetsTitleRow: {
    marginBottom: space[2],
    paddingHorizontal: space[1],
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
