import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FocusSettingsModal } from '@/components/focus';
import { MeRoomPlanCard, PaywallModal } from '@/components/rooms';
import { useAuth } from '@/contexts/AuthContext';
import { useRooms } from '@/hooks/useRooms';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function MeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile, isGuest, signOut } = useAuth();
  const { rooms } = useRooms();
  const [showFocusSettings, setShowFocusSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleSignOut = () => {
    const performSignOut = async () => {
      await signOut();
      router.replace('/auth/sign-in');
    };

    if (Platform.OS === 'web') {
      const g = globalThis as unknown as { confirm?: (msg: string) => boolean };
      const confirmed =
        typeof g.confirm === 'function'
          ? g.confirm(t('auth.signOutConfirm'))
          : true;
      if (confirmed) {
        void performSignOut();
      }
      return;
    }

    Alert.alert(t('auth.signOut'), t('auth.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.signOut'),
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('tabs.me')}</Text>
      </View>

      {/* Guest Mode Banner */}
      {isGuest && (
        <View
          style={[
            styles.guestCard,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          testID="guest-mode-banner"
        >
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
            Guest Mode
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: fontSize.sm, marginVertical: spacing.xs }}
          >
            {t('auth.guestNotice')}
          </Text>
          <Pressable
            testID="btn-me-signin"
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent, marginTop: spacing.sm },
            ]}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
              {t('auth.title')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Authenticated Profile Info */}
      {!isGuest && user && (
        <View
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '700' }}>
            {profile?.nickname ?? 'User'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md, marginTop: 2 }}>
            @{profile?.username ?? '—'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 }}>
            {user.email ?? ''}
          </Text>

          {profile && (
            <View style={[styles.detailsSection, { borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Height</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                  {profile.height_cm} cm
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Units</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                  {profile.units}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Discoverable</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                  {profile.discoverable ? 'Everyone' : 'Nobody'}
                </Text>
              </View>
            </View>
          )}

          <Pressable
            testID="btn-me-edit-profile"
            style={[styles.secondaryButton, { borderColor: colors.border, marginTop: spacing.md }]}
            onPress={() => {
              if (!profile) {
                router.push('/auth/profile-setup');
              } else {
                router.push('/profile/edit');
              }
            }}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
              {profile ? t('profileEdit.title') : t('profileSetup.title')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Room Plan & Capacity Card (PRD 6.18 SUB-14, 7.11) */}
      {!isGuest && user && (
        <MeRoomPlanCard
          attachedRoom={rooms[0] ?? null}
          onChangePlan={() => setShowPaywall(true)}
        />
      )}

      {/* Account Actions */}
      {(user || isGuest) && (
        <View style={styles.actionsSection}>
          {user && (
            <Pressable
              testID="btn-me-ai-coach"
              style={[
                styles.actionRow,
                {
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                },
              ]}
              onPress={() => router.push('/coach' as never)}
              accessibilityRole="button"
              accessibilityLabel={t('coach.title')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="sparkles" size={20} color={colors.accent} />
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                  {t('coach.title')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}

          {user && (
            <Pressable
              testID="btn-me-focus-settings"
              style={[
                styles.actionRow,
                {
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                },
              ]}
              onPress={() => setShowFocusSettings(true)}
              accessibilityRole="button"
              accessibilityLabel={t('focus.settings.title')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="timer-outline" size={20} color={colors.accent} />
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                  {t('focus.settings.title')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}

          <Pressable
            testID="btn-me-notification-settings"
            style={[
              styles.actionRow,
              {
                borderColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            ]}
            onPress={() => router.push('/notifications/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.title')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="notifications-outline" size={20} color={colors.accent} />
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
                {t('notifications.title')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            testID="btn-me-signout"
            style={[styles.actionRow, { borderColor: colors.border }]}
            onPress={handleSignOut}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
              {t('auth.signOut')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* If not logged in and not in guest mode */}
      {!isGuest && !user && (
        <Pressable
          testID="btn-me-signin-fallback"
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/auth/sign-in')}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
            {t('auth.title')}
          </Text>
        </Pressable>
      )}

      {/* Focus Settings Modal */}
      {showFocusSettings && user && (
        <FocusSettingsModal
          visible={showFocusSettings}
          userId={user.id}
          onClose={() => setShowFocusSettings(false)}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 56,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  guestCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  detailsSection: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsSection: {
    gap: spacing.sm,
  },
  actionRow: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
