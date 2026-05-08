import React, { useState } from 'react';
import { Text, View, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';

import tokens from '@/components/tokens';
import ConnectionIndicator from '@/components/shared/ConnectionIndicator';
import useBleStore from '@/stores/bleStore';

export function OnboardingScreen() {
  const connectionState = useBleStore((state) => state.connectionState);
  const startScan = useBleStore((state) => state.startScan);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const bleReady = connectionState === 'connected';
  const stepsComplete = [notificationsGranted, bleReady];
  const completedCount = stepsComplete.filter(Boolean).length;

  const requestNotifications = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      setNotificationsGranted(true);
      setStatusMessage('Notifications already enabled.');
      return;
    }

    const next = await Notifications.requestPermissionsAsync();
    const granted = !!next.granted;
    setNotificationsGranted(granted);
    setStatusMessage(granted ? 'Notification permission granted.' : 'Notification permission denied.');
  };

  const scanForDevice = async () => {
    await startScan();
    setStatusMessage('Scanning for SomniSync device...');
  };

  const handleContinue = () => {
    if (completedCount === 2) {
      setStatusMessage('Setup complete!');
    } else {
      setCurrentStep(Math.min(2, currentStep + 1));
    }
  };

  const handleSkip = () => {
    setCurrentStep(2);
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      {/* Step Indicators */}
      <View style={styles.indicators}>
        {[1, 2].map((step) => (
          <View
            key={step}
            style={[
              styles.indicator,
              completedCount >= step && styles.indicatorActive,
            ]}
          />
        ))}
      </View>

      {/* Step 1: Welcome */}
      {currentStep === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.brand}>SomniSync</Text>
          <Text style={styles.stepTitle}>Sleep smarter.</Text>
          <Text style={styles.stepDescription}>
            Connect your device and enable notifications to begin adaptive wake sessions.
          </Text>
        </View>
      )}

      {/* Step 2: Permissions & Connection */}
      {currentStep === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepHeading}>Set up your device</Text>

          {/* Notifications Permission */}
          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionLabel}>Notifications</Text>
              <Text style={styles.permissionDesc}>For wake alerts</Text>
            </View>
            <View
              style={[
                styles.badge,
                notificationsGranted && styles.badgeGranted,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  notificationsGranted && styles.badgeTextGranted,
                ]}
              >
                {notificationsGranted ? 'On' : 'Off'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.permissionButton}
            onPress={() => { void requestNotifications(); }}
          >
            <Text style={styles.permissionButtonText}>
              {notificationsGranted ? 'Enabled' : 'Enable Notifications'}
            </Text>
          </Pressable>

          {/* BLE Connection */}
          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionLabel}>Device Connection</Text>
              <Text style={styles.permissionDesc}>Via Bluetooth</Text>
            </View>
            <View
              style={[
                styles.badge,
                bleReady && styles.badgeGranted,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  bleReady && styles.badgeTextGranted,
                ]}
              >
                {bleReady ? 'Connected' : 'No'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.permissionButton}
            onPress={() => { void scanForDevice(); }}
          >
            <Text style={styles.permissionButtonText}>
              {bleReady ? 'Connected' : 'Scan for Device'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Status Message */}
      {statusMessage ? (
        <Text style={styles.statusMessage}>{statusMessage}</Text>
      ) : null}

      {/* Navigation Buttons */}
      <View style={styles.navButtons}>
        <Pressable
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>

        <Pressable
          style={[
            styles.continueButton,
            completedCount < 2 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={completedCount < 2 && currentStep === 2}
        >
          <Text style={styles.continueButtonText}>
            {completedCount === 2 ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
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
    flexGrow: 1,
    padding: tokens.SPACING.XL,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicators: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
    marginTop: tokens.SPACING.XXXL,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.BORDER,
  },
  indicatorActive: {
    width: 20,
    backgroundColor: tokens.COLORS.ACCENT,
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.SPACING.XXL,
  },
  brand: {
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.ACCENT,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: tokens.SPACING.SM,
  },
  stepTitle: {
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: tokens.SPACING.SM,
  },
  stepDescription: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.TEXT_DIM,
    textAlign: 'center',
    marginTop: tokens.SPACING.XL,
    maxWidth: 280,
  },
  stepHeading: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: tokens.SPACING.XL,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: tokens.SPACING.XL,
    paddingBottom: tokens.SPACING.LG,
    borderBottomWidth: 1,
    borderBottomColor: tokens.COLORS.BORDER,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
    marginBottom: tokens.SPACING.XS,
  },
  permissionDesc: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  badge: {
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.SM,
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.SURFACE,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
  },
  badgeGranted: {
    backgroundColor: tokens.COLORS.ACCENT_DIM,
    borderColor: tokens.COLORS.ACCENT,
  },
  badgeText: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  badgeTextGranted: {
    color: tokens.COLORS.ACCENT,
  },
  permissionButton: {
    width: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.XL,
    paddingVertical: tokens.SPACING.LG,
    paddingHorizontal: tokens.SPACING.MD,
    alignItems: 'center',
    marginBottom: tokens.SPACING.LG,
  },
  permissionButtonText: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  statusMessage: {
    marginTop: tokens.SPACING.MD,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.body,
    color: tokens.COLORS.SUCCESS,
    textAlign: 'center',
  },
  navButtons: {
    width: '100%',
    gap: tokens.SPACING.MD,
    marginBottom: tokens.SPACING.LG,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: tokens.SPACING.SM,
  },
  skipButtonText: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_DIM,
  },
  continueButton: {
    width: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.XL,
    paddingVertical: tokens.SPACING.LG,
    paddingHorizontal: tokens.SPACING.MD,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
});
