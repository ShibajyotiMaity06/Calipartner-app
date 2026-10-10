import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WaterLog } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface WaterHistoryModalProps {
  visible: boolean;
  logs: WaterLog[];
  onClose: () => void;
  onUpdate: (id: string, amountMl: number) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export function WaterHistoryModal({
  visible,
  logs,
  onClose,
  onUpdate,
  onDelete,
}: WaterHistoryModalProps) {
  const { colors } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmountText, setEditAmountText] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const startEdit = (log: WaterLog) => {
    setEditingId(log.id);
    setEditAmountText(String(log.amount_ml));
  };

  const handleSaveEdit = async (id: string) => {
    const parsed = parseInt(editAmountText.trim(), 10);
    if (isNaN(parsed) || parsed < 10 || parsed > 5000) {
      Alert.alert(t('common.errorTitle'), t('trackers.water.invalidAmount'));
      return;
    }

    try {
      setLoadingAction(id);
      await onUpdate(id, parsed);
      setEditingId(null);
    } catch {
      Alert.alert(t('common.errorTitle'), t('common.errorBody'));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeletePrompt = (id: string) => {
    Alert.alert(
      t('common.delete'),
      t('trackers.water.confirmDelete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction(id);
              await onDelete(id);
            } catch {
              Alert.alert(t('common.errorTitle'), t('common.errorBody'));
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="modal-water-history"
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="time-outline" size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {t('trackers.water.todayLogs')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* List or Empty State */}
          <ScrollView
            testID="list-water-history"
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {logs.length === 0 ? (
              <View style={styles.emptyContainer} testID="water-history-empty">
                <Ionicons name="water-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('trackers.water.emptyHistory')}
                </Text>
              </View>
            ) : (
              logs.map((log) => {
                const isEditing = editingId === log.id;
                const isBusy = loadingAction === log.id;

                return (
                  <View
                    key={log.id}
                    testID={`item-water-log-${log.id}`}
                    style={[
                      styles.logItem,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          testID={`input-edit-water-${log.id}`}
                          value={editAmountText}
                          onChangeText={setEditAmountText}
                          keyboardType="numeric"
                          style={[
                            styles.editInput,
                            {
                              color: colors.text,
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                            },
                          ]}
                          accessibilityLabel={t('trackers.water.amountLabel')}
                        />
                        <Text style={[styles.mlSuffix, { color: colors.textMuted }]}>ml</Text>
                        <Pressable
                          testID={`btn-save-edit-water-${log.id}`}
                          onPress={() => void handleSaveEdit(log.id)}
                          disabled={isBusy}
                          style={[styles.smallBtn, { backgroundColor: colors.accent }]}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.save')}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.onAccent} />
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingId(null)}
                          disabled={isBusy}
                          style={[styles.smallBtn, { backgroundColor: colors.surface }]}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.cancel')}
                        >
                          <Ionicons name="close" size={16} color={colors.text} />
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <View style={styles.logInfo}>
                          <Text style={[styles.logAmount, { color: colors.text }]}>
                            {log.amount_ml} ml
                          </Text>
                          <Text style={[styles.logTime, { color: colors.textMuted }]}>
                            {formatLogTime(log.logged_at)}
                          </Text>
                        </View>

                        <View style={styles.itemActions}>
                          <Pressable
                            testID={`btn-edit-water-${log.id}`}
                            onPress={() => startEdit(log)}
                            disabled={isBusy}
                            hitSlop={8}
                            style={styles.iconBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t('trackers.water.editEntryTitle')}
                          >
                            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                          </Pressable>

                          <Pressable
                            testID={`btn-delete-water-${log.id}`}
                            onPress={() => handleDeletePrompt(log.id)}
                            disabled={isBusy}
                            hitSlop={8}
                            style={styles.iconBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.delete')}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
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
    maxHeight: '75%',
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
    maxHeight: 320,
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
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  logInfo: {
    gap: 2,
  },
  logAmount: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  logTime: {
    fontSize: fontSize.xs,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBtn: {
    padding: 4,
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    width: 80,
    height: 38,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  mlSuffix: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  smallBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
