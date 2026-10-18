import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useSubscription } from '@/hooks/useSubscription';
import type { RoomSummary } from '@/types/rooms';

export interface MeRoomPlanCardProps {
  attachedRoom?: RoomSummary | null;
  onChangePlan: () => void;
}

export function MeRoomPlanCard({ attachedRoom, onChangePlan }: MeRoomPlanCardProps) {
  const { colors } = useTheme();
  const { entitlement, hasPlan, isTrial, isGrace, isLapsed, isUnattached, loading } =
    useSubscription();

  const handleManageInStore = () => {
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';

    Linking.openURL(storeUrl).catch(() => {
      // Fallback
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    });
  };

  if (loading) {
    return (
      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        testID="card-me-room-plan-loading"
      >
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          {t('me.roomPlan.loadingPlan')}
        </Text>
      </View>
    );
  }

  const tier = entitlement?.tier ?? (isTrial ? 'trial' : 'free');
  const tierName =
    tier === 'pro'
      ? t('me.roomPlan.tierPro')
      : tier === 'plus'
        ? t('me.roomPlan.tierPlus')
        : tier === 'basic'
          ? t('me.roomPlan.tierBasic')
          : isTrial
            ? t('me.roomPlan.tierTrial')
            : t('me.roomPlan.tierFree');

  const statusName = isGrace
    ? t('me.roomPlan.statusGrace')
    : isTrial
      ? t('me.roomPlan.statusTrial')
      : isLapsed
        ? t('me.roomPlan.statusLapsed')
        : hasPlan
          ? t('me.roomPlan.statusActive')
          : t('me.roomPlan.tierFree');

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

  const roomCap = attachedRoom?.member_cap ?? (tier === 'pro' ? 50 : tier === 'plus' ? 20 : 5);
  const memberCount = attachedRoom?.member_count ?? 1;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID="card-me-room-plan"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('me.roomPlan.title')}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            {t('me.roomPlan.subtitle')}
          </Text>
        </View>

        <View
          style={[
            styles.tierBadge,
            {
              backgroundColor: hasPlan ? colors.cardHighlight : colors.surfaceAlt,
            },
          ]}
        >
          <Text
            style={[styles.tierBadgeText, { color: hasPlan ? colors.accent : colors.textMuted }]}
          >
            {tier.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Details Section */}
      <View style={[styles.detailsSection, { borderColor: colors.border }]}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {t('me.roomPlan.planLabel')}
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{tierName}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {t('me.roomPlan.statusLabel')}
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{statusName}</Text>
        </View>

        {renewalText && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Renewal</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{renewalText}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {t('me.roomPlan.roomCoveredLabel')}
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {attachedRoom?.name
              ? t('me.roomPlan.roomCoveredValue', { name: attachedRoom.name })
              : t('me.roomPlan.noRoomCovered')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
            {t('me.roomPlan.capacityLabel')}
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {t('me.roomPlan.capacityValue', {
              count: memberCount,
              cap: roomCap,
            })}
          </Text>
        </View>
      </View>

      {/* Unattached Subscription Note (PRD 6.18 SUB-14, 7.11) */}
      {isUnattached && (
        <View
          style={[
            styles.unattachedCard,
            {
              backgroundColor: colors.cardHighlight,
              borderColor: colors.accent,
            },
          ]}
          testID="banner-unattached-subscription"
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
          <View style={styles.unattachedTextWrap}>
            <Text style={[styles.unattachedTitle, { color: colors.text }]}>
              {t('me.roomPlan.unattachedAlertTitle')}
            </Text>
            <Text style={[styles.unattachedDesc, { color: colors.textMuted }]}>
              {t('me.roomPlan.unattachedAlertDesc')}
            </Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onChangePlan}
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel={t('me.roomPlan.changePlanBtn')}
          testID="btn-me-change-plan"
        >
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{t('me.roomPlan.changePlanBtn')}</Text>
        </Pressable>

        <Pressable
          onPress={handleManageInStore}
          style={[
            styles.secondaryBtn,
            { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('me.roomPlan.manageStoreBtn')}
          testID="btn-me-manage-store"
        >
          <Ionicons name="open-outline" size={14} color={colors.text} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
            {t('me.roomPlan.manageStoreBtn')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.xs,
  },
  detailValue: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
  },
  unattachedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    padding: spacing.sm,
    marginVertical: 2,
  },
  unattachedTextWrap: {
    flex: 1,
  },
  unattachedTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  unattachedDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    gap: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
