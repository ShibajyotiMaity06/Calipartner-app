import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ChatTermsModalProps {
  visible: boolean;
  onAccept: () => Promise<void>;
  onClose: () => void;
  testID?: string;
}

export function ChatTermsModal({
  visible,
  onAccept,
  onClose,
  testID = 'chat-terms-modal',
}: ChatTermsModalProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(false);
  const handleAgree = async () => {
    setLoading(true);
    setError(false);
    try {
      await onAccept();
      onClose();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheetContainer, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handleIndicator, { backgroundColor: colors.border }]} />

          <View style={[styles.headerIconCircle, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t('chat.termsTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('chat.termsSubtitle')}
          </Text>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {t('chatAudit.actionError')}
            </Text>
          ) : null}
          {/* Guideline Bullet 1 */}
          <View style={styles.guidelineRow}>
            <Ionicons
              name="heart-outline"
              size={20}
              color={colors.accent}
              style={styles.bulletIcon}
            />
            <Text style={[styles.bulletText, { color: colors.text }]}>{t('chat.term1')}</Text>
          </View>

          {/* Guideline Bullet 2 */}
          <View style={styles.guidelineRow}>
            <Ionicons
              name="nutrition-outline"
              size={20}
              color={colors.accent}
              style={styles.bulletIcon}
            />
            <Text style={[styles.bulletText, { color: colors.text }]}>{t('chat.term2')}</Text>
          </View>

          {/* Guideline Bullet 3 */}
          <View style={styles.guidelineRow}>
            <Ionicons
              name="close-circle-outline"
              size={20}
              color={colors.accent}
              style={styles.bulletIcon}
            />
            <Text style={[styles.bulletText, { color: colors.text }]}>{t('chat.term3')}</Text>
          </View>

          <Text style={[styles.bulletText, { color: colors.text }]}>
            {t('chatAudit.moderationNotice')}
          </Text>
          {/* Accept button */}
          <Pressable
            onPress={handleAgree}
            disabled={loading}
            style={[styles.agreeButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.termAgreeBtn')}
            testID="btn-accept-chat-terms"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.agreeButtonText}>{t('chat.termAgreeBtn')}</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + spacing.md,
    alignItems: 'center',
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
  bulletIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  bulletText: {
    fontSize: fontSize.xs,
    lineHeight: 19,
    flex: 1,
  },
  agreeButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
