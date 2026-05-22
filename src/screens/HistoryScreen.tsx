import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';

import PhaseIndicator from '@/components/shared/PhaseIndicator';
import tokens from '@/components/tokens';
import type { NightSummary } from '@/services/storage/nightLogStorage';
import { getLastSevenNights, getNightSummary } from '@/services/storage/nightLogStorage';

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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={tokens.COLORS.ACCENT} />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.emptyStateContainer}>
        <Text style={styles.title}>History</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIllustration}>zzz</Text>
          <Text style={styles.emptyTitle}>No sleep data yet</Text>
          <Text style={styles.emptyText}>Start your first night to see history</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>

        <View style={styles.listContainer}>
          {history.map((item, index) => (
            <View key={item.date}>
              <View style={styles.nightRow}>
                <View style={styles.leftContent}>
                  <Text style={styles.nightDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.duration}>{formatDuration(item.totalSleepMinutes)}</Text>
                </View>
                <View style={styles.rightContent}>
                  <PhaseIndicator phase={item.dominantPhase} confidence={0.5} />
                  <Text style={styles.avgTemp}>{item.avgTemperature.toFixed(1)}°C</Text>
                </View>
              </View>
              {index < history.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
  },
  container: {
    padding: tokens.SPACING.XL,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.SPACING.XL,
  },
  title: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
    marginBottom: tokens.SPACING.XL,
  },
  listContainer: {
    marginTop: tokens.SPACING.XL,
  },
  nightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: tokens.SPACING.LG,
  },
  leftContent: {
    flex: 1,
  },
  nightDate: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
    marginBottom: tokens.SPACING.SM,
  },
  duration: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  rightContent: {
    alignItems: 'flex-end',
    gap: tokens.SPACING.XS,
  },
  avgTemp: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.TEXT_DIM,
    marginTop: tokens.SPACING.XS,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.COLORS.BORDER,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIllustration: {
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_DIM,
    letterSpacing: 3,
    marginBottom: tokens.SPACING.MD,
  },
  emptyTitle: {
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
    marginBottom: tokens.SPACING.SM,
  },
  emptyText: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.TEXT_DIM,
    textAlign: 'center',
  },
});
