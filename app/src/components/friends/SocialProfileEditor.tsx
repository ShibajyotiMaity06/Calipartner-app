import React, { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SegmentedControl, SwitchRow, Text, useTheme } from '@calipartner/ui';
import {
  validateSocialProfile,
  type SocialProfile,
  type SocialProfileDraft,
} from '@calipartner/core';
import { PlanTextField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export function SocialProfileEditor({
  profile,
  busy,
  onClose,
  onSave,
}: {
  profile: SocialProfile;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: SocialProfileDraft) => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<SocialProfileDraft>({
    ...profile,
    instagram_handle: '',
    website_url: '',
    training_style: ['bulk', 'cut'].includes(profile.training_style) ? profile.training_style : '',
  });
  const [invalid, setInvalid] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const save = async () => {
    if (!validateSocialProfile(draft).valid) {
      setInvalid(true);
      return;
    }
    setSaveError(false);
    if (await onSave(draft)) onClose();
    else setSaveError(true);
  };
  return (
    <Modal visible onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          contentContainerStyle={planStyles.reviewContent}
          keyboardShouldPersistTaps="handled"
        >
          <Button
            variant="tertiary"
            label={t('friends.close')}
            onPress={onClose}
            testID="close-social-editor"
          />
          <Text variant="title2" accessibilityRole="header">
            {t('friends.editProfile')}
          </Text>
          <Text>@{profile.username}</Text>
          <PlanTextField
            label={t('friends.bio')}
            placeholder={t('friends.bioPlaceholder')}
            value={draft.bio}
            onChangeText={(bio) => setDraft({ ...draft, bio })}
            maxLength={240}
            multiline
            testID="social-bio"
          />
          <Text variant="bodyS">{t('fixes.socialGoal')}</Text>
          <SegmentedControl
            options={[
              { value: 'bulk', label: t('fixes.bulk') },
              { value: 'cut', label: t('fixes.cut') },
            ]}
            value={draft.training_style}
            onChange={(training_style: string) => setDraft({ ...draft, training_style })}
            testID="social-goal"
          />
          <SwitchRow
            title={t('friends.publicLabel')}
            consequence={t('friends.publicHelp')}
            value={draft.is_public}
            onValueChange={(is_public) => setDraft({ ...draft, is_public })}
            testID="social-sharing"
          />
          {invalid ? (
            <Text accessibilityRole="alert" color={colors.danger}>
              {t('friends.profileRules')}
            </Text>
          ) : null}
          {saveError ? (
            <Text accessibilityRole="alert" color={colors.danger}>
              {t('friends.genericError')}
            </Text>
          ) : null}
          <Button
            label={t('friends.save')}
            disabled={busy}
            onPress={() => void save()}
            testID="save-social-profile"
          />
          <Text variant="bodyS">{t('friends.savedLocally')}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
