import { StyleSheet, View } from 'react-native';
import { Skeleton, Text, space, dark } from '@calipartner/ui';
import { t } from '@/i18n';

export function LoadingState({ label }: { label?: string }) {
  const text = label ?? t('common.loading');
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      testID="loading-state"
    >
      <Skeleton.Card style={styles.card} />
      <Skeleton.ListRow style={styles.row} />
      <Skeleton.ListRow style={styles.row} />
      <Text variant="bodyS" color={dark.textLo} style={styles.label}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    width: '100%',
  },
  card: {
    width: '100%',
  },
  row: {
    width: '100%',
  },
  label: {
    marginTop: space[2],
  },
});
