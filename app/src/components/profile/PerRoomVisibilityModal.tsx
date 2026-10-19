import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  radius,
  space,
  SwitchRow,
  Text,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import type { RoomSummary } from '@/types/rooms';

export interface PerRoomVisibilityModalProps {
  visible: boolean;
  onClose: () => void;
  rooms?: RoomSummary[];
  testID?: string;
}

export function PerRoomVisibilityModal({
  visible,
  onClose,
  rooms = [],
  testID = 'modal-per-room-visibility',
}: PerRoomVisibilityModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    rooms[0]?.id ?? 'room-default',
  );
  const [shareMeals, setShareMeals] = useState(true);
  const [shareWeight, setShareWeight] = useState(false);
  const [shareWorkouts, setShareWorkouts] = useState(true);
  const [shareFocus, setShareFocus] = useState(true);
  const [shareFasting, setShareFasting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  const handleSave = () => {
    playClickSound();
    setSaving(true);
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSaving(false);
        onClose();
      }, 500);
    }, 400);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-per-room"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.perRoomVisibility.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.perRoomVisibility.subtitle')}
            </Text>

            {/* Room Picker Selector */}
            <View style={styles.roomSelectorWrap}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.perRoomVisibility.selectRoomPrompt')}
              </Text>
              {rooms.length > 0 ? (
                rooms.map((room) => {
                  const isSelected = room.id === selectedRoomId;
                  return (
                    <TouchableOpacity
                      key={room.id}
                      onPress={() => setSelectedRoomId(room.id)}
                      style={[
                        styles.roomTile,
                        isSelected && styles.roomTileSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      testID={`room-option-${room.id}`}
                    >
                      <Text
                        variant="heading"
                        color={isSelected ? dark.apricot : dark.textHi}
                      >
                        {room.name}
                      </Text>
                      <Text variant="micro" color={dark.textLo}>
                        {room.member_count} of {room.member_cap} members
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Card elevation="s2" style={styles.noRoomCard}>
                  <Text variant="bodyS" color={dark.textMid}>
                    {selectedRoom?.name ?? 'General Room Default'}
                  </Text>
                </Card>
              )}
            </View>

            {/* Room Visibility Switches with Consequence text */}
            <Card elevation="s1" style={styles.switchesCard}>
              <SwitchRow
                title={t('rooms.privacyModal.mealItems')}
                consequence={t('rooms.privacyModal.mealItemsConsequence')}
                value={shareMeals}
                onValueChange={setShareMeals}
                testID="switch-room-share-meals"
              />
              <SwitchRow
                title={t('rooms.privacyModal.weight')}
                consequence={t('rooms.privacyModal.weightConsequence')}
                value={shareWeight}
                onValueChange={setShareWeight}
                testID="switch-room-share-weight"
              />
              <SwitchRow
                title={t('rooms.privacyModal.workouts')}
                consequence={t('rooms.privacyModal.workoutsConsequence')}
                value={shareWorkouts}
                onValueChange={setShareWorkouts}
                testID="switch-room-share-workouts"
              />
              <SwitchRow
                title={t('rooms.privacyModal.focusing')}
                consequence={t('rooms.privacyModal.focusingConsequence')}
                value={shareFocus}
                onValueChange={setShareFocus}
                testID="switch-room-share-focus"
              />
              <SwitchRow
                title={t('rooms.privacyModal.fasting')}
                consequence={t('rooms.privacyModal.fastingConsequence')}
                value={shareFasting}
                onValueChange={setShareFasting}
                testID="switch-room-share-fasting"
              />
            </Card>

            <Text variant="micro" color={dark.textLo} style={styles.defaultNotice}>
              {t('me.perRoomVisibility.defaultNotice')}
            </Text>
          </ScrollView>

          {/* Bottom Save Action */}
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label={success ? 'Saved' : saving ? 'Saving…' : 'Save room privacy'}
              onPress={handleSave}
              disabled={saving}
              testID="btn-save-per-room"
              style={styles.saveButton}
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
  scrollContent: {
    padding: space[4],
    paddingBottom: space[8],
  },
  introSubtitle: {
    marginBottom: space[4],
  },
  roomSelectorWrap: {
    marginBottom: space[4],
  },
  sectionLabel: {
    marginBottom: space[2],
  },
  roomTile: {
    padding: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    marginBottom: space[2],
  },
  roomTileSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s3,
  },
  noRoomCard: {
    padding: space[3],
  },
  switchesCard: {
    paddingVertical: space[1],
    marginBottom: space[4],
  },
  defaultNotice: {
    marginTop: space[1],
    paddingHorizontal: space[2],
  },
  bottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  saveButton: {
    width: '100%',
  },
});
