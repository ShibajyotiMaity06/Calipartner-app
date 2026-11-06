import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text } from '@calipartner/ui';
import { useChallenges } from '@/hooks/useChallenges';
import { challengeText } from '@/i18n/challenges';
import { t } from '@/i18n';
import { squadStyles } from '@/components/rooms/SquadViews';

export function TodayChallengeCard() {
  const { home, loading, error, refresh, userId } = useChallenges();
  const router = useRouter();
  if (!userId) return null;
  if (loading && !home) return <Text>{t('common.loading')}</Text>;
  if (error)
    return (
      <View style={squadStyles.card}>
        <Text variant="heading">{t('homeRefresh.activeChallenge')}</Text>
        <Text accessibilityRole="alert">{t('homeRefresh.challengesLoadError')}</Text>
        <Button
          variant="secondary"
          label={t('common.retry')}
          onPress={() => void refresh()}
          testID="home-challenge-retry"
        />
      </View>
    );
  const active =
    home?.items.filter(
      (item) => item.self.status === 'joined' && item.challenge.status === 'active',
    ) ?? [];
  if (!active.length || !home) return null;
  return (
    <View style={squadStyles.stack}>
      {active.map((item) => (
        <View
          key={item.challenge.id}
          style={squadStyles.card}
          testID={`home-challenge-${item.challenge.id}`}
        >
          <Text variant="heading">{t('homeRefresh.activeChallenge')}</Text>
          <Text>
            {item.challenge.custom_title ??
              challengeText(home.catalog, item.challenge.rules_snapshot.title_key)}
          </Text>
          <Text tabular>
            {t('homeRefresh.challengeDay', { day: item.day, total: item.challenge.duration_days })}
          </Text>
          {typeof item.team_percent === 'number' && (
            <Text tabular>{t('homeRefresh.challengeTeam', { percent: item.team_percent })}</Text>
          )}
          <Button
            variant="secondary"
            label={t('homeRefresh.viewChallenge')}
            testID={`home-view-challenge-${item.challenge.id}`}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/progress',
                params: { tab: 'challenges', challenge: item.challenge.id },
              })
            }
          />
        </View>
      ))}
    </View>
  );
}
