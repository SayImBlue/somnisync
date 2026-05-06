import React from 'react';
import { View } from 'react-native';

import Layout from './src/app/_layout';
import { DashboardScreen } from './src/screens/DashboardScreen';

export default function App() {
  return (
    <Layout>
      <View style={{ flex: 1 }}>
        <DashboardScreen />
      </View>
    </Layout>
  );
}
