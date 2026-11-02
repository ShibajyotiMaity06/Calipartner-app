import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getLocalDateString } from '@calipartner/core';
import { Button, dark, homeLayout, radius, space, Text, type as typography } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useSquadDay } from '@/hooks/useSquadDay';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useSubscription } from '@/hooks/useSubscription';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { saveCheckIn, type CheckInActivity, type SquadDayMember } from '@/services/checkInService';

export function CheckInRing({ count, total }: { count: number; total: number }) {
  const size = homeLayout.ringSize,
    stroke = homeLayout.ringStroke,
    r = (size - stroke) / 2,
    circumference = 2 * Math.PI * r;
  return (
    <View
      style={styles.ring}
      accessible
      accessibilityLabel={
        t('homeRefresh.checked', { count, total }) + ' ' + t('homeRefresh.checkedLabel')
      }
    >
      <Svg width={size} height={size} accessible={false}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={dark.s3}
          strokeWidth={stroke}
          fill="none"
        />
        {total > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={dark.apricot}
            strokeWidth={stroke}
            strokeDasharray={`${circumference * Math.min(count / total, 1)} ${circumference}`}
            rotation={-90}
            origin={`${size / 2},${size / 2}`}
            fill="none"
          />
        )}
      </Svg>
      <View style={styles.ringText}>
        <Text variant="numeralM" tabular>
          {t('homeRefresh.checked', { count, total })}
        </Text>
        <Text variant="micro" color={dark.textMid}>
          {t('homeRefresh.checkedLabel')}
        </Text>
      </View>
    </View>
  );
}

export function SquadDayPanel({
  roomId,
  name,
  memberCount,
  visible = true,
  onOpen,
  onNudge,
  showFeed = true,
  embedded = false,
}: {
  roomId: string;
  name: string;
  memberCount: number;
  visible?: boolean;
  onOpen?: () => void;
  onNudge?: () => void;
  showFeed?: boolean;
  embedded?: boolean;
}) {
  const { members, loading, error, refresh } = useSquadDay(roomId, visible);
  const { hasActiveAccess } = useSubscription();
  const [checkIn, setCheckIn] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const checked = members.filter((member) => member.checked_in === true).length;
  const waiting = members.filter((member) => member.checked_in === false);
  const own = members.find((member) => member.is_self);
  const privateCount = members.filter((member) => member.checked_in === null).length;
  return (
    <View style={styles.stack} testID={`squad-day-${roomId}`}>
      <View style={[styles.card, embedded && styles.embedded]}>
        <View style={styles.summary}>
          {!error && members.length > 0 ? (
            <CheckInRing count={checked} total={memberCount} />
          ) : (
            <Text color={dark.textMid}>
              {loading ? t('common.loading') : t('common.unavailable')}
            </Text>
          )}
          <View style={styles.details}>
            <Text variant="heading">
              {!error && members.length > 0
                ? waiting.length
                  ? t('homeRefresh.waiting', { count: waiting.length })
                  : members.some((m) => m.checked_in === null) || members.length < memberCount
                    ? t('homeRefresh.private')
                    : t('homeRefresh.allIn')
                : name}
            </Text>
            {memberCount <= 3 &&
              members.map((member) => (
                <View key={member.user_id} style={styles.memberLine}>
                  <View
                    style={[styles.avatar, { borderColor: member.is_self ? dark.iris : dark.teal }]}
                  >
                    <Text variant="micro">{member.nickname.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.details}>
                    <Text variant="bodyS">{member.nickname}</Text>
                    <Text variant="micro" color={dark.textMid}>
                      {member.checked_in === null
                        ? t('homeRefresh.private')
                        : member.checked_in
                          ? t('homeRefresh.checkedLabel')
                          : t('homeRefresh.pending')}
                    </Text>
                  </View>
                </View>
              ))}
            {memberCount > 3 && (
              <Text variant="bodyS" color={dark.textMid}>
                {t('homeRefresh.checkedTodaySummary', { count: checked })}
              </Text>
            )}
            {privateCount > 0 && (
              <Text variant="micro" color={dark.textMid}>
                {t('homeRefresh.privateMembers', { count: privateCount })}
              </Text>
            )}
          </View>
        </View>
        {memberCount > 3 && (
          <View style={styles.avatarRow}>
            {waiting.slice(0, 5).map((member) => (
              <View
                key={member.user_id}
                style={[styles.avatar, { borderColor: member.is_self ? dark.iris : dark.teal }]}
                accessible
                accessibilityLabel={member.nickname}
              >
                <Text variant="micro">{member.nickname.slice(0, 2).toUpperCase()}</Text>
              </View>
            ))}
            {waiting.length > 5 && (
              <Text variant="bodyS" tabular>
                +{waiting.length - 5}
              </Text>
            )}
          </View>
        )}
        {error && (
          <Button
            variant="tertiary"
            label={t('common.retry')}
            onPress={() => void refresh()}
            testID={`retry-squad-${roomId}`}
          />
        )}
        {!own?.checked_in && (
          <Button
            variant="primary"
            label={own?.checked_in ? t('homeRefresh.checkedToday') : t('homeRefresh.checkIn')}
            disabled={own?.checked_in === true}
            onPress={() => setCheckIn(true)}
            testID={`check-in-${roomId}`}
          />
        )}
        {own?.checked_in && (
          <Text variant="bodyS" color={dark.textMid}>
            {t('homeRefresh.checkedToday')}
          </Text>
        )}
        {onNudge && hasActiveAccess && waiting.some((m) => !m.is_self) && (
          <Button
            variant={own?.checked_in ? 'primary' : 'tertiary'}
            label={t('homeRefresh.nudge')}
            onPress={onNudge}
            testID={`nudge-squad-${roomId}`}
          />
        )}
        {memberCount > 3 && (
          <Button
            variant="tertiary"
            label={t('homeRefresh.seeAll', { count: memberCount })}
            onPress={() => (onOpen ? onOpen() : setShowAll((value) => !value))}
            testID={`all-squad-${roomId}`}
          />
        )}
        {showAll &&
          members.map((member) => (
            <Text key={member.user_id} variant="bodyS">
              {member.nickname} ·{' '}
              {member.checked_in === null
                ? t('homeRefresh.private')
                : member.checked_in
                  ? t('homeRefresh.checkedLabel')
                  : t('homeRefresh.pending')}
            </Text>
          ))}
      </View>
      {showFeed && (
        <SquadFeedContent members={members} name={name} hasActiveAccess={hasActiveAccess} />
      )}
      {checkIn && (
        <CheckInModal
          roomId={roomId}
          name={name}
          count={error ? undefined : checked}
          total={memberCount}
          onClose={() => setCheckIn(false)}
          onSaved={() => {
            setCheckIn(false);
            void refresh();
          }}
        />
      )}
    </View>
  );
}

