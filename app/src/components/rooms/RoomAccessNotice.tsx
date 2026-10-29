import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

export function RoomAccessNotice({
  message,
  onUpgrade,
  actionTestID = 'upgrade-room-chat',
}: {
  message: string;
  onUpgrade?: () => void;
  actionTestID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} testID="room-access-notice">
      <Text fontSet="onboarding" color={colors.textHi}>
        {message}
      </Text>
      {onUpgrade ? (
        <Button label={t('rooms.access.upgrade')} onPress={onUpgrade} testID={actionTestID} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ container: { padding: space[5], gap: space[4] } });
