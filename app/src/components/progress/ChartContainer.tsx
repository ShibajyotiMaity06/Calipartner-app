import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  accessibilitySummary: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  tableView?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function ChartContainer({
  title,
  subtitle,
  accessibilitySummary,
  loading = false,
  empty = false,
  emptyMessage,
  emptyIcon = 'stats-chart-outline',
  testID = 'chart-container',
  headerRight,
  children,
  tableView,
  actionLabel,
  onActionPress,
}: ChartContainerProps) {
  const { colors } = useTheme();
  const [isTableView, setIsTableView] = React.useState(false);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface }]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={accessibilitySummary}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          {tableView && !empty && !loading ? (
            <React.Fragment>
              <View
                style={styles.tableToggleTouch}
                accessibilityRole="button"
                accessibilityLabel={isTableView ? 'View as chart' : 'View as table'}
                testID={`${testID}-toggle-table`}
              >
                <Text
                  style={[styles.tableToggleText, { color: colors.accent }]}
                  onPress={() => setIsTableView(!isTableView)}
                >
                  {isTableView ? 'View as chart' : 'View as table'}
                </Text>
              </View>
            </React.Fragment>
          ) : null}
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      </View>

      {/* Screen Reader hidden summary text for assistive tech */}
      <Text style={styles.srOnly} accessibilityElementsHidden={false}>
        {accessibilitySummary}
      </Text>

      {/* Content / Skeleton / Empty State / Table View */}
      {loading ? (
        <View style={styles.skeletonContainer} testID={`${testID}-skeleton`}>
          <View style={[styles.skeletonPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        </View>
      ) : empty ? (
        <View style={styles.emptyContainer} testID={`${testID}-empty`}>
          <Ionicons name={emptyIcon} size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {emptyMessage || 'No data recorded yet.'}
          </Text>
          {actionLabel && onActionPress ? (
            <View
              style={[styles.emptyActionButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              testID={`${testID}-empty-action`}
            >
              <Text
                style={[styles.emptyActionText, { color: colors.accent }]}
                onPress={onActionPress}
              >
                {actionLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : isTableView && tableView ? (
        <View testID={`${testID}-table-view`}>{tableView}</View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleColumn: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  skeletonContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tableToggleTouch: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tableToggleText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  emptyActionButton: {
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyActionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
