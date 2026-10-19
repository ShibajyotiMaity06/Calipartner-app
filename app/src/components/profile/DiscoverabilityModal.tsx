import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  SegmentedControl,
  space,
  Text,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface BlockedUser {
  id: string;
  username: string;
  nickname: string;
}

export interface DiscoverabilityModalProps {
  visible: boolean;
  onClose: () => void;
  discoverable?: boolean;
  onUpdateDiscoverable?: (value: boolean) => Promise<void> | void;
  blockedUsers?: BlockedUser[];
  onUnblockUser?: (userId: string) => Promise<void> | void;
  testID?: string;
}

export function DiscoverabilityModal({
  visible,
  onClose,
  discoverable = true,
  onUpdateDiscoverable,
  blockedUsers = [],
  onUnblockUser,
  testID = 'modal-discoverability',
}: DiscoverabilityModalProps) {
  const [isDiscoverable, setIsDiscoverable] = useState<boolean>(discoverable);
  const [users, setUsers] = useState<BlockedUser[]>(blockedUsers);

  const handleToggle = async (id: string) => {
    const nextVal = id === 'everyone';
    setIsDiscoverable(nextVal);
    playClickSound();
    if (onUpdateDiscoverable) {
      await onUpdateDiscoverable(nextVal);
    }
  };

  const handleUnblock = async (userId: string) => {
    playClickSound();
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (onUnblockUser) {
      await onUnblockUser(userId);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-discoverability"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.discoverability.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.discoverability.subtitle')}
            </Text>

            {/* Discoverability option */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.discoverability.findLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'everyone', label: t('me.discoverability.everyone') },
                  { value: 'nobody', label: t('me.discoverability.nobody') },
                ]}
                value={isDiscoverable ? 'everyone' : 'nobody'}
                onChange={handleToggle}
                testID="segment-discoverable-setting"
              />
              <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                {isDiscoverable
                  ? 'People can search your @username to send room invitations or partner requests.'
                  : 'Your account is hidden from search. People can only invite you via invite link or room code.'}
              </Text>
            </Card>

            {/* Blocked Users Section */}
            <View style={styles.blockedSection}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.discoverability.blockedHeader')}
              </Text>

              {users.length === 0 ? (
                <Card elevation="s2" style={styles.emptyCard}>
                  <Text variant="bodyS" color={dark.textMid}>
                    {t('me.discoverability.noBlocked')}
                  </Text>
                </Card>
              ) : (
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Card elevation="s1" style={styles.blockedRow}>
                      <View>
                        <Text variant="heading" color={dark.textHi}>
                          {item.nickname}
                        </Text>
                        <Text variant="micro" color={dark.textLo}>
                          @{item.username}
                        </Text>
                      </View>
                      <Button
                        variant="secondary"
                        size="sm"
                        label={t('me.discoverability.unblockBtn')}
                        onPress={() => handleUnblock(item.id)}
                        testID={`btn-unblock-${item.id}`}
                      />
                    </Card>
                  )}
                />
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: space[4],
  },
  introSubtitle: {
    marginBottom: space[4],
  },
  sectionCard: {
    padding: space[4],
    marginBottom: space[6],
  },
  sectionLabel: {
    marginBottom: space[2],
  },
  helperText: {
    marginTop: space[2],
    lineHeight: 18,
  },
  blockedSection: {
    flex: 1,
  },
  emptyCard: {
    padding: space[4],
  },
  blockedRow: {
    padding: space[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
});
