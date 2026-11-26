import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CloseIcon,
  IconButton,
  PrimaryButton,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
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
  const insets = useSafeAreaInsets();
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
      if (reason instanceof AiFoodPhotoServiceError && reason.code === 'CONSENT_REQUIRED') {
        setConsent(true);
      } else if (
        reason instanceof AiFoodPhotoServiceError &&
        ['UPGRADE_REQUIRED', 'PRO_REQUIRED', 'PREMIUM_REQUIRED'].includes(reason.code)
      ) {
        setPlans(true);
      } else {
        setError(
          t(
            reason instanceof AiFoodPhotoServiceError &&
              ['MONTHLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED'].includes(reason.code)
              ? 'homeRefresh.aiLimit'
              : 'homeRefresh.aiError',
          ),
        );
      }
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
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + layout.topContentOffset,
            paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm),
          },
        ]}
        testID="describe-meal-modal"
      >
        <View style={styles.topRow}>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            onPress={onClose}
            accessibilityLabel={t('homeRefresh.close')}
            testID="describe-meal-close"
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="eyebrow" color="textLo">
            {t('captureV1.aiEstimateEyebrow')}
          </Text>
          <Text variant="title" color="textHi">
            {t('homeRefresh.describe')}
          </Text>
          <Text variant="body" color="textMid">
            {t('homeRefresh.describeHint')}
          </Text>
          <TextInput
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            style={styles.input}
            accessibilityLabel={t('homeRefresh.describe')}
            placeholder={t('homeRefresh.description')}
            placeholderTextColor={colors.textLo}
            testID="meal-description-input"
          />
          <Text variant="meta" color="textLo">
            {t('homeRefresh.estimate')}
          </Text>
          {error ? (
            <Text variant="meta" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <PrimaryButton
          title={busy ? t('homeRefresh.analyzing') : t('homeRefresh.analyze')}
          loading={busy}
          disabled={busy || planLoading || !description.trim()}
          onPress={() => void analyze()}
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

        {candidates ? (
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
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
    paddingHorizontal: layout.screenPaddingX,
  },
  topRow: {
    height: layout.navRowHeight,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  content: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  input: {
    minHeight: 160,
    padding: space.lg,
    color: colors.textHi,
    borderColor: colors.hairline,
    borderWidth: borders.width,
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
});
