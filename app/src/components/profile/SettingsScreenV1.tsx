import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kgToLb, TRACKING_METRICS, type TrackingPreferences } from '@calipartner/core';
import { getTabBarHeight } from '@calipartner/ui';
import {
  Badge,
  BellIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  EnvelopeIcon,
  EyeIcon,
  FlagIcon,
  HeartIcon,
  InfoCircleIcon,
  KeyIcon,
  PulseIcon,
  QuestionCircleIcon,
  RulerIcon,
  ScaleIcon,
  SearchIcon,
  SignOutIcon,
  SlidersIcon,
  StarIcon,
  Text,
  TrashIcon,
  UsersIcon,
  ProfileIcon,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { AboutLegalModal } from '@/components/profile/AboutLegalModal';
import { CustomMacrosModal } from '@/components/profile/CustomMacrosModal';
import { DailyGoalsModal } from '@/components/profile/DailyGoalsModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { DiscoverabilityModal } from '@/components/profile/DiscoverabilityModal';
import { GoalsAndBodyModal } from '@/components/profile/GoalsAndBodyModal';
import { HealthSyncModal } from '@/components/profile/HealthSyncModal';
import { HelpCentreModal } from '@/components/profile/HelpCentreModal';
import { PerRoomVisibilityModal } from '@/components/profile/PerRoomVisibilityModal';
import { ReportFeedbackModal } from '@/components/profile/ReportFeedbackModal';
import {
  EmailSettingsSheet,
  PasswordSettingsSheet,
  SignInMethodsSheet,
} from '@/components/profile/SettingsAccountSheets';
import { SignOutSheet } from '@/components/profile/SignOutSheet';
import { UnitsLanguageModal } from '@/components/profile/UnitsLanguageModal';
import { TrackingPreferencesSheet } from '@/components/rooms/TrackingPreferencesSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useRooms } from '@/hooks/useRooms';
import { useSteps } from '@/hooks/useSteps';
import { useSubscription } from '@/hooks/useSubscription';
import { useTargets } from '@/hooks/useTargets';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { useWeight } from '@/hooks/useWeight';
import { t } from '@/i18n';
import { disconnectNativeHealth } from '@/services/nativeHealthService';
import { getNotificationPermissionStatus } from '@/services/notificationPermissionService';
import { getNotificationSettings } from '@/services/notificationSettingsService';
import { requestStoreReview } from '@/services/storeReviewService';
import { generateClientUuid } from '@/services/foodService';

function deriveAgeYears(dateOfBirth?: string | null): number {
  if (!dateOfBirth) return 27;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 27;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return Math.max(18, Math.min(100, age));
}

function formatWeightDisplay(weightKg: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const lb = Math.round(kgToLb(weightKg) * 10) / 10;
    return `${lb} lb`;
  }
  const kg = Math.round(weightKg * 10) / 10;
  return `${kg} kg`;
}

function formatWaterShort(waterMl: number): string {
  if (waterMl >= 1000) {
    const liters = Math.round((waterMl / 1000) * 10) / 10;
    return `${liters} L`;
  }
  return `${Math.round(waterMl)} ml`;
}

function formatProviderName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === 'apple') return 'Apple';
  if (lower === 'google') return 'Google';
  if (lower === 'email') return 'Email';
  return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : '';
}

interface SettingsRowItem {
  id: string;
  label: string;
  value?: string;
  valueColor?: 'textLo' | 'apricot';
  badge?: string;
  danger?: boolean;
  icon: React.ReactNode;
  onPress: () => void;
  testID: string;
}

