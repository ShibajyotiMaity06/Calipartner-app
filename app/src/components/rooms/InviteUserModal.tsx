import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PublicUserProfile } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface InviteUserModalProps {
  visible: boolean;
  roomId: string;
  onClose: () => void;
  onSearchUsers: (prefix: string) => Promise<PublicUserProfile[]>;
  onSendInvitation: (roomId: string, username: string) => Promise<unknown>;
}

export function InviteUserModal({
  visible,
  roomId,
  onClose,
  onSearchUsers,
  onSendInvitation,
}: InviteUserModalProps) {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUsernames, setInvitedUsernames] = useState<Set<string>>(new Set());
  const [invitingUsername, setInvitingUsername] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounced user search
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const found = await onSearchUsers(clean);
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, onSearchUsers]);

  const handleInvite = async (user: PublicUserProfile) => {
    setInvitingUsername(user.username);
    setErrorMsg(null);
    try {
      await onSendInvitation(roomId, user.username);
      setInvitedUsernames((prev) => new Set(prev).add(user.username));
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      if (msg.includes('ROOM_FULL')) {
        setErrorMsg(t('rooms.roomFull.hostNotice'));
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setInvitingUsername(null);
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
                {t('rooms.inviteModal.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.inviteModal.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close invite modal"
              testID="btn-close-invite-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setErrorMsg(null);
              }}
              placeholder={t('rooms.inviteModal.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              testID="input-search-username"
            />
            {searching && <ActivityIndicator size="small" color={colors.accent} />}
          </View>

          {errorMsg && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          )}

          {/* Results List */}
          <View style={styles.listContainer}>
            {searchQuery.trim().length < 3 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.hintText, { color: colors.textMuted }]}>
                  {t('rooms.inviteModal.searchMinHint')}
                </Text>
              </View>
            ) : results.length === 0 && !searching ? (
              <View style={styles.emptyState}>
                <Text style={[styles.hintText, { color: colors.textMuted }]}>
                  {t('rooms.inviteModal.noUsersFound')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.username}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isInvited = invitedUsernames.has(item.username);
                  const isInviting = invitingUsername === item.username;

                  return (
                    <View style={[styles.userRow, { borderColor: colors.border }]}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.avatarInitial, { color: colors.text }]}>
                            {item.nickname.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.userInfo}>
                        <Text style={[styles.nickname, { color: colors.text }]}>{item.nickname}</Text>
                        <Text style={[styles.username, { color: colors.textMuted }]}>
                          @{item.username}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleInvite(item)}
                        disabled={isInvited || isInviting}
                        style={[
                          styles.inviteButton,
                          {
                            backgroundColor: isInvited ? colors.surfaceAlt : colors.accent,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Invite @${item.username}`}
                        testID={`btn-invite-user-${item.username}`}
                      >
                        {isInviting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : isInvited ? (
                          <Text style={[styles.inviteButtonText, { color: colors.syncSynced }]}>
                            {t('rooms.inviteModal.invited')}
                          </Text>
                        ) : (
                          <Text style={[styles.inviteButtonText, { color: '#FFFFFF' }]}>
                            {t('rooms.inviteModal.sendInviteBtn')}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </View>
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
    maxHeight: '85%',
    minHeight: 380,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
  },
  listContainer: {
    flex: 1,
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  hintText: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    gap: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  nickname: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  username: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  inviteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  inviteButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
