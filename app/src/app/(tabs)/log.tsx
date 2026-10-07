import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { t } from '@/i18n';

export default function LogScreen() {
  return (
    <PlaceholderScreen title={t('tabs.log')} subtitle={t('placeholder.log')} testID="screen-log" />
  );
}
