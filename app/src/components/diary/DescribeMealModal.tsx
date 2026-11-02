import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, dark, homeLayout, radius, space, Text, type as typography } from '@calipartner/ui';
import type { FoodCandidateItem, MealSection } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { AiConsentSheet, FoodPhotoResultsEditor } from '@/components/food_photo';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import {
  acceptAiProcessingConsent,
  analyzeFoodPhoto,
  AiFoodPhotoServiceError,
  savePhotoCandidatesToDiary,
  type SupabaseFunctionsClient,
} from '@/services/aiFoodPhotoService';
import { getSupabase } from '@/lib/supabase';
import { getDb } from '@/db';
import { t } from '@/i18n';

export function DescribeMealModal({
  visible,
  section,
  localDate,
  onClose,
  onLogged,
}: {
  visible: boolean;
  section: MealSection;
  localDate: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  useBrowserModalBack(visible, onClose);
  const { user } = useAuth();
  const { currentTier, hasActiveAccess, isTrial, loading: planLoading } = useSubscription();
  const { isOnline } = useNetworkStatus();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<FoodCandidateItem[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [plans, setPlans] = useState(false);
  const inFlight = useRef(false);
  const analyze = async () => {
    if (inFlight.current || !description.trim() || planLoading) return;
    if (currentTier !== 'pro' || !hasActiveAccess || isTrial) {
      setPlans(true);
      return;
    }
    if (isOnline === false) {
      setError(t('homeRefresh.aiError'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await analyzeFoodPhoto(getSupabase() as unknown as SupabaseFunctionsClient, {
        description: description.trim(),
      });
      setCandidates(response.candidates);
    } catch (reason) {
      if (reason instanceof AiFoodPhotoServiceError && reason.code === 'CONSENT_REQUIRED')
        setConsent(true);
      else if (
        reason instanceof AiFoodPhotoServiceError &&
        ['UPGRADE_REQUIRED', 'PRO_REQUIRED', 'PREMIUM_REQUIRED'].includes(reason.code)
      )
        setPlans(true);
      else
        setError(
          t(
            reason instanceof AiFoodPhotoServiceError && reason.code === 'DAILY_LIMIT_REACHED'
              ? 'homeRefresh.aiLimit'
              : 'homeRefresh.aiError',
          ),
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.root} testID="describe-meal-modal">
        <Button
          variant="tertiary"
          label={t('homeRefresh.close')}
          onPress={onClose}
          testID="describe-meal-close"
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title1">{t('homeRefresh.describe')} · Pro</Text>
          <Text color={dark.textMid}>{t('homeRefresh.describeHint')}</Text>
          <TextInput
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            style={styles.input}
            accessibilityLabel={t('homeRefresh.describe')}
            placeholder={t('homeRefresh.description')}
            placeholderTextColor={dark.textLo}
            testID="meal-description-input"
          />
          <Text variant="bodyS" color={dark.textMid}>
            {t('homeRefresh.estimate')}
          </Text>
          {error && (
            <Text color={dark.danger} accessibilityRole="alert">
              {error}
            </Text>
          )}
        </ScrollView>
        <Button
          variant="primary"
          label={busy ? t('homeRefresh.analyzing') : t('homeRefresh.analyze')}
          onPress={() => void analyze()}
          disabled={busy || planLoading || !description.trim()}
          testID="analyze-meal-description"
        />
        <AiConsentSheet
          visible={consent}
          loading={busy}
          onDecline={() => setConsent(false)}
          onAccept={async () => {
            setBusy(true);
            try {
              await acceptAiProcessingConsent(getSupabase() as unknown as SupabaseFunctionsClient);
              setConsent(false);
              await analyze();
            } catch {
              setError(t('homeRefresh.aiError'));
            } finally {
              setBusy(false);
            }
          }}
        />
        <PaywallModal visible={plans} onClose={() => setPlans(false)} />
        {candidates && (
          <FoodPhotoResultsEditor
            visible
            mealDescription={description}
            initialCandidates={candidates}
            defaultSection={section}
            localDate={localDate}
            onClose={() => setCandidates(null)}
            onSaveMeal={async (items, mealSection) => {
              if (!user?.id) throw new Error(t('common.errorBody'));
              await savePhotoCandidatesToDiary(await getDb(), {
                userId: user.id,
                candidates: items,
                mealSection,
                localDate,
                source: 'description',
              });
              setCandidates(null);
              onLogged?.();
              onClose();
            }}
          />
        )}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg0, padding: space[4] },
  content: { gap: space[4], paddingVertical: space[4] },
  input: {
    ...typography.body,
    minHeight: homeLayout.ringSize,
    padding: space[4],
    color: dark.textHi,
    borderColor: dark.hairline,
    borderWidth: 1,
    borderRadius: radius.card,
    backgroundColor: dark.s1,
    textAlignVertical: 'top',
  },
});
