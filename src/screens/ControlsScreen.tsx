import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';

import tokens from '@/components/tokens';
import useBleStore from '@/stores/bleStore';
import { useBleConnection } from '@/hooks';

export function ControlsScreen() {
  const ble = useBleConnection();
  const writeLightControl = useBleStore((state) => state.writeLightControl);
  const writeTempSetpoint = useBleStore((state) => state.writeTempSetpoint);

  const [light, setLight] = useState(72);
  const [temp, setTemp] = useState(21.5);
  const [manualOverride, setManualOverride] = useState(false);

  const togglePosition = useRef(new Animated.Value(manualOverride ? 1 : 0)).current;

  const connected = ble.connectionState === 'connected';
  const disabled = !connected;
  const lightDisplay = `${Math.round(light)}%`;
  const tempDisplay = `${temp.toFixed(1)}°C`;

  const handleToggleOverride = () => {
    const newValue = !manualOverride;
    setManualOverride(newValue);
    
    Animated.timing(togglePosition, {
      toValue: newValue ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const toggleTranslate = togglePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Controls</Text>

      {/* Disconnected Banner */}
      {disabled && (
        <View style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedText}>Connect a device to enable controls</Text>
        </View>
      )}

      {/* Lighting Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>LIGHTING</Text>
        <Text style={[styles.valueDisplay, disabled && styles.dimText]}>{disabled ? '--' : lightDisplay}</Text>
        <Slider
          style={styles.slider}
          value={light}
          onValueChange={setLight}
          onSlidingComplete={(v) => { void writeLightControl(Math.round(v)); }}
          minimumValue={0}
          maximumValue={100}
          step={1}
          disabled={disabled}
          minimumTrackTintColor={tokens.COLORS.ACCENT}
          maximumTrackTintColor={tokens.COLORS.BORDER}
          thumbTintColor={tokens.COLORS.ACCENT}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Temperature Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>TEMPERATURE</Text>
        <Text style={[styles.valueDisplay, disabled && styles.dimText]}>{disabled ? '--' : tempDisplay}</Text>
        <Slider
          style={styles.slider}
          value={temp}
          onValueChange={setTemp}
          onSlidingComplete={(v) => { void writeTempSetpoint(v); }}
          minimumValue={16}
          maximumValue={28}
          step={0.5}
          disabled={disabled}
          minimumTrackTintColor={tokens.COLORS.ACCENT}
          maximumTrackTintColor={tokens.COLORS.BORDER}
          thumbTintColor={tokens.COLORS.ACCENT}
        />
      </View>

      {/* Manual Override Row */}
      <View style={styles.overrideRow}>
        <View>
          <Text style={styles.overrideLabel}>Manual Override</Text>
          <Text style={styles.overrideSubtext}>Disable automatic control</Text>
        </View>
        <TouchableOpacity
          style={[styles.togglePill, { backgroundColor: manualOverride ? tokens.COLORS.ACCENT : tokens.COLORS.BORDER }]}
          onPress={handleToggleOverride}
        >
          <Animated.View
            style={[
              styles.toggleCircle,
              {
                transform: [{ translateX: toggleTranslate }],
                backgroundColor: manualOverride ? tokens.COLORS.WHITE : tokens.COLORS.TEXT_DIM,
              },
            ]}
          />
        </TouchableOpacity>
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
    gap: tokens.SPACING.XL,
  },
  title: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  disconnectedBanner: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.COLORS.WARNING,
    backgroundColor: tokens.COLORS.SURFACE,
    padding: tokens.SPACING.MD,
    borderRadius: tokens.RADIUS.SM,
    marginTop: tokens.SPACING.LG,
  },
  disconnectedText: {
    fontSize: tokens.FONT_SIZES.SM,
    color: tokens.COLORS.WARNING,
    fontFamily: tokens.TYPOGRAPHY.body,
  },
  sectionContainer: {
    marginTop: tokens.SPACING.XL,
    gap: tokens.SPACING.MD,
  },
  sectionLabel: {
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 4,
    color: tokens.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    fontFamily: tokens.TYPOGRAPHY.medium,
  },
  valueDisplay: {
    fontSize: tokens.FONT_SIZES.XXXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -1,
  },
  dimText: {
    color: tokens.COLORS.TEXT_DIM,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.COLORS.BORDER,
    marginVertical: tokens.SPACING.XL,
  },
  overrideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.SPACING.XL,
  },
  overrideLabel: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  overrideSubtext: {
    fontSize: tokens.FONT_SIZES.SM,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.body,
    marginTop: tokens.SPACING.XS,
  },
  togglePill: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
