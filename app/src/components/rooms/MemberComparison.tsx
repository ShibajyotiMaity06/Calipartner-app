import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Button, Card, dark, HiddenMetric, space, Text } from '@calipartner/ui';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { t } from '@/i18n';

export function MemberComparison({
  members,
  callerId,
  onNudge,
}: {
  members: RoomMemberSnapshot[];
  callerId: string;
  onNudge: (member: RoomMemberSnapshot) => void;
}) {
  return (
    <View style={styles.grid} testID="multi-member-comparison">
      {members.map((member) => {
        const pct = member.metrics.goal_completion;
        const started =
          (typeof pct === 'number' && pct > 0) ||
          (typeof member.metrics.meal_checklist === 'object' &&
            Object.values(member.metrics.meal_checklist).some(Boolean));
        return (
          <Card key={member.user_id} style={styles.member} testID={`comparison-${member.user_id}`}>
            <View style={styles.list}>
              <View style={styles.heading}>
                <Avatar name={member.nickname} uri={member.avatar_url ?? undefined} size="sm" />
                <Text variant="heading" style={styles.name}>
                  {member.user_id === callerId ? t('repairs.you') : member.nickname}
                </Text>
              </View>
              {typeof pct === 'number' ? (
                <Text tabular variant="numeralM">
                  {t(pct > 100 ? 'repairs.over' : 'repairs.goal', { percent: pct })}
                </Text>
              ) : (
                <HiddenMetric label={t('repairs.private')} />
              )}
              {typeof member.metrics.steps === 'number' ? (
                <Text tabular>
                  {t('roomAudit.steps')}: {member.metrics.steps}
                </Text>
              ) : (
                <HiddenMetric label={t('roomAudit.steps')} />
              )}
              {member.metrics.logged_today === 'locked' ? (
                <HiddenMetric label={t('roomAudit.logging')} />
              ) : (
                <Text variant="bodyS">
                  {t(
                    started
                      ? 'repairs.logged'
                      : member.metrics.logged_today
                        ? 'setup.loggedToday'
                        : 'repairs.loggingIncomplete',
                  )}
                </Text>
              )}
              {member.user_id !== callerId && member.status === 'active' ? (
                <Button
                  size="md"
                  variant="secondary"
                  label={t('repairs.nudge')}
                  onPress={() => onNudge(member)}
                  testID={`nudge-member-${member.user_id}`}
                />
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], padding: space[2] },
  member: { flexGrow: 1, flexBasis: '45%', minWidth: space[8] * 3 },
  list: { gap: space[3], padding: space[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  name: { flex: 1, color: dark.textHi },
});
