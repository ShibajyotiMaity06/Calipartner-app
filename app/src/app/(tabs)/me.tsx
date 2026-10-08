import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function MeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, profile, isGuest, signOut, deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    Alert.alert(t('auth.signOut'), t('auth.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/sign-in');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('accountDeletion.confirmTitle'),
      `${t('accountDeletion.confirmBody')}\n\n${t('accountDeletion.storeSubscriptionNote')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const { error } = await deleteAccount();
            setIsDeleting(false);
            if (error) {
              Alert.alert(t('common.errorTitle'), error.message);
            } else {
              Alert.alert(t('accountDeletion.title'), t('accountDeletion.success'));
              router.replace('/auth/sign-in');
            }
          },
        },
      ],
    );
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

      {/* Account Actions */}
      {!isGuest && user && (
        <View style={styles.actionsSection}>
          <Pressable
            testID="btn-me-signout"
            style={[styles.actionRow, { borderColor: colors.border }]}
            onPress={handleSignOut}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
              {t('auth.signOut')}
            </Text>
          </Pressable>

          <Pressable
            testID="btn-me-delete-account"
            style={[styles.actionRow, { borderColor: colors.border }]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={{ color: colors.danger, fontSize: fontSize.md, fontWeight: '500' }}>
                {t('accountDeletion.title')}
              </Text>
            )}
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
