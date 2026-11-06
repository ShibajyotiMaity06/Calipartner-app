import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, dark, homeLayout, radius, space } from '@calipartner/ui';
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
  const [showScoreHint, setShowScoreHint] = useState(false);
  useEffect(() => setShowScoreHint(false), [roomId, visible]);
  useEffect(() => {
    if (!showScoreHint || Platform.OS !== 'web') return;
    type KeyHandler = (event: { key: string }) => void;
    const browser = globalThis as unknown as {
      addEventListener: (type: 'keydown', handler: KeyHandler) => void;
      removeEventListener: (type: 'keydown', handler: KeyHandler) => void;
    };
    const dismiss: KeyHandler = (event) => {
      if (event.key === 'Escape') setShowScoreHint(false);
    };
    browser.addEventListener('keydown', dismiss);
    return () => browser.removeEventListener('keydown', dismiss);
  }, [showScoreHint]);
  return (
    <View style={styles.stack}>
      <SquadMentions roomId={roomId} visible={visible} />
      <View style={localStyles.header}>
        <Text variant="label" style={localStyles.heading}>
          {t('squadDesign.leaders')}
        </Text>
        <Pressable
          style={localStyles.hintAction}
          accessibilityRole="button"
          accessibilityLabel={t('squadDesign.dailyTargetPercent')}
          accessibilityState={{ expanded: showScoreHint }}
          aria-expanded={showScoreHint}
          onPress={() => setShowScoreHint((value) => !value)}
          onBlur={() => setShowScoreHint(false)}
          onAccessibilityEscape={() => setShowScoreHint(false)}
          testID={`home-squad-score-help-${roomId}`}
        >
          <Text variant="micro" color={dark.textMid} style={localStyles.label}>
            {t('squadDesign.dailyTargetPercent')}
          </Text>
        </Pressable>
        {showScoreHint && (
          <View style={localStyles.hint} testID={`home-squad-score-hint-${roomId}`}>
            <Text variant="micro" color={dark.textMid} accessibilityLiveRegion="polite">
              {t('squadDesign.scoreRule')}
            </Text>
          </View>
        )}
      </View>
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
          showSteps
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

const localStyles = StyleSheet.create({
  header: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[2],
  },
  heading: { flexShrink: 1 },
  hintAction: {
    minHeight: homeLayout.touchSize,
    minWidth: homeLayout.touchSize,
    maxWidth: '100%',
    marginLeft: 'auto',
    justifyContent: 'center',
  },
  label: { textAlign: 'right' },
  hint: {
    position: 'absolute',
    top: '100%',
    left: space[0],
    right: space[0],
    padding: space[2],
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairlineLit,
    backgroundColor: dark.s2,
  },
});
