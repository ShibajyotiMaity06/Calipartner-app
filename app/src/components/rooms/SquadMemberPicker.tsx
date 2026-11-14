import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Sheet, Text } from '@calipartner/ui';
import type { RankedSquadMember } from '@calipartner/core';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { memberName, useSquadStyles } from './SquadViews';

export function SquadMemberPicker({
  visible,
  members,
  excludedId,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  members: RankedSquadMember[];
  excludedId: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const styles = useSquadStyles();

  useBrowserModalBack(visible, onClose);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      accessibilityLabel={t('squadDesign.choose')}
      testID="squad-member-picker"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.spread}>
          <Text variant="title2">{t('squadDesign.choose')}</Text>
          <Button
            variant="tertiary"
            label={t('squadDesign.close')}
            onPress={onClose}
            testID="close-member-picker"
          />
        </View>
        <Text>{t('squadDesign.chooseHint')}</Text>
        {members
          .filter((member) => member.user_id !== excludedId)
          .map((member) => (
            <Pressable
              key={member.user_id}
              style={styles.leader}
              onPress={() => {
                onSelect(member.user_id);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: member.user_id === selectedId }}
              aria-checked={member.user_id === selectedId}
              accessibilityLabel={memberName(member)}
              testID={`choose-member-${member.user_id}`}
            >
              <View style={styles.flex}>
                <Text variant="bodyS">{memberName(member)}</Text>
                <Text variant="bodyS" tabular>
                  {member.score == null
                    ? t('squadDesign.noGoals')
                    : t('squadDesign.percent', { value: member.score })}
                </Text>
              </View>
              {member.user_id === selectedId && <Text>✓</Text>}
            </Pressable>
          ))}
      </ScrollView>
    </Sheet>
  );
}
