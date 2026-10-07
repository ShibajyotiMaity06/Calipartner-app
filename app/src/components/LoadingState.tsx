import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { spacing, fontSize } from '@/theme/tokens';

export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  const text = label ?? t('common.loading');
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      testID="loading-state"
    >
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.text, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  text: { fontSize: fontSize.md },
});
