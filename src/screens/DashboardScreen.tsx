import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import Card from '@/components/shared/Card';
import ConnectionIndicator from '@/components/shared/ConnectionIndicator';
import SensorTile from '@/components/shared/SensorTile';
import tokens from '@/components/tokens';
import { useSensorData, useSleepPhase, useAlarmStatus, useBleConnection } from '@/hooks';
import useSleepStore from '@/stores/sleepStore';
import useBleStore from '@/stores/bleStore';

const PHASE_DEPTH = {
  AWAKE: 0.04,
  TRANSITIONAL: 0.2,
  LIGHT: 0.5,
  DEEP: 0.96,
  SIGNAL_LOST: 0,
} as const;

export function DashboardScreen() {
  const sensor = useSensorData();
  const phase = useSleepPhase();
  const alarm = useAlarmStatus();
  const ble = useBleConnection();
  const sleepConfidence = useSleepStore((state) => state.confidenceScore);
  const startScan = useBleStore((state) => state.startScan);
  
  const [liveTime, setLiveTime] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const depth = PHASE_DEPTH[phase as keyof typeof PHASE_DEPTH] ?? 0;
  const connected = ble.connectionState === 'connected';
  const alarmTime = alarm.config?.targetTime ? new Date(alarm.config.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  const phaseColor = useMemo(() => {
    switch (phase) {
      case 'LIGHT':
        return tokens.COLORS.PHASE_LIGHT;
      case 'DEEP':
        return tokens.COLORS.PHASE_DEEP;
      case 'AWAKE':
        return tokens.COLORS.PHASE_AWAKE;
      case 'TRANSITIONAL':
        return tokens.COLORS.PHASE_TRANSITIONAL;
      default:
        return tokens.COLORS.TEXT_DIM;
    }
  }, [phase]);

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.brand}>SOMNISYNC</Text>
        <ConnectionIndicator />
      </View>

      {/* Hero Card with Live Time */}
      <Card style={styles.heroCard}>
        <Text style={styles.liveTime}>{liveTime}</Text>
        <Text style={[styles.phaseName, { color: phaseColor }]}>{phase}</Text>
        
        {/* Sleep Depth Bar */}
        <View style={styles.depthBarContainer}>
          <View style={styles.depthBarBg}>
            <View style={[styles.depthBarFill, { width: `${Math.max(0, Math.min(1, depth)) * 100}%` }]} />
          </View>
        </View>
        
        <Text style={styles.confidence}>{Math.round(sleepConfidence * 100)}% confidence</Text>
      </Card>

      {/* Sensor Row */}
      <View style={styles.sensorRow}>
        <SensorTile 
          label="Temperature" 
          value={sensor?.temperature ?? '--'} 
          unit="°C" 
          iconName="thermometer" 
        />
        <SensorTile 
          label="Luminosity" 
          value={sensor?.luminosity ?? '--'} 
          unit="lux" 
          iconName="sun" 
        />
      </View>

      {/* Signal Lost Banner */}
      {phase === 'SIGNAL_LOST' && (
        <View style={styles.signalLostBanner}>
          <Text style={styles.signalLostText}>Signal lost · Check microphone permissions</Text>
        </View>
      )}

      {/* Next Alarm or Connect Button */}
      {connected ? (
        <View style={styles.alarmSection}>
          <Text style={styles.alarmLabel}>NEXT ALARM</Text>
          <Text style={[styles.alarmTime, !alarm.config?.targetTime && styles.alarmTimeDim]}>
            {alarmTime}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.connectButtonRow} onPress={() => { void startScan(); }}>
          <Text style={styles.connectButtonText}>Connect Device</Text>
        </TouchableOpacity>
      )}
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
    gap: tokens.SPACING.XL,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: tokens.SPACING.XL,
    marginTop: tokens.SPACING.XL,
  },
  liveTime: {
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -1.2,
  },
  phaseName: {
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.medium,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: tokens.SPACING.SM,
    textAlign: 'center',
  },
  depthBarContainer: {
    marginTop: tokens.SPACING.MD,
    width: '100%',
  },
  depthBarBg: {
    height: 2,
    backgroundColor: tokens.COLORS.BORDER,
    borderRadius: tokens.RADIUS.FULL,
    overflow: 'hidden',
  },
  depthBarFill: {
    height: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.FULL,
  },
  confidence: {
    marginTop: tokens.SPACING.SM,
    fontSize: tokens.FONT_SIZES.XS,
    color: tokens.COLORS.TEXT_DIM,
    textAlign: 'right',
    width: '100%',
  },
  sensorRow: {
    flexDirection: 'row',
    gap: tokens.SPACING.MD,
    marginTop: tokens.SPACING.XL,
  },
  signalLostBanner: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.COLORS.DANGER,
    backgroundColor: tokens.COLORS.SURFACE,
    padding: tokens.SPACING.MD,
    borderRadius: tokens.RADIUS.SM,
    marginTop: tokens.SPACING.MD,
  },
  signalLostText: {
    fontSize: tokens.FONT_SIZES.SM,
    color: tokens.COLORS.DANGER,
    fontFamily: tokens.TYPOGRAPHY.body,
  },
  alarmSection: {
    marginTop: tokens.SPACING.XL,
  },
  alarmLabel: {
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 4,
    color: tokens.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    fontFamily: tokens.TYPOGRAPHY.medium,
    marginBottom: tokens.SPACING.MD,
  },
  alarmTime: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  alarmTimeDim: {
    color: tokens.COLORS.TEXT_DIM,
  },
  connectButtonRow: {
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER_BRIGHT,
    borderRadius: tokens.RADIUS.XL,
    padding: tokens.SPACING.LG,
    alignItems: 'center',
    marginTop: tokens.SPACING.XL,
  },
  connectButtonText: {
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.ACCENT,
    textAlign: 'center',
  },
});

