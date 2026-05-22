import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import tokens from '@/components/tokens';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glowAccent?: boolean;
};

export default function Card({ children, style, glowAccent }: Props) {
  return (
    <View
      style={[
        styles.card,
        glowAccent && { backgroundColor: tokens.COLORS.ACCENT_GLOW },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.COLORS.SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    borderRadius: tokens.RADIUS.XL,
    padding: tokens.SPACING.XL,
  },
});
