import { visualPrimitives } from '@calipartner/ui/tokens';
import { Button, Text, useReduceTransparency } from '@calipartner/ui';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import {
  getNotificationPermissionStatus,
  type NotificationPromptContext,
  requestNotificationPermissions,
} from '@/services/notificationPermissionService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface NotificationPrimerModalProps {
  visible: boolean;
  context?: NotificationPromptContext;
  isGlass?: boolean;
  onGranted?: () => void;
  onDismiss: () => void;
  testID?: string;
}

export function NotificationPrimerModal({
  visible,
  context = 'settings_manual',
  isGlass = false,
  onGranted,
  onDismiss,
  testID = 'notification-primer-modal',
}: NotificationPrimerModalProps) {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const isGlassActive = isGlass && !reduceTransparency;
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<Notifications.PermissionStatus>(
    Notifications.PermissionStatus.UNDETERMINED,
  );

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    getNotificationPermissionStatus().then((currentStatus) => {
      if (mounted) setStatus(currentStatus);
    });
    return () => {
      mounted = false;
    };
  }, [visible]);

  const handleRequestPermission = async () => {
    try {
      setRequesting(true);
      const granted = await requestNotificationPermissions(context);
      if (granted) {
        onGranted?.();
        onDismiss();
      } else {
        const nextStatus = await getNotificationPermissionStatus();
        setStatus(nextStatus);
        if (nextStatus !== Notifications.PermissionStatus.DENIED) {
          onDismiss();
        }
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch {
      // Fallback
    }
    onDismiss();
  };

  const isDenied = status === Notifications.PermissionStatus.DENIED;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            isGlassActive
              ? styles.glassCard
              : {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
          ]}
        >
          {isGlassActive && <View pointerEvents="none" style={styles.glassHighlight} />}
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={isDenied ? 'notifications-off-outline' : 'notifications-outline'}
              size={36}
              color={colors.accent}
            />
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: colors.text }]}>
            {isDenied
              ? t('notifications.permission.deniedTitle')
              : t('notifications.permission.primerTitle')}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isDenied
              ? t('notifications.permission.deniedSubtitle')
              : t('notifications.permission.primerSubtitle')}
          </Text>

          {/* Bullet points for primer */}
          {!isDenied && (
            <View style={styles.bulletsContainer}>
              <View style={styles.bulletRow}>
                <Ionicons name="people-outline" size={18} color={colors.accent} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('notifications.permission.primerBulletNudges')}
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <Ionicons name="water-outline" size={18} color={colors.waterInk} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('notifications.permission.primerBulletReminders')}
                </Text>
              </View>

              <View style={styles.bulletRow}>
                <Ionicons name="flame-outline" size={18} color={colors.accent} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  {t('notifications.permission.primerBulletStreaks')}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isDenied ? (
              <Button
                variant="secondary"
                fullWidth={false}
                label={t('notifications.permission.openSettingsButton')}
                testID="btn-open-settings"
                accessibilityRole="button"
                accessibilityLabel={t('notifications.permission.openSettingsButton')}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                onPress={handleOpenSettings}
              />
            ) : (
              <Pressable
                testID="btn-enable-notifications"
                accessibilityRole="button"
                accessibilityLabel={t('notifications.permission.enableButton')}
                disabled={requesting}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.accent, opacity: requesting ? 0.7 : 1 },
                ]}
                onPress={handleRequestPermission}
              >
                {requesting ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent }]}>
                    {t('notifications.permission.enableButton')}
                  </Text>
                )}
              </Pressable>
            )}

            <Button
              variant="secondary"
              fullWidth={false}
              label={t('notifications.permission.maybeLaterButton')}
              testID="btn-dismiss-primer"
              accessibilityRole="button"
              accessibilityLabel={t('notifications.permission.maybeLaterButton')}
              style={[
                styles.secondaryButton,
                { borderColor: colors.border, backgroundColor: 'transparent' },
              ]}
              onPress={onDismiss}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    position: 'relative',
  },
  glassCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderBottomColor: 'rgba(0, 0, 0, 0.45)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(22, 19, 16, 0.68)' : 'rgba(26, 21, 17, 0.78)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(32px) saturate(190%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%) brightness(1.05)',
        } as unknown as ViewStyle)
      : {}),
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: radius.full,
    zIndex: 1,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: visualPrimitives.radii[36],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bulletsContainer: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulletText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
