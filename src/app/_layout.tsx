import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import initApp from '@/services/appInit';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await initApp();
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
