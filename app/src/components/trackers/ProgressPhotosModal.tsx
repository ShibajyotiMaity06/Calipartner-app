import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface ProgressPhotoItem {
  id: string;
  date: string;
  uri?: string;
  weightKg?: number;
}

export interface ProgressPhotosModalProps {
  visible: boolean;
  onClose: () => void;
  onAddPhoto?: () => void;
  testID?: string;
}

// Sample milestone photo entries (mock/fixtures)
const SAMPLE_PHOTOS: ProgressPhotoItem[] = [
  { id: 'p1', date: '2026-10-15', weightKg: 74.2 },
  { id: 'p2', date: '2026-10-01', weightKg: 75.8 },
  { id: 'p3', date: '2026-09-15', weightKg: 77.1 },
];

function ProgressPhotosModalContent({
  visible,
  onClose,
  onAddPhoto,
  testID = 'progress-photos-modal',
}: ProgressPhotosModalProps) {
  const [photos, setPhotos] = useState<ProgressPhotoItem[]>(SAMPLE_PHOTOS);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>(['p1', 'p2']);

  if (!visible) return null;

  const toggleSelectPhoto = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 2) {
        return [prev[1]!, id];
      }
      return [...prev, id];
    });
  };

  const handleSimulateAdd = () => {
    const newEntry: ProgressPhotoItem = {
      id: `p-${Date.now()}`,
      date: new Date().toISOString().split('T')[0]!,
      weightKg: 73.8,
    };
    setPhotos([newEntry, ...photos]);
    onAddPhoto?.();
  };

  const comparePhotoA = photos.find((p) => p.id === selectedForCompare[0]);
  const comparePhotoB = photos.find((p) => p.id === selectedForCompare[1]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
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

        <View style={styles.sheet} testID="progress-photos-sheet">
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="images-outline" size={20} color={dark.apricot} />
              </View>
              <View>
                <Text style={styles.title}>{t('trackers.weight.photosTitle')}</Text>
                <Text style={styles.privateBadge}>
                  <Ionicons name="lock-closed" size={11} color={dark.textLo} />
                  {' Only you can see these'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          {/* Compare toggle bar */}
          <View style={styles.modeBar}>
            <Pressable
              testID="btn-toggle-compare-mode"
              style={[styles.modeBtn, compareMode && styles.modeBtnActive]}
              onPress={() => setCompareMode(!compareMode)}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.comparePhotos')}
            >
              <Ionicons
                name="contrast-outline"
                size={16}
                color={compareMode ? dark.onBrand : dark.textMid}
              />
              <Text style={[styles.modeBtnText, compareMode && styles.modeBtnTextActive]}>
                {t('trackers.weight.comparePhotos')}
              </Text>
            </Pressable>

            {compareMode && <Text style={styles.compareHint}>Select 2 photos to compare</Text>}
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Compare View if compareMode is active and 2 selected */}
            {compareMode && comparePhotoA && comparePhotoB ? (
              <View style={styles.compareContainer} testID="photo-compare-view">
                <View style={styles.compareSide}>
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person-outline" size={32} color={dark.textLo} />
                  </View>
                  <Text style={styles.compareDate}>{comparePhotoA.date}</Text>
                  {comparePhotoA.weightKg && (
                    <Text style={styles.compareWeight}>{`${comparePhotoA.weightKg} kg`}</Text>
                  )}
                </View>

                <View style={styles.compareDivider} />

                <View style={styles.compareSide}>
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person-outline" size={32} color={dark.textLo} />
                  </View>
                  <Text style={styles.compareDate}>{comparePhotoB.date}</Text>
                  {comparePhotoB.weightKg && (
                    <Text style={styles.compareWeight}>{`${comparePhotoB.weightKg} kg`}</Text>
                  )}
                </View>
              </View>
            ) : null}

            {/* Grid of Photos with Add Tile */}
            <View style={styles.grid} testID="photos-grid">
              {/* Add Photo Tile */}
              <Pressable
                testID="btn-add-progress-photo"
                style={styles.addTile}
                onPress={handleSimulateAdd}
                accessibilityRole="button"
                accessibilityLabel={t('trackers.weight.addPhoto')}
              >
                <View style={styles.addIconCircle}>
                  <Ionicons name="camera-outline" size={24} color={dark.apricot} />
                </View>
                <Text style={styles.addTileLabel}>{t('trackers.weight.addPhoto')}</Text>
              </Pressable>

              {/* Photo Cards */}
              {photos.map((item) => {
                const isSelected = selectedForCompare.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    testID={`photo-item-${item.id}`}
                    style={[
                      styles.photoCard,
                      compareMode && isSelected && styles.photoCardSelected,
                    ]}
                    onPress={() => {
                      if (compareMode) {
                        toggleSelectPhoto(item.id);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Progress photo from ${item.date}`}
                  >
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={dark.textLo} />
                      {compareMode && isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={14} color={dark.onBrand} />
                        </View>
                      )}
                    </View>
                    <View style={styles.photoMeta}>
                      <Text style={styles.photoDate}>{item.date}</Text>
                      {item.weightKg && (
                        <Text style={styles.photoWeight}>{`${item.weightKg} kg`}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Privacy notice banner */}
            <View style={styles.privacyBanner}>
              <Ionicons name="lock-closed-outline" size={16} color={dark.teal} />
              <Text style={styles.privacyBannerText}>
                {t('trackers.weight.photosPrivateNotice')}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <Pressable
              testID="btn-progress-photos-done"
              style={styles.doneBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneBtnText}>Done</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
    maxHeight: '90%',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  privateBadge: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[1],
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  modeBtnActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  modeBtnText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: dark.onBrand, // #1C1109
  },
  compareHint: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  scrollArea: {
    maxHeight: 400,
  },
  scrollContent: {
    gap: space[3],
  },
  compareContainer: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  compareSide: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  compareDivider: {
    width: 1,
    height: '80%',
    backgroundColor: dark.hairline,
    marginHorizontal: space[2],
  },
  compareDate: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  compareWeight: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  addTile: {
    width: '31%',
    aspectRatio: 0.85,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  photoCard: {
    width: '31%',
    aspectRatio: 0.85,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    overflow: 'hidden',
  },
  photoCardSelected: {
    borderColor: dark.apricot,
    borderWidth: 2,
  },
  photoPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMeta: {
    padding: space[1],
    backgroundColor: dark.s2,
    alignItems: 'center',
  },
  photoDate: {
    fontSize: 10,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
  },
  photoWeight: {
    fontSize: 9,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    padding: space[3],
    borderRadius: radius.control,
    marginTop: space[1],
  },
  privacyBannerText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    flex: 1,
  },
  footer: {
    paddingTop: space[2],
  },
  doneBtn: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
});

export function ProgressPhotosModal(props: ProgressPhotosModalProps) {
  return (
    <PremiumFeatureModal feature="progress_photos" visible={props.visible} onClose={props.onClose}>
      <ProgressPhotosModalContent {...props} />
    </PremiumFeatureModal>
  );
}
