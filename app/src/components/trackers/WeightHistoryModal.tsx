import { Text, homeLayout, useReducedMotion } from '@calipartner/ui';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { weeklyWeightHistory, type WeightLog } from '@calipartner/core';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface WeightHistoryModalProps {
  visible: boolean;
  entries: WeightLog[];
  weekly?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  onEditEntry: (entry: WeightLog) => void;
  onDeleteEntry: (id: string) => Promise<unknown>;
}

export function WeightHistoryModal({
  visible,
  entries,
  weekly = false,
  loading = false,
  error = null,
  onRetry,
  onClose,
  onEditEntry,
  onDeleteEntry,
}: WeightHistoryModalProps) {
  const { localDate } = useCurrentLocalDate();
  const reduceMotion = useReducedMotion();
  const displayedEntries = weekly ? weeklyWeightHistory(entries, localDate) : entries;
  const { colors } = useTheme();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePrompt = (id: string) => {
    Alert.alert(
      t('common.delete'),
      t('trackers.weight.confirmDelete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(id);
              await onDeleteEntry(id);
            } catch {
              Alert.alert(t('common.errorTitle'), t('common.errorBody'));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
      testID="modal-weight-history"
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="time-outline" size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {t(weekly ? 'weightUpdate.progress' : 'trackers.weight.historyButton')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {weekly && <Text>{t('weightUpdate.weeklyHint')}</Text>}
          {/* List or Empty State */}
          <ScrollView
            testID="list-weight-history"
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <Text>{t('common.loading')}</Text>
            ) : error ? (
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                testID="weight-history-retry"
              >
                <Text accessibilityRole="alert">
                  {t('common.errorBody')} {t('common.retry')}
                </Text>
              </Pressable>
            ) : displayedEntries.length === 0 ? (
              <View style={styles.emptyContainer} testID="weight-history-empty">
                <Ionicons name="scale-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('trackers.weight.emptyHistory')}
                </Text>
              </View>
            ) : (
              displayedEntries.map((item) => {
                const isDeleting = deletingId === item.id;

                return (
                  <View
                    key={item.id}
                    testID={`item-weight-log-${item.id}`}
                    style={[
                      styles.itemCard,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.itemInfo}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemWeight, { color: colors.text }]}>
                          {item.weight_kg.toFixed(1)} kg
                        </Text>
                        <Text style={[styles.itemDate, { color: colors.textMuted }]}>
                          {item.local_date}
                        </Text>
                      </View>

                      {item.notes ? (
                        <Text style={[styles.itemNotes, { color: colors.textMuted }]}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.itemActions}>
                      <Pressable
                        testID={`btn-edit-weight-${item.id}`}
                        onPress={() => onEditEntry(item)}
                        disabled={isDeleting}
                        hitSlop={8}
                        style={styles.iconBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t('trackers.weight.editModalTitle')}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                      </Pressable>

                      <Pressable
                        testID={`btn-delete-weight-${item.id}`}
                        onPress={() => handleDeletePrompt(item.id)}
                        disabled={isDeleting}
                        hitSlop={8}
                        style={styles.iconBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={[
              styles.closeBtn,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={[styles.closeBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  scrollList: {
    maxHeight: 360,
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
  },
  itemWeight: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  itemDate: {
    fontSize: fontSize.xs,
  },
  itemNotes: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.sm,
  },
  iconBtn: {
    minWidth: homeLayout.compactTouchSize,
    minHeight: homeLayout.compactTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  closeBtn: {
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  closeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
