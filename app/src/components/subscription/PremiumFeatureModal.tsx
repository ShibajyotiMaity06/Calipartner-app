import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { Button, Card, Text, dark, space } from '@calipartner/ui';
import { getRequiredTierForFeature, isFeatureAllowed, type AppFeature } from '@calipartner/core';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { t } from '@/i18n';

export function PremiumFeatureModal({
  feature,
  visible,
  onClose,
  children,
}: {
  feature: AppFeature;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { entitlement, hasActiveAccess, loading } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const tier = hasActiveAccess ? (entitlement?.tier ?? 'free') : 'free';
  if (!visible) return null;
  if (!loading && isFeatureAllowed(feature, tier)) return <>{children}</>;
  const required = getRequiredTierForFeature(feature) === 'pro' ? 'pro' : 'plus';
  if (showPlans)
    return <PaywallModal visible onClose={() => setShowPlans(false)} preselectedTier={required} />;
  return (
    <Modal visible transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card elevation="s1" style={styles.card} testID={`locked-${feature}`}>
          {loading ? (
            <ActivityIndicator color={dark.textHi} />
          ) : (
            <>
              <Text variant="title1" color={dark.textHi}>
                {t(required === 'pro' ? 'brandRepair.proRequired' : 'brandRepair.plusRequired')}
              </Text>
              <Text variant="body" color={dark.textMid}>
                {t('brandRepair.paidBody')}
              </Text>
              <Button
                label={t('brandRepair.seePlans')}
                onPress={() => setShowPlans(true)}
                testID={`upgrade-${feature}`}
              />
            </>
          )}
          <Button
            variant="secondary"
            label={t('common.cancel')}
            onPress={onClose}
            testID={`close-${feature}`}
          />
        </Card>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: dark.bg0, justifyContent: 'center', padding: space[4] },
  card: { gap: space[4], padding: space[5] },
});
