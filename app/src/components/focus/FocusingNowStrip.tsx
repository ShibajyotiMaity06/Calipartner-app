import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoomFocus } from '@/hooks/useRoomFocus';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMinutesDisplay } from './focusUIUtils';

export interface FocusingNowStripProps {
  roomId: string | null;
  isVisible: boolean;
  userId?: string | null;
  onOpenFocusSegment?: () => void;
  testID?: string;
}

export function FocusingNowStrip({
  roomId,
  isVisible,
  userId,
  onOpenFocusSegment,
  testID = 'strip-focusing-now',
}: FocusingNowStripProps) {
  const { colors } = useTheme();

  const {
    activeSession,
    participants,
    isParticipating,
    join,
  } = useRoomFocus(roomId, { userId, isVisible });

  if (!activeSession || activeSession.status !== 'active') {
    return null;
  }

  const starterName = activeSession.started_by ? activeSession.started_by.slice(0, 8) : 'A member';
  const durationDesc =
    activeSession.mode === 'timer' && activeSession.planned_seconds
      ? formatMinutesDisplay(activeSession.planned_seconds / 60)
      : 'stopwatch';

  const count = participants.filter((p) => p.status === 'focusing').length || 1;
  const countText =
    count === 1
      ? t('focus.focusingNowCount', { count })
      : t('focus.focusingNowCountPlural', { count });

  const handleAction = async () => {
    if (isParticipating) {
      if (onOpenFocusSegment) onOpenFocusSegment();
    } else {
      try {
        await join();
        if (onOpenFocusSegment) onOpenFocusSegment();
      } catch {
        // Fallback open focus segment
        if (onOpenFocusSegment) onOpenFocusSegment();
      }
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.strip,
        {
          backgroundColor: colors.cardHighlight,
          borderColor: colors.accent,
        },
      ]}
    >
      <View style={styles.leftGroup}>
        <View style={[styles.pulsingIconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="timer" size={16} color={colors.accent} />
        </View>
        <View style={styles.textGroup}>
          <Text style={[styles.mainText, { color: colors.text }]}>
            {t('focus.focusingNowStrip', {
              starter: starterName,
              duration: durationDesc,
            })}
          </Text>
          <Text style={[styles.subText, { color: colors.textMuted }]}>
            {countText}
            {activeSession.label ? ` • ${activeSession.label}` : ''}
          </Text>
        </View>
      </View>

      <Pressable
        testID={isParticipating ? 'btn-strip-view-focus' : 'btn-strip-join-focus'}
        onPress={handleAction}
        style={[
          styles.actionBtn,
          { backgroundColor: colors.accent },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isParticipating ? t('focus.viewBtn') : t('focus.joinBtn')
        }
      >
        <Text style={[styles.actionBtnText, { color: colors.onAccent }]}>
          {isParticipating ? t('focus.viewBtn') : t('focus.joinBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  pulsingIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  mainText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  subText: {
    fontSize: 11,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  actionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
