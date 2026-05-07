import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import tokens from '@/components/tokens';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.COLORS.SURFACE,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    borderRadius: tokens.RADIUS.LG,
    padding: tokens.SPACING.LG,
    ...tokens.SHADOWS.CARD,
  },
});
