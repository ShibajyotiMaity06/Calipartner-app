import { visualPrimitives } from '@calipartner/ui/tokens';
import { Button } from '@calipartner/ui';
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { onboardingLayout as layout } from '@calipartner/ui';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { roomCap } from '@calipartner/core';

export interface RoomFullNoticeProps {
  memberCount: number;
  memberCap: number;
  isHost: boolean;
  onUpgrade?: () => void;
}

export interface RoomFullSheetProps extends RoomFullNoticeProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Inline notice when a room reaches capacity.
 * Host gets upgrade sheet/card; members get calm, neutral notification.
 */
export function RoomFullNotice({ memberCount, memberCap, isHost, onUpgrade }: RoomFullNoticeProps) {
  const { colors } = useTheme();

  const atMaximum = memberCap >= roomCap('pro');

  if (isHost) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        testID="sheet-room-full-host"
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="people" size={18} color={colors.accent} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('rooms.roomFull.sheetTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {atMaximum ? t('roomAudit.maximumCapacity') : t('proPlan.roomFull')}
            </Text>
          </View>
        </View>

        {onUpgrade && !atMaximum && (
          <Button
            variant="secondary"
            fullWidth={false}
            label={t('me.roomPlan.seePlansBtn')}
            icon={<Ionicons name="information-circle-outline" size={14} color={colors.onAccent} />}
            onPress={onUpgrade}
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('me.roomPlan.seePlansBtn')}
            testID="btn-room-full-upgrade"
          />
        )}
      </View>
    );
  }

  // Non-host member view: calm, plain notification (Spec J22)
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
      testID="notice-room-full-member"
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="people-outline" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.roomFull.memberNotice', {
              count: memberCount,
              cap: memberCap,
            })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Ask the host to make space.
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Modal variant for when host attempts to invite someone beyond room capacity.
 */
export function RoomFullSheet({
  visible,
  onClose,
  memberCount,
  memberCap,
  isHost,
  onUpgrade,
}: RoomFullSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          testID="modal-room-full-sheet"
        >
          <View style={styles.modalTopRow}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('rooms.roomFull.sheetTitle')}
            </Text>
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('rooms.paywall.close')}
              iconOnly
              icon={<Ionicons name="close" size={18} color={colors.text} />}
              onPress={onClose}
              style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.paywall.close')}
              testID="btn-close-room-full-sheet"
            />
          </View>

          <RoomFullNotice
            memberCount={memberCount}
            memberCap={memberCap}
            isHost={isHost}
            onUpgrade={() => {
              onClose();
              onUpgrade?.();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: visualPrimitives.radii[18],
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  upgradeBtn: {
    minHeight: layout.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  upgradeBtnText: {
    color: visualPrimitives.colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: visualPrimitives.radii[15],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
