import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  Card,
  Chip,
  dark,
  ListRow,
  radius,
  space,
  SyncPill,
  Text,
} from '@calipartner/ui';

import {
  MeRoomPlanCard,
  PaywallModal,
  PrivacySettingsModal,
  RequestsInboxModal,
} from '@/components/rooms';
import {
  AboutLegalModal,
  AppearanceModal,
  AvatarPickerModal,
  DailyGoalsModal,
  DiscoverabilityModal,
  ExportDataModal,
  GoalsAndBodyModal,
  HealthSyncModal,
  HelpCentreModal,
  PerRoomVisibilityModal,
  PreviewAsPartnerModal,
  ReportFeedbackModal,
  SignOutSheet,
  StorageCacheModal,
  UnitsLanguageModal,
} from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { useRooms } from '@/hooks/useRooms';
import { useRoomRequests } from '@/hooks/useRoomRequests';
import { useTargets } from '@/hooks/useTargets';
import { OnboardingStateMachine } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export default function MeScreen() {
  const router = useRouter();
  const { user, profile, isGuest, signOut, updateProfile } = useAuth();
  const { currentGoalProfile, updateDailyGoals, saveGoalProfile } = useTargets();
  const { rooms } = useRooms();
  const { incoming, outgoing, respondToRequest, cancelRequest } = useRoomRequests();

  // Modals visibility state
  const [showPaywall, setShowPaywall] = useState(false);
  const [showRequestsInbox, setShowRequestsInbox] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showGoalsBody, setShowGoalsBody] = useState(false);
  const [showDailyGoals, setShowDailyGoals] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPerRoomVisibility, setShowPerRoomVisibility] = useState(false);
  const [showPreviewPartner, setShowPreviewPartner] = useState(false);
  const [showDiscoverability, setShowDiscoverability] = useState(false);

  const [showHealthSync, setShowHealthSync] = useState(false);
  const [showUnitsLanguage, setShowUnitsLanguage] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showStorageCache, setShowStorageCache] = useState(false);
  const [showExportData, setShowExportData] = useState(false);
  const [showHelpCentre, setShowHelpCentre] = useState(false);
  const [showReportFeedback, setShowReportFeedback] = useState(false);
  const [showAboutLegal, setShowAboutLegal] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);

  const friends = useFriends();
  const pendingRequestsCount = incoming.length + (friends.inbox?.incoming.length ?? 0);

  const handleRateApp = () => {
    playClickSound();
    Alert.alert(
      'Rate CaliPartner',
      'Enjoying your accountability partner journey? Your review helps more people reach their health goals.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: '5 Stars ★', onPress: () => {} },
      ],
    );
  };

  const performSignOut = async () => {
    setShowSignOutSheet(false);
    await signOut();
    router.replace('/auth/sign-in');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container} testID="screen-me">
        {/* Header with Title and Requests Bell (Spec N01) */}
        <View style={styles.header}>
          <Text variant="title1" color={dark.textHi}>
            {t('tabs.me')}
          </Text>

          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setShowRequestsInbox(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Requests inbox with ${pendingRequestsCount} pending`}
            style={styles.bellButton}
            testID="btn-me-requests-bell"
          >
            <Ionicons name="notifications-outline" size={22} color={dark.textHi} />
            {pendingRequestsCount > 0 && (
              <View style={styles.bellBadge} testID="badge-requests-count">
                <Text variant="micro" color={dark.onBrand} style={styles.bellBadgeText}>
                  {pendingRequestsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Guest Mode Banner (Spec N01) */}
          {isGuest && (
            <Card elevation="s2" style={styles.guestCard} testID="guest-mode-banner">
              <Text variant="heading" color={dark.textHi}>
                Guest Mode
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.guestDesc}>
                Create an account to keep your data, join accountability rooms, and match with
                partners.
              </Text>
              <Button
                variant="primary"
                label={t('auth.title')}
                onPress={() =>
                  router.push({ pathname: '/auth/sign-in', params: { mode: 'signup' } })
                }
                testID="btn-me-signin"
                style={styles.guestSignInBtn}
              />
            </Card>
          )}

          {/* Authenticated Profile Header (Avatar 72, nickname, @username, edit) (Spec N01) */}
          {!isGuest && (
            <Card elevation="s1" style={styles.profileCard}>
              <View style={styles.profileHeaderRow}>
                <TouchableOpacity
                  onPress={() => {
                    playClickSound();
                    setShowAvatarPicker(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change avatar"
                  testID="btn-me-avatar"
                  style={styles.avatarWrap}
                >
                  <Avatar
                    size="lg"
                    uri={profile?.avatar_url}
                    name={profile?.nickname ?? 'User'}
                    identityHue="teal"
                  />
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={14} color={dark.onBrand} />
                  </View>
                </TouchableOpacity>

                <View style={styles.profileTextWrap}>
                  <Text variant="title2" color={dark.textHi} style={styles.nicknameText}>
                    {profile?.nickname ?? 'CaliPartner'}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid}>
                    @{profile?.username ?? 'user'}
                  </Text>
                  {user?.email ? (
                    <Text variant="micro" color={dark.textLo} style={styles.emailText}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.profileActions}>
                <Button
                  variant="secondary"
                  size="md"
                  fontSet="onboarding"
                  label={t('friends.editProfile')}
                  onPress={() => router.push('/profile/social' as never)}
                  testID="me-social-profile"
                />
                <Button
                  variant="secondary"
                  size="md"
                  fontSet="onboarding"
                  label={t('friends.title')}
                  onPress={() => router.push('/friends' as never)}
                  testID="me-friends"
                />
                <Button
                  variant="secondary"
                  size="md"
                  fontSet="onboarding"
                  label={profile ? t('profileEdit.title') : t('profileSetup.title')}
                  onPress={() => {
                    playClickSound();
                    if (!profile) {
                      router.push('/auth/profile-setup');
                    } else {
                      router.push('/profile/edit');
                    }
                  }}
                  testID="btn-me-edit-profile"
                />
              </View>
            </Card>
          )}

          {/* Room Plan Card (Spec N01, O01) */}
          <MeRoomPlanCard
            attachedRoom={rooms[0] ?? null}
            onChangePlan={() => setShowPaywall(true)}
          />

          {/* Group 1: My Goals (Spec N01, N03, N04) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.myGoals')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title={t('me.goalsAndBody.title')}
                subtitle="Primary goal, deficit pace, body measurements"
                onPress={() => {
                  playClickSound();
                  setShowGoalsBody(true);
                }}
                testID="row-goals-body"
              />
              <ListRow
                title={t('me.dailyGoals.title')}
                subtitle={
                  currentGoalProfile
                    ? t('fixes.dailyGoalsSummary', {
                        steps: currentGoalProfile.step_goal.toLocaleString(),
                      })
                    : t('common.loading')
                }
                onPress={() => {
                  playClickSound();
                  setShowDailyGoals(true);
                }}
                showDivider={false}
                testID="row-daily-goals"
              />
            </Card>
          </View>

          {/* Group 2: Privacy & Visibility (Spec N01, N05, N06, N07, N08) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.privacy')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title="Privacy"
                subtitle="You decide what people in your room see"
                onPress={() => {
                  playClickSound();
                  setShowPrivacy(true);
                }}
                testID="row-privacy"
              />
              <ListRow
                title={t('me.perRoomVisibility.title')}
                subtitle="Customise visibility for individual rooms"
                onPress={() => {
                  playClickSound();
                  setShowPerRoomVisibility(true);
                }}
                testID="row-per-room-visibility"
              />
              <ListRow
                title={t('me.previewPartner.title')}
                subtitle="Read-only preview of your card as seen by partners"
                onPress={() => {
                  playClickSound();
                  setShowPreviewPartner(true);
                }}
                testID="row-preview-partner"
              />
              <ListRow
                title={t('me.discoverability.title')}
                subtitle="Searchability by username and blocked accounts"
                onPress={() => {
                  playClickSound();
                  setShowDiscoverability(true);
                }}
                showDivider={false}
                testID="row-discoverability"
              />
            </Card>
          </View>

          {/* Group 3: Features (Spec N01) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.features')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title="Find a partner"
                subtitle="Matching status and preferences"
                trailing={<Chip label="Open" />}
                onPress={() => {
                  playClickSound();
                  setShowDiscoverability(true);
                }}
                testID="row-find-partner"
              />
              <ListRow
                title="Fasting"
                subtitle="Active fasting timer and protocols"
                onPress={() => {
                  playClickSound();
                  router.push('/(tabs)/log');
                }}
                testID="row-fasting"
              />

              <ListRow
                title="AI coach history"
                subtitle="Personal fitness and meal check-in logs"
                onPress={() => {
                  playClickSound();
                  router.push('/coach' as never);
                }}
                showDivider={false}
                testID="row-coach-history"
              />
            </Card>
          </View>

          {/* Group 4: Preferences (Spec N01, N09, N10, N11, N12) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.preferences')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title={t('notifications.title')}
                subtitle="Push alerts, quiet hours, local reminders"
                onPress={() => {
                  playClickSound();
                  router.push('/notifications/settings' as never);
                }}
                testID="row-notifications"
              />
              <ListRow
                title={t('me.healthSync.title')}
                subtitle="Apple Health, Health Connect, pedometer"
                onPress={() => {
                  playClickSound();
                  setShowHealthSync(true);
                }}
                testID="row-health-sync"
              />
              <ListRow
                title={t('me.unitsLanguage.title')}
                subtitle="Metric/imperial, English/Hindi, timezone"
                onPress={() => {
                  playClickSound();
                  setShowUnitsLanguage(true);
                }}
                testID="row-units-language"
              />
              <ListRow
                title={t('me.appearance.title')}
                subtitle="Theme, reduce motion, haptics, text scaling"
                onPress={() => {
                  playClickSound();
                  setShowAppearance(true);
                }}
                showDivider={false}
                testID="row-appearance"
              />
            </Card>
          </View>

          {/* Group 5: Data & Storage (Spec N01, P01, B09) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.syncStorage')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title="Sync status"
                subtitle="Saved on this phone • Offline first"
                trailing={<SyncPill status="synced" />}
                testID="row-sync-status"
              />
              <ListRow
                title={t('me.storageCache.title')}
                subtitle="SQLite database, food cache"
                onPress={() => {
                  playClickSound();
                  setShowStorageCache(true);
                }}
                testID="row-storage-cache"
              />
              <ListRow
                title="Export my data"
                subtitle="Download your logs as CSV or JSON"
                onPress={() => {
                  playClickSound();
                  setShowExportData(true);
                }}
                showDivider={false}
                testID="row-export-data"
              />
            </Card>
          </View>

          {/* Group 6: Help and Feedback (Spec N01, N13, N14, RAT-6) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.helpFeedback')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title={t('me.helpCentre.title')}
                subtitle="Guides, FAQs, and support"
                onPress={() => {
                  playClickSound();
                  setShowHelpCentre(true);
                }}
                testID="row-help-centre"
              />
              <ListRow
                title={t('me.reportFeedback.title')}
                subtitle="Report a problem, wrong food entry, or feedback"
                onPress={() => {
                  playClickSound();
                  setShowReportFeedback(true);
                }}
                testID="row-report-feedback"
              />
              <ListRow
                title="Rate CaliPartner"
                subtitle="Share your feedback on the app store"
                onPress={handleRateApp}
                showDivider={false}
                testID="row-rate-app"
              />
            </Card>
          </View>

          {/* Group 7: About and Legal (Spec N01, N15) */}
          <View style={styles.groupSection}>
            <Text variant="label" color={dark.textHi} style={styles.groupHeader}>
              {t('me.sections.aboutLegal')}
            </Text>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title={t('me.aboutLegal.title')}
                subtitle="Terms, privacy, health disclaimer, IFCT"
                onPress={() => {
                  playClickSound();
                  setShowAboutLegal(true);
                }}
                showDivider={false}
                testID="row-about-legal"
              />
            </Card>
          </View>

          {/* Group 8: Account & Sign Out (Spec N01, N16) */}
          <View style={styles.groupSection}>
            <Card elevation="s1" style={styles.groupCard}>
              <ListRow
                title={t('auth.signOut')}
                subtitle="Pause notifications and safely disconnect"
                onPress={() => {
                  playClickSound();
                  setShowSignOutSheet(true);
                }}
                showDivider={false}
                testID="row-sign-out"
              />
            </Card>
          </View>
        </ScrollView>

        {/* All Modals Wired (N02 - N16, O02) */}
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          context="general"
          roomName={rooms[0]?.name ?? 'Accountability Room'}
        />

        <RequestsInboxModal
          visible={showRequestsInbox}
          incoming={incoming}
          outgoing={outgoing}
          onClose={() => setShowRequestsInbox(false)}
          onRespond={respondToRequest}
          onCancel={cancelRequest}
          onOpenPaywall={() => setShowPaywall(true)}
        />

        <AvatarPickerModal
          visible={showAvatarPicker}
          currentAvatarUri={profile?.avatar_url}
          onClose={() => setShowAvatarPicker(false)}
          onSelectAvatar={(avatar) => {
            if (avatar.uri) {
              updateProfile({ avatar_url: avatar.uri });
            }
            setShowAvatarPicker(false);
          }}
          onSelectCustomPhoto={(uri) => {
            updateProfile({ avatar_url: uri });
            setShowAvatarPicker(false);
          }}
        />

        {showGoalsBody && currentGoalProfile && profile && (
          <GoalsAndBodyModal
            visible={showGoalsBody}
            onClose={() => setShowGoalsBody(false)}
            currentHeightCm={currentGoalProfile.input_height_cm ?? profile.height_cm}
            currentGoal={currentGoalProfile.goal}
            currentRate={currentGoalProfile.weekly_rate_kg}
            currentWeightKg={currentGoalProfile.current_weight_kg}
            currentSex={profile.sex}
            onSave={async (details) => {
              if (!user) throw new Error('Sign in to save your plan');
              if (details.sex !== profile.sex) {
                const changed = await updateProfile({ sex: details.sex });
                if (changed.error) throw changed.error;
              }
              const machine = new OnboardingStateMachine({
                goal: details.goal,
                sex: details.sex,
                dateOfBirth: profile.date_of_birth,
                heightCm: details.heightCm,
                weightKg: details.weightKg,
                bodyFatPercentage: currentGoalProfile.body_fat_percentage,
                activityLevel: currentGoalProfile.activity_level,
                gymDays: currentGoalProfile.gym_days ?? 3,
                weeklyRateKg: details.goal === 'maintain' ? 0 : details.rate,
                stepGoal: currentGoalProfile.step_goal,
                waterMlGoal: currentGoalProfile.water_ml_goal,
              });
              const saved = await saveGoalProfile({
                ...machine.buildGoalProfile(user.id),
                recompute_reason: 'manual_edit',
              });
              if (!saved.success) throw new Error(saved.error);
            }}
          />
        )}

        {showDailyGoals && currentGoalProfile && (
          <DailyGoalsModal
            visible={showDailyGoals}
            onClose={() => setShowDailyGoals(false)}
            currentStepGoal={currentGoalProfile.step_goal}
            currentWaterGoalMl={currentGoalProfile.water_ml_goal}
            onSave={({ stepGoal, waterGoalMl }) => updateDailyGoals(stepGoal, waterGoalMl)}
          />
        )}

        <PrivacySettingsModal
          visible={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          onGetPrivacy={async () => ({
            share_streak: true,
            share_goal_completion: true,
            share_steps: true,
            share_water: true,
            share_workouts: true,
            share_workout_details: false,
            share_calories_macros: true,
            share_meals: 'always',
            share_weight_number: false,
            share_weight_progress: true,
            share_fasting: false,
            share_focus_status: true,
            share_focus_label: false,
          })}
          onUpdatePrivacy={async (settings) => settings as never}
          onOpenPerRoom={() => setShowPerRoomVisibility(true)}
          onOpenPreviewPartner={() => setShowPreviewPartner(true)}
        />

        <PerRoomVisibilityModal
          visible={showPerRoomVisibility}
          onClose={() => setShowPerRoomVisibility(false)}
          rooms={rooms}
        />

        <PreviewAsPartnerModal
          visible={showPreviewPartner}
          onClose={() => setShowPreviewPartner(false)}
        />

        <DiscoverabilityModal
          visible={showDiscoverability}
          onClose={() => setShowDiscoverability(false)}
          discoverable={profile?.discoverable ?? true}
        />

        <HealthSyncModal visible={showHealthSync} onClose={() => setShowHealthSync(false)} />

        <UnitsLanguageModal
          visible={showUnitsLanguage}
          onClose={() => setShowUnitsLanguage(false)}
          currentUnits={profile?.units ?? 'metric'}
        />

        <AppearanceModal visible={showAppearance} onClose={() => setShowAppearance(false)} />

        <StorageCacheModal visible={showStorageCache} onClose={() => setShowStorageCache(false)} />

        <ExportDataModal visible={showExportData} onClose={() => setShowExportData(false)} />

        <HelpCentreModal visible={showHelpCentre} onClose={() => setShowHelpCentre(false)} />

        <ReportFeedbackModal
          visible={showReportFeedback}
          onClose={() => setShowReportFeedback(false)}
        />

        <AboutLegalModal visible={showAboutLegal} onClose={() => setShowAboutLegal(false)} />

        <SignOutSheet
          visible={showSignOutSheet}
          onClose={() => setShowSignOutSheet(false)}
          onConfirmSignOut={performSignOut}
        />
      </View>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  bellButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: dark.danger,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontWeight: '700',
    fontSize: 10,
  },
  scrollContent: {
    padding: space[4],
    paddingBottom: 80,
  },
  guestCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  guestDesc: {
    marginTop: space[1],
    marginBottom: space[3],
    lineHeight: 20,
  },
  guestSignInBtn: {
    width: '100%',
  },
  profileActions: {
    gap: space[3],
    marginTop: space[3],
  },
  profileCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    marginBottom: space[3],
  },
  avatarWrap: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: dark.bg0,
  },
  profileTextWrap: {
    flex: 1,
  },
  nicknameText: {
    marginBottom: 2,
  },
  emailText: {
    marginTop: 2,
  },
  editProfileBtn: {
    width: '100%',
  },
  groupSection: {
    marginBottom: space[4],
  },
  groupHeader: {
    marginBottom: space[2],
    paddingHorizontal: space[1],
  },
  groupCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
});
