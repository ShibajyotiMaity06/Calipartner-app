import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { RankedSquadMember } from '@calipartner/core';
import { colors, radius } from '@calipartner/ui/v1';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';

export function squadMemberName(member: Pick<RankedSquadMember, 'nickname' | 'username'>): string {
  return member.nickname || member.username;
}

export function formatActivityAgo(isoString: string): string {
  const diffMs = Date.now() - Date.parse(isoString);
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d`;
}

export function sponsorLabelForRoom(
  room: RoomSummary | null,
  currentUserId?: string | null,
): string {
  if (!room) return '';
  if (room.plan_holder_id && currentUserId && room.plan_holder_id === currentUserId) {
    return t('squadV1.sponsoredByYou');
  }
  if (room.plan_holder_name) {
    return t('squadV1.sponsoredByName', { name: room.plan_holder_name });
  }
  if ((room.member_cap ?? 2) <= 2 && !room.plan_holder_id) {
    return t('squadV1.freePair');
  }
  return t('squadV1.membersCount', { count: room.member_count });
}

export function AvatarCluster({ size = 26 }: { size?: number }): React.JSX.Element {
  const overlap = -Math.round(size * 0.34);
  const tones = [colors.s3, colors.apricotPressed, colors.apricot];
  return (
    <View style={styles.clusterWrap}>
      {tones.map((bg, index) => (
        <View
          key={index}
          style={[
            styles.clusterDot,
            {
              width: size,
              height: size,
              borderRadius: radius.full,
              backgroundColor: bg,
              marginLeft: index === 0 ? 0 : overlap,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clusterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clusterDot: {
    borderWidth: 2,
    borderColor: colors.bg0,
  },
});
