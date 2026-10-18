import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ChatEmptyStateProps {
  onSelectStarter?: (text: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function ChatEmptyState({
  onSelectStarter,
  disabled = false,
  testID = 'chat-empty-state',
}: ChatEmptyStateProps) {
  const { colors } = useTheme();

  const starters = [t('chat.starter1'), t('chat.starter2'), t('chat.starter3')];

  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="chatbubbles-outline" size={36} color={colors.accent} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{t('chat.emptyTitle')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('chat.emptySubtitle')}</Text>

      {!disabled && onSelectStarter && (
        <View style={styles.startersContainer}>
          <Text style={[styles.startersHeader, { color: colors.textMuted }]}>
            Quick conversation starters:
          </Text>
          <View style={styles.startersRow}>
            {starters.map((starter, index) => (
              <Pressable
                key={index}
                onPress={() => onSelectStarter(starter)}
                style={[
                  styles.starterChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Send prompt: ${starter}`}
                testID={`btn-starter-${index}`}
              >
                <Text style={[styles.starterText, { color: colors.text }]}>{starter}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    transform: [{ scaleY: -1 }], // Counteracts FlatList inverted scale
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  startersContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  startersHeader: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  startersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  starterChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  starterText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
