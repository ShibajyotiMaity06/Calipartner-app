import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FastingSession, FastingStats, FastingStreak } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface FastingHistoryModalProps {
  visible: boolean;
  history: FastingSession[];
  stats: FastingStats;
  streak: FastingStreak;
  onClose: () => void;
  testID?: string;
}

export function FastingHistoryModal({
  visible,
  history,
  stats,
  streak,
  onClose,
  testID = 'fasting-history-modal',
}: FastingHistoryModalProps) {
  const [viewAsTable, setViewAsTable] = useState(false);

  if (!visible) return null;

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getStatusPill = (status: string) => {
    const isCompleted = status === 'completed';
    return (
      <View
        style={[
          styles.statusPill,
          isCompleted ? styles.statusPillCompleted : styles.statusPillEarly,
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            isCompleted ? styles.statusTextCompleted : styles.statusTextEarly,
          ]}
        >
          {isCompleted ? 'Completed' : 'Ended early'}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID={`${testID}-content`}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title} testID="fasting-history-title">
                {t('fasting.history')}
              </Text>
              <Text style={styles.subtitle}>{t('fasting.safeFastingNotice')}</Text>
            </View>
            <Pressable
              testID="button-close-history-modal"
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* 4 Summary Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>{t('fasting.totalFasts')}</Text>
                <Text style={styles.statValue} testID="stat-total-fasts">
                  {stats.total_fasts}
                </Text>
              </View>

              <View style={styles.statTile}>
                <Text style={styles.statLabel}>{t('fasting.completionRate')}</Text>
                <Text style={styles.statValue} testID="stat-completion-rate">
                  {Math.round(stats.completion_rate_pct)}%
                </Text>
              </View>

              <View style={styles.statTile}>
                <Text style={styles.statLabel}>{t('fasting.averageDuration')}</Text>
                <Text style={styles.statValue} testID="stat-avg-duration">
                  {stats.average_duration_hours.toFixed(1)} h
                </Text>
              </View>

              <View style={styles.statTile}>
                <Text style={styles.statLabel}>{t('fasting.currentStreak')}</Text>
                <Text style={styles.statValue} testID="stat-current-streak">
                  {streak.current_streak} d
                </Text>
              </View>
            </View>

            {/* Fasting Hours Section with Table Toggle */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('fasting.hoursGraph')}</Text>
                <Pressable
                  testID="button-toggle-cmp14-table"
                  onPress={() => setViewAsTable(!viewAsTable)}
                  style={styles.toggleTableBtn}
                  accessibilityRole="button"
                  accessibilityLabel={viewAsTable ? 'View chart' : t('fasting.viewAsTable')}
                >
                  <Ionicons
                    name={viewAsTable ? 'bar-chart-outline' : 'list-outline'}
                    size={16}
                    color={dark.apricot}
                  />
                  <Text style={styles.toggleTableText}>
                    {viewAsTable ? 'View chart' : t('fasting.viewAsTable')}
                  </Text>
                </Pressable>
              </View>

              {/* View as Table (CMP-14 Accessible Data Table) */}
              {viewAsTable ? (
                <View style={styles.tableContainer} testID="fasting-cmp14-table">
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
                      {t('fasting.tableHeaderDate')}
                    </Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>
                      {t('fasting.tableHeaderPlanned')}
                    </Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>
                      {t('fasting.tableHeaderActual')}
                    </Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
                      {t('fasting.tableHeaderStatus')}
                    </Text>
                  </View>

                  {history.slice(0, 10).map((item) => {
                    const actualM = item.end_at
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(item.end_at).getTime() - new Date(item.start_at).getTime()) /
                              60000,
                          ),
                        )
                      : null;

                    return (
                      <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 2 }]}>{item.local_date}</Text>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>
                          {formatHours(item.planned_minutes)}
                        </Text>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>
                          {actualM !== null ? formatHours(actualM) : '—'}
                        </Text>
                        <View style={{ flex: 2 }}>{getStatusPill(item.status)}</View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* 7-Session Visual Mini Bar Chart */
                <View style={styles.chartContainer} testID="fasting-chart-bars">
                  <View style={styles.barsRow}>
                    {history
                      .slice(0, 7)
                      .reverse()
                      .map((item, idx) => {
                        const actualM = item.end_at
                          ? Math.max(
                              0,
                              Math.round(
                                (new Date(item.end_at).getTime() -
                                  new Date(item.start_at).getTime()) /
                                  60000,
                              ),
                            )
                          : 0;
                        const actualH = actualM / 60;
                        const barHeight = Math.min(100, Math.max(12, (actualH / 20) * 100));

                        return (
                          <View key={item.id || idx} style={styles.barCol}>
                            <Text style={styles.barValue}>
                              {actualH > 0 ? `${actualH.toFixed(0)}h` : ''}
                            </Text>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    height: `${barHeight}%`,
                                    backgroundColor:
                                      item.status === 'completed' ? dark.iris : dark.hairline,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.barLabel}>{item.local_date.slice(5)}</Text>
                          </View>
                        );
                      })}
                  </View>
                  <Text style={styles.chartCaption}>
                    Shows recent fasts up to the 20-hour safety cap.
                  </Text>
                </View>
              )}
            </View>

            {/* Past Fast Sessions List */}
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
              {history.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{t('fasting.historyEmpty')}</Text>
                </View>
              ) : (
                history.map((sess) => {
                  const durationM = sess.end_at
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(sess.end_at).getTime() - new Date(sess.start_at).getTime()) /
                            60000,
                        ),
                      )
                    : sess.planned_minutes;
                  return (
                    <View
                      key={sess.id}
                      style={styles.historyCard}
                      testID={`fasting-item-${sess.id}`}
                    >
                      <View style={styles.historyCardHeader}>
                        <View>
                          <Text style={styles.historyDate}>{sess.local_date}</Text>
                          <Text style={styles.historySub}>
                            Planned {formatHours(sess.planned_minutes)}
                          </Text>
                        </View>
                        {getStatusPill(sess.status)}
                      </View>

                      <View style={styles.historyCardBottom}>
                        <Ionicons name="time-outline" size={16} color={dark.textMid} />
                        <Text style={styles.historyDuration}>
                          Duration: {formatHours(durationM)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              testID="button-close-history"
              style={({ pressed }) => [styles.doneButton, pressed && styles.buttonPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.doneButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space[4],
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[3],
  },
  title: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.s1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    gap: space[3],
    paddingBottom: space[3],
  },
  statsGrid: {
    flexDirection: 'row',
    gap: space[2],
  },
  statTile: {
    flex: 1,
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: typeTokens.numeralM.fontSize,
    fontFamily: typeTokens.numeralM.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
  },
  sectionCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  sectionTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
  },
  toggleTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space[1],
  },
  toggleTableText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  tableCell: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  chartContainer: {
    gap: space[1],
  },
  barsRow: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space[1],
    paddingTop: space[2],
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 10,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: dark.s2,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    marginTop: 4,
  },
  chartCaption: {
    fontSize: 11,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
    marginTop: space[1],
  },
  listSection: {
    gap: space[1],
  },
  emptyBox: {
    padding: space[4],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
  },
  historyCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[1],
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '700',
    color: dark.textHi,
  },
  historySub: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
  },
  historyCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginTop: 2,
  },
  historyDuration: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  statusPill: {
    paddingHorizontal: space[1],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(180, 154, 252, 0.15)',
  },
  statusPillEarly: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: typeTokens.label.fontFamily,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: dark.iris,
  },
  statusTextEarly: {
    color: dark.textMid,
  },
  footer: {
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  doneButton: {
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  doneButtonText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    fontWeight: '600',
    color: dark.textHi,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
