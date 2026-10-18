import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CoachConversation } from './types';

export interface CoachHistoryModalProps {
  visible: boolean;
  conversations: CoachConversation[];
  loading?: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onDeleteAllHistory: () => void;
}

export function CoachHistoryModal({
  visible,
  conversations,
  loading = false,
  onClose,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAllHistory,
}: CoachHistoryModalProps) {
  const { colors } = useTheme();

  const handleConfirmDeleteAll = () => {
    const runDelete = () => {
      onDeleteAllHistory();
    };

    if (Platform.OS === 'web') {
      const g = globalThis as unknown as { confirm?: (msg: string) => boolean };
      const confirmed =
        typeof g.confirm === 'function'
          ? g.confirm(t('coach.history.confirmMsg'))
          : true;
      if (confirmed) runDelete();
      return;
    }

    Alert.alert(
      t('coach.history.confirmTitle'),
      t('coach.history.confirmMsg'),
      [
        { text: t('coach.history.cancelBtn'), style: 'cancel' },
        {
          text: t('coach.history.confirmBtn'),
          style: 'destructive',
          onPress: runDelete,
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="modal-coach-history"
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.headerLeft}>
            <Text
              style={[styles.headerTitle, { color: colors.text }]}
              testID="text-coach-history-title"
            >
              {t('coach.history.title')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close history"
            testID="btn-close-coach-history"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Content list or empty state */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.emptyContainer} testID="view-coach-history-loading">
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Loading…
              </Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer} testID="view-coach-history-empty">
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colors.cardHighlight },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('coach.history.empty')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {t('coach.history.emptySub')}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {conversations.map((conv) => (
                <View
                  key={conv.id}
                  style={[
                    styles.conversationCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  testID={`card-coach-conv-${conv.id}`}
                >
                  <Pressable
                    style={styles.cardInfo}
                    onPress={() => {
                      onSelectConversation(conv.id);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open conversation: ${conv.title}`}
                    testID={`btn-select-conv-${conv.id}`}
                  >
                    <View style={styles.titleRow}>
                      <Text
                        style={[styles.cardTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {conv.title}
                      </Text>
                      <Text
                        style={[styles.cardDate, { color: colors.textMuted }]}
                      >
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardSnippet, { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {conv.lastMessageSnippet || 'No messages'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => onDeleteConversation(conv.id)}
                    style={styles.deleteItemBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('coach.history.deleteSession')}: ${conv.title}`}
                    testID={`btn-delete-conv-${conv.id}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.danger}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom actions: Delete all history */}
        {conversations.length > 0 && (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={handleConfirmDeleteAll}
              style={[
                styles.deleteAllBtn,
                { borderColor: colors.danger },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('coach.history.deleteAll')}
              testID="btn-delete-all-history"
            >
              <Ionicons
                name="trash-bin-outline"
                size={18}
                color={colors.danger}
              />
              <Text
                style={[styles.deleteAllBtnText, { color: colors.danger }]}
              >
                {t('coach.history.deleteAll')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    marginTop: 4,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: fontSize.sm + 1,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  cardDate: {
    fontSize: fontSize.xs,
  },
  cardSnippet: {
    fontSize: fontSize.xs + 1,
    lineHeight: 18,
  },
  deleteItemBtn: {
    padding: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  deleteAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  deleteAllBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
