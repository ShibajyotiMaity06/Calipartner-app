import { StyleSheet, View } from 'react-native';
import { EmptyState, dark, space } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: Props) {
  return (
    <View style={styles.container} accessible accessibilityRole="alert" testID="error-state">
      <EmptyState
        icon={<Ionicons name="alert-circle-outline" size={40} color={dark.danger} />}
        title={title ?? t('common.errorTitle')}
        description={message ?? t('common.errorBody')}
        actionLabel={onRetry ? t('common.retry') : undefined}
        onAction={onRetry}
        testID="error-retry"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
    width: '100%',
  },
});
