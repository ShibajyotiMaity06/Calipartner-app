import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  gentlerChallengeTargets,
  challengeDuelOutcome,
  challengeLogRoute,
  type ChallengeCatalog,
  type ChallengeSnapshot,
  type ChallengeMutation,
} from '@calipartner/core';
import { ct, challengeText, challengeError, type ChallengeCopy } from '@/i18n/challenges';
import { challengeRequest } from '@/services/challengeService';
import { getSupabase } from '@/lib/supabase';
import { acceptAiProcessingConsent } from '@/services/aiFoodPhotoService';
import { generateClientUuid } from '@/services/foodService';
import { cs, CButton, CInput, CSheet } from './ChallengeUI';
import { ChallengeResultModal } from './ChallengeResultModal';
import { ChallengeShareCard } from './ChallengeShareCard';

export function ChallengeDetailModal({
  snapshot: initial,
  catalog,
  userId,
  isOnline,
  onClose,
  mutate,
  refresh,
  onRematch,
}: {
  snapshot: ChallengeSnapshot;
  catalog: ChallengeCatalog;
  userId: string;
  isOnline: boolean;
  onClose: () => void;
  mutate: (m: ChallengeMutation) => Promise<string>;
  refresh: () => Promise<void>;
  onRematch: () => void;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(initial.self.notify_partner);
  const [recap, setRecap] = useState(false);
  const [recapText, setRecapText] = useState<string>();
  const id = initial.challenge.id;
  const requestRecap = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await challengeRequest<{
        summary: NonNullable<ChallengeSnapshot['participants'][number]['summary']>;
        title: string;
      }>(getSupabase(), userId, { action: 'recap', id });
      const summary = result.summary;
      await acceptAiProcessingConsent({
        rpc: async (name, args) => await getSupabase().rpc(name, args),
      });
      const { data, error } = await getSupabase().functions.invoke('ai-coach', {
        body: {
          context_mode: 'challenge_summary',
          messages: [
            {
              role: 'user',
              content: ct('recapPrompt', {
                title:
                  initial.challenge.custom_title ??
                  challengeText(catalog, initial.challenge.rules_snapshot.title_key),
                passed: summary.passed,
                eligible: summary.eligible,
                percent: summary.percent.toFixed(0),
                streak: summary.longest_streak,
              }),
            },
          ],
        },
      });
      if (error || !data?.message?.content) throw new Error('CHALLENGE_UNAVAILABLE');
      setRecapText(data.message.content);
      setRecap(false);
    } catch {
      setError(ct('error'));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setSnapshot(initial);
  }, [initial]);
  useEffect(() => {
    let live = true;
    if (isOnline)
      void challengeRequest<ChallengeSnapshot>(getSupabase(), userId, { action: 'detail', id })
        .then((data) => {
          if (live) setSnapshot(data);
        })
        .catch((e) => {
          if (live) setError(challengeError(e instanceof Error ? e.message : ''));
        });
    return () => {
      live = false;
    };
  }, [id, userId, isOnline]);
  const act = async (mutation: ChallengeMutation) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const state = await mutate(mutation);
      if (
        (mutation.action === 'social' && ['leave', 'block'].includes(mutation.kind)) ||
        (mutation.action === 'respond' && !mutation.accept)
      ) {
        onClose();
        return;
      }
      setNotice(ct(state === 'pending' ? 'queued' : 'socialDone'));
      if (isOnline) {
        const data = await challengeRequest<ChallengeSnapshot>(getSupabase(), userId, {
          action: 'detail',
          id,
        });
        setSnapshot(data);
      }
      await refresh();
    } catch (e) {
      setError(challengeError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };
  const social = (
    kind: string,
    other?: { target?: string; date?: string; value?: Record<string, unknown> },
  ) => void act({ action: 'social', id, request_id: generateClientUuid(), kind, ...other });
  const rules = snapshot.challenge.rules_snapshot;
  const me = snapshot.participants.find((p) => p.self);
  const peers = snapshot.participants.filter(
    (p) => !p.self && p.id && p.status !== 'left' && p.status !== 'declined',
  );
  const done = ['completed', 'finished'].includes(snapshot.self.status);
  const joined = ['joined', 'completed', 'finished'].includes(snapshot.self.status);
  const title = snapshot.challenge.custom_title ?? challengeText(catalog, rules.title_key);
  const outcome = rules.format === 'duel' ? challengeDuelOutcome(snapshot) : null;
  if (snapshot.details_locked && snapshot.self.status !== 'invited')
    return (
      <CSheet visible title={title} onClose={onClose} testID="challenge-detail-modal">
        <Text style={cs.body}>{ct('upgrade')}</Text>
        <CButton
          brand
          label={ct('plans')}
          onPress={() => {
            onClose();
            router.push('/paywall');
          }}
          testID="challenge-upgrade-details"
        />
      </CSheet>
    );
  return (
    <CSheet visible title={title} onClose={onClose} testID="challenge-detail-modal">
      <Text style={cs.body}>{challengeText(catalog, rules.desc_key)}</Text>
      <Text style={cs.small}>
        {ct('day', { day: snapshot.day, total: snapshot.challenge.duration_days })}
      </Text>
      {snapshot.challenge.status === 'invited' && <Text style={cs.heading}>{ct('waiting')}</Text>}
      {snapshot.self.start_date && (
        <Text style={cs.small}>{ct('starts', { date: snapshot.self.start_date })}</Text>
      )}
      {snapshot.self.status === 'invited' ? (
        <View style={cs.row}>
          <CButton
            brand
            label={ct('accept')}
            disabled={busy}
            onPress={() => void act({ action: 'respond', id, accept: true })}
            testID="challenge-accept"
          />
          <CButton
            label={ct('decline')}
            disabled={busy}
            onPress={() => void act({ action: 'respond', id, accept: false }).then(onClose)}
            testID="challenge-decline"
          />
        </View>
      ) : (
        <>
          {done && <ChallengeResultModal snapshot={snapshot} />}
          {outcome && !['private', 'running'].includes(outcome.kind) && (
            <Text style={cs.heading}>
              {ct(outcome.kind === 'tie' ? 'duelTie' : 'duelAhead', {
                name: outcome.name ?? ct('partner'),
              })}
            </Text>
          )}
          {rules.format === 'coop' && (
            <Text style={cs.heading}>
              {snapshot.team_percent === 'locked'
                ? ct('hidden')
                : ct('team', { percent: snapshot.team_percent.toFixed(0) })}
            </Text>
          )}
          {snapshot.challenge.status === 'cancelled' && (
            <>
              <Text style={cs.body}>{ct('errorExpired')}</Text>
              <CButton label={ct('resend')} onPress={onRematch} testID="challenge-resend" />
            </>
          )}
          <View style={cs.card}>
            {snapshot.participants.map((p, index) => {
              const percent = done ? p.overall_percent : p.percent;
              return (
                <View key={p.id ?? index}>
                  <Text style={cs.heading}>{p.self ? ct('you') : (p.name ?? ct('former'))}</Text>
                  <Text
                    style={cs.number}
                    testID={p.self ? 'challenge-percent-self' : `challenge-percent-${index}`}
                  >
                    {percent === 'locked'
                      ? ct('hidden')
                      : p.self
                        ? ct('progress', { percent: percent.toFixed(0) })
                        : ct('partnerProgress', {
                            name: p.name ?? ct('former'),
                            percent: percent.toFixed(0),
                          })}
                  </Text>
                </View>
              );
            })}
          </View>
          {me?.summary?.today_tasks?.map((task) => (
            <View key={task.metric}>
              <Text style={cs.body}>
                {ct('taskProgress', {
                  metric: ct(task.metric),
                  value: task.value.toFixed(0),
                  target: task.target,
                })}
              </Text>
              {task.source === 'manual' && <Text style={cs.small}>{ct('manualSource')}</Text>}
            </View>
          ))}
          {joined && !done && (
            <CButton
              brand
              label={ct('log')}
              onPress={() => {
                onClose();
                router.push(challengeLogRoute(rules.tasks[0]!) as never);
              }}
              testID="challenge-log"
            />
          )}
          <Text style={cs.heading}>{ct('rules')}</Text>
          <Text style={cs.small}>
            {ct('format', { format: ct(`${rules.format}Format` as ChallengeCopy) })}
          </Text>
          <Text style={cs.body}>{ct('rulesBody')}</Text>
          <Text style={cs.small}>
            {ct(rules.format === 'weekly_rhythm' ? 'weeklyRule' : 'passRule', {
              count: rules.format === 'weekly_rhythm' ? rules.weekly_days : rules.pass_days,
            })}
          </Text>
          <Text style={cs.small}>{ct('finalizeRule', { count: rules.finalize_delay_hours })}</Text>
          <Text style={cs.small}>{ct('safeManual')}</Text>
          <Text style={cs.heading}>{ct('personalTargets')}</Text>
          {rules.tasks.map((metric) => (
            <Text style={cs.body} key={metric}>
              {ct(metric)} · {snapshot.self.targets[metric]}
            </Text>
          ))}
          <Text style={cs.small}>{ct('shields', { count: snapshot.self.shields })}</Text>
          <Text style={cs.small}>
            {ct('pauseBudget', {
              used: snapshot.self.pause_days_used,
              total: snapshot.self.benefits.pause_max,
            })}
          </Text>
          {me?.days?.map((day) => (
            <View key={day.local_date} style={cs.between}>
              <Text style={cs.body}>{day.local_date}</Text>
              <Text style={cs.small}>
                {ct((day.status ?? 'pending') as ChallengeCopy)} · {day.percent?.toFixed(0)}%
              </Text>
            </View>
          ))}
          {joined &&
            peers.map((peer) => (
              <View key={peer.id} style={cs.card}>
                <Text style={cs.heading}>{peer.name}</Text>
                <View style={cs.row}>
                  <CButton
                    label={ct('cheer')}
                    disabled={busy}
                    onPress={() => social('cheer', { target: peer.id! })}
                    testID={`challenge-cheer-${peer.id}`}
                  />
                  <CButton
                    label={ct('nudge')}
                    disabled={busy}
                    onPress={() => social('nudge', { target: peer.id! })}
                    testID={`challenge-nudge-${peer.id}`}
                  />
                </View>
                {!done &&
                  snapshot.self.shields > 0 &&
                  snapshot.self.cover_used < snapshot.self.benefits.cover_max &&
                  peer.days
                    ?.filter((day) => day.status === 'miss')
                    .map((day) => (
                      <CButton
                        key={day.local_date}
                        label={ct('cover', { date: day.local_date! })}
                        disabled={busy}
                        onPress={() => social('cover', { target: peer.id!, date: day.local_date })}
                        testID={`challenge-cover-${peer.id}-${day.local_date}`}
                      />
                    ))}
              </View>
            ))}
          {joined && !done && (
            <View style={cs.row}>
              <CButton
                label={ct('pause')}
                disabled={
                  busy ||
                  snapshot.self.pause_days_used >= snapshot.self.benefits.pause_max ||
                  !me?.days?.some(
                    (day) => day.local_date === snapshot.today_date && day.status !== 'upcoming',
                  )
                }
                onPress={() => social('pause', { date: snapshot.today_date })}
                testID="challenge-pause"
              />
              <CButton
                label={ct('adjust')}
                disabled={busy || snapshot.self.target_adjusted}
                onPress={() =>
                  social('adjust', { value: gentlerChallengeTargets(snapshot.self.targets, rules) })
                }
                testID="challenge-adjust"
              />
            </View>
          )}
          {joined && (
            <>
              <Text style={cs.small}>{ct('privacy')}</Text>
              <View style={cs.row}>
                <CButton
                  label={ct(snapshot.self.comparison_opt_out ? 'showComparison' : 'comparison')}
                  disabled={busy}
                  onPress={() =>
                    social('comparison', { value: { enabled: !snapshot.self.comparison_opt_out } })
                  }
                  testID="challenge-comparison"
                />
                <CButton
                  label={ct(snapshot.self.muted ? 'unmute' : 'mute')}
                  disabled={busy}
                  onPress={() => social('mute', { value: { enabled: !snapshot.self.muted } })}
                  testID="challenge-mute"
                />
                <CButton
                  label={ct(notify ? 'notifyOff' : 'notifyOn')}
                  disabled={busy}
                  onPress={() => {
                    setNotify(!notify);
                    void act({ action: 'notify', id, enabled: !notify });
                  }}
                  testID="challenge-notify"
                />
                {rules.season_id && (
                  <CButton
                    label={ct(snapshot.self.board_opt_in ? 'boardOff' : 'boardOn')}
                    disabled={busy}
                    onPress={() =>
                      social('board', { value: { enabled: !snapshot.self.board_opt_in } })
                    }
                    testID="challenge-board-optin"
                  />
                )}
              </View>
            </>
          )}
          {me?.summary?.chapters?.length ? (
            <>
              <Text style={cs.heading}>{ct('chapters')}</Text>
              {me.summary.chapters.map((key) => (
                <Text key={key} style={cs.body}>
                  {challengeText(catalog, key)}
                </Text>
              ))}
            </>
          ) : null}
          {snapshot.occasion && (
            <>
              <Text style={cs.heading}>{ct('timeline')}</Text>
              {snapshot.occasion.milestones.map((m) => (
                <View key={m.week} style={cs.card}>
                  <Text style={cs.body}>{ct('milestone', { week: m.week, date: m.date })}</Text>
                  {m.weight !== null && (
                    <Text style={cs.small}>
                      {ct('privateWeight', { weight: m.weight.toFixed(1) })}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}
          {snapshot.forfeit_key && (
            <Text style={cs.body}>{challengeText(catalog, snapshot.forfeit_key)}</Text>
          )}
          {snapshot.events.length > 0 && (
            <>
              <Text style={cs.heading}>{ct('activity')}</Text>
              {snapshot.events.map((event) => (
                <View key={event.id} style={cs.card}>
                  <Text style={cs.body}>
                    {event.actor ?? ct('former')} ·{' '}
                    {ct(
                      ([
                        'created',
                        'pass',
                        'shield',
                        'covered',
                        'paused',
                        'completed',
                        'finished',
                        'invited',
                      ].includes(event.type)
                        ? event.type
                        : event.type === 'day_passed'
                          ? 'pass'
                          : event.type === 'cover'
                            ? 'covered'
                            : event.type === 'pause'
                              ? 'paused'
                              : 'socialDone') as ChallengeCopy,
                    )}
                  </Text>
                  <Text style={cs.small}>{event.at}</Text>
                </View>
              ))}
            </>
          )}
          {done && (
            <>
              <CButton label={ct('rematch')} onPress={onRematch} testID="challenge-rematch" />
              {catalog.plan === 'pro' && (
                <>
                  <CButton
                    label={ct('recap')}
                    onPress={() => setRecap(true)}
                    testID="challenge-recap"
                  />
                  {recap && (
                    <>
                      <Text style={cs.small}>{ct('recapConsent')}</Text>
                      <CButton
                        label={ct('continue')}
                        disabled={busy || !isOnline}
                        onPress={() => void requestRecap()}
                        testID="challenge-recap-consent"
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
          {recapText && <Text style={cs.body}>{recapText}</Text>}
          {joined && (
            <ChallengeShareCard
              snapshot={snapshot}
              catalog={catalog}
              onShared={() => social('share')}
            />
          )}
          {peers.length > 0 && (
            <>
              <CButton
                label={ct('report')}
                onPress={() => setReport(!report)}
                testID="challenge-report"
              />
              {report && (
                <>
                  <CInput
                    label={ct('report')}
                    value={reason}
                    onChangeText={setReason}
                    testID="challenge-report-reason"
                  />
                  <CButton
                    label={ct('report')}
                    disabled={!reason.trim() || busy}
                    onPress={() => social('report', { target: peers[0]!.id!, value: { reason } })}
                    testID="challenge-report-submit"
                  />
                  <CButton
                    label={ct('block')}
                    disabled={busy}
                    onPress={() => social('block', { target: peers[0]!.id! })}
                    testID="challenge-block"
                  />
                </>
              )}
            </>
          )}
          {joined && (
            <>
              <CButton
                label={ct('leave')}
                onPress={() => setConfirm(true)}
                testID="challenge-leave"
              />
              {confirm && (
                <>
                  <Text style={cs.body}>{ct('leaveConfirm')}</Text>
                  <CButton
                    label={ct('leave')}
                    disabled={busy}
                    onPress={() => social('leave')}
                    testID="challenge-leave-confirm"
                  />
                  <CButton
                    label={ct('cancel')}
                    onPress={() => setConfirm(false)}
                    testID="challenge-leave-cancel"
                  />
                </>
              )}
            </>
          )}
        </>
      )}
      {notice && (
        <Text accessibilityLiveRegion="polite" style={cs.body}>
          {notice}
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={cs.error}>
          {error}
        </Text>
      )}
    </CSheet>
  );
}
