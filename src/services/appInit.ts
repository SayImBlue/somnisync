import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONFIG } from '@/config';
import { createBleManager } from '@/services/ble';
import useBleStore from '@/stores/bleStore';
import useAlarmStore from '@/stores/alarmStore';
import useSleepStore from '@/stores/sleepStore';
import { initializeStorage, migrateIfNeeded, getLastSevenNights } from '@/services/storage/nightLogStorage';
import { audioProcessor } from '@/services/audio/audioProcessor';
import backgroundTasks from '@/services/background/backgroundTasks';

const ALARM_CONFIG_KEY = 'somnisync:alarm-config';
const LAST_DEVICE_ID_KEY = 'lastDeviceId';

let appStateListener: ((state: AppStateStatus) => void) | null = null;
let notificationResponseSubscriber: { remove: () => void } | null = null;

/** Save transient state when app goes to background or is killed. */
const persistTransientState = async (): Promise<void> => {
  try {
    const alarmState = useAlarmStore.getState().config;
    await AsyncStorage.setItem(ALARM_CONFIG_KEY, JSON.stringify(alarmState));

    const bleState = useBleStore.getState();
    if (bleState.connectedDeviceId) {
      await AsyncStorage.setItem(LAST_DEVICE_ID_KEY, bleState.connectedDeviceId);
    }

    // Save partial night log (current phase timeline) as the latest night
    const phaseHistory = useSleepStore.getState().phaseHistory;
    if (phaseHistory && phaseHistory.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const nightLog = {
        date: today,
        phases: phaseHistory,
        sensorSnapshots: [],
      } as any;
      // Use existing storage helper to persist
      const { saveNightLog } = await import('@/services/storage/nightLogStorage');
      await saveNightLog(nightLog);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[appInit] Failed to persist transient state:', error);
  }
};

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState === 'background' || nextAppState === 'inactive') {
    // Pause audio processing, keep BLE alive and alarm armed
    try {
      await audioProcessor.stopRecording();
    } catch (e) {
      // ignore errors
    }
    await persistTransientState();
  }

  if (nextAppState === 'active') {
    // Resume audio processing and sync sensor state
    try {
      await audioProcessor.initializeMicrophone();
      // Warmup will be handled by audioProcessor; it's up to callers to start recording
    } catch (e) {
      // If microphone permission revoked, emit SIGNAL_LOST via sleep store
      try {
        useSleepStore.getState().setRespiratoryFrequency(0 as any);
      } catch {}
    }

    // If BLE disconnected, attempt auto-reconnect to lastDeviceId
    const bleState = useBleStore.getState();
    const manager = bleState.manager;
    if (!bleState.connectedDeviceId) {
      try {
        const lastDeviceId = await AsyncStorage.getItem(LAST_DEVICE_ID_KEY);
        if (lastDeviceId && !CONFIG.USE_MOCK_BLE && typeof manager.connectToDevice === 'function') {
          // Attempt silent reconnect
          void manager.connectToDevice(lastDeviceId);
        }
      } catch (e) {
        // ignore
      }
    }
  }
};

/** Initialize application state on launch. */
export const initApp = async (): Promise<void> => {
  // 1. Migrate storage if needed
  await migrateIfNeeded();

  // 2. Initialize storage and validate AsyncStorage access
  await initializeStorage();

  // 3. Load last known AlarmConfig from storage and rearm if necessary
  try {
    const raw = await AsyncStorage.getItem(ALARM_CONFIG_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed) {
          useAlarmStore.getState().setConfig(parsed);
          if (parsed.enabled) {
            useAlarmStore.getState().armAlarm();
          }
        }
      } catch (err) {
        // ignore parse errors
      }
    }
  } catch (error) {
    // ignore
  }

  // 4/5. BLE connect or start mock manager
  const bleState = useBleStore.getState();
  const manager = bleState.manager;

  try {
    const lastDeviceId = await AsyncStorage.getItem(LAST_DEVICE_ID_KEY);
    if (CONFIG.USE_MOCK_BLE) {
      // Ensure mock BLE scanning is started so UI sees data
      if (typeof manager.startScan === 'function') {
        void manager.startScan();
      }
    } else if (lastDeviceId && typeof manager.connectToDevice === 'function') {
      // Attempt auto-connect silently
      void manager.connectToDevice(lastDeviceId);
    }
  } catch (error) {
    // ignore
  }

  // 6. Restore last NightLog in progress if any
  try {
    const logs = await getLastSevenNights();
    if (logs.length > 0) {
      const latest = logs[0];
      const today = new Date().toISOString().slice(0, 10);
      if (latest.date === today) {
        // Restore phase history and active phase start
        useSleepStore.setState({
          phaseHistory: latest.phases,
          currentPhase: latest.phases.length > 0 ? latest.phases[latest.phases.length - 1].phase : 'AWAKE',
          activePhaseStartedAt: latest.phases.length > 0 ? latest.phases[latest.phases.length - 1].startTime : Date.now(),
        });
      }
    }
  } catch (error) {
    // ignore
  }

  // Register AppState listener
  if (!appStateListener) {
    appStateListener = handleAppStateChange;
    AppState.addEventListener('change', appStateListener as any);
  }

  // Request notification permissions here (background task will handle channels)
  try {
    const { requestPermissionsAsync } = await import('expo-notifications');
    await requestPermissionsAsync();
  } catch (e) {
    // ignore if not available
  }

  // Initialize notification channels and handlers
  try {
    await backgroundTasks.initNotifications();
  } catch (e) {
    // ignore
  }

  // Register BLE background polling task
  try {
    await backgroundTasks.registerBlePollTask();
  } catch (e) {
    // ignore
  }

  // Listen for notification responses (e.g., user taps the alarm) and resume wake sequence
  try {
    notificationResponseSubscriber = backgroundTasks.addNotificationResponseListener((response) => {
      try {
        const data = response.notification.request.content.data as any;
        if (data && data.type === 'alarm') {
          // Trigger wake sequence when user taps the alarm notification
          useAlarmStore.getState().triggerWakeSequence(Date.now());
        }
      } catch (err) {
        // ignore
      }
    }) as any;
  } catch (e) {
    // ignore
  }
};

/** Cleanup listeners when app is shutting down (useful for tests). */
export const teardownApp = async (): Promise<void> => {
  if (appStateListener) {
    AppState.removeEventListener('change', appStateListener as any);
    appStateListener = null;
  }
  if (notificationResponseSubscriber) {
    try {
      notificationResponseSubscriber.remove();
    } catch {}
    notificationResponseSubscriber = null;
  }

  try {
    await backgroundTasks.unregisterBlePollTask();
  } catch {}
};

export default initApp;
