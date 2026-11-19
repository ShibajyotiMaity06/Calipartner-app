import React from 'react';
import { View } from 'react-native';
import { Button, NavigationIcon, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';

export function ModalNavigation({
  onBack,
  onClose,
  title,
  disabled,
  closeTestID = 'modal-close',
  backTestID = 'modal-back',
}: {
  onBack?: () => void;
  onClose?: () => void;
  title?: string;
  disabled?: boolean;
  closeTestID?: string;
  backTestID?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: space[2],
      }}
    >
      {onBack ? (
        <Button
          variant="tertiary"
          label={t('common.back')}
          fullWidth={false}
          iconOnly
          icon={<NavigationIcon action="back" />}
          disabled={disabled}
          onPress={onBack}
          testID={backTestID}
        />
      ) : title ? null : (
        <View />
      )}
      {title && (
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
      )}
      {!!onClose && (
        <Button
          variant="tertiary"
          label={t('squadDesign.close')}
          fullWidth={false}
          iconOnly
          icon={<NavigationIcon action="close" />}
          disabled={disabled}
          onPress={onClose}
          testID={closeTestID}
        />
      )}
    </View>
  );
}
