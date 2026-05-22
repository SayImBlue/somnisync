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
        return { color: tokens.COLORS.SIGNAL_LOST };
      default:
        return { color: tokens.COLORS.TEXT_DIM };
    }
  }, [phase]);

  return (
    <View style={[styles.pill, { borderColor: config.color }]}>
      <Text style={[styles.text, { color: config.color }]}>
        {phase}
        {' · '}
        {Math.round(confidence * 100)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    backgroundColor: tokens.COLORS.ACCENT_DIM,
  },
  text: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
