import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import Card from '@/components/shared/Card';
import ConnectionIndicator from '@/components/shared/ConnectionIndicator';
import SensorTile from '@/components/shared/SensorTile';
import tokens from '@/components/tokens';
import { useSensorData, useSleepPhase, useAlarmStatus, useBleConnection } from '@/hooks';
import useSleepStore from '@/stores/sleepStore';
import useBleStore from '@/stores/bleStore';

const PHASE_ORDER = {
  AWAKE: 0,
  TRANSITIONAL: 0.33,
  LIGHT: 0.58,
  DEEP: 1,
  SIGNAL_LOST: 0,
} as const;

export function DashboardScreen() {
  const sensor = useSensorData();
  const phase = useSleepPhase();
  const alarm = useAlarmStatus();
  const ble = useBleConnection();
  const sleepConfidence = useSleepStore((state) => state.confidenceScore);
  const startScan = useBleStore((state) => state.startScan);

  const depth = PHASE_ORDER[phase as keyof typeof PHASE_ORDER] ?? 0;
  const nextAlarmText = alarm.config?.targetTime ? new Date(alarm.config.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No alarm set';
  const connected = ble.connectionState === 'connected';

  const phaseStyle = useMemo(() => {
    switch (phase) {
      case 'LIGHT':
        return styles.phaseLight;
      case 'DEEP':
        return styles.phaseDeep;
      case 'AWAKE':
        return styles.phaseAwake;
      case 'TRANSITIONAL':
        return styles.phaseTransitional;
      default:
        return styles.phaseLost;
    }
  }, [phase]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>SomniSync</Text>
        <ConnectionIndicator />
      </View>

      <Card style={styles.phaseCard}>
        <View style={styles.phaseGlow} />
        <Text style={[styles.phaseLabel, phaseStyle]}>{phase}</Text>
        <Text style={styles.phaseConfidence}>{Math.round(sleepConfidence * 100)}% confidence</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, depth)) * 100}%` }]} />
        </View>
      </Card>

      <View style={styles.sensorRow}>
        <SensorTile label="Temperature" value={sensor?.temperature ?? '--'} unit="°C" iconName="thermometer" timestamp={sensor?.timestamp} />
        <SensorTile label="Luminosity" value={sensor?.luminosity ?? '--'} unit="lux" iconName="white-balance-sunny" timestamp={sensor?.timestamp} />
      </View>

      <Card style={styles.alarmCard}>
        <Text style={styles.cardLabel}>Next alarm</Text>
        <Text style={[styles.alarmTime, !alarm.config?.targetTime && styles.alarmTimeDim]}>
          {nextAlarmText}
        </Text>
        {!connected ? (
          <TouchableOpacity style={styles.connectButton} onPress={startScan}>
            <Text style={styles.connectButtonText}>Tap to connect</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
    padding: tokens.SPACING.LG,
    gap: tokens.SPACING.LG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.4,
  },
  phaseCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: tokens.COLORS.SURFACE_ELEVATED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.SPACING.XXL,
    minHeight: 250,
  },
  phaseGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.ACCENT_GLOW,
    top: -40,
  },
  phaseLabel: {
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    fontSize: 48,
    letterSpacing: -1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  phaseLight: {
    color: tokens.COLORS.PHASE_LIGHT,
  },
  phaseDeep: {
    color: tokens.COLORS.PHASE_DEEP,
  },
  phaseAwake: {
    color: tokens.COLORS.PHASE_AWAKE,
  },
  phaseTransitional: {
    color: tokens.COLORS.PHASE_TRANSITIONAL,
  },
  phaseLost: {
    color: tokens.COLORS.PHASE_SIGNAL_LOST,
  },
  phaseConfidence: {
    marginTop: tokens.SPACING.SM,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    fontSize: tokens.FONT_SIZES.SM,
  },
  progressTrack: {
    marginTop: tokens.SPACING.LG,
    width: '100%',
    height: 3,
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.BORDER,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.ACCENT,
  },
  sensorRow: {
    flexDirection: 'row',
    gap: tokens.SPACING.MD,
  },
  alarmCard: {
    gap: tokens.SPACING.SM,
  },
  cardLabel: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  alarmTime: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    fontSize: tokens.FONT_SIZES.XXL,
    letterSpacing: -0.5,
  },
  alarmTimeDim: {
    color: tokens.COLORS.TEXT_DIM,
  },
  connectButton: {
    marginTop: tokens.SPACING.SM,
    alignSelf: 'center',
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    borderColor: tokens.COLORS.ACCENT,
    paddingHorizontal: tokens.SPACING.LG,
    paddingVertical: tokens.SPACING.SM,
  },
  connectButtonText: {
    color: tokens.COLORS.ACCENT,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    letterSpacing: 0.6,
  },
});

