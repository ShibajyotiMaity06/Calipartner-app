import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BrandRingMark,
  Card,
  DropletIcon,
  NotificationPreview,
  ScreenTitle,
  SquadIcon,
  SwitchRow,
  UtensilsIcon,
  colors,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

export interface ReminderPrefs {
  meals: boolean;
  hydration: boolean;
  partner: boolean;
}

export interface RemindersStepProps {
  nickname?: string;
  prefs: ReminderPrefs;
  onChangePrefs: (next: ReminderPrefs) => void;
}

export function RemindersStep({
  nickname,
  prefs,
  onChangePrefs,
}: RemindersStepProps): React.JSX.Element {
  const cleanName = nickname?.trim() ?? '';

  return (
    <View style={styles.root} testID="step-reminders-v1">
      <ScreenTitle
        eyebrow={t('onboardingV1.remindersEyebrow')}
        title={t('onboardingV1.remindersTitle')}
        accentWord={t('onboardingV1.remindersAccent')}
        subtitle={t('onboardingV1.remindersSubtitle')}
        spacingBottom={space.xl}
        testID="reminders-header"
      />

      <NotificationPreview
        showStackPeek
        appName={t('onboardingV1.remindersPreviewApp')}
        timeLabel={t('onboardingV1.remindersPreviewTime')}
        title={
          cleanName
            ? t('onboardingV1.remindersPreviewTitleNamed', { name: cleanName })
            : t('onboardingV1.remindersPreviewTitleFallback')
        }
        body={t('onboardingV1.remindersPreviewBody')}
        icon={<BrandRingMark size={20} color={colors.textHi} />}
        testID="reminders-notification-preview"
      />

      <Card style={styles.switchCard} testID="reminders-settings-card">
        <SwitchRow
          title={t('onboardingV1.remindersMealsTitle')}
          meta={t('onboardingV1.remindersMealsMeta')}
          icon={<UtensilsIcon size={18} color={colors.textMid} />}
          value={prefs.meals}
          onValueChange={(meals) => onChangePrefs({ ...prefs, meals })}
          testID="switch-reminder-meals"
        />
        <SwitchRow
          title={t('onboardingV1.remindersWaterTitle')}
          meta={t('onboardingV1.remindersWaterMeta')}
          icon={<DropletIcon size={18} color={colors.textMid} />}
          value={prefs.hydration}
          onValueChange={(hydration) => onChangePrefs({ ...prefs, hydration })}
          testID="switch-reminder-hydration"
        />
        <SwitchRow
          title={t('onboardingV1.remindersPartnerTitle')}
          meta={t('onboardingV1.remindersPartnerMeta')}
          icon={<SquadIcon size={18} color={colors.textMid} />}
          value={prefs.partner}
          onValueChange={(partner) => onChangePrefs({ ...prefs, partner })}
          showDivider={false}
          testID="switch-reminder-partner"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: space.xl,
  },
  switchCard: {
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
});
