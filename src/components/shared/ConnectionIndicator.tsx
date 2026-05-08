import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import tokens from '@/components/tokens';
import useBleStore from '@/stores/bleStore';

export default function ConnectionIndicator() {
  const connectionState = useBleStore((state) => state.connectionState);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (connectionState === 'scanning') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );

      animation.start();
      return () => animation.stop();
    }

    pulse.stopAnimation();
    pulse.setValue(1);
    return undefined;
  }, [connectionState, pulse]);

  const config = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return {
          label: 'Connected',
          backgroundColor: tokens.COLORS.ACCENT_DIM,
          borderColor: tokens.COLORS.ACCENT,
          textColor: tokens.COLORS.ACCENT,
        };
      case 'scanning':
        return {
          label: 'Scanning',
          backgroundColor: 'transparent',
          borderColor: tokens.COLORS.BORDER_BRIGHT,
          textColor: tokens.COLORS.TEXT_SECONDARY,
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting',
          backgroundColor: 'rgba(232,168,56,0.1)',
          borderColor: tokens.COLORS.WARNING,
          textColor: tokens.COLORS.WARNING,
        };
      default:
        return {
          label: 'Offline',
          backgroundColor: 'transparent',
          borderColor: tokens.COLORS.DANGER,
          textColor: tokens.COLORS.DANGER,
        };
    }
  }, [connectionState]);

  const animatedStyle = connectionState === 'scanning' ? { opacity: pulse } : null;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: tokens.TYPOGRAPHY.medium,
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
