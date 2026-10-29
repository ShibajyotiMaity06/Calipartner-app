import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  Card,
  dark,
  onboardingLayout as layout,
  radius,
  space,
  Text,
} from '@calipartner/ui';

import { MeRoomPlanCard, PaywallModal, RequestsInboxModal } from '@/components/rooms';
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
import { ProfileRow, ProfileShortcut, SettingsGroup } from '@/components/profile/CompactSettings';
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
  const {
    user,
    profile,
    isGuest,
    signOut,
    updateProfile,
    isLoading,
    profileError,
    refreshProfile,
  } = useAuth();
  const {
    currentGoalProfile,
    updateDailyGoals,
    saveGoalProfile,
    loading: targetsLoading,
    error: targetsError,
  } = useTargets();
  const { rooms } = useRooms();
  const { incoming, outgoing, respondToRequest, cancelRequest } = useRoomRequests();

  // Modals visibility state
  const [showPaywall, setShowPaywall] = useState(false);
  const [showRequestsInbox, setShowRequestsInbox] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showGoalsBody, setShowGoalsBody] = useState(false);
  const [showDailyGoals, setShowDailyGoals] = useState(false);
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
    Alert.alert(t('compactProfile.rate'), t('compactProfile.rateMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const performSignOut = async () => {
    setShowSignOutSheet(false);
    await signOut();
    router.replace('/auth/sign-in');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container} testID="screen-me">
        <View style={styles.header}>
          <Text variant="title2" color={dark.textHi}>
            {t('compactProfile.account')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setShowRequestsInbox(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('compactProfile.requests', { count: pendingRequestsCount })}
            style={styles.bellButton}
            testID="btn-me-requests-bell"
          >
            <Ionicons name="notifications-outline" size={layout.icon} color={dark.textHi} />
            {pendingRequestsCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text variant="micro" color={dark.onBrand} tabular>
                  {pendingRequestsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="profile-scroll"
        >
          {isGuest ? (
            <Card elevation="s2" style={styles.profileCard} testID="guest-mode-banner">
              <Text variant="heading">{t('compactProfile.guest')}</Text>
              <Text variant="bodyS" color={dark.textMid}>
                {t('compactProfile.guestSubtitle')}
              </Text>
              <Button
                label={t('auth.title')}
                onPress={() =>
                  router.push({ pathname: '/auth/sign-in', params: { mode: 'signup' } })
                }
                testID="btn-me-signin"
              />
            </Card>
          ) : (
            <Card elevation="s1" style={styles.profileCard}>
              {isLoading ? (
                <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
              ) : null}
              {profileError ? (
                <>
                  <Text accessibilityRole="alert" color={dark.danger}>
                    {t('compactProfile.profileError')}
                  </Text>
                  <Button
                    variant="tertiary"
                    label={t('friends.retry')}
                    onPress={() => void refreshProfile()}
                    testID="retry-me-profile"
                  />
                </>
              ) : null}
              <View style={styles.profileHeaderRow}>
                <TouchableOpacity
                  onPress={() => setShowAvatarPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('compactProfile.avatar')}
                  testID="btn-me-avatar"
                  style={styles.bellButton}
                >
                  <Avatar
                    size="md"
                    uri={profile?.avatar_url}
                    name={profile?.nickname ?? t('compactProfile.account')}
                    identityHue="teal"
                  />
                </TouchableOpacity>
                <View style={styles.profileTextWrap}>
                  <Text variant="heading">{profile?.nickname ?? t('compactProfile.account')}</Text>
                  <Text variant="micro" color={dark.textMid}>
                    {profile ? `@${profile.username}` : t('profileSetup.title')}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('profileEdit.title')}
                  onPress={() => router.push(profile ? '/profile/edit' : '/auth/profile-setup')}
                  testID="btn-me-edit-profile"
                  style={styles.bellButton}
                >
                  <Ionicons name="create-outline" size={layout.icon} color={dark.textMid} />
                </TouchableOpacity>
              </View>
              <View style={styles.shortcuts}>
                <View style={styles.shortcut}>
                  <ProfileShortcut
                    title={t('compactProfile.trophies')}
                    icon="trophy-outline"
                    onPress={() => router.push('/progress?tab=challenges&trophies=1' as never)}
                    testID="me-challenge-trophies"
                  />
                </View>
                <View style={styles.shortcut}>
                  <ProfileShortcut
                    title={t('community.title')}
                    icon="people-outline"
                    onPress={() => router.push('/friends' as never)}
                    testID="me-friends"
                  />
                </View>
              </View>
            </Card>
          )}
          <MeRoomPlanCard
            attachedRoom={rooms[0] ?? null}
            onChangePlan={() => setShowPaywall(true)}
            compact
          />
          <Text variant="label" color={dark.textMid}>
            {t('me.sections.myGoals')}
          </Text>
          <Card elevation="s1" style={styles.groupCard}>
            <ProfileRow
              title={t('me.goalsAndBody.title')}
              subtitle={
                currentGoalProfile
                  ? t(`socialUpdate.${currentGoalProfile.goal}`)
                  : t(targetsLoading ? 'common.loading' : 'compactProfile.noGoals')
              }
              icon="body-outline"
              onPress={() => setShowGoalsBody(true)}
              disabled={!currentGoalProfile || !profile}
              testID="row-goals-body"
            />
            <ProfileRow
              title={t('me.dailyGoals.title')}
              subtitle={
                currentGoalProfile
                  ? t('fixes.dailyGoalsSummary', {
                      steps: currentGoalProfile.step_goal.toLocaleString(),
                    })
                  : t(targetsLoading ? 'common.loading' : 'compactProfile.noGoals')
              }
              icon="footsteps-outline"
              onPress={() => setShowDailyGoals(true)}
              disabled={!currentGoalProfile}
              testID="row-daily-goals"
            />
          </Card>
          {targetsError ? (
            <Text accessibilityRole="alert" color={dark.danger}>
              {t('compactProfile.goalsError')}
            </Text>
          ) : null}
          <Text variant="label" color={dark.textMid}>
            {t('me.sections.features')}
          </Text>
          <Card elevation="s1" style={styles.groupCard}>
            <ProfileRow
              title={t('compactProfile.findPartner')}
              icon="people-outline"
              onPress={() => router.push('/friends' as never)}
              testID="row-find-partner"
            />
            <ProfileRow
              title={t('compactProfile.fasting')}
              icon="timer-outline"
              onPress={() => router.push('/(tabs)/log')}
              testID="row-fasting"
            />
            <ProfileRow
              title={t('compactProfile.coach')}
              icon="chatbubbles-outline"
              onPress={() => router.push('/coach' as never)}
              testID="row-coach-history"
            />
          </Card>
          <SettingsGroup
            title={t('me.sections.preferences')}
            summary={t('compactProfile.preferences')}
            icon="options-outline"
            testID="section-preferences"
          >
            <ProfileRow
              title={t('notifications.title')}
              icon="notifications-outline"
              onPress={() => router.push('/notifications/settings' as never)}
              testID="row-notifications"
            />
            <ProfileRow
              title={t('me.healthSync.title')}
              icon="heart-outline"
              onPress={() => setShowHealthSync(true)}
              testID="row-health-sync"
            />
            <ProfileRow
              title={t('me.unitsLanguage.title')}
              icon="globe-outline"
              onPress={() => setShowUnitsLanguage(true)}
              testID="row-units-language"
            />
            <ProfileRow
              title={t('me.appearance.title')}
              icon="color-palette-outline"
              onPress={() => setShowAppearance(true)}
              testID="row-appearance"
            />
          </SettingsGroup>
          <SettingsGroup
            title={t('me.sections.privacy')}
            summary={t('compactProfile.privacy')}
            icon="lock-closed-outline"
            testID="section-privacy"
          >
            <ProfileRow
              title={t('compactProfile.privacyTitle')}
              icon="lock-closed-outline"
              onPress={() => setShowPerRoomVisibility(true)}
              testID="row-privacy"
            />
            <ProfileRow
              title={t('me.perRoomVisibility.title')}
              icon="eye-outline"
              onPress={() => setShowPerRoomVisibility(true)}
              testID="row-per-room-visibility"
            />
            <ProfileRow
              title={t('me.previewPartner.title')}
              icon="person-outline"
              onPress={() => setShowPreviewPartner(true)}
              testID="row-preview-partner"
            />
            <ProfileRow
              title={t('me.discoverability.title')}
              icon="shield-outline"
              onPress={() => setShowDiscoverability(true)}
              testID="row-discoverability"
            />
            <ProfileRow
              title={t('friends.editProfile')}
              icon="create-outline"
              onPress={() => router.push('/profile/social' as never)}
              testID="me-social-profile"
            />
          </SettingsGroup>
          <SettingsGroup
            title={t('me.sections.syncStorage')}
            summary={t('compactProfile.storage')}
            icon="server-outline"
            testID="section-storage"
          >
            <ProfileRow
              title={t('me.storageCache.title')}
              icon="server-outline"
              onPress={() => setShowStorageCache(true)}
              testID="row-storage-cache"
            />
            <ProfileRow
              title={t('compactProfile.export')}
              icon="download-outline"
              onPress={() => setShowExportData(true)}
              testID="row-export-data"
            />
          </SettingsGroup>
          <SettingsGroup
            title={t('compactProfile.helpLegal')}
            summary={t('compactProfile.help')}
            icon="help-circle-outline"
            testID="section-help"
          >
            <ProfileRow
              title={t('me.helpCentre.title')}
              icon="help-circle-outline"
              onPress={() => setShowHelpCentre(true)}
              testID="row-help-centre"
            />
            <ProfileRow
              title={t('me.reportFeedback.title')}
              icon="warning-outline"
              onPress={() => setShowReportFeedback(true)}
              testID="row-report-feedback"
            />
            <ProfileRow
              title={t('compactProfile.rate')}
              icon="thumbs-up-outline"
              onPress={handleRateApp}
              testID="row-rate-app"
            />
            <ProfileRow
              title={t('me.aboutLegal.title')}
              icon="document-text-outline"
              onPress={() => setShowAboutLegal(true)}
              testID="row-about-legal"
            />
          </SettingsGroup>
          <Card elevation="s1" style={styles.groupCard}>
            <ProfileRow
              title={t('compactProfile.signOut')}
              icon="log-out-outline"
              onPress={() => setShowSignOutSheet(true)}
              testID="row-signout"
              danger
            />
          </Card>
        </ScrollView>

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

        <PerRoomVisibilityModal
          visible={showPerRoomVisibility}
          onClose={() => setShowPerRoomVisibility(false)}
          rooms={rooms}
        />

        <PreviewAsPartnerModal
          roomId={rooms[0]?.id}
          visible={showPreviewPartner}
          onClose={() => setShowPreviewPartner(false)}
        />

        <DiscoverabilityModal
          visible={showDiscoverability}
          onClose={() => setShowDiscoverability(false)}
          discoverable={profile?.discoverable ?? true}
          onUpdateDiscoverable={async (discoverable) => {
            const result = await updateProfile({ discoverable });
            if (result.error) throw result.error;
          }}
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
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  container: { flex: 1, backgroundColor: dark.bg0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[1],
  },
  bellButton: {
    minWidth: layout.touch,
    minHeight: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: space[0],
    right: space[0],
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
    minWidth: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingTop: space[1],
    paddingBottom: space[9] + space[6],
    gap: space[2],
  },
  profileCard: { padding: space[3], gap: space[2] },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  profileTextWrap: { flex: 1, minWidth: 0 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  shortcut: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    maxWidth: '100%',
    minWidth: layout.touch,
  },
  groupCard: { padding: space[0], borderRadius: radius.card, overflow: 'hidden' },
});
