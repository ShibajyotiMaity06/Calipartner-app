import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

export function RoomAccessNotice({
  message,
  onUpgrade,
}: {
  message: string;
  onUpgrade?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} testID="room-access-notice">
      <Text fontSet="onboarding" color={colors.textHi}>
        {message}
      </Text>
      {onUpgrade ? (
        <Button label={t('rooms.access.upgrade')} onPress={onUpgrade} testID="upgrade-room-chat" />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ container: { padding: space[5], gap: space[4] } });
