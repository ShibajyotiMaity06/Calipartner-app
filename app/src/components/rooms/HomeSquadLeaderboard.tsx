import React, { useEffect, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, dark, homeLayout, radius, space, squadIndicators } from '@calipartner/ui';
import { useRouter, type Href } from 'expo-router';
import { useSquadToday, useSquadUnread } from '@/hooks/useSquad';
import { t } from '@/i18n';
import { SquadLeaderboard } from './SquadViews';
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
  const unread = useSquadUnread(roomId, visible);
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
    <View style={localStyles.content}>
      <View style={localStyles.notifications}>
        <SquadMentions roomId={roomId} visible={visible} />
        {(unread.error || (unread.data ?? 0) > 0) && (
          <Pressable
            style={localStyles.chatAction}
            accessibilityRole="button"
            accessibilityLabel={
              unread.error
                ? t('common.errorBody') + ' ' + t('common.retry')
                : t('squadDesign.unreadMessages', { count: unread.data ?? 0 })
            }
            onPress={() =>
              unread.error
                ? void unread.refresh()
                : router.push({ pathname: '/(tabs)/room', params: { room: roomId, tab: 'chat' } })
            }
            testID={`home-squad-chat-${roomId}`}
          >
            <Ionicons
              name={unread.error ? 'refresh-outline' : 'chatbubble-outline'}
              size={homeLayout.iconSize}
              color={dark.textHi}
              accessible={false}
            />
            {!unread.error && unread.data != null && unread.data > 0 && (
              <Text
                variant="micro"
                color={squadIndicators.unread}
                tabular
                accessibilityLiveRegion="polite"
                testID={`home-squad-unread-${roomId}`}
              >
                {unread.data > 99 ? '99+' : unread.data}
              </Text>
            )}
          </Pressable>
        )}
      </View>
      <View style={localStyles.header}>
        <Text variant="label" style={localStyles.heading}>
          <Ionicons
            name="trophy-outline"
            size={homeLayout.editIconSize}
            color={dark.textHi}
            accessible={false}
          />{' '}
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
            <MaterialCommunityIcons
              name="bullseye-arrow"
              size={homeLayout.editIconSize}
              color={dark.textMid}
              accessible={false}
            />{' '}
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
          compact
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
  content: { gap: space[0] },
  notifications: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatAction: {
    minWidth: homeLayout.compactTouchSize,
    minHeight: homeLayout.compactTouchSize,
    flexDirection: 'row',
    gap: space[1],
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    minHeight: homeLayout.compactTouchSize,
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
