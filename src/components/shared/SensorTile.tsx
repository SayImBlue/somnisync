import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import tokens from '@/components/tokens';

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  iconName?: string;
};

export default function SensorTile({ label, value, unit, iconName = 'activity' }: Props) {
  const isDash = useMemo(() => value === '--', [value]);
  const valueColor = isDash ? tokens.COLORS.TEXT_DIM : tokens.COLORS.TEXT_PRIMARY;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name={iconName as any} size={16} color={tokens.COLORS.TEXT_SECONDARY} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.COLORS.SURFACE,
    borderRadius: tokens.RADIUS.LG,
    padding: tokens.SPACING.LG,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    flex: 1,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.SPACING.SM,
  },
  label: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: tokens.FONT_SIZES.XXXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    lineHeight: tokens.FONT_SIZES.XXXL + 4,
  },
  unit: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
  },
});
