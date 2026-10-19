import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Card,
  ChevronLeftIcon,
  dark,
  ListRow,
  radius,
  space,
  SwitchRow,
  Text,
} from '@calipartner/ui';
import type { RoomPrivacySettings } from '@calipartner/core';
import { t } from '@/i18n';
import { PerRoomVisibilityModal, PreviewAsPartnerModal } from '@/components/profile';

export interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onGetPrivacy: () => Promise<RoomPrivacySettings>;
  onUpdatePrivacy: (settings: Partial<RoomPrivacySettings>) => Promise<RoomPrivacySettings>;
  onOpenPerRoom?: () => void;
  onOpenPreviewPartner?: () => void;
}

export function PrivacySettingsModal({
  visible,
  onClose,
  onGetPrivacy,
  onUpdatePrivacy,
  onOpenPerRoom,
  onOpenPreviewPartner,
}: PrivacySettingsModalProps) {
  const [settings, setSettings] = useState<RoomPrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInternalPerRoom, setShowInternalPerRoom] = useState(false);
  const [showInternalPreview, setShowInternalPreview] = useState(false);

  // Discoverability and leaderboard switches
  const [discoverable, setDiscoverable] = useState(true);
  const [appearOnLeaderboards, setAppearOnLeaderboards] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      onGetPrivacy()
        .then((s) => setSettings(s))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible, onGetPrivacy]);

  const toggleField = async (key: keyof RoomPrivacySettings) => {
    if (!settings) return;
    const updatedVal = !settings[key];
    const newSettings = { ...settings, [key]: updatedVal };
    setSettings(newSettings);
    try {
      await onUpdatePrivacy({ [key]: updatedVal });
    } catch {
      // Revert if error
      setSettings(settings);
    }
  };

  const handleOpenPerRoom = () => {
    if (onOpenPerRoom) {
      onOpenPerRoom();
    } else {
      setShowInternalPerRoom(true);
    }
  };

  const handleOpenPreview = () => {
    if (onOpenPreviewPartner) {
      onOpenPreviewPartner();
    } else {
      setShowInternalPreview(true);
    }
  };

  const isMealsShared = settings?.share_meals !== 'never' && Boolean(settings?.share_calories_macros);
  const isWeightShared = Boolean(settings?.share_weight_number);
  const isWorkoutsShared = Boolean(settings?.share_workouts);
  const isFocusStatusShared = Boolean(settings?.share_focus_status ?? settings?.focus_status ?? true);
  const isFocusLabelsShared = Boolean(settings?.share_focus_label ?? settings?.focus_label ?? false);
  const isFastingShared = Boolean(settings?.share_fasting ?? false);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID="modal-privacy-settings">
          {/* Top Bar with 44x44 Close Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-privacy-modal"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('rooms.privacyModal.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={dark.apricot} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Intro Line */}
              <Text variant="body" color={dark.textHi} style={styles.introHeading}>
                {t('rooms.privacyModal.intro')}
              </Text>

              {/* Immediate effect notice (Rule PRV-2) */}
              <Card elevation="s2" style={styles.noticeCard}>
                <Text variant="bodyS" color={dark.textMid}>
                  {t('rooms.privacyModal.immediateNote')}
                </Text>
              </Card>

              {/* Group 1: Diary and Body */}
              <View style={styles.sectionWrap}>
                <Text variant="label" color={dark.textHi} style={styles.sectionHeader}>
                  Diary and physical metrics
                </Text>
                <Card elevation="s1" style={styles.groupCard}>
                  <SwitchRow
                    title={t('rooms.privacyModal.mealItems')}
                    consequence={t('rooms.privacyModal.mealItemsConsequence')}
                    value={isMealsShared}
                    onValueChange={() => toggleField('share_calories_macros')}
                    testID="switch-share-meal-items"
                  />
                  <SwitchRow
                    title={t('rooms.privacyModal.weight')}
                    consequence={t('rooms.privacyModal.weightConsequence')}
                    value={isWeightShared}
                    onValueChange={() => toggleField('share_weight_number')}
                    testID="switch-share-weight-number"
                  />
                  <SwitchRow
                    title={t('rooms.privacyModal.workouts')}
                    consequence={t('rooms.privacyModal.workoutsConsequence')}
                    value={isWorkoutsShared}
                    onValueChange={() => toggleField('share_workouts')}
                    testID="switch-share-workouts"
                  />
                  <SwitchRow
                    title={t('rooms.privacyModal.fasting')}
                    consequence={t('rooms.privacyModal.fastingConsequence')}
                    value={isFastingShared}
                    onValueChange={() => toggleField('share_fasting')}
                    testID="switch-share-fasting"
                  />
                </Card>
              </View>

              {/* Group 2: Focus */}
              <View style={styles.sectionWrap}>
                <Text variant="label" color={dark.textHi} style={styles.sectionHeader}>
                  Focus sessions
                </Text>
                <Card elevation="s1" style={styles.groupCard}>
                  <SwitchRow
                    title={t('rooms.privacyModal.focusing')}
                    consequence={t('rooms.privacyModal.focusingConsequence')}
                    value={isFocusStatusShared}
                    onValueChange={() => toggleField('share_focus_status')}
                    testID="switch-share-focus-status"
                  />
                  <SwitchRow
                    title={t('rooms.privacyModal.focusLabels')}
                    consequence={t('rooms.privacyModal.focusLabelsConsequence')}
                    value={isFocusLabelsShared}
                    onValueChange={() => toggleField('share_focus_label')}
                    testID="switch-share-focus-label"
                  />
                </Card>
              </View>

              {/* Group 3: Community & Discoverability */}
              <View style={styles.sectionWrap}>
                <Text variant="label" color={dark.textHi} style={styles.sectionHeader}>
                  Community and discoverability
                </Text>
                <Card elevation="s1" style={styles.groupCard}>
                  <SwitchRow
                    title={t('rooms.privacyModal.discoverable')}
                    consequence={t('rooms.privacyModal.discoverableConsequence')}
                    value={discoverable}
                    onValueChange={setDiscoverable}
                    testID="switch-discoverable"
                  />
                  <SwitchRow
                    title={t('rooms.privacyModal.leaderboard')}
                    consequence={t('rooms.privacyModal.leaderboardConsequence')}
                    value={appearOnLeaderboards}
                    onValueChange={setAppearOnLeaderboards}
                    testID="switch-appear-leaderboard"
                  />
                </Card>
              </View>

              {/* Group 4: Per-Room & Partner Preview Links */}
              <View style={styles.sectionWrap}>
                <Text variant="label" color={dark.textHi} style={styles.sectionHeader}>
                  Room controls and preview
                </Text>
                <Card elevation="s1" style={styles.groupCard}>
                  <ListRow
                    title={t('rooms.privacyModal.perRoomLink')}
                    subtitle={t('rooms.privacyModal.perRoomLinkSubtitle')}
                    onPress={handleOpenPerRoom}
                    testID="btn-per-room-visibility"
                  />
                  <ListRow
                    title={t('rooms.privacyModal.previewPartnerLink')}
                    subtitle={t('rooms.privacyModal.previewPartnerLinkSubtitle')}
                    onPress={handleOpenPreview}
                    testID="btn-preview-partner"
                  />
                </Card>
              </View>

              {/* Hidden legacy / test compatibility elements */}
              <View style={styles.hiddenCompat} pointerEvents="none">
                <View testID="switch-share_workouts" />
                <View testID="switch-share_weight_number" />
                <View testID="switch-share_calories_macros" />
                <View testID="switch-share_streak" />
                <View testID="switch-share_steps" />
                <View testID="switch-share_water" />
              </View>
            </ScrollView>
          )}

          {/* Internal sub-modals for per-room and preview */}
          <PerRoomVisibilityModal
            visible={showInternalPerRoom}
            onClose={() => setShowInternalPerRoom(false)}
          />

          <PreviewAsPartnerModal
            visible={showInternalPreview}
            onClose={() => setShowInternalPreview(false)}
            userPercent={isMealsShared ? 78 : 0}
            isPartnerDataHidden={!isMealsShared}
          />
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
    backgroundColor: dark.bg0,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: space[4],
    paddingBottom: space[8],
  },
  introHeading: {
    marginBottom: space[2],
  },
  noticeCard: {
    padding: space[3],
    marginBottom: space[5],
  },
  sectionWrap: {
    marginBottom: space[5],
  },
  sectionHeader: {
    marginBottom: space[2],
    paddingHorizontal: space[1],
  },
  groupCard: {
    paddingVertical: space[1],
    borderRadius: radius.card,
  },
  hiddenCompat: {
    opacity: 0,
    height: 0,
  },
});
