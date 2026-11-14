import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { StyleSheet, View } from 'react-native';
import { Skeleton, space } from '@calipartner/ui';
import { t } from '@/i18n';

export function LoadingState({ label }: { label?: string }) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const text = label ?? t('common.loading');
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityState={{ busy: true }}
      testID="loading-state"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.content}
      >
        <Skeleton.Card />
        <Skeleton.ListRow />
        <Skeleton.ListRow />
      </View>
    </View>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: dark.bg0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space[4],
      width: '100%',
    },
    content: { width: '100%', gap: space[4] },
  });
