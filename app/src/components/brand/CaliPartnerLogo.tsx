import React from 'react';
import { SvgXml } from 'react-native-svg';
import { brandLogoSvg, onboardingLayout } from '@calipartner/ui';
import { t } from '@/i18n';

interface CaliPartnerLogoProps {
  size?: number;
  testID?: string;
}
/** Static, exact owner-supplied logo. */
export function CaliPartnerLogo({
  size = onboardingLayout.logo,
  testID = 'calipartner-brand-logo',
}: CaliPartnerLogoProps) {
  return (
    <SvgXml
      xml={brandLogoSvg}
      width={size}
      height={size}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={t('brandRepair.logoLabel')}
    />
  );
}
