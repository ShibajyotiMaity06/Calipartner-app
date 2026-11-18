import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, space } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import { t } from '@/i18n';

export function PaywallDownsellModal({
  tier,
  quote,
  pending,
  message,
  onClaim,
  onDismiss,
  loading,
}: {
  tier: string;
  quote: { total: string; equivalent: string } | null;
  pending: boolean;
  message: string | null;
  onClaim: () => void;
  onDismiss: () => void;
  loading: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content} testID="paywall-downsell">
      <Text variant="label" color={colors.actionInk}>
        {t('releaseUpdate.exitEyebrow')}
      </Text>
      <Text variant="title1">{t('releaseUpdate.exitTitle')}</Text>
      <Text>{t('releaseUpdate.exitBody')}</Text>
      <Card elevation="s1" style={styles.offer}>
        <Text variant="heading">
          {tier} · {t('releaseUpdate.quarterly')}
        </Text>
        {quote ? (
          <>
            <Text variant="numeralM" tabular testID="paywall-downsell-total">
              {quote.total}
            </Text>
            <Text tabular>{quote.equivalent}</Text>
            <Text variant="bodyS">{t('releaseUpdate.charged', { total: quote.total })}</Text>
            <Text variant="bodyS">{t('fixes.storeTerms')}</Text>
          </>
        ) : (
          <Text>{t(loading ? 'fixes.loadingPrices' : 'fixes.priceUnavailable')}</Text>
        )}
      </Card>
      {message && <Text accessibilityRole="alert">{message}</Text>}
      <Button
        label={t(pending ? 'fixes.checkPayment' : 'releaseUpdate.exitAction')}
        disabled={loading || (!quote && !pending)}
        onPress={onClaim}
        testID="claim-three-month-pass"
      />
      <Button
        variant="tertiary"
        label={t('releaseUpdate.exitDecline')}
        disabled={loading}
        onPress={onDismiss}
        testID="dismiss-three-month-pass"
      />
      <View>
        <Text variant="bodyS">{t('releaseUpdate.freeForever')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: space[4], padding: space[5] },
  offer: { gap: space[2] },
});
