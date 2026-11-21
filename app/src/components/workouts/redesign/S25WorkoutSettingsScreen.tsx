import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { WorkoutToggle } from '../s_common';
import type { WorkoutSettings } from '@/services/workoutRedesignService';

interface S25WorkoutSettingsScreenProps {
  settings: WorkoutSettings;
  onUpdateSettings: (updates: Partial<WorkoutSettings>) => void;
  onBack: () => void;
}

export function S25WorkoutSettingsScreen({
  settings,
  onUpdateSettings,
  onBack,
}: S25WorkoutSettingsScreenProps) {
  return (
    <View style={styles.screenContainer} testID="s25-workout-settings-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="workout-settings-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Units */}
        <Text style={styles.sectionHeader}>WEIGHT UNIT</Text>
        <View style={styles.unitsRow}>
          <Pressable
            testID="unit-kg-btn"
            accessibilityRole="button"
            accessibilityState={{ selected: settings.weight_unit === 'kg' }}
            onPress={() => onUpdateSettings({ weight_unit: 'kg' })}
            style={[styles.unitBtn, settings.weight_unit === 'kg' && styles.unitBtnActive]}
          >
            <Text style={[styles.unitText, settings.weight_unit === 'kg' && styles.unitTextActive]}>
              Kilograms (kg)
            </Text>
          </Pressable>
          <Pressable
            testID="unit-lbs-btn"
            accessibilityRole="button"
            accessibilityState={{ selected: settings.weight_unit === 'lbs' }}
            onPress={() => onUpdateSettings({ weight_unit: 'lbs' })}
            style={[styles.unitBtn, settings.weight_unit === 'lbs' && styles.unitBtnActive]}
          >
            <Text
              style={[styles.unitText, settings.weight_unit === 'lbs' && styles.unitTextActive]}
            >
              Pounds (lbs)
            </Text>
          </Pressable>
        </View>

        {/* Rest Timer settings */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>REST TIMER</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Start rest timer automatically</Text>
              <Text style={styles.toggleSubtitle}>Triggers when a set is ticked</Text>
            </View>
            <WorkoutToggle
              value={settings.auto_start_rest_timer}
              onValueChange={(val) => onUpdateSettings({ auto_start_rest_timer: val })}
              testID="auto-start-rest-toggle"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Sound</Text>
              <Text style={styles.toggleSubtitle}>Play chime when rest time ends</Text>
            </View>
            <WorkoutToggle
              value={settings.rest_timer_sound}
              onValueChange={(val) => onUpdateSettings({ rest_timer_sound: val })}
              testID="sound-rest-toggle"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Vibration</Text>
              <Text style={styles.toggleSubtitle}>Vibrate device when rest time ends</Text>
            </View>
            <WorkoutToggle
              value={settings.rest_timer_vibrate}
              onValueChange={(val) => onUpdateSettings({ rest_timer_vibrate: val })}
              testID="vibrate-rest-toggle"
            />
          </View>
        </View>

        {/* Display */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>DISPLAY</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Keep screen awake</Text>
              <Text style={styles.toggleSubtitle}>During an active workout session</Text>
            </View>
            <WorkoutToggle
              value={settings.keep_screen_awake}
              onValueChange={(val) => onUpdateSettings({ keep_screen_awake: val })}
              testID="keep-awake-toggle"
            />
          </View>
        </View>

        {/* AI Rebuild Info */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>AI PLAN REBUILD</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="sparkles-outline" size={20} color={workoutTokens.accent} />
            <View style={styles.infoCol}>
              <Text style={styles.infoTitle}>Plan rebuild limit</Text>
              <Text style={styles.infoSubtitle}>AI plans can be regenerated every 3 months.</Text>
            </View>
          </View>
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  unitsRow: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.control,
    padding: 3,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  unitBtn: {
    flex: 1,
    borderRadius: workoutRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnActive: {
    backgroundColor: workoutTokens.selected,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  unitText: {
    color: workoutTokens.dim,
    fontSize: 14,
    fontWeight: '700',
  },
  unitTextActive: {
    color: workoutTokens.text,
  },
  card: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: workoutTokens.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  infoSubtitle: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  scrollSpacer: {
    height: 40,
  },
});
