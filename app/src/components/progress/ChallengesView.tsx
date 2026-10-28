import React, { useEffect, useRef, useState } from 'react';
import { Avatar, PairRing, challengeLayout, dark } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  challengeLogRoute,
  type ChallengeTemplate,
  type ChallengeSnapshot,
} from '@calipartner/core';
import { useChallenges } from '@/hooks/useChallenges';
import { ct, challengeError, challengeText, type ChallengeCopy } from '@/i18n/challenges';
import { challengeRequest } from '@/services/challengeService';
import { getSupabase } from '@/lib/supabase';
import { cs, CButton, CSheet } from './ChallengeUI';
import { CreateChallengeModal } from './CreateChallengeModal';
import { ChallengeDetailModal } from './ChallengeDetailModal';
import { OccasionPlanModal } from './OccasionPlanModal';

export function ChallengesView({ testID = 'challenges-view' }: { testID?: string }) {
  const state = useChallenges();
  const { home, userId, track } = state;
  const router = useRouter();
  const params = useLocalSearchParams<{ challenge?: string; trophies?: string }>();
  const [filter, setFilter] = useState<ChallengeCopy>('all');
  const [create, setCreate] = useState(false);
  const [template, setTemplate] = useState<ChallengeTemplate | null>(null);
  const [selected, setSelected] = useState<ChallengeSnapshot | null>(null);
  const [occasion, setOccasion] = useState(false);
  const [trophies, setTrophies] = useState(params.trophies === '1');
  const [board, setBoard] = useState<Array<{ name: string; percent: number; band: number }> | null>(
    null,
  );
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState(false);
  useEffect(() => {
    if (userId) track('challenge_viewed');
  }, [userId, track]);
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (params.challenge && home && opened.current !== params.challenge) {
      const item = home.items.find((i) => i.challenge.id === params.challenge);
      if (item) {
        opened.current = params.challenge;
        setSelected(item);
      }
    }
  }, [params.challenge, home]);
  if (!home)
    return (
      <View style={cs.home} testID={testID}>
        <Text style={cs.title}>{ct('title')}</Text>
        <Text style={cs.body}>
          {ct(state.loading ? 'loading' : !state.isOnline ? 'offlineEmpty' : 'error')}
        </Text>
        {!state.loading && (
          <CButton
            label={ct('retry')}
            onPress={() => void state.refresh()}
            testID="challenges-retry"
          />
        )}
      </View>
    );
  const catalog = home.catalog;
  const isFinished = (item: ChallengeSnapshot) =>
    ['completed', 'finished'].includes(item.self.status) || item.challenge.status === 'cancelled';
  const current = home.items.filter((i) => !isFinished(i));
  const finished = home.items.filter(isFinished);
  const byFilter = (i: ChallengeSnapshot) =>
    filter === 'all' ||
    (filter === 'active' && !isFinished(i)) ||
    (filter === 'completed' && isFinished(i)) ||
    (filter === 'occasion' && i.challenge.scope === 'occasion') ||
    (filter === 'seasonal' && i.challenge.scope === 'season');
  const loadBoard = async (season: string) => {
    setBoard([]);
    setBoardLoading(true);
    setBoardError(false);
    try {
      setBoard(
        await challengeRequest(getSupabase(), userId!, { action: 'board', season_id: season }),
      );
    } catch {
      setBoardError(true);
    } finally {
      setBoardLoading(false);
    }
  };
  return (
    <View style={cs.home} testID={testID}>
      <View style={cs.between}>
        <View>
          <Text accessibilityRole="header" style={cs.title}>
            {ct('title')}
          </Text>
          <Text style={cs.small}>{ct('subtitle')}</Text>
        </View>
        <CButton
          brand
          label={ct('create')}
          onPress={() => {
            state.track('create_started');
            setCreate(true);
          }}
          testID={`${testID}-create-btn`}
        />
      </View>
      <View style={cs.row}>
        {(['all', 'active', 'seasonal', 'occasion', 'completed'] as ChallengeCopy[]).map((f) => (
          <CButton
            key={f}
            label={ct(f)}
            selected={filter === f}
            onPress={() => setFilter(f)}
            testID={`${testID}-tab-${f}`}
          />
        ))}
      </View>
      {(state.cached || !state.isOnline) && (
        <Text style={cs.small} accessibilityLiveRegion="polite">
          {ct('offline')}
        </Text>
      )}
      {state.error && (
        <>
          <Text accessibilityRole="alert" style={cs.error}>
            {challengeError(state.error)}
          </Text>
          <CButton
            label={ct('retry')}
            onPress={() => void state.refresh()}
            testID="challenges-retry"
          />
        </>
      )}
      {state.pending.map((item) => (
        <View key={item.id} style={cs.card}>
          <Text style={cs.body}>
            {item.status === 'failed' ? challengeError(item.last_error ?? '') : ct('queued')}
          </Text>
          {item.status === 'failed' && (
            <CButton
              label={ct('dismiss')}
              onPress={() => void state.dismiss(item.id)}
              testID={`challenge-dismiss-${item.id}`}
            />
          )}
        </View>
      ))}
      {(filter === 'all' || filter === 'active') && home.due?.length ? (
        <View style={cs.card}>
          <Text style={cs.heading}>{ct('today')}</Text>
          {home.due.map((task) => (
            <View key={`${task.id}:${task.metric}`} style={cs.between}>
              <Text style={cs.body}>
                {ct('taskProgress', {
                  metric: ct(task.metric),
                  value: task.value.toFixed(0),
                  target: task.target,
                })}
              </Text>
              <CButton
                label={ct('log')}
                onPress={() => router.push(challengeLogRoute(task.metric) as never)}
                testID={`challenge-today-${task.id}-${task.metric}`}
              />
            </View>
          ))}
        </View>
      ) : null}
      {!home.items.filter(byFilter).length && <Text style={cs.body}>{ct('empty')}</Text>}
      {[...current, ...finished].filter(byFilter).map((item) => {
        const me = item.participants.find((p) => p.self);
        const peer = item.participants.find((p) => !p.self && p.id);
        const ownPercent = isFinished(item) ? me?.overall_percent : me?.percent;
        const peerPercent = isFinished(item) ? peer?.overall_percent : peer?.percent;
        const icon = item.challenge.rules_snapshot.icon_key as keyof typeof Ionicons.glyphMap;
        return (
          <View
            key={item.challenge.id}
            style={cs.card}
            testID={`challenge-card-${item.challenge.id}`}
          >
            <Ionicons
              name={Object.hasOwn(Ionicons.glyphMap, icon) ? icon : 'ribbon-outline'}
              size={challengeLayout.icon}
              color={dark.iris}
            />
            {typeof ownPercent === 'number' && typeof peerPercent === 'number' && (
              <PairRing
                userPercent={ownPercent}
                partnerPercent={peerPercent}
                partnerName={peer?.name ?? ct('partner')}
                centerLabel={ct('ofGoal')}
                fontSet="onboarding"
                userHue="iris"
                partnerHue="teal"
                accessibilityLabel={`${ct('progress', { percent: ownPercent.toFixed(0) })}. ${ct('partnerProgress', { name: peer?.name ?? ct('partner'), percent: peerPercent.toFixed(0) })}`}
              />
            )}
            <Text style={cs.heading}>
              {item.challenge.custom_title ??
                challengeText(catalog, item.challenge.rules_snapshot.title_key)}
            </Text>
            <View style={cs.row}>
              {item.participants
                .filter((p) => p.id)
                .map((p) => (
                  <View key={p.id} style={cs.row}>
                    <Avatar size="sm" uri={p.avatar_url} name={p.name ?? undefined} />
                    <Text style={cs.small}>{p.self ? ct('you') : p.name}</Text>
                  </View>
                ))}
            </View>
            {item.day > 0 ? (
              <Text style={cs.small}>
                {ct('day', { day: item.day, total: item.challenge.duration_days })}
              </Text>
            ) : item.self.start_date ? (
              <Text style={cs.small}>{ct('starts', { date: item.self.start_date })}</Text>
            ) : null}
            <Text style={cs.body}>
              {item.self.status === 'invited'
                ? ct('invitedBy', { name: peer?.name ?? ct('partner') })
                : item.challenge.status === 'invited'
                  ? ct('waiting')
                  : ct('progress', {
                      percent:
                        me?.overall_percent === 'locked'
                          ? ct('hidden')
                          : typeof me?.overall_percent === 'number'
                            ? me.overall_percent.toFixed(0)
                            : 0,
                    })}
            </Text>
            {me?.summary?.today_tasks?.map((task) => (
              <Text style={cs.small} key={task.metric}>
                {ct('taskProgress', {
                  metric: ct(task.metric),
                  value: task.value.toFixed(0),
                  target: task.target,
                })}
              </Text>
            ))}
            <CButton
              label={ct(item.self.status === 'invited' ? 'accept' : 'view')}
              onPress={() => setSelected(item)}
              testID={`challenge-open-${item.challenge.id}`}
            />
          </View>
        );
      })}
      {(filter === 'all' || filter === 'active' || filter === 'seasonal') && (
        <>
          <Text style={cs.heading}>{ct('discover')}</Text>
          {catalog.templates
            .filter((t) => filter !== 'seasonal' || !!t.season_id)
            .filter((t) => !t.season_id || catalog.seasons.some((s) => s.id === t.season_id))
            .map((t) => {
              const season = catalog.seasons.find((s) => s.id === t.season_id);
              const upcoming = !!season && season.starts_at > catalog.now;
              const ended = !!season && season.ends_at <= catalog.now;
              const hasCount = t.joined_count >= catalog.config.min_public_count;
              const joinedSeason = t.season_id
                ? home.items.find(
                    (item) =>
                      item.challenge.template_id === t.id && item.challenge.status !== 'cancelled',
                  )
                : null;
              return (
                <View style={cs.card} key={t.id} testID={`challenge-template-${t.slug}`}>
                  <Text style={cs.heading}>{challengeText(catalog, t.title_key)}</Text>
                  <Text style={cs.body}>{challengeText(catalog, t.desc_key)}</Text>
                  <Text style={cs.small}>
                    {ct(
                      hasCount ? 'joined' : 'first',
                      hasCount ? { count: t.joined_count } : undefined,
                    )}
                  </Text>
                  {joinedSeason ? (
                    <CButton
                      label={ct('view')}
                      onPress={() => setSelected(joinedSeason)}
                      testID={`challenge-season-joined-${t.slug}`}
                    />
                  ) : upcoming ? (
                    <>
                      <Text style={cs.small}>
                        {ct('upcoming', { date: season!.starts_at.slice(0, 10) })}
                      </Text>
                      <CButton
                        label={ct(home.reminders.includes(t.id) ? 'reminderSet' : 'reminder')}
                        selected={home.reminders.includes(t.id)}
                        disabled={state.busy}
                        onPress={() =>
                          void state
                            .mutate({
                              action: 'remind',
                              template_id: t.id,
                              enabled: !home.reminders.includes(t.id),
                            })
                            .catch(() => {})
                        }
                        testID={`challenge-remind-${t.slug}`}
                      />
                    </>
                  ) : ended ? (
                    <Text style={cs.small}>{ct('ended')}</Text>
                  ) : (
                    <CButton
                      label={ct('create')}
                      onPress={() => {
                        state.track('join_tapped');
                        setTemplate(t);
                      }}
                      testID={`challenge-choose-${t.slug}`}
                    />
                  )}
                  {season && (
                    <CButton
                      label={ct('board')}
                      onPress={() => void loadBoard(season.id)}
                      testID={`challenge-board-${t.slug}`}
                    />
                  )}
                </View>
              );
            })}
        </>
      )}
      {(filter === 'all' || filter === 'occasion') && !catalog.screened && (
        <View style={cs.card}>
          <Text style={cs.heading}>{ct('occasionTitle')}</Text>
          <Text style={cs.body}>{ct('recovery')}</Text>
          <CButton
            label={ct(catalog.limits.custom ? 'planOccasion' : 'plans')}
            onPress={() =>
              catalog.limits.custom
                ? setOccasion(true)
                : (state.track('lock_tapped'), router.push('/paywall' as never))
            }
            testID="challenge-occasion"
          />
        </View>
      )}
      <CButton
        label={ct('trophies')}
        onPress={() => setTrophies(true)}
        testID="challenge-trophies"
      />
      {create && (
        <CSheet
          visible
          title={ct('chooseTemplate')}
          onClose={() => setCreate(false)}
          testID="choose-challenge-template"
        >
          {catalog.templates
            .filter(
              (t) =>
                !t.season_id ||
                catalog.seasons.some(
                  (s) =>
                    s.id === t.season_id && s.starts_at <= catalog.now && s.ends_at > catalog.now,
                ),
            )
            .map((t) => (
              <CButton
                key={t.id}
                label={challengeText(catalog, t.title_key)}
                onPress={() => {
                  setCreate(false);
                  setTemplate(t);
                }}
                testID={`create-template-${t.slug}`}
              />
            ))}
        </CSheet>
      )}
      {template && userId && (
        <CreateChallengeModal
          key={template.id}
          catalog={catalog}
          template={template}
          userId={userId}
          isOnline={state.isOnline}
          mutate={state.mutate}
          onClose={() => setTemplate(null)}
        />
      )}
      {selected && userId && (
        <ChallengeDetailModal
          snapshot={home.items.find((i) => i.challenge.id === selected.challenge.id) ?? selected}
          catalog={catalog}
          userId={userId}
          isOnline={state.isOnline}
          mutate={state.mutate}
          refresh={state.refresh}
          onClose={() => setSelected(null)}
          onRematch={() => {
            state.track('rematch_tapped', selected.challenge.id);
            const t = catalog.templates.find((t) => t.id === selected.challenge.template_id);
            setSelected(null);
            if (t) setTemplate(t);
          }}
        />
      )}
      {occasion && (
        <OccasionPlanModal
          catalog={catalog}
          onClose={() => setOccasion(false)}
          mutate={state.mutate}
        />
      )}
      {trophies && (
        <CSheet
          visible
          title={ct('trophies')}
          onClose={() => setTrophies(false)}
          testID="challenge-trophy-shelf"
        >
          {!catalog.badges.some((b) => b.earned > 0) && (
            <Text style={cs.body}>{ct('noBadges')}</Text>
          )}
          {catalog.badges
            .filter((b) => b.earned > 0)
            .map((b) => (
              <View key={b.id} style={cs.card}>
                <Text style={cs.heading}>{challengeText(catalog, b.text_key)}</Text>
                <Text style={cs.small}>{ct('earned', { count: b.earned })}</Text>
              </View>
            ))}
        </CSheet>
      )}
      {board !== null && (
        <CSheet
          visible
          title={ct('board')}
          onClose={() => setBoard(null)}
          testID="challenge-board-modal"
        >
          <Text style={cs.small}>{ct('publicBoard')}</Text>
          {boardLoading ? (
            <Text style={cs.body}>{ct('loading')}</Text>
          ) : boardError ? (
            <Text accessibilityRole="alert" style={cs.error}>
              {ct('error')}
            </Text>
          ) : !board.length ? (
            <Text style={cs.body}>{ct('boardEmpty')}</Text>
          ) : (
            board.map((row, index) => (
              <View key={index} style={cs.card}>
                <Text style={cs.heading}>{row.name}</Text>
                <Text style={cs.small}>
                  {ct('band', { band: row.band })} · {row.percent.toFixed(0)}%
                </Text>
              </View>
            ))
          )}
        </CSheet>
      )}
    </View>
  );
}
