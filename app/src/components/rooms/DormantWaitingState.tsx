import React, { useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface DormantWaitingStateProps {
  roomName: string;
  roomCode: string;
  onInviteByUsername: () => void;
}

export function DormantWaitingState({
  roomName,
  roomCode,
  onInviteByUsername,
}: DormantWaitingStateProps) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { clipboard?: { writeText: (text: string) => Promise<void> } }) : undefined;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(roomCode);
      } else {
        await Share.share({ message: roomCode });
      }
    } catch {
      // Ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my accountability room "${roomName}" on CaliPartner! My room code is: ${roomCode}`,
      });
    } catch {
      // Ignore share cancellation
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
        <Ionicons name="people-outline" size={36} color={colors.accent} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {t('rooms.dormant.title')}
      </Text>

      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('rooms.dormant.subtitle')}
      </Text>

      {/* Big Room Code Box */}
      <View style={[styles.codeBox, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.codeLabel, { color: colors.textMuted }]}>
          {t('rooms.roomCode', { code: '' })}
        </Text>
        <Text style={[styles.codeText, { color: colors.text }]}>{roomCode}</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={handleCopy}
          style={[styles.button, { backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Copy room code"
          testID="btn-dormant-copy-code"
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={16}
            color={copied ? colors.syncSynced : colors.text}
          />
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {copied ? t('rooms.codeCopied') : t('rooms.dormant.copyBtn')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={[styles.button, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Share room code"
          testID="btn-dormant-share-code"
        >
          <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {t('rooms.dormant.shareBtn')}
          </Text>
        </Pressable>
      </View>

      {/* Search user by username alternative */}
      <Pressable
        onPress={onInviteByUsername}
        style={styles.inviteLink}
        accessibilityRole="button"
        accessibilityLabel="Invite friend by username"
        testID="btn-dormant-invite-username"
      >
        <Ionicons name="search-outline" size={14} color={colors.accent} />
        <Text style={[styles.inviteLinkText, { color: colors.accent }]}>
          {t('rooms.inviteModal.title')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  codeBox: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeText: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    gap: 6,
  },
  buttonText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
  inviteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: 4,
  },
  inviteLinkText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '600',
  },
});