function SettingsSection({ title, rows }: { title?: string; rows: SettingsRowItem[] }) {
  return (
    <View style={styles.sectionBlock}>
      {title ? (
        <Text variant="eyebrow" color="textLo" style={styles.sectionEyebrow}>
          {title}
        </Text>
      ) : null}
      <View style={styles.sectionCard}>
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1;
          return (
            <Pressable
              key={row.id}
              onPress={row.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}${row.value ? `, ${row.value}` : ''}`}
              style={({ pressed }) => [
                styles.rowPressable,
                !isLast ? styles.rowDivider : null,
                pressed ? styles.rowPressed : null,
              ]}
              testID={row.testID}
            >
              <View style={[styles.iconTile, row.danger ? styles.iconTileDanger : null]}>
                {row.icon}
              </View>
              <Text
                variant="label"
                color={row.danger ? 'danger' : 'textHi'}
                style={styles.rowLabel}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <View style={styles.rowRight}>
                {row.badge ? <Badge variant="outlinePro" label={row.badge} /> : null}
                {row.value ? (
                  <Text
                    variant="meta"
                    color={row.valueColor === 'apricot' ? 'apricot' : 'textLo'}
                    numberOfLines={1}
                    style={styles.rowValue}
                  >
                    {row.value}
                  </Text>
                ) : null}
                {!row.danger ? <ChevronRightIcon size={15} color={colors.textLo} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreenV1({ inTabs = false }: { inTabs?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const {
    user,
    profile,
    signOut,
    deleteAccount,
    updateProfile,
    updateEmail,
    updatePassword,
    resetPassword,
  } = useAuth();
  const {
    currentGoalProfile,
    calculate,
    saveGoalProfile,
    updateDailyGoals,
    refresh: refreshTargets,
  } = useTargets();
  const weight = useWeight();
  const tracking = useTrackingPreferences();
  const steps = useSteps();
  const { rooms } = useRooms();
  const { currentTier, isTrial } = useSubscription();

  const [notifStatusLabel, setNotifStatusLabel] = useState<string>(t('settingsV1.on'));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [showGoalsBody, setShowGoalsBody] = useState(false);
  const [showDailyTargets, setShowDailyTargets] = useState(false);
  const [showCustomMacros, setShowCustomMacros] = useState(false);
  const [showTrackingPrefs, setShowTrackingPrefs] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [showHealthSync, setShowHealthSync] = useState(false);
  const [showPerSquadVisibility, setShowPerSquadVisibility] = useState(false);
  const [showDiscoverability, setShowDiscoverability] = useState(false);
  const [showEmailSheet, setShowEmailSheet] = useState(false);
  const [showPasswordSheet, setShowPasswordSheet] = useState(false);
  const [showMethodsSheet, setShowMethodsSheet] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const loadNotificationSummary = useCallback(async () => {
    try {
      const [perm, settings] = await Promise.all([
        getNotificationPermissionStatus(),
        getNotificationSettings(),
      ]);
      if (perm === Notifications.PermissionStatus.DENIED) {
        setNotifStatusLabel(t('settingsV1.off'));
        return;
      }
      if (settings.pause_all) {
        setNotifStatusLabel(t('settingsV1.paused'));
        return;
      }
      const anyEnabled = Boolean(
        settings.meal_reminders_enabled ||
        settings.water_reminders_enabled ||
        settings.partner_activity_enabled,
      );
      setNotifStatusLabel(anyEnabled ? t('settingsV1.on') : t('settingsV1.off'));
    } catch {
      setNotifStatusLabel(t('settingsV1.on'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotificationSummary();
      void steps.refresh();
    }, [loadNotificationSummary, steps]),
  );

  useEffect(() => {
    if (steps.activity?.source === 'health_platform' && steps.activity.updated_at) {
      setLastSyncedAt(steps.activity.updated_at);
    }
  }, [steps.activity?.source, steps.activity?.updated_at]);

  const units = profile?.units === 'imperial' ? 'imperial' : 'metric';
  const latestWeightKg = weight.latestLog?.weight_kg ?? currentGoalProfile?.current_weight_kg ?? 72;
  const activeGoal = currentGoalProfile?.goal ?? 'cut';
  const goalLabel =
    activeGoal === 'cut'
      ? t('settingsV1.goalCut')
      : activeGoal === 'bulk'
        ? t('settingsV1.goalBulk')
        : t('settingsV1.goalMaintain');
  const goalsBodyValue = `${goalLabel} · ${formatWeightDisplay(latestWeightKg, units)}`;

  const stepGoal = currentGoalProfile?.step_goal ?? 10000;
  const waterGoalMl = currentGoalProfile?.water_ml_goal ?? 3000;
  const dailyTargetsValue = t('settingsV1.stepsWaterValue', {
    steps: stepGoal.toLocaleString('en-US'),
    water: formatWaterShort(waterGoalMl),
  });

  const enabledTrackersCount = useMemo(
    () => TRACKING_METRICS.filter((metric) => Boolean(tracking.enabled[metric])).length,
    [tracking.enabled],
  );

  const isProTier = currentTier === 'pro';
  const planLabel = isTrial
    ? t('settingsV1.planTrial')
    : currentTier === 'pro'
      ? t('settingsV1.planPro')
      : currentTier === 'plus'
        ? t('settingsV1.planPlus')
        : t('settingsV1.planFree');

  const providers = useMemo(() => {
    const raw = new Set<string>();
    for (const id of user?.identities ?? []) {
      if (id.provider) raw.add(id.provider.toLowerCase());
    }
    const metaProviders = user?.app_metadata?.providers;
    if (Array.isArray(metaProviders)) {
      for (const p of metaProviders) {
        if (typeof p === 'string') raw.add(p.toLowerCase());
      }
    }
    if (raw.size === 0 && user?.email) raw.add('email');
    return Array.from(raw);
  }, [user?.app_metadata?.providers, user?.email, user?.identities]);

  const providersSummary = useMemo(
    () => providers.map(formatProviderName).filter(Boolean).join(', '),
    [providers],
  );

  const isHealthConnected = steps.permissionStatus === 'granted';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/today' as Href);
    }
  };

  const handleRateApp = async () => {
    const opened = await requestStoreReview();
    if (!opened) setShowFeedback(true);
  };

  const youRows: SettingsRowItem[] = [
    {
      id: 'goals-body',
      label: t('settingsV1.goalsAndBody'),
      value: goalsBodyValue,
      icon: <ScaleIcon size={18} color={colors.textMid} />,
      onPress: () => setShowGoalsBody(true),
      testID: 'settings-row-goals-body',
    },
    {
      id: 'daily-targets',
      label: t('settingsV1.dailyTargets'),
      value: dailyTargetsValue,
      icon: <PulseIcon size={18} color={colors.textMid} />,
      onPress: () => setShowDailyTargets(true),
      testID: 'settings-row-daily-targets',
    },
    {
      id: 'custom-macros',
      label: t('settingsV1.customMacros'),
      badge: !isProTier ? t('onboardingV1.paywallColPro') : undefined,
      value:
        isProTier && currentGoalProfile
          ? `${Math.round(currentGoalProfile.protein_grams)}p · ${Math.round(currentGoalProfile.carb_grams)}c · ${Math.round(currentGoalProfile.fat_grams)}f`
          : undefined,
      icon: <ChartBarIcon size={18} color={colors.textMid} />,
      onPress: () => {
        if (!currentGoalProfile) {
          setShowGoalsBody(true);
          return;
        }
        if (!isProTier) {
          router.push('/paywall' as Href);
          return;
        }
        setShowCustomMacros(true);
      },
      testID: 'settings-row-custom-macros',
    },
    {
      id: 'customize-day',
      label: t('settingsV1.customizeYourDay'),
      value: t('settingsV1.ofSixOn', { count: enabledTrackersCount }),
      icon: <SlidersIcon size={18} color={colors.textMid} />,
      onPress: () => setShowTrackingPrefs(true),
      testID: 'settings-row-customize-day',
    },
  ];

  const appRows: SettingsRowItem[] = [
    {
      id: 'units',
      label: t('settingsV1.units'),
      value: units === 'imperial' ? t('settingsV1.imperial') : t('settingsV1.metric'),
      icon: <RulerIcon size={18} color={colors.textMid} />,
      onPress: () => setShowUnits(true),
      testID: 'settings-row-units',
    },
    {
      id: 'notifications',
      label: t('settingsV1.notificationsAndReminders'),
      value: notifStatusLabel,
      icon: <BellIcon size={18} color={colors.textMid} />,
      onPress: () => router.push('/notifications/settings' as Href),
      testID: 'settings-row-notifications',
    },
    {
      id: 'health-sync',
      label: t('settingsV1.healthSync'),
      value: isHealthConnected ? t('settingsV1.connected') : t('settingsV1.off'),
      valueColor: isHealthConnected ? 'apricot' : 'textLo',
      icon: <HeartIcon size={18} color={colors.textMid} />,
      onPress: () => setShowHealthSync(true),
      testID: 'settings-row-health-sync',
    },
  ];

  const privacyRows: SettingsRowItem[] = [
    {
      id: 'squad-visibility',
      label: t('settingsV1.visibilityPerSquad'),
      value:
        rooms.length === 1
          ? t('settingsV1.squadCountOne', { count: 1 })
          : t('settingsV1.squadCountMany', { count: rooms.length }),
      icon: <EyeIcon size={18} color={colors.textMid} />,
      onPress: () => setShowPerSquadVisibility(true),
      testID: 'settings-row-squad-visibility',
    },
    {
      id: 'discoverability',
      label: t('settingsV1.partnerFinderVisibility'),
      value: profile?.discoverable ? t('settingsV1.on') : t('settingsV1.off'),
      icon: <SearchIcon size={18} color={colors.textMid} />,
      onPress: () => setShowDiscoverability(true),
      testID: 'settings-row-discoverability',
    },
    {
      id: 'social-profile',
      label: t('settingsV1.socialProfile'),
      icon: <ProfileIcon size={18} color={colors.textMid} />,
      onPress: () => router.push('/profile/social' as Href),
      testID: 'settings-row-social-profile',
    },
  ];

  const accountRows: SettingsRowItem[] = [
    {
      id: 'plan-billing',
      label: t('settingsV1.planAndBilling'),
      value: planLabel,
      icon: <CreditCardIcon size={18} color={colors.textMid} />,
      onPress: () => router.push('/paywall' as Href),
      testID: 'settings-row-plan',
    },
    {
      id: 'email',
      label: t('settingsV1.email'),
      value: user?.email ?? '',
      icon: <EnvelopeIcon size={18} color={colors.textMid} />,
      onPress: () => setShowEmailSheet(true),
      testID: 'settings-row-email',
    },
    {
      id: 'password',
      label: t('settingsV1.password'),
      icon: <KeyIcon size={18} color={colors.textMid} />,
      onPress: () => setShowPasswordSheet(true),
      testID: 'settings-row-password',
    },
    {
      id: 'sign-in-methods',
      label: t('settingsV1.signInMethods'),
      value: providersSummary,
      icon: <UsersIcon size={18} color={colors.textMid} />,
      onPress: () => setShowMethodsSheet(true),
      testID: 'settings-row-methods',
    },
  ];

  const helpRows: SettingsRowItem[] = [
    {
      id: 'help-centre',
      label: t('settingsV1.helpCentre'),
      icon: <QuestionCircleIcon size={18} color={colors.textMid} />,
      onPress: () => setShowHelp(true),
      testID: 'settings-row-help',
    },
    {
      id: 'report-feedback',
      label: t('settingsV1.reportFeedback'),
      icon: <FlagIcon size={18} color={colors.textMid} />,
      onPress: () => setShowFeedback(true),
      testID: 'settings-row-feedback',
    },
    {
      id: 'rate-app',
      label: t('settingsV1.rateApp'),
      icon: <StarIcon size={18} color={colors.textMid} />,
      onPress: () => void handleRateApp(),
      testID: 'settings-row-rate',
    },
    {
      id: 'about-legal',
      label: t('settingsV1.aboutAndLegal'),
      icon: <InfoCircleIcon size={18} color={colors.textMid} />,
      onPress: () => setShowAbout(true),
      testID: 'settings-row-about',
    },
  ];

  const destructiveRows: SettingsRowItem[] = [
    {
      id: 'sign-out',
      label: t('settingsV1.signOut'),
      danger: true,
      icon: <SignOutIcon size={18} color={colors.danger} />,
      onPress: () => setShowSignOut(true),
      testID: 'btn-sign-out',
    },
    {
      id: 'delete-account',
      label: t('settingsV1.deleteAccount'),
      danger: true,
      icon: <TrashIcon size={18} color={colors.danger} />,
      onPress: () => setShowDeleteAccount(true),
      testID: 'btn-delete-account',
    },
  ];

  const bottomPadding = inTabs
    ? getTabBarHeight(fontScale) + insets.bottom + space.lg
    : Math.max(space.lg, insets.bottom + space.md);

  return (
    <View style={styles.root} testID="screen-me">
      <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('squadDesign.back')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
          testID="settings-back-button"
        >
          <ChevronLeftIcon size={18} color={colors.textHi} />
        </Pressable>
        <Text variant="titleS" color="textHi" accessibilityRole="header" style={styles.headerTitle}>
          {t('settingsV1.title')}
        </Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
      >
        <View style={styles.innerWrap}>
          <SettingsSection title={t('settingsV1.sectionYou')} rows={youRows} />
          <SettingsSection title={t('settingsV1.sectionApp')} rows={appRows} />
          <SettingsSection title={t('settingsV1.sectionPrivacy')} rows={privacyRows} />
          <SettingsSection title={t('settingsV1.sectionAccount')} rows={accountRows} />
          <SettingsSection title={t('settingsV1.sectionHelp')} rows={helpRows} />
          <SettingsSection rows={destructiveRows} />

          <Text variant="meta" color="textLo" style={styles.versionFooter}>
            {t('settingsV1.versionFooter', { version: appVersion })}
          </Text>
        </View>
      </ScrollView>

      {showGoalsBody ? (
        <GoalsAndBodyModal
          visible={showGoalsBody}
          onClose={() => setShowGoalsBody(false)}
          currentGoal={activeGoal}
          currentRate={currentGoalProfile?.weekly_rate_kg ?? 0.5}
          currentHeightCm={profile?.height_cm ?? 175}
          currentWeightKg={latestWeightKg}
          currentSex={profile?.sex ?? 'male'}
          onSave={async (data) => {
            if (!user?.id) return;
            await updateProfile({ height_cm: data.heightCm, sex: data.sex });
            const activityLevel = currentGoalProfile?.activity_level ?? 'light';
            const computed = calculate({
              sex: data.sex,
              age: deriveAgeYears(profile?.date_of_birth),
              heightCm: data.heightCm,
              weightKg: data.weightKg,
              activityLevel,
              goal: data.goal,
              weeklyRateKg: data.rate,
            });
            const now = new Date().toISOString();
            await saveGoalProfile({
              id: generateClientUuid(),
              user_id: user.id,
              effective_from: now,
              activity_level: activityLevel,
              goal: data.goal,
              weekly_rate_kg: data.rate,
              target_weight_kg: currentGoalProfile?.target_weight_kg ?? null,
              target_date: currentGoalProfile?.target_date ?? null,
              body_fat_percentage: currentGoalProfile?.body_fat_percentage ?? null,
              current_weight_kg: data.weightKg,
              bmr: computed.bmr,
              tdee: computed.tdee,
              daily_calorie_target: computed.targetKcal,
              protein_grams: computed.macros.proteinGrams,
              fat_grams: computed.macros.fatGrams,
              carb_grams: computed.macros.carbGrams,
              step_goal: currentGoalProfile?.step_goal ?? 10000,
              water_ml_goal: currentGoalProfile?.water_ml_goal ?? 3000,
              recompute_reason: 'manual_edit',
              confirmed_at: now,
              created_at: now,
            });
            await refreshTargets();
          }}
        />
      ) : null}

      {showDailyTargets ? (
        <DailyGoalsModal
          visible={showDailyTargets}
          onClose={() => setShowDailyTargets(false)}
          currentStepGoal={stepGoal}
          currentWaterGoalMl={waterGoalMl}
          onSave={async ({ stepGoal: nextSteps, waterGoalMl: nextWater }) => {
            await updateDailyGoals(nextSteps, nextWater);
          }}
        />
      ) : null}

      {showCustomMacros && currentGoalProfile ? (
        <CustomMacrosModal
          goal={currentGoalProfile}
          sex={profile?.sex ?? 'male'}
          onClose={() => setShowCustomMacros(false)}
        />
      ) : null}

      {showTrackingPrefs ? (
        <TrackingPreferencesSheet
          enabled={tracking.enabled}
          onClose={() => setShowTrackingPrefs(false)}
          onSave={async (next: TrackingPreferences) => {
            await tracking.save(next);
          }}
        />
      ) : null}

      {showUnits ? (
        <UnitsLanguageModal
          visible={showUnits}
          onClose={() => setShowUnits(false)}
          currentUnits={units}
          onUpdateUnits={async (nextUnits) => {
            const res = await updateProfile({ units: nextUnits });
            if (res.error) throw res.error;
          }}
        />
      ) : null}

      {showHealthSync ? (
        <HealthSyncModal
          visible={showHealthSync}
          onClose={() => setShowHealthSync(false)}
          isConnected={isHealthConnected}
          lastSyncedAt={lastSyncedAt}
          onToggleConnection={async (connect) => {
            if (connect) {
              const granted = await steps.requestPermission();
              if (granted) await steps.syncFromPlatform();
            } else {
              await disconnectNativeHealth();
              await steps.refresh();
            }
          }}
        />
      ) : null}

      {showPerSquadVisibility ? (
        <PerRoomVisibilityModal
          visible={showPerSquadVisibility}
          onClose={() => setShowPerSquadVisibility(false)}
          rooms={rooms}
        />
      ) : null}

      {showDiscoverability ? (
        <DiscoverabilityModal
          visible={showDiscoverability}
          onClose={() => setShowDiscoverability(false)}
          discoverable={profile?.discoverable ?? true}
          onUpdateDiscoverable={async (value) => {
            const res = await updateProfile({ discoverable: value });
            if (res.error) throw res.error;
          }}
        />
      ) : null}

      <EmailSettingsSheet
        visible={showEmailSheet}
        currentEmail={user?.email ?? ''}
        onClose={() => setShowEmailSheet(false)}
        onSave={updateEmail}
      />

      <PasswordSettingsSheet
        visible={showPasswordSheet}
        userEmail={user?.email ?? ''}
        onClose={() => setShowPasswordSheet(false)}
        onSavePassword={updatePassword}
        onSendReset={resetPassword}
      />

      <SignInMethodsSheet
        visible={showMethodsSheet}
        providers={providers}
        email={user?.email ?? ''}
        onClose={() => setShowMethodsSheet(false)}
      />

      <HelpCentreModal visible={showHelp} onClose={() => setShowHelp(false)} />
      <ReportFeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
      <AboutLegalModal visible={showAbout} onClose={() => setShowAbout(false)} />

      <SignOutSheet
        visible={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirmSignOut={async () => {
          await signOut();
          router.replace('/welcome' as Href);
        }}
        onOpenDeleteAccount={() => setShowDeleteAccount(true)}
      />

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirmDelete={async () => {
          const res = await deleteAccount();
          if (res.error) throw res.error;
          router.replace('/welcome' as Href);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.sm,
    backgroundColor: colors.bg0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    backgroundColor: colors.s2,
  },
  backSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  sectionBlock: {
    gap: space.xs + 2,
  },
  sectionEyebrow: {
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.optical14,
    minHeight: 54,
    gap: space.md,
  },
  rowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
  },
  rowPressed: {
    backgroundColor: colors.s2,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileDanger: {
    backgroundColor: colors.s2,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    maxWidth: '48%',
  },
  rowValue: {
    fontSize: 13,
    textAlign: 'right',
  },
  versionFooter: {
    textAlign: 'center',
    paddingVertical: space.md,
  },
});
