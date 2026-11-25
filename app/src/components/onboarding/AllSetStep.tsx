import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckIcon,
  LinkButton,
  PrimaryButton,
  ScreenTitle,
  colors,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

export interface AllSetStepProps {
  nickname?: string;
  loading?: boolean;
  onGoToToday: () => void;
  onInvitePartner: () => void;
}

const CONFETTI_PIECES = [
  { top: 18, left: 32, size: 7, rotate: '18deg', color: colors.apricot },
  { top: 54, left: 68, size: 5, rotate: '-25deg', color: colors.apricotPressed },
  { top: 4, left: 162, size: 6, rotate: '12deg', color: colors.textHi },
  { top: 8, right: 98, size: 6, rotate: '-18deg', color: colors.apricotPressed },
  { top: 24, right: 48, size: 7, rotate: '28deg', color: colors.textMid },
  { top: 112, left: 26, size: 5, rotate: '-12deg', color: colors.textMid },
  { top: 76, right: 24, size: 7, rotate: '15deg', color: colors.hairlineLit },
  { top: 146, right: 18, size: 6, rotate: '-20deg', color: colors.apricot },
] as const;

export function AllSetStep({
  nickname,
  loading = false,
  onGoToToday,
  onInvitePartner,
}: AllSetStepProps): React.JSX.Element {
  const cleanName = nickname?.trim() ?? '';
  const headline = cleanName
    ? t('onboardingV1.allSetTitleNamed', { name: cleanName })
    : t('onboardingV1.allSetTitleFallback');
  const accent = cleanName ? `${cleanName}!` : t('onboardingV1.allSetTitleFallback');

  return (
    <SafeAreaView style={styles.safe} testID="onboarding-screen-all_set">
      <View style={styles.body}>
        <View style={styles.confettiArea}>
          {CONFETTI_PIECES.map((piece, idx) => (
            <View
              key={idx}
              pointerEvents="none"
              style={[
                styles.confettiSquare,
                {
                  top: piece.top,
                  left: 'left' in piece ? piece.left : undefined,
                  right: 'right' in piece ? piece.right : undefined,
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  transform: [{ rotate: piece.rotate }],
                },
              ]}
            />
          ))}

          <View style={styles.checkRing} testID="all-set-check-ring">
            <CheckIcon size={54} color={colors.apricot} strokeWidth={3} />
          </View>
        </View>

        <ScreenTitle
          size="displayL"
          align="center"
          title={headline}
          accentWord={accent}
          subtitle={t('onboardingV1.allSetSubtitle')}
          spacingBottom={0}
          style={styles.titleBlock}
          testID="all-set-header"
        />
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title={t('onboardingV1.allSetPrimaryCta')}
          showArrow
          loading={loading}
          disabled={loading}
          onPress={onGoToToday}
          testID="btn-all-set-today"
        />
        <LinkButton
          title={t('onboardingV1.allSetInviteCta')}
          disabled={loading}
          onPress={onInvitePartner}
          testID="btn-all-set-invite"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingX,
    gap: space.max,
  },
  confettiArea: {
    position: 'relative',
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiSquare: {
    position: 'absolute',
    borderRadius: radius.tick,
  },
  checkRing: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: layout.ctaBottomMin,
    alignItems: 'center',
    gap: space.md,
  },
});
