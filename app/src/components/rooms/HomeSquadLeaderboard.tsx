import React from 'react';
import { View } from 'react-native';
import { Button, Text, dark } from '@calipartner/ui';
import { useRouter, type Href } from 'expo-router';
import { useSquadToday } from '@/hooks/useSquad';
import { t } from '@/i18n';
import { SquadLeaderboard, squadStyles as styles } from './SquadViews';
import { SquadMentions } from './SquadMentions';

export function HomeSquadLeaderboard({
  roomId,
  memberCount,
  visible,
}: {
  roomId: string;
  memberCount: number;
  visible: boolean;
}) {
  const { data, loading, error, refresh } = useSquadToday(roomId, visible);
  const router = useRouter();
  return (
    <View style={styles.stack}>
      <SquadMentions roomId={roomId} visible={visible} />
      <Text variant="label">{t('squadDesign.leaders')}</Text>
      {loading && !data ? (
        <Text>{t('common.loading')}</Text>
      ) : error ? (
        <Button
          variant="tertiary"
          label={t('common.retry')}
          onPress={() => void refresh()}
          testID={`retry-squad-${roomId}`}
        />
      ) : (
        <SquadLeaderboard
          members={data?.members ?? []}
          limit={memberCount === 2 ? 2 : 3}
          onMember={(member) =>
            router.push(
              ('/squad/person?room=' +
                encodeURIComponent(roomId) +
                '&member=' +
                encodeURIComponent(member.user_id)) as Href,
            )
          }
        />
      )}
      <Button
        variant="secondary"
        labelColor={dark.selection}
        label={t(memberCount === 2 ? 'squadDesign.open' : 'squadDesign.seeAll', {
          count: memberCount,
        })}
        onPress={() =>
          router.push({
            pathname: '/(tabs)/room',
            params: { room: roomId, tab: memberCount === 2 ? 'today' : 'progress' },
          })
        }
        testID={`home-leaderboard-${roomId}`}
      />
    </View>
  );
}
