import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useHealth } from '@/hooks/useHealth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { state, retry } = useHealth();
  const { isOnline } = useNetworkStatus();
  const { user, profile, isGuest, needsProfileSetup } = useAuth();

  return (
    <PlaceholderScreen
      title={t('tabs.today')}
      subtitle={t('placeholder.today')}
      testID="screen-today"
    >
      {/* Profile setup prompt if signed in without a profile */}
      {needsProfileSetup && (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.md,
            gap: spacing.xs,
          }}
          testID="banner-needs-profile"
        >
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
            {t('profileSetup.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('profileSetup.subtitle')}
          </Text>
          <Pressable
            testID="btn-prompt-setup-profile"
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.sm,
              paddingVertical: 10,
              alignItems: 'center',
              marginTop: spacing.xs,
            }}
            onPress={() => router.push('/auth/profile-setup')}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.sm }}>
              {t('profileSetup.createProfileButton')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Guest Mode Indicator */}
      {isGuest && (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.md,
            gap: spacing.xs,
          }}
          testID="banner-guest-today"
        >
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>
            Guest Mode
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('auth.guestNotice')}
          </Text>
          <Pressable
            testID="btn-guest-prompt-signin"
            style={{
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingVertical: 8,
              alignItems: 'center',
              marginTop: spacing.xs,
            }}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{t('auth.title')}</Text>
          </Pressable>
        </View>
      )}

      {/* User greeting if profile exists */}
      {user && profile && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.md,
          }}
          testID="banner-welcome-user"
        >
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
            Welcome, {profile.nickname}!
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            @{profile.username}
          </Text>
        </View>
      )}

      {/* Connection & Network Card */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {t('connection.label')}
        </Text>
        {state === 'checking' ? <LoadingState label={t('connection.checking')} /> : null}
        {state === 'connected' ? (
          <Text
            testID="health-status"
            accessibilityLiveRegion="polite"
            style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '600' }}
          >
            {t('connection.connected')}
          </Text>
        ) : null}
        {state === 'failed' ? <ErrorState title={t('connection.failed')} onRetry={retry} /> : null}
        {state === 'notConfigured' ? (
          <Text testID="health-status" style={{ color: colors.text, fontSize: fontSize.md }}>
            {t('connection.notConfigured')}
          </Text>
        ) : null}
        <Text testID="network-status" style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {isOnline === false ? t('connection.offline') : t('connection.online')}
        </Text>
      </View>
    </PlaceholderScreen>
  );
}
