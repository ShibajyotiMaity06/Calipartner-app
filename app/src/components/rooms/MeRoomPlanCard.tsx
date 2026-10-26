import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, dark, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { useSubscription } from '@/hooks/useSubscription';
import { openDodoPortal } from '@/services/dodoService';
import type { RoomSummary } from '@/types/rooms';
import { playClickSound } from '@/lib/sound';

export interface MeRoomPlanCardProps {
  attachedRoom?: RoomSummary | null;
  onChangePlan: () => void;
  onRestorePurchases?: () => Promise<void> | void;
}

export function MeRoomPlanCard({
  attachedRoom,
  onChangePlan,
  onRestorePurchases,
}: MeRoomPlanCardProps) {
  const { entitlement, hasPlan, isTrial, isLapsed, isUnattached, loading, restore } =
    useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const handleManageInStore = async () => {
    playClickSound();
    if (entitlement?.source === 'dodo') {
      await openDodoPortal().catch(() => setRestoreMessage(t('fixes.storeNotReady')));
      return;
    }
    if (Platform.OS === 'web') {
      setRestoreMessage(t('fixes.nativeManagement'));
      return;
    }
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';

    Linking.openURL(storeUrl).catch(() => {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    });
  };

  const handleRestore = async () => {
    playClickSound();
    setRestoring(true);
    setRestoreMessage(null);
    try {
      if (onRestorePurchases) {
        await onRestorePurchases();
      } else {
        if (!(await restore())) {
          setRestoreMessage(t('fixes.paymentPending'));
          return;
        }
      }
      setRestoreMessage(t('fixes.restoreSuccess'));
      setTimeout(() => setRestoreMessage(null), 2500);
    } catch {
      setRestoreMessage('No purchases found');
      setTimeout(() => setRestoreMessage(null), 2500);
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <Card elevation="s1" style={styles.card} testID="card-me-room-plan-loading">
        <ActivityIndicator size="small" color={dark.apricot} />
        <Text variant="micro" color={dark.textMid} style={styles.loadingText}>
          {t('me.roomPlan.loadingPlan')}
        </Text>
      </Card>
    );
  }

  const tier = entitlement?.tier ?? (isTrial ? 'trial' : 'free');
  const isPaidOrTrial = hasPlan || isTrial;

  const tierName =
    tier === 'pro'
      ? 'CaliPartner Pro'
      : tier === 'plus'
        ? 'CaliPartner Plus'
        : tier === 'basic'
          ? 'CaliPartner Free'
          : isTrial
            ? 'Plus Free Trial'
            : 'Free Plan';

  const formattedPeriodEnd = entitlement?.period_end
    ? new Date(entitlement.period_end).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const renewalText = formattedPeriodEnd
    ? isTrial
      ? t('me.roomPlan.trialEnds', { date: formattedPeriodEnd })
      : isLapsed
        ? t('me.roomPlan.expiredDate', { date: formattedPeriodEnd })
        : t('me.roomPlan.renewalDate', { date: formattedPeriodEnd })
    : null;

  const planDefaultCap = tier === 'pro' ? 20 : tier === 'plus' ? 5 : 2;
  const roomCap = attachedRoom ? planDefaultCap : planDefaultCap;
  const memberCount = attachedRoom?.member_count ?? 1;
  const capacityText = attachedRoom?.name
    ? `${memberCount} of ${roomCap} people`
    : `Up to ${planDefaultCap} people`;

  // 1. FREE STATE: "Free Plan. Personal tracking is 100% free forever." with a quiet "See plans" (Spec N01, O01)
  if (!isPaidOrTrial) {
    return (
      <Card elevation="s1" style={styles.card} testID="card-me-room-plan">
        <View style={styles.freeHeaderRow}>
          <View style={styles.freeTextGroup}>
            <Text variant="heading" color={dark.textHi}>
              Free Plan
            </Text>
            <Text variant="bodyS" color={dark.textMid} style={styles.freeNoticeText}>
              Personal tracking is 100% free forever.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onChangePlan}
            style={styles.seePlansBtn}
            accessibilityRole="button"
            accessibilityLabel="See plans"
            testID="btn-me-change-plan"
          >
            <Text variant="label" color={dark.apricot}>
              See plans
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.freeFooterRow}>
          <TouchableOpacity
            onPress={handleRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            testID="btn-me-restore-free"
          >
            <Text variant="micro" color={dark.textLo}>
              {restoring ? 'Restoring…' : (restoreMessage ?? 'Restore purchases')}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }

  // 2. ACTIVE / TRIAL PLAN STATE (Spec O01)
  return (
    <Card elevation="s1" style={styles.card} testID="card-me-room-plan">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text variant="heading" color={dark.textHi}>
            {tierName}
          </Text>
          <Text variant="bodyS" color={dark.textMid}>
            {attachedRoom?.name ? attachedRoom.name : 'Personal active plan'}
          </Text>
        </View>

        <View style={styles.tierBadge}>
          <Text variant="micro" color={dark.apricot} style={styles.tierBadgeText}>
            {tier.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Text variant="micro" color={dark.textMid}>
            Capacity
          </Text>
          <Text variant="bodyS" color={dark.textHi} style={styles.tabularNum}>
            {capacityText}
          </Text>
        </View>

        {renewalText && (
          <View style={styles.detailRow}>
            <Text variant="micro" color={dark.textMid}>
              Status
            </Text>
            <Text variant="bodyS" color={dark.textHi}>
              {renewalText}
            </Text>
          </View>
        )}
      </View>

      {/* Unattached Subscription Note (PRD 6.18 SUB-14) */}
      {isUnattached && (
        <Card elevation="s2" style={styles.unattachedCard} testID="banner-unattached-subscription">
          <Ionicons name="alert-circle-outline" size={18} color={dark.apricot} />
          <View style={styles.unattachedTextWrap}>
            <Text variant="label" color={dark.textHi}>
              {t('me.roomPlan.unattachedAlertTitle')}
            </Text>
            <Text variant="micro" color={dark.textMid}>
              {t('me.roomPlan.unattachedAlertDesc')}
            </Text>
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Button
          variant="secondary"
          label={t('me.roomPlan.changePlanBtn')}
          onPress={onChangePlan}
          testID="btn-me-change-plan"
          style={styles.actionBtn}
        />

        <Button
          variant="secondary"
          label={t('me.roomPlan.manageStoreBtn')}
          onPress={handleManageInStore}
          testID="btn-me-manage-store"
          style={styles.actionBtn}
        />
      </View>

      <TouchableOpacity
        onPress={handleRestore}
        style={styles.restoreLink}
        accessibilityRole="button"
        accessibilityLabel="Restore purchases"
        testID="btn-me-restore"
      >
        <Text variant="micro" color={dark.textLo}>
          {restoring ? 'Restoring…' : (restoreMessage ?? 'Restore purchases')}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    marginBottom: space[4],
  },
  loadingText: {
    textAlign: 'center',
    marginTop: space[2],
  },
  freeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  freeTextGroup: {
    flex: 1,
  },
  freeNoticeText: {
    marginTop: 2,
  },
  seePlansBtn: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeFooterRow: {
    marginTop: space[3],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[3],
  },
  titleGroup: {
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  tierBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailsSection: {
    paddingVertical: space[2],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
    marginBottom: space[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
  unattachedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[3],
    marginBottom: space[3],
    borderColor: dark.apricot,
  },
  unattachedTextWrap: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  actionBtn: {
    flex: 1,
  },
  restoreLink: {
    marginTop: space[2],
    alignItems: 'center',
    minHeight: 28,
    justifyContent: 'center',
  },
});
