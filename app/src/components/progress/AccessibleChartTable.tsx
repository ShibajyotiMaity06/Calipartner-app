import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { dark, radius, space, type } from '@calipartner/ui';

export interface TableColumn {
  key: string;
  header: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  id: string;
  [key: string]: string | number | null | undefined;
}

interface AccessibleChartTableProps {
  columns: TableColumn[];
  rows: TableRow[];
  caption?: string;
  testID?: string;
}

export function AccessibleChartTable({
  columns,
  rows,
  caption,
  testID = 'accessible-chart-table',
}: AccessibleChartTableProps) {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No tabular data available for this range.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID} accessibilityRole={'table' as any}>
      {caption ? (
        <Text style={styles.caption} accessibilityRole="header">
          {caption}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableInner}>
          {/* Header Row */}
          <View style={styles.headerRow} accessibilityRole={'row' as any}>
            {columns.map((col) => (
              <View
                key={col.key}
                style={[
                  styles.headerCell,
                  col.width
                    ? { width: typeof col.width === 'number' ? col.width : 100 }
                    : { minWidth: 80 },
                  col.align === 'right' && styles.alignRight,
                  col.align === 'center' && styles.alignCenter,
                ]}
                accessibilityRole={'columnheader' as any}
              >
                <Text style={styles.headerText}>{col.header}</Text>
              </View>
            ))}
          </View>

          {/* Body Rows */}
          <ScrollView
            style={styles.bodyScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row, idx) => (
              <View
                key={row.id || String(idx)}
                style={[styles.row, idx % 2 === 1 && styles.rowAlt]}
                accessibilityRole={'row' as any}
              >
                {columns.map((col) => {
                  const val = row[col.key];
                  return (
                    <View
                      key={col.key}
                      style={[
                        styles.cell,
                        col.width
                          ? { width: typeof col.width === 'number' ? col.width : 100 }
                          : { minWidth: 80 },
                        col.align === 'right' && styles.alignRight,
                        col.align === 'center' && styles.alignCenter,
                      ]}
                      accessibilityRole={'cell' as any}
                    >
                      <Text style={styles.cellText}>{val != null ? String(val) : '—'}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  caption: {
    ...type.label,
    color: dark.textLo,
    paddingHorizontal: space[3],
    paddingTop: space[2],
  },
  tableInner: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: dark.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
  headerCell: {
    paddingHorizontal: space[2],
  },
  headerText: {
    ...type.label,
    color: dark.textMid,
    fontWeight: '600',
  },
  bodyScroll: {
    maxHeight: 200,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
  },
  rowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  cell: {
    paddingHorizontal: space[2],
  },
  cellText: {
    ...type.bodyS,
    color: dark.textHi,
    fontVariant: ['tabular-nums'],
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  alignCenter: {
    alignItems: 'center',
  },
  emptyContainer: {
    padding: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...type.bodyS,
    color: dark.textLo,
  },
});
