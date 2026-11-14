import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@calipartner/ui';
import type { ReviewProposal } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { t, type TranslationKey } from '@/i18n';
import { useSquadStyles } from '@/components/rooms/SquadViews';
import { NutrientSummary } from '@/components/diary/NutrientSummary';

export function AdaptiveReview({ onAccepted }: { onAccepted?: () => Promise<void> } = {}) {
  const styles = useSquadStyles();

  const { user } = useAuth(),
    { currentGoalProfile: goal, refresh } = useTargets();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const request = useRef(generateClientUuid());
  const locked = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ id: string; proposal: ReviewProposal } | null>(null);
  const failure = (code: string): TranslationKey =>
    code.includes('PURCHASED_PRO')
      ? 'aha.reviewLocked'
      : code.includes('STALE')
        ? 'aha.reviewStale'
        : code.includes('NOT_DUE')
          ? 'aha.reviewNotDue'
          : code.includes('SAFETY')
            ? 'aha.reviewSafety'
            : 'aha.reviewError';
  const check = async () => {
    if (!user || locked.current) return;
    const id = user.id;
    locked.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    setProposal(null);
    try {
      const result = await getSupabase().functions.invoke('adaptive-review', {
        body: { request_id: request.current },
      });
      let code = result.data?.code;
      if (result.error) {
        try {
          code = (await result.error.context?.json?.())?.code;
        } catch {
          /* Network failure. */
        }
        throw new Error(code ?? 'REVIEW_UNAVAILABLE');
      }
      if (owner.current !== id) return;
      if (result.data?.reason === 'ready' && result.data?.id && result.data?.proposal)
        setProposal(result.data);
      else
        setMessage(
          t(
            result.data?.reason === 'not_due'
              ? 'aha.reviewNotDue'
              : result.data?.reason === 'safety'
                ? 'aha.reviewSafety'
                : 'aha.reviewNeedData',
          ),
        );
    } catch (e) {
      if (owner.current === id) {
        const code = e instanceof Error ? e.message : '';
        if (code.includes('STALE')) request.current = generateClientUuid();
        setError(t(failure(code)));
      }
    } finally {
      locked.current = false;
      if (owner.current === id) setBusy(false);
    }
  };
  const accept = async () => {
    if (!user || !proposal || locked.current) return;
    const id = user.id;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await getSupabase().rpc('accept_adaptive_review', { p_id: proposal.id });
      if (result.error) throw result.error;
      if (result.data?.id !== proposal.id || result.data?.user_id !== id)
        throw new Error('REVIEW_UNAVAILABLE');
      if (owner.current !== id) return;
      setProposal(null);
      setMessage(t('aha.reviewSaved'));
      request.current = generateClientUuid();
      await refresh();
      await onAccepted?.();
    } catch (e) {
      if (owner.current === id) {
        const code = String((e as { message?: string })?.message ?? '');
        if (code.includes('STALE')) {
          setProposal(null);
          request.current = generateClientUuid();
        }
        setError(t(failure(code)));
      }
    } finally {
      locked.current = false;
      if (owner.current === id) setBusy(false);
    }
  };
  return (
    <View style={styles.card} testID="adaptive-review">
      <Text variant="heading">{t('aha.reviewTitle')}</Text>
      <Text>{t('aha.reviewBody')}</Text>
      <Text variant="bodyS">{t('aha.reviewLimits')}</Text>
      {busy && <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>}
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      {proposal && goal && (
        <>
          <Text tabular>
            {t('aha.reviewSummary', {
              days: proposal.proposal.logged_days,
              weights: proposal.proposal.weigh_in_days,
              change: proposal.proposal.weight_change.toFixed(2),
            })}
          </Text>
          <Text tabular>
            {t('aha.reviewMaintenance', { old: goal.tdee, next: proposal.proposal.tdee })}
          </Text>
          <Text tabular>
            {t('aha.reviewCalories', {
              old: goal.daily_calorie_target,
              next: proposal.proposal.daily_calorie_target,
            })}
          </Text>
          <NutrientSummary
            values={{
              calories: proposal.proposal.daily_calorie_target,
              protein: proposal.proposal.protein_grams,
              carbs: proposal.proposal.carb_grams,
              fat: proposal.proposal.fat_grams,
            }}
            testID="adaptive-proposed-nutrients"
          />
          <Button
            label={t('aha.reviewAccept')}
            onPress={() => void accept()}
            disabled={busy}
            testID="accept-adaptive-review"
          />
          <Button
            variant="tertiary"
            label={t('aha.reviewLater')}
            onPress={() => setProposal(null)}
            disabled={busy}
            testID="dismiss-adaptive-review"
          />
        </>
      )}
      {!proposal && (
        <Button
          variant="secondary"
          label={t('aha.reviewLoad')}
          onPress={() => void check()}
          disabled={busy}
          testID="prepare-adaptive-review"
        />
      )}
    </View>
  );
}
