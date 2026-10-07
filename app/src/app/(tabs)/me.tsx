import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { t } from '@/i18n';

export default function MeScreen() {
  return (
    <PlaceholderScreen title={t('tabs.me')} subtitle={t('placeholder.me')} testID="screen-me" />
  );
}