function SquadFeedContent({
  members,
  name,
  hasActiveAccess,
  limit,
  onOpen,
}: {
  members: SquadDayMember[];
  name: string;
  hasActiveAccess: boolean;
  limit?: number;
  onOpen?: () => void;
}) {
  const checked = members
    .filter((member) => member.checked_in && (hasActiveAccess || member.is_self))
    .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
  return (
    <View style={styles.stack}>
      <Text variant="heading">{t('homeRefresh.todayWith', { name })}</Text>
      {checked.length === 0 ? (
        <Text variant="bodyS" color={dark.textMid}>
          {t('homeRefresh.emptyFeed')}
        </Text>
      ) : (
        checked.slice(0, limit).map((member) => (
          <View style={styles.feedRow} key={member.user_id}>
            <View style={[styles.avatar, { borderColor: member.is_self ? dark.iris : dark.teal }]}>
              <Text variant="micro">{member.nickname.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.details}>
              <Text variant="bodyS">
                {member.nickname} · {t('homeRefresh.checkedLabel')}
              </Text>
              {member.activities?.length > 0 && (
                <Text variant="micro" color={dark.textMid}>
                  {member.activities.map((activity) => t(`homeRefresh.${activity}`)).join(' · ')}
                </Text>
              )}
              {member.note ? (
                <Text variant="bodyS" color={dark.textMid}>
                  {member.note}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
      {limit && checked.length > limit && onOpen && (
        <Button
          variant="tertiary"
          label={t('homeRefresh.moreCheckIns', { count: checked.length - limit })}
          onPress={onOpen}
          testID="home-open-all-check-ins"
        />
      )}
    </View>
  );
}

export function SquadCheckInFeed({
  roomId,
  name,
  visible,
  onOpen,
}: {
  roomId: string;
  name: string;
  visible: boolean;
  onOpen: () => void;
}) {
  const { members, loading, error, refresh } = useSquadDay(roomId, visible);
  const { hasActiveAccess } = useSubscription();
  return loading && !members.length ? (
    <Text>{t('common.loading')}</Text>
  ) : error ? (
    <Button variant="tertiary" label={t('common.retry')} onPress={() => void refresh()} />
  ) : (
    <SquadFeedContent
      members={members}
      name={name}
      hasActiveAccess={hasActiveAccess}
      limit={2}
      onOpen={onOpen}
    />
  );
}

export function CheckInModal({
  roomId,
  name,
  count,
  total,
  onClose,
  onSaved,
}: {
  roomId: string;
  name: string;
  count: number | undefined;
  total: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  useBrowserModalBack(true, onClose);
  const { user } = useAuth();
  const { timeZone } = useCurrentLocalDate();
  const [activities, setActivities] = useState<CheckInActivity[]>([]);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const save = async () => {
    if (!user?.id || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      const occurred = new Date();
      await saveCheckIn(await getDb(), {
        userId: user.id,
        roomId,
        localDate: getLocalDateString(occurred, timeZone),
        activities,
        note,
        share,
        occurredAt: occurred.toISOString(),
      });
      onSaved();
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal} testID="check-in-modal">
        <Button
          variant="tertiary"
          label={t('homeRefresh.close')}
          onPress={onClose}
          testID="close-check-in"
        />
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text variant="title1">{t('homeRefresh.checkIn')}</Text>
          {count === undefined ? (
            <Text>{t('common.unavailable')}</Text>
          ) : (
            <CheckInRing count={count} total={total} />
          )}
          <Text variant="title2">{t('homeRefresh.checkInFor', { name })}</Text>
          <Text variant="bodyS" color={dark.textMid}>
            {t('homeRefresh.whatDid')}
          </Text>
          <View style={styles.chips}>
            {(['ate', 'trained', 'walked', 'rest'] as const).map((activity) => (
              <Pressable
                key={activity}
                onPress={() =>
                  setActivities((current) =>
                    current.includes(activity)
                      ? current.filter((v) => v !== activity)
                      : [...current, activity],
                  )
                }
                style={[styles.chip, activities.includes(activity) && styles.selected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: activities.includes(activity) }}
                accessibilityLabel={t(`homeRefresh.${activity}`)}
                testID={`check-in-${activity}`}
              >
                <Text color={dark.textHi}>{t(`homeRefresh.${activity}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Text variant="bodyS" color={dark.textMid}>
            {t('homeRefresh.checkInHint')}
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            placeholder={t('homeRefresh.note')}
            placeholderTextColor={dark.textLo}
            accessibilityLabel={t('homeRefresh.note')}
            style={styles.input}
            testID="check-in-note"
          />
          <View style={styles.summary}>
            <View style={styles.details}>
              <Text>{t('homeRefresh.share', { name })}</Text>
              <Text variant="micro" color={dark.textMid}>
                {t('homeRefresh.shareHint')}
              </Text>
            </View>
            <Switch
              value={share}
              onValueChange={setShare}
              accessibilityLabel={t('homeRefresh.share', { name })}
              testID="check-in-share"
            />
          </View>
          {error && (
            <Text color={dark.danger} accessibilityRole="alert">
              {t('common.errorBody')}
            </Text>
          )}
        </ScrollView>
        <Button
          variant="primary"
          label={busy ? t('common.saving') : t('homeRefresh.checkIn')}
          onPress={() => void save()}
          disabled={busy || !user?.id}
          testID="save-check-in"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  stack: { gap: space[3] },
  embedded: { padding: 0, borderWidth: 0, flex: 1 },
  card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[3] },
  details: { flex: 1, minWidth: space[9] },
  ring: {
    width: homeLayout.ringSize,
    height: homeLayout.ringSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { position: 'absolute', alignItems: 'center' },
  memberLine: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    paddingVertical: space[1],
  },
  avatar: {
    width: homeLayout.avatarSize,
    height: homeLayout.avatarSize,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.s2,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    paddingVertical: space[3],
  },
  modal: { flex: 1, padding: space[4], backgroundColor: dark.bg0 },
  modalContent: { gap: space[5], paddingBottom: space[7] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: homeLayout.touchSize,
    padding: space[3],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    justifyContent: 'center',
  },
  selected: { backgroundColor: dark.s3, borderWidth: 1, borderColor: dark.hairlineLit },
  input: {
    ...typography.body,
    color: dark.textHi,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    padding: space[3],
    minHeight: homeLayout.touchSize,
  },
});
