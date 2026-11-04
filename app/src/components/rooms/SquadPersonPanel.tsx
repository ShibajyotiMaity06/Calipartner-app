import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, dark, homeLayout, Text } from '@calipartner/ui';
import type { RankedSquadMember } from '@calipartner/core';
import { useSquadDetails } from '@/hooks/useSquad';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';
import {
  goalName,
  memberName,
  MemberDetailsContent,
  MemberMetrics,
  numberText,
  PlusDetailsCard,
  squadStyles as styles,
} from './SquadViews';
export function SquadPersonPanel({
  roomId,
  person,
  members,
  visible,
}: {
  roomId: string;
  person: RankedSquadMember;
  members: RankedSquadMember[];
  visible: boolean;
}) {
  const router = useRouter();
  const { hasActiveAccess, loading: checkingPlan } = useSubscription();
  const details = useSquadDetails(roomId, person.user_id, visible && hasActiveAccess);
  const own = members.find((member) => member.is_self);
  const other = person.is_self ? members.find((member) => !member.is_self) : own;
  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <Avatar
            name={memberName(person)}
            uri={person.avatar_url ?? undefined}
            size="lg"
            identityHue={person.is_self ? 'iris' : 'teal'}
          />
          <View style={styles.flex}>
            <Text variant="title1">{memberName(person)}</Text>
            <Text>{goalName(person)}</Text>
            <Text variant="bodyS">{person.local_date}</Text>
          </View>
        </View>
        {other && (
          <Button
            variant={hasActiveAccess ? 'primary' : 'secondary'}
            label={t(person.is_self ? 'squadDesign.compare' : 'squadDesign.compareYou')}
            onPress={() =>
              router.push(
                ('/squad/compare?room=' +
                  encodeURIComponent(roomId) +
                  '&left=' +
                  encodeURIComponent(own?.user_id ?? other.user_id) +
                  '&right=' +
                  encodeURIComponent(person.is_self ? other.user_id : person.user_id)) as Href,
              )
            }
            testID="person-compare"
          />
        )}
      </View>
      <MemberMetrics member={person} />
      {checkingPlan ? (
        <Text>{t('common.loading')}</Text>
      ) : !hasActiveAccess ? (
        <PlusDetailsCard onUpgrade={() => router.push('/paywall')} />
      ) : details.error ? (
        <View style={styles.card}>
          <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void details.refresh()}
            testID="person-details-retry"
          />
        </View>
      ) : details.loading && !details.data ? (
        <Text>{t('common.loading')}</Text>
      ) : details.data ? (
        <MemberDetailsContent
          details={details.data}
          roomId={roomId}
          memberId={person.is_self ? undefined : person.user_id}
        />
      ) : null}
      <View style={styles.card}>
        <View style={styles.row}>
          {person.height_cm == null && (
            <Ionicons name="lock-closed-outline" size={homeLayout.iconSize} color={dark.textMid} />
          )}
          <Text>
            {person.height_cm == null
              ? t('squadDesign.hiddenHeight')
              : t('squadDesign.height', { value: numberText(person.height_cm) })}
          </Text>
        </View>
        <View style={styles.row}>
          {person.weight_kg == null && (
            <Ionicons name="lock-closed-outline" size={homeLayout.iconSize} color={dark.textMid} />
          )}
          <Text>
            {person.weight_kg == null
              ? t('squadDesign.hiddenWeight')
              : t('squadDesign.weight', { value: numberText(person.weight_kg) })}
          </Text>
        </View>
      </View>
    </>
  );
}
