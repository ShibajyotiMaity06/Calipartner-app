import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  ChallengeCatalog,
  ChallengeTemplate,
  ChallengeCreateRequest,
  ChallengeMetric,
  ChallengeMutation,
} from '@calipartner/core';
import { CHALLENGE_METRICS } from '@calipartner/core';
import { ct, challengeError, challengeText } from '@/i18n/challenges';
import { challengeRequest } from '@/services/challengeService';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { createLogger } from '@/lib/logger';
import { cs, CButton, CInput, CSheet } from './ChallengeUI';

export function CreateChallengeModal({
  catalog,
  template,
  onClose,
  mutate,
  userId,
  isOnline,
}: {
  catalog: ChallengeCatalog;
  template: ChallengeTemplate;
  onClose: () => void;
  mutate: (m: ChallengeMutation) => Promise<string>;
  userId: string;
  isOnline: boolean;
}) {
  const router = useRouter();
  const [scope, setScope] = useState(
    template.season_id ? 'season' : (template.scope_options[0] ?? 'solo'),
  );
  const [duration, setDuration] = useState(template.duration_options[0]!);
  const [partners, setPartners] = useState<string[]>([]);
  const [room, setRoom] = useState<string>();
  const [tasks, setTasks] = useState<ChallengeMetric[]>(template.tasks);
  const [targets, setTargets] = useState<Partial<Record<ChallengeMetric, number>>>({});
  const [recommended, setRecommended] = useState(false);
  const [title, setTitle] = useState('');
  const [forfeit, setForfeit] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<ChallengeCreateRequest | null>(null);
  const [saved, setSaved] = useState<string>();
  const [sameTarget, setSameTarget] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [rest, setRest] = useState<number[] | undefined>();
  const [manual, setManual] = useState<boolean | undefined>();
  useEffect(() => {
    let live = true;
    setRecommended(false);
    if (isOnline)
      void challengeRequest<{ targets: Partial<Record<ChallengeMetric, number>> }>(
        getSupabase(),
        userId,
        { action: 'recommend', template_id: template.id, tasks },
      )
        .then((data) => {
          if (live) {
            setTargets(data.targets);
            setRecommended(true);
          }
        })
        .catch(() => {
          if (live) setError(ct('error'));
        });
    return () => {
      live = false;
    };
  }, [template.id, tasks, userId, isOnline]);
  const paid = catalog.limits.custom;
  const max = catalog.limits.duration_max;
  const send = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const next: ChallengeCreateRequest = request ?? {
        action: 'create',
        id: generateClientUuid(),
        template_id: template.id,
        scope,
        duration,
        partners: scope === 'pair' || scope === 'room' ? partners : [],
        room_id: scope === 'room' ? room : undefined,
        title: title.trim() || undefined,
        forfeit_id: forfeit,
        tasks,
        same_target: sameTarget,
        start_date: startDate || undefined,
        rest_weekdays: rest,
        allow_manual: manual,
        ...(recommended ? { targets } : {}),
      };
      setRequest(next);
      const state = await mutate(next);
      setSaved(ct(state === 'pending' ? 'queuedCreate' : 'created'));
    } catch (e) {
      createLogger('challenge-create').warn(
        e instanceof Error ? e.message : 'CHALLENGE_UNAVAILABLE',
      );
      setError(challengeError(e instanceof Error ? e.message : ''));
      setRequest(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CSheet
      visible
      title={challengeText(catalog, template.title_key)}
      onClose={onClose}
      testID="create-challenge-modal"
    >
      <Text style={cs.body}>{challengeText(catalog, template.desc_key)}</Text>
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={cs.heading}>
          {saved}
        </Text>
      ) : (
        <>
          <View style={cs.row}>
            {template.scope_options.map((s) => (
              <CButton
                key={s}
                label={ct(
                  s === 'season'
                    ? 'season'
                    : s === 'room'
                      ? 'room'
                      : s === 'pair'
                        ? 'pair'
                        : 'solo',
                )}
                selected={scope === s}
                onPress={() => {
                  setScope(s);
                  setPartners([]);
                  setRoom(undefined);
                }}
                disabled={busy || (s === 'room' && !paid)}
                testID={`challenge-scope-${s}`}
              />
            ))}
          </View>
          <Text style={cs.heading}>{ct('duration')}</Text>
          <View style={cs.row}>
            {template.duration_options.map((days) => (
              <CButton
                key={days}
                label={ct('days', { count: days })}
                selected={duration === days}
                disabled={busy || (scope !== 'season' && days > max)}
                onPress={() => setDuration(days)}
                testID={`challenge-duration-${days}`}
              />
            ))}
          </View>
          {(scope === 'pair' || scope === 'room') && (
            <>
              <Text style={cs.heading}>
                {ct(scope === 'room' ? 'chooseRoom' : 'choosePartner')}
              </Text>
              {scope === 'room'
                ? catalog.rooms
                    .filter((r) => r.host && r.count > 2)
                    .map((r) => (
                      <CButton
                        key={r.id}
                        label={r.name}
                        selected={room === r.id}
                        onPress={() => {
                          setRoom(r.id);
                          setPartners([]);
                        }}
                        testID={`challenge-room-${r.id}`}
                      />
                    ))
                : null}
              {catalog.partners
                .filter(
                  (p) =>
                    scope !== 'room' ||
                    catalog.rooms.find((r) => r.id === room)?.member_ids?.includes(p.id),
                )
                .map((p) => (
                  <CButton
                    key={p.id}
                    label={p.nickname}
                    selected={partners.includes(p.id)}
                    onPress={() =>
                      setPartners(
                        scope === 'pair'
                          ? [p.id]
                          : partners.includes(p.id)
                            ? partners.filter((id) => id !== p.id)
                            : [...partners, p.id],
                      )
                    }
                    testID={`challenge-partner-${p.id}`}
                  />
                ))}
              {!catalog.partners.length && (
                <>
                  <Text style={cs.body}>{ct('noPartner')}</Text>
                  <CButton
                    label={ct('community')}
                    onPress={() => {
                      onClose();
                      router.push('/friends' as never);
                    }}
                    testID="challenge-community"
                  />
                </>
              )}
            </>
          )}
          {template.format === 'checklist' && (
            <>
              <Text style={cs.heading}>{ct('tasks')}</Text>
              <View style={cs.row}>
                {CHALLENGE_METRICS.map((metric) => (
                  <CButton
                    key={metric}
                    label={ct(metric)}
                    disabled={!paid}
                    selected={tasks.includes(metric)}
                    onPress={() =>
                      setTasks(
                        tasks.includes(metric)
                          ? tasks.filter((t) => t !== metric)
                          : [...tasks, metric],
                      )
                    }
                    testID={`challenge-task-${metric}`}
                  />
                ))}
              </View>
            </>
          )}
          {scope === 'pair' && (
            <CButton
              label={ct(sameTarget ? 'personalTarget' : 'sameTarget')}
              selected={sameTarget}
              onPress={() => setSameTarget(!sameTarget)}
              testID="challenge-same-target"
            />
          )}
          <CInput
            label={ct('startDate')}
            value={startDate}
            onChangeText={setStartDate}
            testID="challenge-start-date"
          />
          {paid && (
            <>
              <Text style={cs.heading}>{ct('restDays')}</Text>
              <View style={cs.row}>
                {catalog.config.rest_weekday_options.map((day) => (
                  <CButton
                    key={day}
                    label={ct(
                      (
                        [
                          'sunday',
                          'monday',
                          'tuesday',
                          'wednesday',
                          'thursday',
                          'friday',
                          'saturday',
                        ] as const
                      )[Number(day)]!,
                    )}
                    selected={(rest ?? template.rule_overrides.rest_weekdays ?? []).includes(
                      Number(day),
                    )}
                    onPress={() => {
                      const days = rest ?? template.rule_overrides.rest_weekdays ?? [];
                      setRest(
                        days.includes(Number(day))
                          ? days.filter((d) => d !== Number(day))
                          : [...days, Number(day)],
                      );
                    }}
                    testID={`challenge-rest-${day}`}
                  />
                ))}
              </View>
              <CButton
                label={ct((manual ?? template.allow_manual) ? 'disallowManual' : 'allowManual')}
                selected={manual ?? template.allow_manual}
                onPress={() => setManual(!(manual ?? template.allow_manual))}
                testID="challenge-manual"
              />
            </>
          )}
          <Text style={cs.heading}>{ct('personalTargets')}</Text>
          <Text style={cs.small}>{ct('baseline')}</Text>
          {recommended ? (
            tasks.map((metric) => (
              <CInput
                key={metric}
                label={`${ct(metric)} · ${ct('range', { min: catalog.config.rules.metrics[metric].min, max: catalog.config.rules.metrics[metric].max })}`}
                keyboardType="numeric"
                value={String(targets[metric] ?? '')}
                onChangeText={(value) => setTargets({ ...targets, [metric]: Number(value) })}
                testID={`challenge-target-${metric}`}
              />
            ))
          ) : (
            <Text style={cs.small}>{ct(isOnline ? 'loading' : 'queuedCreate')}</Text>
          )}
          {paid && (
            <CInput
              label={ct('customTitle')}
              value={title}
              onChangeText={setTitle}
              maxLength={catalog.config.title_max_length}
              testID="challenge-custom-title"
            />
          )}
          {template.format === 'duel' && catalog.limits.forfeits && (
            <>
              <Text style={cs.heading}>{ct('forfeit')}</Text>
              <CButton
                label={ct('noForfeit')}
                selected={!forfeit}
                onPress={() => setForfeit(undefined)}
                testID="challenge-no-forfeit"
              />
              {catalog.forfeits.map((card) => (
                <CButton
                  key={card.id}
                  label={challengeText(catalog, card.text_key)}
                  selected={forfeit === card.id}
                  onPress={() => setForfeit(card.id)}
                  testID={`challenge-forfeit-${card.id}`}
                />
              ))}
            </>
          )}
          <Text style={cs.small}>{ct('privacy')}</Text>
          {!paid && (
            <View style={cs.card}>
              <Text style={cs.body}>{ct('upgrade')}</Text>
              <CButton
                label={ct('plans')}
                onPress={() => {
                  onClose();
                  router.push('/paywall');
                }}
                testID="challenge-upgrade-options"
              />
            </View>
          )}
          <CButton
            brand
            label={ct(scope === 'pair' || scope === 'room' ? 'start' : 'startSolo')}
            disabled={
              busy ||
              (scope === 'pair' && partners.length !== 1) ||
              (scope === 'room' && (!room || partners.length < 2)) ||
              (template.format === 'checklist' &&
                (tasks.length < catalog.config.checklist_min ||
                  tasks.length > catalog.config.checklist_max))
            }
            onPress={() => void send()}
            testID="challenge-create-submit"
          />
        </>
      )}
      {error && (
        <Text accessibilityRole="alert" style={cs.error}>
          {error}
        </Text>
      )}
    </CSheet>
  );
}
