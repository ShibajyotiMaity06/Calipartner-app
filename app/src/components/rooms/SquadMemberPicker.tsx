import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Text, dark, radius, space } from '@calipartner/ui';
import type { RankedSquadMember } from '@calipartner/core';
import { Ionicons } from '@expo/vector-icons';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { memberName } from './SquadViews';

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
  useBrowserModalBack(visible, onClose);
  if (!visible) return null;

  const selectable = members.filter((member) => member.user_id !== excludedId);

  return (
    <View
      style={{
        backgroundColor: dark.s1,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: dark.hairlineLit,
        overflow: 'hidden',
        marginTop: space[1],
        marginBottom: space[2],
      }}
      testID="squad-member-picker"
    >
      {selectable.map((member) => {
        const isSelected = member.user_id === selectedId;
        return (
          <Pressable
            key={member.user_id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: space[3],
              paddingHorizontal: space[3],
              backgroundColor: isSelected ? dark.s2 : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: dark.hairline,
            }}
            onPress={() => {
              onSelect(member.user_id);
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            aria-checked={isSelected}
            accessibilityLabel={memberName(member)}
            testID={`choose-member-${member.user_id}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flex: 1 }}>
              <Avatar
                name={memberName(member)}
                uri={member.avatar_url ?? undefined}
                size="sm"
                identityHue={member.is_self ? 'iris' : 'teal'}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyS" color={dark.textHi}>
                  {memberName(member)}
                </Text>
                <Text variant="micro" color={dark.textMid} tabular>
                  {member.score == null
                    ? t('squadDesign.noGoals')
                    : t('squadDesign.percent', { value: member.score })}
                </Text>
              </View>
            </View>
            {isSelected && <Ionicons name="checkmark" size={18} color={dark.apricot} />}
          </Pressable>
        );
      })}
    </View>
  );
}
