import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';
import { WeeklyPlanModal } from './WeeklyPlanModal';
import { WorkoutLogModal } from './WorkoutLogModal';
import { WorkoutProgressModal } from './WorkoutProgressModal';
import { WorkoutHistoryCalendarModal } from './WorkoutHistoryCalendarModal';

export interface WorkoutHubModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function WorkoutHubModal({
  visible,
  onClose,
  testID = 'workout-hub-modal',
}: WorkoutHubModalProps) {
  useBrowserModalBack(visible, onClose);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [logCategory, setLogCategory] = useState<'upper' | 'lower' | 'core' | 'full' | undefined>();

  const handleOpenLog = () => {
    playClickSound();
    setLogCategory(undefined);
    setShowLogModal(true);
  };

  const handleOpenPlan = () => {
    playClickSound();
    setShowPlanModal(true);
  };

  const handleOpenProgress = () => {
    playClickSound();
    setShowProgressModal(true);
  };

  const handleOpenHistory = () => {
    playClickSound();
    setShowHistoryModal(true);
  };

  const handleOpenPopularType = (typeId: string) => {
    setLogCategory(typeId === 'lower' || typeId === 'core' || typeId === 'full' ? typeId : 'upper');
    setShowLogModal(true);
  };

  const workoutTypes = [
    { id: 'strength', name: 'Strength Training', icon: 'barbell' as const },
    { id: 'upper', name: 'Upper Body', icon: 'body' as const },
    { id: 'lower', name: 'Lower Body', icon: 'walk' as const },
    { id: 'core', name: 'Core', icon: 'fitness' as const },
    { id: 'full', name: 'Full Body', icon: 'man' as const },
  ];

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
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-workout-hub-back"
            >
              <ChevronLeftIcon size={22} color={dark.textHi} />
            </TouchableOpacity>

            <View style={styles.headerTitleCol}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="barbell" size={26} color={dark.apricot} />
              </View>
              <Text variant="title1" color={dark.textHi} style={styles.headerTitle}>
                Workout
              </Text>
              <Text variant="micro" color={dark.textLo} style={styles.headerSubtitle}>
                Get stronger every day
              </Text>
            </View>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Atmospheric Gym Hero Image Banner */}
            <View style={styles.heroBannerCard}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
                }}
                style={styles.heroImage}
              />
              <View style={styles.heroOverlay} />
            </View>

            {/* 4 Action Cards in 2x2 Grid */}
            <View style={styles.actionGrid}>
              {/* 1. Log Workout */}
              <TouchableOpacity
                onPress={handleOpenLog}
                style={styles.actionTile}
                accessibilityRole="button"
                accessibilityLabel="Log Workout. Track your exercises"
                testID="btn-action-log-workout"
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="barbell" size={22} color={dark.apricot} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text variant="body" color={dark.textHi} style={styles.actionTitle}>
                    Log Workout
                  </Text>
                  <Text variant="micro" color={dark.textLo}>
                    Track your exercises
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 2. Set Goal / Weekly Plan */}
              <TouchableOpacity
                onPress={handleOpenPlan}
                style={styles.actionTile}
                accessibilityRole="button"
                accessibilityLabel="Set Goal. Plan your fitness journey"
                testID="btn-action-set-goal"
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="flag-outline" size={22} color={dark.apricot} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text variant="body" color={dark.textHi} style={styles.actionTitle}>
                    Set Goal
                  </Text>
                  <Text variant="micro" color={dark.textLo}>
                    Plan your fitness journey
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 3. View Progress */}
              <TouchableOpacity
                onPress={handleOpenProgress}
                style={styles.actionTile}
                accessibilityRole="button"
                accessibilityLabel="View Progress. Check improvements"
                testID="btn-action-view-progress"
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="stats-chart-outline" size={22} color={dark.apricot} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text variant="body" color={dark.textHi} style={styles.actionTitle}>
                    View Progress
                  </Text>
                  <Text variant="micro" color={dark.textLo}>
                    Check improvements
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 4. Workout History */}
              <TouchableOpacity
                onPress={handleOpenHistory}
                style={styles.actionTile}
                accessibilityRole="button"
                accessibilityLabel="Workout History. See past workouts"
                testID="btn-action-workout-history"
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="time-outline" size={22} color={dark.apricot} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text variant="body" color={dark.textHi} style={styles.actionTitle}>
                    Workout History
                  </Text>
                  <Text variant="micro" color={dark.textLo}>
                    See past workouts
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Popular Workout Types Section (413 Workouts Database) */}
            <View style={styles.popularSection}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="heading" color={dark.textHi} style={{ fontWeight: '700' }}>
                  Popular Workout Types
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    playClickSound();
                    setLogCategory(undefined);
                    setShowLogModal(true);
                  }}
                >
                  <Text variant="bodyS" color={dark.apricot} style={{ fontWeight: '600' }}>
                    See All (413)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 6 Types in 3x2 Grid */}
              <View style={styles.typesGrid}>
                {workoutTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => handleOpenPopularType(type.id)}
                    style={styles.typeTile}
                    accessibilityRole="button"
                    accessibilityLabel={type.name}
                    testID={`type-tile-${type.id}`}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name={type.icon} size={28} color={dark.apricot} />
                    </View>
                    <Text variant="micro" color={dark.textHi} style={styles.typeTitle}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Sub-modals */}
          <WorkoutLogModal
            visible={showLogModal}
            initialCategory={logCategory}
            onClose={() => setShowLogModal(false)}
            onOpenProgress={() => {
              setShowLogModal(false);
              setShowProgressModal(true);
            }}
          />

          <WeeklyPlanModal
            visible={showPlanModal}
            onClose={() => setShowPlanModal(false)}
            onSavePlan={() => {
              setShowPlanModal(false);
              setShowLogModal(true);
            }}
          />

          <WorkoutProgressModal
            visible={showProgressModal}
            initialTab="Overview"
            onClose={() => setShowProgressModal(false)}
          />

          <WorkoutHistoryCalendarModal
            visible={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerIconCircle: {
    marginBottom: 2,
  },
  headerTitle: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
  heroBannerCard: {
    height: 170,
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 11, 8, 0.35)',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  actionTile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[3] + 2,
    gap: space[2],
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  popularSection: {
    gap: space[3],
    marginTop: space[1],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    justifyContent: 'space-between',
  },
  typeTile: {
    width: '31%',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    paddingVertical: space[4],
    paddingHorizontal: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  typeIconBox: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
