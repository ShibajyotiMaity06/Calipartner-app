import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Sheet, space } from '@calipartner/ui';
import { SquadConnectFlow, type SquadConnectFlowProps } from './SquadConnectFlow';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export function SquadConnectModal({
  visible,
  onClose,
  ...flow
}: SquadConnectFlowProps & { visible: boolean; onClose: () => void }) {
  useBrowserModalBack(visible, onClose);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      accessibilityLabel={t('socialUpdate.connect')}
      testID="squad-connect-modal"
    >
      <View style={styles.close}>
        <Button
          variant="secondary"
          size="sm"
          fullWidth={false}
          label={t('squadDesign.close')}
          onPress={onClose}
          testID="close-create-squad"
        />
      </View>
      <SquadConnectFlow {...flow} />
    </Sheet>
  );
}
const styles = StyleSheet.create({
  close: { alignItems: 'flex-end', paddingHorizontal: space[4] },
});
