import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { ChallengeCatalog, ChallengeMutation, ChallengeMetric } from '@calipartner/core';
import { ct, challengeError } from '@/i18n/challenges';
import { generateClientUuid } from '@/services/foodService';
import { cs, CButton, CInput, CSheet } from './ChallengeUI';
export function OccasionPlanModal({
  catalog,
  onClose,
  mutate,
}: {
  catalog: ChallengeCatalog;
  onClose: () => void;
  mutate: (m: ChallengeMutation) => Promise<string>;
}) {
  const [event, setEvent] = useState(catalog.config.occasion_event_types[0]!);
  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('');
  const [tasks, setTasks] = useState<ChallengeMetric[]>(
    catalog.templates.find((t) => t.format === 'checklist' && !t.season_id)?.tasks ?? [],
  );
  const [partner, setPartner] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [id] = useState(generateClientUuid);
  const send = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const template = catalog.templates.find((t) => t.format === 'checklist' && !t.season_id);
      if (!template) throw new Error('TEMPLATE_UNAVAILABLE');
      const state = await mutate({
        action: 'occasion',
        id,
        template_id: template.id,
        partner_id: partner!,
        event_type: event,
        event_date: date,
        tasks,
        ...(weight.trim() ? { target_weight: Number(weight) } : {}),
      });
      setSaved(ct(state === 'pending' ? 'queuedCreate' : 'created'));
    } catch (e) {
      setError(challengeError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };
  return (
    <CSheet visible title={ct('occasionTitle')} onClose={onClose} testID="occasion-plan-modal">
      {saved ? (
        <Text style={cs.heading}>{saved}</Text>
      ) : (
        <>
          <View style={cs.row}>
            {catalog.config.occasion_event_types.map((e) => (
              <CButton
                key={e}
                label={ct(e as 'wedding' | 'birthday' | 'vacation' | 'new_year')}
                selected={event === e}
                onPress={() => setEvent(e)}
                testID={`occasion-${e}`}
              />
            ))}
          </View>
          <CInput
            label={ct('eventDate')}
            value={date}
            onChangeText={setDate}
            testID="occasion-date"
          />
          <Text style={cs.heading}>{ct('choosePartner')}</Text>
          {catalog.partners.map((p) => (
            <CButton
              key={p.id}
              label={p.nickname}
              selected={partner === p.id}
              onPress={() => setPartner(p.id)}
              testID={`occasion-partner-${p.id}`}
            />
          ))}
          {!catalog.partners.length && <Text style={cs.body}>{ct('noPartner')}</Text>}
          {!catalog.screened ? (
            <CInput
              label={ct('bodyGoal')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              testID="occasion-weight"
            />
          ) : (
            <Text style={cs.body}>{ct('health')}</Text>
          )}
          <Text style={cs.heading}>{ct('tasks')}</Text>
          <View style={cs.row}>
            {(Object.keys(catalog.config.rules.metrics) as ChallengeMetric[]).map((metric) => (
              <CButton
                key={metric}
                label={ct(metric)}
                selected={tasks.includes(metric)}
                onPress={() =>
                  setTasks(
                    tasks.includes(metric) ? tasks.filter((t) => t !== metric) : [...tasks, metric],
                  )
                }
                testID={`occasion-task-${metric}`}
              />
            ))}
          </View>
          <Text style={cs.small}>{ct('bodyPrivacy')}</Text>
          <Text style={cs.small}>{ct('recovery')}</Text>
          <CButton
            brand
            label={ct('planOccasion')}
            disabled={
              busy ||
              !partner ||
              !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              tasks.length < catalog.config.checklist_min ||
              tasks.length > catalog.config.checklist_max
            }
            onPress={() => void send()}
            testID="occasion-submit"
          />
        </>
      )}
      {error && (
        <Text style={cs.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </CSheet>
  );
}
