import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, homeLayout, space, Text } from '@calipartner/ui';
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
  useSquadStyles,
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
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const router = useRouter();
  const { hasActiveAccess, loading: checkingPlan } = useSubscription();
  const isOwn = Boolean(person.is_self);
  const canViewDetails = hasActiveAccess || isOwn;
  const details = useSquadDetails(roomId, person.user_id, visible && canViewDetails);
  const own = members.find((member) => member.is_self);
  const other = person.is_self ? members.find((member) => !member.is_self) : own;
  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <Avatar
            name={memberName(person)}
            uri={person.avatar_url ?? undefined}
            size="md"
            identityHue={person.is_self ? 'iris' : 'teal'}
          />
          <View style={styles.flex}>
            <View style={styles.spread}>
              <Text variant="heading">{memberName(person)}</Text>
              <Text variant="micro" color={dark.textMid}>
                {person.local_date}
              </Text>
            </View>
            <Text variant="bodyS" color={dark.textMid}>
              {goalName(person)}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: 2 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {person.height_cm == null && (
                  <Ionicons name="lock-closed-outline" size={12} color={dark.textMid} />
                )}
                <Text variant="micro" color={dark.textMid}>
                  {person.height_cm == null
                    ? t('squadDesign.hiddenHeight')
                    : t('squadDesign.height', { value: numberText(person.height_cm) })}
                </Text>
              </View>
              <Text variant="micro" color={dark.textMid}>
                ·
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {person.weight_kg == null && (
                  <Ionicons name="lock-closed-outline" size={12} color={dark.textMid} />
                )}
                <Text variant="micro" color={dark.textMid}>
                  {person.weight_kg == null
                    ? t('squadDesign.hiddenWeight')
                    : t('squadDesign.weight', { value: numberText(person.weight_kg) })}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {other && (
          <Button
            variant={hasActiveAccess ? 'primary' : 'secondary'}
            size="sm"
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
      {checkingPlan && !isOwn ? (
        <Text>{t('common.loading')}</Text>
      ) : !canViewDetails ? (
        <PlusDetailsCard onUpgrade={() => router.push('/paywall')} />
      ) : details.error ? (
        <View style={styles.card}>
          <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
          <Button
            variant="secondary"
            size="sm"
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
    </>
  );
}
