import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeftIcon,
  HeartIcon,
  LinkButton,
  PrimaryButton,
  SecondaryButton,
  Switch,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import {
  disconnectNativeHealth,
  getHealthSyncPreferences,
  getNativeHealthPermission,
  openNativeHealthSettings,
  requestNativeHealthPermission,
  setHealthSyncPreferences,
  type HealthSyncPreferences,
} from '@/services/nativeHealthService';

export interface HealthSyncModalProps {
  visible: boolean;
  onClose: () => void;
  isConnected?: boolean;
  lastSyncedAt?: string;
  onToggleConnection?: (connect: boolean) => Promise<void> | void;
  onSyncNow?: () => Promise<void> | void;
  testID?: string;
}

function formatSyncedRelative(iso?: string): string {
  if (!iso) return t('settingsV1.healthConnectedNow');
  const diffMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return t('settingsV1.healthConnectedTime', { time: 'just now' });
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return t('settingsV1.healthConnectedTime', { time: `${mins} min ago` });
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return t('settingsV1.healthConnectedTime', { time: `${hrs}h ago` });
  }
  return t('settingsV1.healthConnectedTime', { time: `${Math.floor(hrs / 24)}d ago` });
}

export function HealthSyncModal({
  visible,
  onClose,
  isConnected,
  lastSyncedAt,
  onToggleConnection,
  onSyncNow,
  testID = 'modal-health-sync',
}: HealthSyncModalProps) {
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState<boolean>(isConnected ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [prefs, setPrefs] = useState<HealthSyncPreferences>({
    steps: true,
    weight: true,
    workouts: true,
  });

  useEffect(() => {
    let active = true;
    if (!visible) return;
    void Promise.all([getNativeHealthPermission(), getHealthSyncPreferences()]).then(
      ([status, savedPrefs]) => {
        if (!active) return;
        setConnected(isConnected ?? status === 'granted');
        setPrefs(savedPrefs);
      },
    );
    return () => {
      active = false;
    };
  }, [visible, isConnected]);

  const handlePrimaryAction = async () => {
    if (loading) return;
    playClickSound();
    setLoading(true);
    setError(null);
    try {
      if (connected && onSyncNow) {
        await onSyncNow();
      } else if (onToggleConnection) {
        await onToggleConnection(true);
        setConnected(true);
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

  const handleSecondaryAction = async () => {
    if (loading) return;
    playClickSound();
    setLoading(true);
    setError(null);
    try {
      if (connected) {
        if (onToggleConnection) {
          await onToggleConnection(false);
        } else {
          await disconnectNativeHealth();
        }
        setConnected(false);
      } else if (Platform.OS !== 'web') {
        await openNativeHealthSettings();
      } else {
        setError(t('capture.webSteps'));
      }
    } catch {
      setError(t('capture.healthPermissionHelp'));
    } finally {
      setLoading(false);
    }
  };

  const togglePref = async (key: keyof HealthSyncPreferences, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await setHealthSyncPreferences(next);
  };

  const platformName =
    Platform.OS === 'android' ? t('settingsV1.healthAndroid') : t('settingsV1.healthApple');

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root} testID={testID}>
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={onClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.back')}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
            testID="btn-close-health-sync"
          >
            <ChevronLeftIcon size={18} color={colors.textHi} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('settingsV1.healthTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(space.xxl, insets.bottom + space.xl) },
          ]}
        >
          <View style={styles.innerWrap}>
            {/* Connection status card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={styles.heartTile}>
                  <HeartIcon size={20} color={colors.textMid} />
                </View>
                <View style={styles.statusCopy}>
                  <Text variant="rowTitle" color="textHi" style={styles.providerTitle}>
                    {platformName}
                  </Text>
                  <View style={styles.dotRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: connected ? colors.apricot : colors.textOff },
                      ]}
                    />
                    <Text variant="meta" color={connected ? 'textLo' : 'textMid'}>
                      {connected
                        ? formatSyncedRelative(lastSyncedAt)
                        : t('settingsV1.healthDisconnected')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <View style={styles.halfBtn}>
                  <PrimaryButton
                    title={
                      loading
                        ? t('common.saving')
                        : connected
                          ? t('settingsV1.healthSyncNow')
                          : t('settingsV1.healthConnect')
                    }
                    compact
                    loading={loading}
                    disabled={loading || Platform.OS === 'web'}
                    onPress={() => void handlePrimaryAction()}
                    testID="btn-toggle-health-sync"
                    style={styles.fullWidthAction}
                  />
                </View>
                <View style={styles.halfBtn}>
                  <SecondaryButton
                    title={
                      connected ? t('settingsV1.healthDisconnect') : t('settingsV1.healthOpenApp')
                    }
                    size="compact48"
                    disabled={loading}
                    onPress={() => void handleSecondaryAction()}
                    testID="health-open-settings"
                  />
                </View>
              </View>

              {error ? (
                <Text
                  variant="meta"
                  color="danger"
                  accessibilityRole="alert"
                  testID="health-sync-error"
                >
                  {error}
                </Text>
              ) : null}
            </View>

            {/* WHAT TO SYNC */}
            <View style={styles.sectionBlock}>
              <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                {t('settingsV1.healthWhatToSync')}
              </Text>
              <View style={styles.cardBox}>
                <View style={[styles.row, styles.rowDivider]}>
                  <View style={styles.rowText}>
                    <Text variant="label" color="textHi" style={styles.rowTitle}>
                      {t('settingsV1.healthSteps')}
                    </Text>
                    <Text variant="meta" color="textLo">
                      {t('settingsV1.healthReadWrite')}
                    </Text>
                  </View>
                  <Switch
                    value={prefs.steps}
                    onValueChange={(v) => void togglePref('steps', v)}
                    accessibilityLabel={t('settingsV1.healthSteps')}
                    testID="switch-health-steps"
                  />
                </View>

                <View style={[styles.row, styles.rowDivider]}>
                  <View style={styles.rowText}>
                    <Text variant="label" color="textHi" style={styles.rowTitle}>
                      {t('settingsV1.healthWeight')}
                    </Text>
                    <Text variant="meta" color="textLo">
                      {t('settingsV1.healthReadWrite')}
                    </Text>
                  </View>
                  <Switch
                    value={prefs.weight}
                    onValueChange={(v) => void togglePref('weight', v)}
                    accessibilityLabel={t('settingsV1.healthWeight')}
                    testID="switch-health-weight"
                  />
                </View>

                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text variant="label" color="textHi" style={styles.rowTitle}>
                      {t('settingsV1.healthWorkouts')}
                    </Text>
                    <Text variant="meta" color="textLo">
                      {t('settingsV1.healthReadOnly')}
                    </Text>
                  </View>
                  <Switch
                    value={prefs.workouts}
                    onValueChange={(v) => void togglePref('workouts', v)}
                    accessibilityLabel={t('settingsV1.healthWorkouts')}
                    testID="switch-health-workouts"
                  />
                </View>
              </View>
            </View>

            <Text variant="micro" color="textLo" style={styles.footnote}>
              {t('settingsV1.healthFootnote')}
            </Text>

            <LinkButton
              title={t('me.healthSync.fixStepsBtn')}
              onPress={() => {
                playClickSound();
                setShowTroubleshoot((v) => !v);
              }}
              testID="btn-fix-step-counting"
              style={styles.troubleshootLink}
            />

            {showTroubleshoot ? (
              <View style={styles.troubleshootCard} testID="card-fix-steps-guide">
                <Text variant="meta" color="textMid">
                  1. Check device Settings → Privacy & Security → Motion & Fitness and allow
                  CaliPartner.
                </Text>
                <Text variant="meta" color="textMid">
                  2. Keep Health Connect / Apple Health read permission enabled for Steps.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  statusCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  heartTile: {
    width: 46,
    height: 46,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
    gap: 3,
  },
  providerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  halfBtn: {
    flex: 1,
  },
  fullWidthAction: {
    alignSelf: 'stretch',
  },
  sectionBlock: {
    gap: space.xs + 2,
    marginTop: space.xs,
  },
  eyebrow: {
    paddingHorizontal: 2,
  },
  cardBox: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    minHeight: 58,
    gap: space.md,
  },
  rowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  footnote: {
    lineHeight: 18,
  },
  troubleshootLink: {
    alignSelf: 'flex-start',
  },
  troubleshootCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
});
