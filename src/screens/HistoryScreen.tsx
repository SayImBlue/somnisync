import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';

import tokens from '@/components/tokens';
import type { NightSummary } from '@/services/storage/nightLogStorage';
import { getLastSevenNights, getNightSummary } from '@/services/storage/nightLogStorage';

const phaseColor: Record<string, string> = {
  DEEP: tokens.COLORS.SUCCESS,
  LIGHT: tokens.COLORS.ACCENT,
  TRANSITIONAL: tokens.COLORS.WARNING,
  AWAKE: tokens.COLORS.TEXT_MUTED,
  SIGNAL_LOST: tokens.COLORS.ERROR,
};

const formatDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export function HistoryScreen() {
  const [history, setHistory] = useState<NightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    const logs = await getLastSevenNights();
    setHistory(logs.map(getNightSummary));
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await loadHistory();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={tokens.COLORS.ACCENT} />
        <Text style={styles.loadingText}>Loading sleep history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIllustration}>
            <Text style={styles.emptyIllustrationText}>ZZZ</Text>
          </View>
          <Text style={styles.emptyTitle}>No sleep data yet</Text>
          <Text style={styles.emptyText}>Run SomniSync overnight to generate your first sleep report.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item, index }) => (
            <View style={styles.rowWrap}>
              <View style={styles.rowTop}>
                <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                <View style={[styles.phaseBadge, { borderColor: phaseColor[item.dominantPhase] ?? tokens.COLORS.BORDER, backgroundColor: `${phaseColor[item.dominantPhase] ?? tokens.COLORS.BORDER}22` }]}>
                  <Text style={[styles.phaseBadgeText, { color: phaseColor[item.dominantPhase] ?? tokens.COLORS.TEXT_SECONDARY }]}>{item.dominantPhase}</Text>
                </View>
              </View>

              <View style={styles.rowBottom}>
                <Text style={styles.metricText}>{formatDuration(item.totalSleepMinutes)}</Text>
                <Text style={styles.metricText}>{item.avgTemperature.toFixed(1)}°C avg</Text>
              </View>

              <View style={[styles.separator, index === history.length - 1 && styles.separatorLast]} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
    padding: tokens.SPACING.LG,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: tokens.SPACING.MD,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.SPACING.LG,
  },
  title: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.4,
  },
  refreshButton: {
    backgroundColor: 'transparent',
    borderColor: tokens.COLORS.BORDER,
    borderWidth: 1,
    borderRadius: tokens.RADIUS.FULL,
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.SM,
  },
  refreshButtonText: {
    color: tokens.COLORS.ACCENT,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  listContainer: {
    paddingBottom: tokens.SPACING.XL,
  },
  rowWrap: {
    paddingBottom: tokens.SPACING.MD,
    marginBottom: tokens.SPACING.MD,
  },
  rowTop: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardDate: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  phaseBadge: {
    borderWidth: 1,
    borderRadius: tokens.RADIUS.FULL,
    paddingHorizontal: tokens.SPACING.SM,
    paddingVertical: tokens.SPACING.XS,
  },
  phaseBadgeText: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowBottom: {
    marginTop: tokens.SPACING.SM,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.SPACING.MD,
  },
  metricText: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.BODY,
    fontSize: tokens.FONT_SIZES.SM,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.SPACING.XL,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: tokens.COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.SPACING.LG,
    shadowColor: tokens.COLORS.ACCENT,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  emptyIllustrationText: {
    color: tokens.COLORS.ACCENT,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    fontSize: 32,
    letterSpacing: 2,
  },
  emptyTitle: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
  },
  emptyText: {
    marginTop: tokens.SPACING.SM,
    color: tokens.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  separator: {
    marginTop: tokens.SPACING.MD,
    height: 1,
    backgroundColor: tokens.COLORS.BORDER,
  },
  separatorLast: {
    opacity: 0,
  },
});
