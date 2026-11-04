import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import {
  Button,
  Text,
  dark,
  radius,
  space,
  onboardingLayout,
  type as typography,
} from '@calipartner/ui';
import { BILLING_COUNTRY_CODES } from '@calipartner/core';
import { fetchBillingCountry, saveBillingCountry } from '@/services/webBillingService';
import { getLocale, t } from '@/i18n';

export function BillingCountrySelect({
  onSaved,
  disabled = false,
  onSaving,
}: {
  onSaved: () => void;
  disabled?: boolean;
  onSaving?: (saving: boolean) => void;
}) {
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([getLocale()], { type: 'region' });
    return BILLING_COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
  }, []);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCountry((await fetchBillingCountry()) ?? '');
    } catch {
      setError(t('webBilling.countryLoadError'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (Platform.OS === 'web') void load();
  }, []);
  if (Platform.OS !== 'web') return null;
  const save = async (value: string) => {
    onSaving?.(true);
    setLoading(true);
    setError(null);
    try {
      await saveBillingCountry(value);
      setCountry(value);
      onSaved();
    } catch {
      setError(t('webBilling.countrySaveError'));
    } finally {
      setLoading(false);
      onSaving?.(false);
    }
  };
  return (
    <View style={{ gap: space[2] }} testID="billing-country-field">
      <Text variant="bodyS">{t('webBilling.countryLabel')}</Text>
      {React.createElement(
        'select',
        {
          'aria-label': t('webBilling.countryLabel'),
          'data-testid': 'billing-country-select',
          value: country,
          disabled: loading || disabled,
          onChange: (event: unknown) => {
            void save((event as { currentTarget: { value: string } }).currentTarget.value);
          },
          style: {
            minHeight: onboardingLayout.touch,
            padding: space[3],
            borderRadius: radius.control,
            backgroundColor: dark.s2,
            color: dark.textHi,
            borderColor: dark.hairline,
            fontFamily: typography.body.fontFamily,
            fontSize: typography.body.fontSize,
            width: '100%',
          },
        },
        React.createElement(
          'option',
          { value: '', disabled: true },
          t(loading ? 'common.loading' : 'webBilling.chooseCountry'),
        ),
        ...countries.map(({ code, name }) =>
          React.createElement('option', { key: code, value: code }, name),
        ),
      )}
      {error && (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={load}
            testID="retry-billing-country"
          />
        </>
      )}
    </View>
  );
}
