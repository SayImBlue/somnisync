import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import tokens from '@/components/tokens';

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  iconName?: string;
  timestamp?: number;
};

export default function SensorTile({ label, value, unit, iconName = 'thermometer', timestamp }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.6, duration: tokens.ANIM.FAST, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: tokens.ANIM.NORMAL, useNativeDriver: true }),
    ]).start();
  }, [value, opacity]);

  const fresh = useMemo(() => Boolean(timestamp && Date.now() - timestamp < 5000), [timestamp, value]);

  return (
    <Animated.View style={[styles.card, fresh && styles.freshCard, { opacity }]}>
      <View style={styles.topRow}>
        <MaterialCommunityIcons name={iconName as any} size={22} color={tokens.COLORS.ACCENT} />
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.COLORS.SURFACE,
    borderRadius: tokens.RADIUS.LG,
    padding: tokens.SPACING.MD,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    flex: 1,
    minHeight: 112,
  },
  freshCard: {
    backgroundColor: tokens.COLORS.ACCENT_GLOW,
    shadowColor: tokens.COLORS.ACCENT,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.SPACING.XS,
  },
  value: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.5,
  },
  unit: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  label: {
    marginTop: tokens.SPACING.LG,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
