import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface FoodPhotoAnalyzingOverlayProps {
  visible: boolean;
  onCancel?: () => void;
}

const HINT_STEPS = ['foodLog.photo.analyzingSubtitle', 'foodLog.photo.analyzingHint'] as const;

export function FoodPhotoAnalyzingOverlay({ visible, onCancel }: FoodPhotoAnalyzingOverlayProps) {
  const { colors } = useTheme();
  const [currentHintIdx, setCurrentHintIdx] = useState(0);

  useEffect(() => {
    if (!visible) {
      setCurrentHintIdx(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentHintIdx((prev) => (prev + 1) % HINT_STEPS.length);
    }, 2800);

    return () => clearInterval(interval);
  }, [visible]);

  return (
    <Modal
      testID="modal-food-photo-analyzing"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          testID="card-food-photo-analyzing"
          style={[
            styles.container,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Pulsing Visual / Sparkles Wrap */}
          <View style={[styles.sparkleWrap, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="sparkles" size={36} color={colors.accent} />
          </View>

          <ActivityIndicator
            testID="spinner-food-photo-analyzing"
            size="large"
            color={colors.accent}
            style={{ marginVertical: spacing.sm }}
          />

          <Text testID="text-analyzing-title" style={[styles.title, { color: colors.text }]}>
            {t('foodLog.photo.analyzingTitle')}
          </Text>

          <Text
            testID="text-analyzing-subtitle"
            style={[styles.subtitle, { color: colors.textMuted }]}
          >
            {t(HINT_STEPS[currentHintIdx] || 'foodLog.photo.analyzingSubtitle')}
          </Text>

          {/* Privacy Footnote Badge */}
          <View
            style={[
              styles.privacyBadge,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
            <Text style={[styles.privacyBadgeText, { color: colors.textMuted }]}>
              {t('foodLog.photo.analyzingHint')}
            </Text>
          </View>

          {onCancel && (
            <Pressable
              testID="btn-cancel-analyzing"
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  sparkleWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  privacyBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
