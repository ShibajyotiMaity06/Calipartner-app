import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { t } from '@/i18n';

export default function ProgressScreen() {
  return (
    <PlaceholderScreen
      title={t('tabs.progress')}
      subtitle={t('placeholder.progress')}
      testID="screen-progress"
    />
  );
}
