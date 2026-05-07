import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Slider from '@react-native-community/slider';

import Card from '@/components/shared/Card';
import tokens from '@/components/tokens';
import SensorTile from '@/components/shared/SensorTile';
import useBleStore from '@/stores/bleStore';
import { useSensorData, useBleConnection } from '@/hooks';

const toSliderNumber = (value: number | readonly number[]): number => {
  if (typeof value === 'number') {
    return value;
  }
  return value.length > 0 ? value[0] ?? 0 : 0;
};

export function ControlsScreen() {
  const ble = useBleConnection();
  const sensor = useSensorData();
  const writeLightControl = useBleStore((state) => state.writeLightControl);
  const writeTempSetpoint = useBleStore((state) => state.writeTempSetpoint);

  const [light, setLight] = useState(50);
  const [temp, setTemp] = useState(22);
  const [manualOverride, setManualOverride] = useState(false);

  const disabled = ble.connectionState !== 'connected';
  const lightDisplay = useMemo(() => `${Math.round(light)}%`, [light]);
  const tempDisplay = useMemo(() => `${temp.toFixed(1)}°C`, [temp]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controls</Text>

      {disabled ? (
        <Card style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>Device disconnected</Text>
          <Text style={styles.bannerText}>Reconnect to adjust lighting and temperature.</Text>
        </Card>
      ) : null}

      <Card style={[styles.sectionCard, disabled && styles.disabledGroup]}>
        <Text style={styles.sectionLabel}>Lighting</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{lightDisplay}</Text>
          <Text style={styles.unit}>Brightness</Text>
        </View>
        <SensorTile label="Current ambient" value={sensor?.luminosity ?? '--'} unit="lux" iconName="lightbulb" timestamp={sensor?.timestamp} />
        <View style={styles.sliderBlock}>
          <Slider
            style={styles.slider}
            value={light}
            onValueChange={(v: number) => setLight(v)}
            onSlidingComplete={(v: number) => {
              const next = toSliderNumber(v);
              void writeLightControl(next);
            }}
            minimumValue={0}
            maximumValue={100}
            disabled={disabled || manualOverride}
            minimumTrackTintColor={tokens.COLORS.ACCENT}
            maximumTrackTintColor={tokens.COLORS.BORDER}
            thumbTintColor={tokens.COLORS.ACCENT}
          />
        </View>
      </Card>

      <View style={styles.divider} />

      <Card style={[styles.sectionCard, disabled && styles.disabledGroup]}>
        <Text style={styles.sectionLabel}>Temperature</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{tempDisplay}</Text>
          <Text style={styles.unit}>Target</Text>
        </View>
        <SensorTile label="Current ambient" value={sensor?.temperature ?? '--'} unit="°C" iconName="thermometer" timestamp={sensor?.timestamp} />
        <View style={styles.sliderBlock}>
          <Slider
            style={styles.slider}
            value={temp}
            onValueChange={(v: number) => setTemp(v)}
            onSlidingComplete={(v: number) => {
              const next = toSliderNumber(v);
              void writeTempSetpoint(next);
            }}
            minimumValue={16}
            maximumValue={28}
            disabled={disabled || manualOverride}
            minimumTrackTintColor={tokens.COLORS.ACCENT}
            maximumTrackTintColor={tokens.COLORS.BORDER}
            thumbTintColor={tokens.COLORS.ACCENT}
          />
        </View>
      </Card>

      <View style={styles.manualRow}>
        <View>
          <Text style={styles.manualLabel}>Manual Override</Text>
          <Text style={styles.manualSubtext}>{manualOverride ? 'Active' : 'Disabled'}</Text>
        </View>
        <View style={styles.toggleWrap}>
          {manualOverride ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View> : null}
          <Switch
            value={manualOverride}
            onValueChange={setManualOverride}
            trackColor={{ false: tokens.COLORS.BORDER, true: tokens.COLORS.ACCENT }}
            thumbColor={tokens.COLORS.TEXT_PRIMARY}
          />
        </View>
      </View>
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
  title: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.4,
  },
  bannerCard: {
    borderColor: tokens.COLORS.WARNING,
    backgroundColor: 'rgba(255,179,71,0.08)',
  },
  bannerTitle: {
    color: tokens.COLORS.WARNING,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    fontSize: tokens.FONT_SIZES.SM,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  bannerText: {
    marginTop: tokens.SPACING.XS,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  sectionCard: {
    gap: tokens.SPACING.MD,
  },
  disabledGroup: {
    opacity: 0.3,
  },
  sectionLabel: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.SPACING.SM,
  },
  value: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -1.2,
  },
  unit: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  sliderBlock: {
    marginTop: tokens.SPACING.XS,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.COLORS.BORDER,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.SPACING.SM,
  },
  manualLabel: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  manualSubtext: {
    marginTop: 2,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  toggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.SPACING.SM,
  },
  activeBadge: {
    backgroundColor: tokens.COLORS.ACCENT,
    paddingHorizontal: tokens.SPACING.SM,
    paddingVertical: 4,
    borderRadius: tokens.RADIUS.FULL,
  },
  activeBadgeText: {
    color: tokens.COLORS.WHITE,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  sliderRow: {},
  overrideRow: {},
  overrideLabel: {},
});
