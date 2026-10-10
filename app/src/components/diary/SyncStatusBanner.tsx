import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function SyncStatusBanner() {
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { uiState, pendingCount, triggerSync } = useSyncStatus();

  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
      {/* Offline Mode Banner */}
      {!isOnline && (
        <View
          testID="banner-offline-mode"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs + 2,
            gap: spacing.xs,
          }}
        >
          <Ionicons name="cloud-offline-outline" size={16} color={colors.syncPending} />
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              fontWeight: '500',
              flex: 1,
            }}
          >
            {t('diary.offlineBanner')}
          </Text>
        </View>
      )}

      {/* Sync Status Chip / Action */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {uiState === 'syncing' ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : uiState === 'synced' ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
          ) : uiState === 'failed' ? (
            <Ionicons name="alert-circle" size={16} color={colors.syncFailed} />
          ) : (
            <Ionicons name="time-outline" size={16} color={colors.syncPending} />
          )}

          <Text
            testID="text-sync-status"
            style={{
              fontSize: fontSize.xs,
              color:
                uiState === 'synced'
                  ? colors.syncSynced
                  : uiState === 'failed'
                    ? colors.syncFailed
                    : colors.textMuted,
              fontWeight: '600',
            }}
          >
            {uiState === 'syncing'
              ? t('diary.sync.syncing')
              : uiState === 'synced'
                ? t('diary.sync.synced')
                : uiState === 'failed'
                  ? t('diary.sync.failed')
                  : t('diary.sync.pending', { count: pendingCount })}
          </Text>
        </View>

        {/* Retry button if failed or pending */}
        {(uiState === 'failed' || (uiState === 'pending' && isOnline)) && (
          <Pressable
            testID="btn-retry-sync"
            onPress={() => void triggerSync()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radius.pill,
              gap: 4,
            }}
          >
            <Ionicons name="refresh" size={12} color={colors.accent} />
            <Text style={{ fontSize: fontSize.xs, color: colors.accent, fontWeight: '700' }}>
              {t('diary.sync.retry')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
