import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

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
      <ActivityIndicator size="large" color={colors.apricot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
    width: '100%',
  },
});
