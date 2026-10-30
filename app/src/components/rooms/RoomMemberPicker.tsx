import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, space, Text } from '@calipartner/ui';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { t } from '@/i18n';

export function RoomMemberPicker({
  members,
  selectedId,
  onSelect,
  disabled = false,
}: {
  members: RoomMemberSnapshot[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = members.find((member) => member.user_id === selectedId);
  return (
    <View style={styles.list}>
      <Text variant="label">{t('repairs.recipient')}</Text>
      <Button
        variant="secondary"
        label={selected?.nickname ?? t('repairs.recipient')}
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
        testID="choose-room-member"
      />
      {expanded
        ? members.map((member) => (
            <Button
              key={member.user_id}
              variant="tertiary"
              label={`${member.nickname} (@${member.username})`}
              disabled={disabled}
              onPress={() => {
                onSelect(member.user_id);
                setExpanded(false);
              }}
              testID={`choose-member-${member.user_id}`}
            />
          ))
        : null}
    </View>
  );
}
const styles = StyleSheet.create({ list: { gap: space[2] } });
