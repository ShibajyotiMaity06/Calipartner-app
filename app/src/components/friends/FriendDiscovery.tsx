import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Text,
  onboardingLayout,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import type { SocialProfile } from '@calipartner/core';
import { useFriendDiscovery, type FriendGoal } from '@/hooks/useFriendDiscovery';
import { PlanTextField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export function FriendDiscovery({
  random = false,
  onOpen,
  onSend,
  busy,
  queuedIds = [],
  remaining,
}: {
  random?: boolean;
  onOpen: (person: SocialProfile) => void;
  onSend: (id: string) => Promise<unknown>;
  busy: boolean;
  queuedIds?: string[];
  remaining?: number | null;
}) {
  const [goal, setGoal] = useState<FriendGoal>(null);
  const [query, setQuery] = useState('');
  const { colors } = useTheme();
  const discovery = useFriendDiscovery(goal, query, random);
  return (
    <View style={planStyles.section} testID="friend-discovery">
      {!random ? (
        <>
          <PlanTextField
            label={t('friends.searchLabel')}
            placeholder={t('friends.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={21}
            testID="friend-username-search"
          />
          <Text variant="bodyS">{t('socialUpdate.universalSearch')}</Text>
          <View style={styles.filters} accessibilityRole="radiogroup">
            {([null, 'bulk', 'cut', 'maintain'] as const).map((value) => (
              <Pressable
                key={value ?? 'all'}
                style={[
                  styles.filter,
                  {
                    backgroundColor: goal === value ? colors.s2 : colors.s1,
                    borderColor: goal === value ? colors.textMid : colors.hairline,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: goal === value }}
                onPress={() => setGoal(value)}
                testID={`friend-filter-${value ?? 'all'}`}
              >
                <Text>
                  {t(
                    value === 'bulk'
                      ? 'socialUpdate.bulk'
                      : value === 'cut'
                        ? 'socialUpdate.cut'
                        : value === 'maintain'
                          ? 'socialUpdate.maintain'
                          : 'socialUpdate.all',
                  )}
                  {goal === value ? ' \u2713' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {discovery.loading ? (
        <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
      ) : null}
      {discovery.cached ? <Text>{t('friends.cached')}</Text> : null}
      {discovery.error ? <Text accessibilityRole="alert">{t('friends.genericError')}</Text> : null}
      {!discovery.loading && !discovery.error && !discovery.people.length ? (
        <Text>{t('friends.searchEmpty')}</Text>
      ) : null}
      {discovery.people.map((person) => (
        <Card key={person.id}>
          <View style={planStyles.gap}>
            <View style={planStyles.row}>
              <Avatar name={person.nickname} uri={person.avatar_url} />
              <View style={planStyles.flex}>
                <Text variant="heading">{person.nickname}</Text>
                <Text>@{person.username}</Text>
              </View>
            </View>
            <Button
              variant="tertiary"
              label={t('friends.viewProfile')}
              onPress={() => onOpen(person)}
              testID={`view-profile-${person.id}`}
            />
            {person.relationship === 'none' ? (
              <Button
                variant="secondary"
                label={t(queuedIds.includes(person.id) ? 'friends.queued' : 'friends.send')}
                disabled={busy || queuedIds.includes(person.id) || remaining === 0}
                onPress={() => void onSend(person.id).then(() => discovery.load())}
                testID={`send-friend-${person.id}`}
              />
            ) : (
              <Text>
                {t(person.relationship === 'friends' ? 'friends.connected' : 'friends.pending')}
              </Text>
            )}
          </View>
        </Card>
      ))}
      {remaining === 0 ? <Text>{t('friends.weeklyLimit')}</Text> : null}
      {discovery.error || discovery.hasMore ? (
        <Button
          variant="tertiary"
          label={t(discovery.error ? 'friends.retry' : 'socialUpdate.more')}
          disabled={discovery.loading}
          onPress={() => void discovery.load(!discovery.error)}
          testID="load-more-friends"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  filter: {
    minHeight: onboardingLayout.touch,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: onboardingLayout.border,
  },
});
