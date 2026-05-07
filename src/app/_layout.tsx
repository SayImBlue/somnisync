import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { Syne_700Bold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';

import initApp from '@/services/appInit';
import useBleStore from '@/stores/bleStore';
import useSleepStore from '@/stores/sleepStore';
import useAlarmStore from '@/stores/alarmStore';
import tokens from '@/components/tokens';

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await initApp();
        try {
          const ble = useBleStore.getState();
          console.log('[TEST] BLE State:', { connectionState: ble.connectionState, connectedDeviceId: ble.connectedDeviceId });
          console.log('[TEST] Sensor Data:', ble.lastSensorData);

          const sleep = useSleepStore.getState();
          console.log('[TEST] Sleep Phase:', { currentPhase: sleep.currentPhase, confidence: sleep.confidenceScore });

          const alarm = useAlarmStore.getState();
          console.log('[TEST] Alarm Config:', alarm.config);
        } catch (logErr) {
          // Temporary test logs failed
          // eslint-disable-next-line no-console
          console.warn('[TEST] debug logs failed', logErr);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Layout] initApp failed', e);
      }

      if (mounted) setReady(true);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={tokens.COLORS.ACCENT} />
        <Text style={styles.text}>Starting SomniSync…</Text>
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.COLORS.BACKGROUND,
    padding: tokens.SPACING.LG,
  },
  text: {
    marginTop: tokens.SPACING.SM,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
});
