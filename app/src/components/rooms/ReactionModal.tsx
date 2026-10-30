import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMemberSnapshot, RoomReactionType } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ReactionModalProps {
  visible: boolean;
  targetMember: RoomMemberSnapshot | null;
  onClose: () => void;
  onSendReaction: (reaction: RoomReactionType) => Promise<unknown>;
}

export function ReactionModal({
  visible,
  targetMember,
  onClose,
  onSendReaction,
}: ReactionModalProps) {
  const { colors } = useTheme();

  const reactionOptions: {
    type: RoomReactionType;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }[] = [
    { type: 'clap', icon: 'hand-left-outline', label: t('rooms.reactionModal.clap') },
    { type: 'fire', icon: 'flame-outline', label: t('rooms.reactionModal.fire') },
    { type: 'muscle', icon: 'barbell-outline', label: t('rooms.reactionModal.muscle') },
    { type: 'heart', icon: 'heart-outline', label: t('rooms.reactionModal.heart') },
    { type: 'party', icon: 'balloon-outline', label: t('rooms.reactionModal.party') },
  ];

  const [selectedReaction, setSelectedReaction] = useState<RoomReactionType>('fire');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const handleSend = async () => {
    setError(null);
    setLoading(true);
    try {
      await onSendReaction(selectedReaction);
      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        onClose();
      }, 1000);
    } catch (error) {
      setError(
        t(
          String(error).includes('NO_SHARED_ACTIVITY')
            ? 'roomAudit.noActivity'
            : 'roomAudit.actionError',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('rooms.reactionModal.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.reactionModal.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close reaction modal"
              testID="btn-close-reaction-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Recipient info pill */}
          {targetMember && (
            <View style={[styles.targetPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.targetLabel, { color: colors.textMuted }]}>For:</Text>
              <Text style={[styles.targetName, { color: colors.text }]}>
                {targetMember.nickname}
              </Text>
            </View>
          )}

          {/* Reactions Grid */}
          <View style={styles.reactionsGrid}>
            {reactionOptions.map((opt) => {
              const isSelected = selectedReaction === opt.type;
              return (
                <Pressable
                  key={opt.type}
                  onPress={() => setSelectedReaction(opt.type)}
                  style={[
                    styles.reactionButton,
                    {
                      backgroundColor: isSelected ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  testID={`reaction-btn-${opt.type}`}
                >
                  <Ionicons name={opt.icon} size={24} color={colors.text} accessible={false} />
                  <Text style={[styles.reactionLabel, { color: colors.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={loading}
            style={[styles.sendButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Send reaction"
            testID="btn-submit-reaction"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>
                {successToast
                  ? t('rooms.reactionModal.sentToast')
                  : t('rooms.reactionModal.sendBtn')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    gap: 6,
  },
  targetLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  targetName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  reactionsGrid: {
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  reactionEmoji: {
    fontSize: 22,
  },
  reactionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sendButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
