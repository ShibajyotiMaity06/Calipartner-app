import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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

  const nextTier = memberCap <= 5 ? 'Plus' : 'Pro';
  const nextCap = memberCap <= 5 ? 20 : 50;

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
              {t('rooms.roomFull.hostNotice', {
                count: memberCount,
                cap: memberCap,
                nextTier,
                nextCap,
              })}
            </Text>
          </View>
        </View>

        {onUpgrade && (
          <Pressable
            onPress={onUpgrade}
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('rooms.roomFull.upgradeBtn')}
            testID="btn-room-full-upgrade"
          >
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>{t('rooms.roomFull.upgradeBtn')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Non-host member view: calm, plain notification
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
            <Pressable
              onPress={onClose}
              style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.paywall.close')}
              testID="btn-close-room-full-sheet"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
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
    borderRadius: 18,
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
    color: '#FFFFFF',
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
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
