import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { fontSize, radius, spacing } from '@/theme/tokens';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessible accessibilityRole="alert" testID="error-state">
      <Text style={[styles.title, { color: colors.text }]}>{title ?? t('common.errorTitle')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {message ?? t('common.errorBody')}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          testID="error-retry"
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.buttonText, { color: colors.onAccent }]}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  title: { fontSize: fontSize.lg, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: fontSize.md, textAlign: 'center' },
  button: {
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  buttonText: { fontSize: fontSize.md, fontWeight: '600' },
});
