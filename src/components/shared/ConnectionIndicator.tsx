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
          Animated.timing(pulse, { toValue: 0.65, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
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
          container: styles.connected,
          text: styles.connectedText,
          border: styles.connectedBorder,
        };
      case 'scanning':
        return {
          label: 'Scanning',
          container: styles.scanning,
          text: styles.scanningText,
          border: styles.scanningBorder,
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting',
          container: styles.reconnecting,
          text: styles.reconnectingText,
          border: styles.reconnectingBorder,
        };
      default:
        return {
          label: 'Disconnected',
          container: styles.disconnected,
          text: styles.disconnectedText,
          border: styles.disconnectedBorder,
        };
    }
  }, [connectionState]);

  const animatedStyle = connectionState === 'scanning' ? { opacity: pulse } : null;

  return (
    <Animated.View style={[styles.pill, config.container, config.border, animatedStyle]}>
      <Text style={[styles.label, config.text]}>{config.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 92,
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.XS,
    borderRadius: tokens.RADIUS.FULL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  connected: {
    backgroundColor: tokens.COLORS.ACCENT,
    shadowColor: tokens.COLORS.ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  connectedBorder: {
    borderColor: tokens.COLORS.ACCENT,
  },
  connectedText: {
    color: tokens.COLORS.WHITE,
  },
  scanning: {
    backgroundColor: tokens.COLORS.SURFACE_ELEVATED,
  },
  scanningBorder: {
    borderColor: tokens.COLORS.BORDER,
  },
  scanningText: {
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  reconnecting: {
    backgroundColor: 'rgba(255,179,71,0.12)',
  },
  reconnectingBorder: {
    borderColor: tokens.COLORS.WARNING,
  },
  reconnectingText: {
    color: tokens.COLORS.WARNING,
  },
  disconnected: {
    backgroundColor: 'transparent',
  },
  disconnectedBorder: {
    borderColor: tokens.COLORS.DANGER,
  },
  disconnectedText: {
    color: tokens.COLORS.DANGER,
  },
});
