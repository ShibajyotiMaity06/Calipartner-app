import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { t } from '@/i18n';

export default function RoomScreen() {
  return (
    <PlaceholderScreen
      title={t('tabs.room')}
      subtitle={t('placeholder.room')}
      testID="screen-room"
    />
  );
}
