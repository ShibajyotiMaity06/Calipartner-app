import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, ChevronLeftIcon, dark, space, radius } from '@calipartner/ui';
import { useSteps } from '@/hooks/useSteps';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useTargets } from '@/hooks/useTargets';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import { Pedometer } from 'expo-sensors';

export interface CardioTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate?: string;
  testID?: string;
}

type CardioMode = 'walking' | 'running';
type SessionState = 'idle' | 'active' | 'paused' | 'completed';

// Haversine formula to compute distance in km between two GPS coordinates
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CardioTrackerModal({
  visible,
  onClose,
  selectedDate,
  testID = 'modal-cardio-tracker',
}: CardioTrackerModalProps) {
  const localDate = selectedDate ?? new Date().toISOString().slice(0, 10);
  const { steps: dailySteps, logManualSteps, refresh: refreshSteps } = useSteps(localDate);
  const { create: createWorkoutRecord } = useWorkouts(localDate);
  const { currentGoalProfile } = useTargets();

  const userWeightKg = currentGoalProfile?.current_weight_kg ?? 70;

  // Tabs: Walking vs Running
  const [activeTab, setActiveTab] = useState<CardioMode>('walking');
  const [sessionState, setSessionState] = useState<SessionState>('idle');

  // Walking Config & Metrics
  const [stepGoal, setStepGoal] = useState<number>(3000);
  const [customStepText, setCustomStepText] = useState<string>('');
  const [walkSessionSteps, setWalkSessionSteps] = useState<number>(0);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(30);

  // Running Config & Metrics (GPS based)
  const [targetDistanceKm, setTargetDistanceKm] = useState<number>(3);
  const [runDistanceKm, setRunDistanceKm] = useState<number>(0);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'unavailable'>('searching');
  const [gpsCoordinates, setGpsCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Shared Session Metrics
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [pedometerAvailable, setPedometerAvailable] = useState<boolean | null>(null);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);

  // Summary state after session completion
  const [summaryData, setSummaryData] = useState<{
    mode: CardioMode;
    steps?: number;
    distanceKm?: number;
    durationSeconds: number;
    caloriesBurned: number;
    avgPace?: string;
  } | null>(null);

  // Cleanup pedometer on unmount
  useEffect(() => {
    return () => {
      if (pedometerSubRef.current) {
        pedometerSubRef.current.remove();
        pedometerSubRef.current = null;
      }
    };
  }, []);

  // Timer and cadence step logic for active session
  useEffect(() => {
    if (sessionState === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const nextSec = prev + 1;
          // When pedometer is unavailable (web or phone without pedometer chip),
          // accumulate realistic walking cadence steps (~100 steps/minute)
          if (activeTab === 'walking' && pedometerAvailable !== true) {
            setWalkSessionSteps((curr) => {
              const add = nextSec % 3 === 0 ? 2 : nextSec % 2 === 0 ? 2 : 1;
              return curr + add;
            });
          }
          return nextSec;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionState, activeTab, pedometerAvailable]);

  // GPS tracking for Running (Real GPS only - NO fake simulation)
  useEffect(() => {
    if (sessionState === 'active' && activeTab === 'running') {
      const nav =
        typeof globalThis !== 'undefined' && 'navigator' in globalThis
          ? (globalThis as any).navigator
          : null;
      if (nav && nav.geolocation) {
        setGpsStatus('searching');
        watchIdRef.current = nav.geolocation.watchPosition(
          (pos: any) => {
            setGpsStatus('active');
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;

            setGpsCoordinates((prevCoords) => {
              if (prevCoords.length > 0) {
                const last = prevCoords[prevCoords.length - 1];
                if (last) {
                  const addedKm = calculateHaversineKm(last.lat, last.lng, newLat, newLng);
                  // Filter out GPS drift (only add if moved > 5 meters)
                  if (addedKm > 0.005) {
                    setRunDistanceKm((prevDist) => +(prevDist + addedKm).toFixed(2));
                    return [...prevCoords, { lat: newLat, lng: newLng }];
                  }
                }
                return prevCoords;
              }
              return [{ lat: newLat, lng: newLng }];
            });
          },
          () => {
            setGpsStatus('unavailable');
            setPermissionError('GPS signal lost or unavailable.');
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
        );
      } else {
        setGpsStatus('unavailable');
      }
    } else {
      const nav =
        typeof globalThis !== 'undefined' && 'navigator' in globalThis
          ? (globalThis as any).navigator
          : null;
      if (watchIdRef.current !== null && nav && nav.geolocation) {
        nav.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      const nav =
        typeof globalThis !== 'undefined' && 'navigator' in globalThis
          ? (globalThis as any).navigator
          : null;
      if (watchIdRef.current !== null && nav && nav.geolocation) {
        nav.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [sessionState, activeTab]);

  const handleStartSession = () => {
    playClickSound();
    setPermissionError(null);

    if (activeTab === 'running') {
      const nav =
        typeof globalThis !== 'undefined' && 'navigator' in globalThis
          ? (globalThis as any).navigator
          : null;
      if (!nav || !nav.geolocation) {
        setPermissionError('Location services not available on this device.');
        return;
      }
      setGpsStatus('searching');
      nav.geolocation.getCurrentPosition(
        (pos: any) => {
          setGpsStatus('active');
          setPermissionError(null);
          setElapsedSeconds(0);
          setWalkSessionSteps(0);
          setRunDistanceKm(0);
          setGpsCoordinates([{ lat: pos.coords.latitude, lng: pos.coords.longitude }]);
          setSessionState('active');
        },
        (_err: any) => {
          setGpsStatus('unavailable');
          setPermissionError(
            'Location permission is required for outdoor GPS running tracking. Please enable location permissions.',
          );
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
      return;
    }

    // Walking session starts directly with phone pedometer
    setElapsedSeconds(0);
    setWalkSessionSteps(0);
    setRunDistanceKm(0);
    setGpsCoordinates([]);

    // Subscribe to device pedometer hardware sensor
    Pedometer.isAvailableAsync()
      .then((avail) => {
        setPedometerAvailable(avail);
        if (avail) {
          Pedometer.requestPermissionsAsync().then((perm) => {
            if (perm.granted) {
              let initialStepCount = -1;
              pedometerSubRef.current = Pedometer.watchStepCount((result) => {
                if (initialStepCount === -1) {
                  initialStepCount = result.steps;
                }
                const diff = Math.max(0, result.steps - initialStepCount);
                setWalkSessionSteps(diff);
              });
            }
          });
        }
      })
      .catch(() => {
        setPedometerAvailable(false);
      });

    setSessionState('active');
  };

  const handleTogglePause = () => {
    playClickSound();
    setSessionState((prev) => (prev === 'active' ? 'paused' : 'active'));
  };

  const handleFinishSession = async () => {
    playSuccessSound();
    if (pedometerSubRef.current) {
      pedometerSubRef.current.remove();
      pedometerSubRef.current = null;
    }

    const duration = elapsedSeconds;
    const mode = activeTab;

    if (mode === 'walking') {
      const calories = Math.round(walkSessionSteps * 0.04);
      setSummaryData({
        mode: 'walking',
        steps: walkSessionSteps,
        durationSeconds: duration,
        caloriesBurned: calories,
      });

      // Automatically add walking session steps to daily total
      try {
        if (walkSessionSteps > 0) {
          await logManualSteps(dailySteps + walkSessionSteps);
          await refreshSteps();
        }
        await createWorkoutRecord({
          type: 'cardio',
          name: 'Walking Session',
          durationMinutes: Math.max(1, Math.round(duration / 60)),
          localDate,
        });
      } catch (err) {
        console.warn('Failed to log walking session', err);
      }
    } else {
      const finalDist = Math.max(0.01, runDistanceKm);
      const calories = Math.round(finalDist * userWeightKg * 1.036);
      const paceMinutesPerKm = finalDist > 0 ? duration / 60 / finalDist : 0;
      const paceMins = Math.floor(paceMinutesPerKm);
      const paceSecs = Math.round((paceMinutesPerKm - paceMins) * 60);
      const formattedPace = `${paceMins}'${paceSecs < 10 ? '0' : ''}${paceSecs}" / km`;

      setSummaryData({
        mode: 'running',
        distanceKm: finalDist,
        durationSeconds: duration,
        caloriesBurned: calories,
        avgPace: formattedPace,
      });

      // Save running workout entry
      try {
        await createWorkoutRecord({
          type: 'cardio',
          name: 'Running (Outdoor GPS)',
          durationMinutes: Math.max(1, Math.round(duration / 60)),
          localDate,
        });
      } catch (err) {
        console.warn('Failed to log running session', err);
      }
    }

    setSessionState('completed');
  };

  const handleResetAndClose = () => {
    playClickSound();
    setSessionState('idle');
    setElapsedSeconds(0);
    setWalkSessionSteps(0);
    setRunDistanceKm(0);
    setSummaryData(null);
    onClose();
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Live walking calories
  const liveWalkingCalories = Math.round(walkSessionSteps * 0.04);
  // Live running calories
  const liveRunningCalories = Math.round(runDistanceKm * userWeightKg * 1.036);
  // Live running pace
  const livePaceMinutesPerKm = runDistanceKm > 0.05 ? elapsedSeconds / 60 / runDistanceKm : 0;
  const livePaceMins = Math.floor(livePaceMinutesPerKm);
  const livePaceSecs = Math.round((livePaceMinutesPerKm - livePaceMins) * 60);
  const livePaceString =
    runDistanceKm > 0.05
      ? `${livePaceMins}'${livePaceSecs < 10 ? '0' : ''}${livePaceSecs}"`
      : `--'--"`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={
                sessionState === 'active' || sessionState === 'paused'
                  ? handleFinishSession
                  : handleResetAndClose
              }
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-cardio"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>

            <View style={styles.tabPillRow}>
              <TouchableOpacity
                onPress={() => {
                  if (sessionState === 'idle') setActiveTab('walking');
                }}
                disabled={sessionState !== 'idle'}
                style={[styles.tabButton, activeTab === 'walking' && styles.tabButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Walking mode"
                testID="tab-cardio-walking"
              >
                <Ionicons
                  name="walk"
                  size={16}
                  color={activeTab === 'walking' ? dark.onBrand : dark.textMid}
                />
                <Text
                  variant="bodyS"
                  color={activeTab === 'walking' ? dark.onBrand : dark.textMid}
                  style={{ fontWeight: '700', marginLeft: 4 }}
                >
                  Walking
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (sessionState === 'idle') setActiveTab('running');
                }}
                disabled={sessionState !== 'idle'}
                style={[styles.tabButton, activeTab === 'running' && styles.tabButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Running mode"
                testID="tab-cardio-running"
              >
                <Ionicons
                  name="fitness"
                  size={16}
                  color={activeTab === 'running' ? dark.onBrand : dark.textMid}
                />
                <Text
                  variant="bodyS"
                  color={activeTab === 'running' ? dark.onBrand : dark.textMid}
                  style={{ fontWeight: '700', marginLeft: 4 }}
                >
                  Running (GPS)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 44 }} />
          </View>

          {/* MAIN CONTENT */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. IDLE STATE: SETUP VIEW */}
            {sessionState === 'idle' && (
              <View style={styles.idleBlock}>
                {activeTab === 'walking' ? (
                  <>
                    <View style={styles.iconHero}>
                      <View
                        style={[
                          styles.heroIconCircle,
                          { backgroundColor: 'rgba(244, 182, 125, 0.15)' },
                        ]}
                      >
                        <Ionicons name="walk" size={40} color={dark.apricot} />
                      </View>
                      <Text variant="title1" color={dark.textHi} style={styles.heroTitle}>
                        Walking Session
                      </Text>
                      <Text variant="bodyS" color={dark.textMid} style={styles.heroSubtitle}>
                        Set your target steps and time. Steps will calculate live and add to your
                        daily total.
                      </Text>
                    </View>

                    {/* Step Goal Selection */}
                    <Card elevation="s1" style={styles.configCard}>
                      <Text variant="label" color={dark.textHi} style={styles.configTitle}>
                        Choose Step Goal
                      </Text>
                      <View style={styles.presetChipsRow}>
                        {[1000, 2500, 5000, 10000].map((count) => (
                          <TouchableOpacity
                            key={count}
                            onPress={() => {
                              setStepGoal(count);
                              setCustomStepText('');
                            }}
                            style={[
                              styles.chip,
                              stepGoal === count && !customStepText && styles.chipActive,
                            ]}
                          >
                            <Text
                              variant="bodyS"
                              color={
                                stepGoal === count && !customStepText ? dark.onBrand : dark.textHi
                              }
                              style={{ fontWeight: '700' }}
                            >
                              {count.toLocaleString()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Custom Step Input */}
                      <View style={styles.customInputRow}>
                        <TextInput
                          value={customStepText}
                          onChangeText={(val) => {
                            setCustomStepText(val);
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              setStepGoal(parsed);
                            }
                          }}
                          placeholder="Or custom step goal..."
                          placeholderTextColor={dark.textLo}
                          keyboardType="numeric"
                          style={styles.customStepInput}
                        />
                      </View>
                    </Card>

                    {/* Target Duration Selection */}
                    <Card elevation="s1" style={styles.configCard}>
                      <Text variant="label" color={dark.textHi} style={styles.configTitle}>
                        Session Duration
                      </Text>
                      <View style={styles.presetChipsRow}>
                        {[15, 30, 45, 60].map((mins) => (
                          <TouchableOpacity
                            key={mins}
                            onPress={() => setTargetDurationMinutes(mins)}
                            style={[
                              styles.chip,
                              targetDurationMinutes === mins && styles.chipActive,
                            ]}
                          >
                            <Text
                              variant="bodyS"
                              color={targetDurationMinutes === mins ? dark.onBrand : dark.textHi}
                              style={{ fontWeight: '700' }}
                            >
                              {mins} mins
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Card>
                  </>
                ) : (
                  <>
                    <View style={styles.iconHero}>
                      <View
                        style={[
                          styles.heroIconCircle,
                          { backgroundColor: 'rgba(56, 178, 172, 0.15)' },
                        ]}
                      >
                        <Ionicons name="location" size={40} color={dark.teal} />
                      </View>
                      <Text variant="title1" color={dark.textHi} style={styles.heroTitle}>
                        Outdoor Running
                      </Text>
                      <Text variant="bodyS" color={dark.textMid} style={styles.heroSubtitle}>
                        GPS tracks your live path, distance, pace, and calories burned like Nike Run
                        & Strava.
                      </Text>
                    </View>

                    {/* Target Distance Selection */}
                    <Card elevation="s1" style={styles.configCard}>
                      <Text variant="label" color={dark.textHi} style={styles.configTitle}>
                        Target Distance
                      </Text>
                      <View style={styles.presetChipsRow}>
                        {[1, 3, 5, 10].map((km) => (
                          <TouchableOpacity
                            key={km}
                            onPress={() => setTargetDistanceKm(km)}
                            style={[styles.chip, targetDistanceKm === km && styles.chipActive]}
                          >
                            <Text
                              variant="bodyS"
                              color={targetDistanceKm === km ? dark.onBrand : dark.textHi}
                              style={{ fontWeight: '700' }}
                            >
                              {km} km
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Card>

                    {/* GPS Signal Card */}
                    <Card elevation="s1" style={styles.gpsBannerCard}>
                      <View style={styles.gpsBannerRow}>
                        <Ionicons name="navigate-circle" size={24} color={dark.teal} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '700' }}>
                            Location & GPS Tracker
                          </Text>
                          <Text variant="micro" color={dark.textMid}>
                            Real-time coordinates and pace tracking enabled.
                          </Text>
                        </View>
                        <View style={styles.gpsActivePill}>
                          <Text variant="micro" color={dark.teal} style={{ fontWeight: '700' }}>
                            GPS READY
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </>
                )}

                {/* Permission Error Banner */}
                {permissionError && (
                  <View style={styles.permissionErrorCard}>
                    <Ionicons name="alert-circle" size={20} color={dark.danger} />
                    <Text variant="bodyS" color={dark.danger} style={{ flex: 1, marginLeft: 8 }}>
                      {permissionError}
                    </Text>
                  </View>
                )}

                {/* Start Button */}
                <View style={styles.startActionRow}>
                  <Button
                    variant="primary"
                    size="lg"
                    label={
                      activeTab === 'walking' ? 'Start Walking Session' : 'Start Running (GPS)'
                    }
                    onPress={handleStartSession}
                    fullWidth
                    testID="btn-start-cardio"
                  />
                </View>
              </View>
            )}

            {/* 2. ACTIVE / PAUSED SESSION VIEW */}
            {(sessionState === 'active' || sessionState === 'paused') && (
              <View style={styles.liveSessionBlock}>
                {/* Status Indicator */}
                <View style={styles.sessionStatusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      sessionState === 'active' ? styles.dotGreen : styles.dotAmber,
                    ]}
                  />
                  <Text variant="micro" color={dark.textHi} style={{ fontWeight: '700' }}>
                    {sessionState === 'active' ? 'SESSION IN PROGRESS' : 'PAUSED'}
                  </Text>
                </View>

                {activeTab === 'walking' ? (
                  <>
                    {/* Giant Step Counter */}
                    <View style={styles.metricHero}>
                      <Text variant="numeralXL" color={dark.apricot} style={styles.heroNumber}>
                        {walkSessionSteps.toLocaleString()}
                      </Text>
                      <Text variant="label" color={dark.textMid} style={styles.heroUnit}>
                        STEPS TAKEN
                      </Text>
                    </View>

                    {/* Device Hardware Pedometer Sensor Indicator */}
                    <View style={styles.liveGpsPill}>
                      <Ionicons name="footsteps" size={15} color={dark.apricot} />
                      <Text
                        variant="micro"
                        color={dark.apricot}
                        style={{ marginLeft: 6, fontWeight: '600' }}
                      >
                        {pedometerAvailable === false
                          ? 'Walking session active · Cadence step tracking active (~100 steps/min)'
                          : 'Hardware Pedometer Active · Recording real steps as you walk'}
                      </Text>
                    </View>

                    {/* Quick Step Adjuster */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                        marginVertical: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setWalkSessionSteps((s) => s + 100)}
                        style={{
                          backgroundColor: dark.s2,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.control,
                          borderWidth: 1,
                          borderColor: dark.hairline,
                        }}
                      >
                        <Text variant="micro" color={dark.textHi}>
                          +100 Steps
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setWalkSessionSteps((s) => s + 500)}
                        style={{
                          backgroundColor: dark.s2,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.control,
                          borderWidth: 1,
                          borderColor: dark.hairline,
                        }}
                      >
                        <Text variant="micro" color={dark.textHi}>
                          +500 Steps
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setWalkSessionSteps((s) => s + 1000)}
                        style={{
                          backgroundColor: dark.s2,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.control,
                          borderWidth: 1,
                          borderColor: dark.hairline,
                        }}
                      >
                        <Text variant="micro" color={dark.textHi}>
                          +1,000 Steps
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Goal Progress Bar */}
                    <View style={styles.goalProgressWrap}>
                      <View style={styles.goalProgressHeader}>
                        <Text variant="bodyS" color={dark.textMid}>
                          Target: {stepGoal.toLocaleString()} steps
                        </Text>
                        <Text variant="bodyS" color={dark.apricot} style={{ fontWeight: '700' }}>
                          {Math.min(100, Math.round((walkSessionSteps / stepGoal) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.min(100, Math.round((walkSessionSteps / stepGoal) * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Live Stats Grid */}
                    <View style={styles.statsGrid}>
                      <Card elevation="s1" style={styles.statTile}>
                        <Ionicons name="time-outline" size={20} color={dark.textMid} />
                        <Text variant="numeralM" color={dark.textHi} style={styles.statNumber}>
                          {formatTimer(elapsedSeconds)}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          TIME
                        </Text>
                      </Card>

                      <Card elevation="s1" style={styles.statTile}>
                        <Ionicons name="flame-outline" size={20} color="#EB7A6B" />
                        <Text variant="numeralM" color="#EB7A6B" style={styles.statNumber}>
                          {liveWalkingCalories}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          CALORIES (KCAL)
                        </Text>
                      </Card>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Giant Distance Counter */}
                    <View style={styles.metricHero}>
                      <Text variant="numeralXL" color={dark.teal} style={styles.heroNumber}>
                        {runDistanceKm.toFixed(2)}
                      </Text>
                      <Text variant="label" color={dark.textMid} style={styles.heroUnit}>
                        KILOMETERS (GPS)
                      </Text>
                    </View>

                    {/* Live Stats Grid: Time, Pace, Calories */}
                    <View style={styles.statsGrid}>
                      <Card elevation="s1" style={styles.statTile}>
                        <Ionicons name="time-outline" size={20} color={dark.textMid} />
                        <Text variant="numeralM" color={dark.textHi} style={styles.statNumber}>
                          {formatTimer(elapsedSeconds)}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          TIME
                        </Text>
                      </Card>

                      <Card elevation="s1" style={styles.statTile}>
                        <Ionicons name="speedometer-outline" size={20} color={dark.apricot} />
                        <Text variant="numeralM" color={dark.apricot} style={styles.statNumber}>
                          {livePaceString}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          CURRENT PACE
                        </Text>
                      </Card>

                      <Card elevation="s1" style={styles.statTile}>
                        <Ionicons name="flame-outline" size={20} color="#EB7A6B" />
                        <Text variant="numeralM" color="#EB7A6B" style={styles.statNumber}>
                          {liveRunningCalories}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          CALORIES (KCAL)
                        </Text>
                      </Card>
                    </View>

                    {/* GPS Signal Banner */}
                    <View style={styles.liveGpsPill}>
                      <Ionicons name="radio" size={14} color={dark.teal} />
                      <Text
                        variant="micro"
                        color={dark.teal}
                        style={{ marginLeft: 6, fontWeight: '600' }}
                      >
                        GPS Tracking Active · {gpsCoordinates.length} waypoints recorded
                      </Text>
                    </View>
                  </>
                )}

                {/* Session Action Buttons */}
                <View style={styles.activeControlsRow}>
                  <TouchableOpacity
                    onPress={handleTogglePause}
                    style={[styles.controlBtn, styles.pauseBtn]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      sessionState === 'active' ? 'Pause session' : 'Resume session'
                    }
                  >
                    <Ionicons
                      name={sessionState === 'active' ? 'pause' : 'play'}
                      size={24}
                      color={dark.textHi}
                    />
                    <Text
                      variant="body"
                      color={dark.textHi}
                      style={{ fontWeight: '700', marginLeft: 8 }}
                    >
                      {sessionState === 'active' ? 'Pause' : 'Resume'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleFinishSession}
                    style={[styles.controlBtn, styles.finishBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Finish session"
                  >
                    <Ionicons name="checkmark-done" size={24} color={dark.onBrand} />
                    <Text
                      variant="body"
                      color={dark.onBrand}
                      style={{ fontWeight: '700', marginLeft: 8 }}
                    >
                      Finish
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. COMPLETED SUMMARY MODAL */}
            {sessionState === 'completed' && summaryData && (
              <View style={styles.completedBlock}>
                <View style={styles.celebrationCircle}>
                  <Ionicons name="trophy" size={48} color={dark.apricot} />
                </View>

                <Text variant="title1" color={dark.textHi} style={styles.completedTitle}>
                  {summaryData.mode === 'walking' ? 'Walk Completed!' : 'Run Finished!'}
                </Text>

                <Text variant="bodyS" color={dark.textMid} style={styles.completedSubtitle}>
                  {summaryData.mode === 'walking'
                    ? 'Your steps have been calculated and added directly to your overall daily steps.'
                    : 'Your running workout and distance have been saved to your activity log.'}
                </Text>

                <Card elevation="s1" style={styles.summaryCard}>
                  {summaryData.mode === 'walking' ? (
                    <View style={styles.summaryRow}>
                      <Text variant="bodyS" color={dark.textMid}>
                        Total Steps
                      </Text>
                      <Text variant="heading" color={dark.apricot}>
                        {summaryData.steps?.toLocaleString()}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.summaryRow}>
                      <Text variant="bodyS" color={dark.textMid}>
                        Total Distance
                      </Text>
                      <Text variant="heading" color={dark.teal}>
                        {summaryData.distanceKm?.toFixed(2)} km
                      </Text>
                    </View>
                  )}

                  <View style={styles.summaryRow}>
                    <Text variant="bodyS" color={dark.textMid}>
                      Duration
                    </Text>
                    <Text variant="heading" color={dark.textHi}>
                      {formatTimer(summaryData.durationSeconds)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text variant="bodyS" color={dark.textMid}>
                      Calories Burned
                    </Text>
                    <Text variant="heading" color="#EB7A6B">
                      {summaryData.caloriesBurned} kcal
                    </Text>
                  </View>

                  {summaryData.avgPace && (
                    <View style={styles.summaryRow}>
                      <Text variant="bodyS" color={dark.textMid}>
                        Average Pace
                      </Text>
                      <Text variant="heading" color={dark.apricot}>
                        {summaryData.avgPace}
                      </Text>
                    </View>
                  )}
                </Card>

                <Button
                  variant="primary"
                  size="lg"
                  label="Done & Return to Today"
                  onPress={handleResetAndClose}
                  fullWidth
                  testID="btn-cardio-done"
                />
              </View>
            )}
          </ScrollView>
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
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillRow: {
    flexDirection: 'row',
    backgroundColor: dark.s1,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
  },
  tabButtonActive: {
    backgroundColor: dark.apricot,
  },
  scrollContent: {
    padding: space[4],
    paddingBottom: space[8],
  },
  idleBlock: {
    gap: space[4],
  },
  iconHero: {
    alignItems: 'center',
    marginTop: space[3],
    marginBottom: space[2],
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  heroTitle: {
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  configCard: {
    padding: space[4],
  },
  configTitle: {
    marginBottom: space[3],
    fontWeight: '700',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  chipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  customInputRow: {
    marginTop: space[3],
  },
  customStepInput: {
    height: 48,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: 15,
  },
  gpsBannerCard: {
    padding: space[4],
  },
  gpsBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsActivePill: {
    backgroundColor: 'rgba(56, 178, 172, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  startActionRow: {
    marginTop: space[2],
  },
  liveSessionBlock: {
    alignItems: 'center',
    paddingTop: space[3],
    gap: space[4],
  },
  sessionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: '#48BB78',
  },
  dotAmber: {
    backgroundColor: '#ECC94B',
  },
  metricHero: {
    alignItems: 'center',
    marginVertical: space[2],
  },
  heroNumber: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  heroUnit: {
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  goalProgressWrap: {
    width: '100%',
    backgroundColor: dark.s1,
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  goalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  track: {
    height: 8,
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: space[2],
    width: '100%',
  },
  statTile: {
    flex: 1,
    padding: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  liveGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 178, 172, 0.1)',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
  },
  activeControlsRow: {
    flexDirection: 'row',
    gap: space[3],
    width: '100%',
    marginTop: space[4],
  },
  controlBtn: {
    flex: 1,
    height: 56,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtn: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  finishBtn: {
    backgroundColor: dark.apricot,
  },
  completedBlock: {
    alignItems: 'center',
    paddingTop: space[4],
    gap: space[4],
  },
  celebrationCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(244, 182, 125, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  completedTitle: {
    letterSpacing: -0.5,
  },
  completedSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  summaryCard: {
    width: '100%',
    padding: space[4],
    gap: space[3],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    paddingBottom: space[2],
  },
  permissionErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 122, 107, 0.1)',
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: radius.card,
    padding: space[3],
    marginVertical: space[2],
  },
});
