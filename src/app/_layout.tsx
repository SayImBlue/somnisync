import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import initApp from '@/services/appInit';
import useBleStore from '@/stores/bleStore';
import useSleepStore from '@/stores/sleepStore';
import useAlarmStore from '@/stores/alarmStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Starting SomniSync…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
  },
});
