import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import tokens from '@/components/tokens';

type Props = {
  phase: string;
  confidence?: number;
};

export default function PhaseIndicator({ phase, confidence = 0 }: Props) {
  const config = useMemo(() => {
    switch (phase) {
      case 'LIGHT':
        return { color: tokens.COLORS.PHASE_LIGHT };
      case 'DEEP':
        return { color: tokens.COLORS.PHASE_DEEP };
      case 'AWAKE':
        return { color: tokens.COLORS.PHASE_AWAKE };
      case 'TRANSITIONAL':
        return { color: tokens.COLORS.PHASE_TRANSITIONAL };
      case 'SIGNAL_LOST':
        return { color: tokens.COLORS.PHASE_SIGNAL_LOST };
      default:
        return { color: tokens.COLORS.TEXT_DIM };
    }
  }, [phase]);

  return (
    <View style={[styles.container, { borderColor: config.color, shadowColor: config.color }]}> 
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={styles.phase}>{phase}</Text>
      <Text style={styles.confidence}>· {Math.round(confidence * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.SPACING.SM,
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.SM,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    backgroundColor: tokens.COLORS.SURFACE,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: tokens.RADIUS.FULL,
  },
  phase: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  confidence: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
});
