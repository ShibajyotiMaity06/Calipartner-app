import { Text, View } from 'react-native';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { useHealth } from '@/hooks/useHealth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function TodayScreen() {
  const { colors } = useTheme();
  const { state, retry } = useHealth();
  const { isOnline } = useNetworkStatus();

  return (
    <PlaceholderScreen
      title={t('tabs.today')}
      subtitle={t('placeholder.today')}
      testID="screen-today"
    >
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
