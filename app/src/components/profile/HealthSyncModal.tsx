import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import {
  disconnectNativeHealth,
  getNativeHealthPermission,
  requestNativeHealthPermission,
  openNativeHealthSettings,
} from '@/services/nativeHealthService';

export interface HealthSyncModalProps {
  visible: boolean;
  onClose: () => void;
  isConnected?: boolean;
  lastSyncedAt?: string;
  onToggleConnection?: (connect: boolean) => Promise<void> | void;
  testID?: string;
}

export function HealthSyncModal({
  visible,
  onClose,
  isConnected,
  lastSyncedAt,
  onToggleConnection,
  testID = 'modal-health-sync',
}: HealthSyncModalProps) {
  const [connected, setConnected] = useState<boolean>(isConnected ?? false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (visible)
      void getNativeHealthPermission().then((status) => {
        if (active) setConnected(isConnected ?? status === 'granted');
      });
    return () => {
      active = false;
    };
  }, [visible, isConnected]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);

  const handleToggle = async () => {
    playClickSound();
    setLoading(true);
    const next = !connected;
    setError(null);
    try {
      if (onToggleConnection) {
        await onToggleConnection(next);
        setConnected(next);
      } else if (!next) {
        await disconnectNativeHealth();
        setConnected(false);
      } else {
        const status = await requestNativeHealthPermission();
        setConnected(status === 'granted');
        if (status !== 'granted') setError(t('capture.healthPermissionHelp'));
      }
    } catch {
      setError(t('capture.healthPermissionHelp'));
    } finally {
      setLoading(false);
    }
  };

  const handleFixStepCounting = () => {
    playClickSound();
    setShowTroubleshoot((prev) => !prev);
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
              testID="btn-close-health-sync"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.healthSync.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t(Platform.OS === 'web' ? 'capture.webSteps' : 'capture.healthSteps')}
            </Text>

            {/* Status Card */}
            <Card elevation="s1" style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View>
                  <Text variant="heading" color={dark.textHi}>
                    {connected
                      ? t('me.healthSync.statusConnected')
                      : t('me.healthSync.statusDisconnected')}
                  </Text>
                  <Text variant="micro" color={dark.textLo} style={styles.syncTime}>
                    {lastSyncedAt
                      ? t('me.healthSync.lastSynced', { time: lastSyncedAt })
                      : t('trackers.steps.noReading')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: connected ? dark.mint : dark.textOff },
                  ]}
                >
                  <Text variant="micro" color={dark.onBrand} style={styles.statusPillText}>
                    {connected ? 'ACTIVE' : 'OFFLINE'}
                  </Text>
                </View>
              </View>

              <Button
                variant={connected ? 'secondary' : 'primary'}
                label={
                  loading
                    ? 'Updating…'
                    : connected
                      ? t('me.healthSync.disconnectBtn')
                      : t('me.healthSync.connectBtn')
                }
                onPress={handleToggle}
                disabled={loading || Platform.OS === 'web'}
                testID="btn-toggle-health-sync"
                style={styles.connectButton}
              />
              {error && (
                <Text variant="bodyS" accessibilityRole="alert" testID="health-sync-error">
                  {error}
                </Text>
              )}
              {Platform.OS !== 'web' && (
                <Button
                  variant="secondary"
                  label={t('capture.healthSettings')}
                  onPress={() => {
                    void openNativeHealthSettings().catch(() =>
                      setError(t('capture.healthPermissionHelp')),
                    );
                  }}
                  testID="health-open-settings"
                />
              )}
            </Card>

            {/* Data Permissions List */}
            <Card elevation="s1" style={styles.permissionsCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.healthSync.readsHeader')}
              </Text>

              <View style={styles.permissionItem}>
                <Text variant="bodyS" color={dark.textHi}>
                  • {t('me.healthSync.readSteps')}
                </Text>
              </View>
              <View style={styles.permissionItem}>
                <Text variant="bodyS" color={dark.textHi}>
                  • {t('capture.readDistance')}
                </Text>
              </View>
            </Card>

            {/* Fix Step Counting Section (E04) */}
            <TouchableOpacity
              onPress={handleFixStepCounting}
              style={styles.fixStepsButton}
              accessibilityRole="button"
              accessibilityLabel={t('me.healthSync.fixStepsBtn')}
              testID="btn-fix-step-counting"
            >
              <Text variant="label" color={dark.apricot}>
                {t('me.healthSync.fixStepsBtn')}
              </Text>
            </TouchableOpacity>

            {showTroubleshoot && (
              <Card elevation="s2" style={styles.troubleshootCard} testID="card-fix-steps-guide">
                <Text variant="heading" color={dark.textHi} style={styles.guideTitle}>
                  Step counting troubleshooting (E04):
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.guideStep}>
                  1. Check device Settings → Privacy & Security → Motion & Fitness and verify
                  CaliPartner is allowed.
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.guideStep}>
                  2. Ensure battery saver is not aggressively killing background pedometer sensors.
                </Text>
                <Text variant="bodyS" color={dark.textMid} style={styles.guideStep}>
                  3. If using Health Connect or Apple Health, confirm &quot;Steps&quot; has read
                  permission enabled.
                </Text>
              </Card>
            )}
          </ScrollView>
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
    padding: space[4],
  },
  introSubtitle: {
    marginBottom: space[4],
  },
  statusCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[4],
  },
  syncTime: {
    marginTop: space[1],
  },
  statusPill: {
    paddingHorizontal: space[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontWeight: '700',
  },
  connectButton: {
    width: '100%',
  },
  permissionsCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  sectionLabel: {
    marginBottom: space[3],
  },
  permissionItem: {
    marginBottom: space[2],
  },
  fixStepsButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space[2],
  },
  troubleshootCard: {
    padding: space[4],
    marginTop: space[2],
  },
  guideTitle: {
    marginBottom: space[2],
  },
  guideStep: {
    marginBottom: space[2],
    lineHeight: 20,
  },
});
