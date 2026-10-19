import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IndividualMacrosProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AccessibleChartTable, type TableColumn } from './AccessibleChartTable';
import { ChartContainer } from './ChartContainer';

interface MacrosChartProps {
  data?: IndividualMacrosProgress | null;
  loading?: boolean;
  testID?: string;
}

export function MacrosChart({ data, loading = false, testID = 'macros-chart' }: MacrosChartProps) {
  const { colors } = useTheme();

  const isEmpty =
    !data || (data.protein_avg_g === 0 && data.carbs_avg_g === 0 && data.fat_avg_g === 0);

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.macros.empty');
    }
    return t('progress.macros.accessibilitySummary', {
      protein: Math.round(data.protein_avg_g),
      carbs: Math.round(data.carbs_avg_g),
      fat: Math.round(data.fat_avg_g),
    });
  }, [isEmpty, data]);

  const items = [
    {
      label: t('progress.macros.protein'),
      avg: data?.protein_avg_g ?? 0,
      target: data?.protein_target_g ?? 0,
      color: colors.macroProtein,
    },
    {
      label: t('progress.macros.carbs'),
      avg: data?.carbs_avg_g ?? 0,
      target: data?.carbs_target_g ?? 0,
      color: colors.macroCarbs,
    },
    {
      label: t('progress.macros.fat'),
      avg: data?.fat_avg_g ?? 0,
      target: data?.fat_target_g ?? 0,
      color: colors.macroFat,
    },
  ];

  // Table representation for accessibility (CMP-14)
  const tableColumns: TableColumn[] = [
    { key: 'nutrient', header: 'Nutrient', width: 90 },
    { key: 'avg', header: 'Daily Avg', width: 85, align: 'right' },
    { key: 'target', header: 'Target', width: 85, align: 'right' },
    { key: 'pct', header: '% Target', width: 85, align: 'right' },
  ];

  const tableRows = useMemo(() => {
    return items.map((item) => ({
      id: item.label,
      nutrient: item.label,
      avg: `${Math.round(item.avg)}g`,
      target: `${Math.round(item.target)}g`,
      pct: item.target > 0 ? `${Math.round((item.avg / item.target) * 100)}%` : '—',
    }));
  }, [items]);

  return (
    <ChartContainer
      title={t('progress.macros.title')}
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.macros.empty')}
      emptyIcon="nutrition-outline"
      testID={testID}
      tableView={
        <AccessibleChartTable
          columns={tableColumns}
          rows={tableRows}
          caption="Macronutrient averages and target breakdown"
          testID={`${testID}-table`}
        />
      }
    >
      <View style={styles.macrosList}>
        {items.map((item) => {
          const ratio = item.target > 0 ? Math.min(1.5, item.avg / item.target) : 0;
          const barWidthPercent = `${Math.min(100, Math.round(ratio * 100))}%`;

          return (
            <View key={item.label} style={styles.macroRow}>
              <View style={styles.macroHeader}>
                <Text style={[styles.macroLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.macroValue, { color: colors.textMuted }]}>
                  {Math.round(item.avg)}g / {Math.round(item.target)}g
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: barWidthPercent as `${number}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  macrosList: {
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  macroRow: {
    gap: spacing.xs,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  macroValue: {
    fontSize: fontSize.xs,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
