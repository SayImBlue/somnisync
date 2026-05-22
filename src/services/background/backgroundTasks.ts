import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONFIG } from '@/config';
import { createBleManager } from '@/services/ble';

const BLE_POLL_TASK = 'SOMNISYNC_BLE_POLL_TASK';
const ALARM_NOTIFICATION_KEY = 'somnisync:alarm-notification-id';

if (!TaskManager.isTaskDefined(BLE_POLL_TASK)) {
  TaskManager.defineTask(BLE_POLL_TASK, async () => {
    try {
      const manager: any = createBleManager();
      const state = manager && typeof manager.isConnected === 'function' ? manager.isConnected() : false;

      if (!state && !CONFIG.USE_MOCK_BLE) {
        let attempts = 0;
        let connected = false;
        const lastDeviceId = await AsyncStorage.getItem('lastDeviceId');
        while (attempts < 3 && lastDeviceId && !connected) {
          attempts += 1;
          try {
            // eslint-disable-next-line no-await-in-loop
            await manager.connectToDevice(lastDeviceId);
            connected = manager.isConnected();
          } catch (err) {
            // ignore and retry
          }
        }

        if (!connected) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'SomniSync connection',
              body: 'SomniSync lost connection to your device',
              data: { type: 'connection_lost' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
              repeats: false,
              channelId: 'connection',
            },
          });
        }
      }

      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[backgroundTasks] BLE poll task failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Create notification channels for Android and set global handler. */
export const initNotifications = async (): Promise<void> => {
  try {
    await Notifications.setNotificationChannelAsync('alarm', {
      name: 'Alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync('connection', {
      name: 'Connection',
      importance: Notifications.AndroidImportance.MIN,
    });

    // Show notifications only when app is backgrounded. If foreground, suppress.
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const state = AppState.currentState;
        const shouldShow = state !== 'active';
        return {
          shouldShowBanner: shouldShow,
          shouldShowList: shouldShow,
          shouldPlaySound: shouldShow,
          shouldSetBadge: false,
        };
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTasks] initNotifications failed', error);
  }
};

/** Schedule an alarm notification at the target timestamp (ms). */
export const scheduleAlarmNotification = async (title: string, body: string, targetTimestampMs: number): Promise<string | null> => {
  try {
    const trigger: Notifications.NotificationTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(targetTimestampMs),
      channelId: 'alarm',
    };
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'alarm' },
      },
      trigger,
    });
    await AsyncStorage.setItem(ALARM_NOTIFICATION_KEY, id);
    return id;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTasks] scheduleAlarmNotification failed', error);
    return null;
  }
};

export const cancelScheduledAlarmNotification = async (): Promise<void> => {
  try {
    const id = await AsyncStorage.getItem(ALARM_NOTIFICATION_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(ALARM_NOTIFICATION_KEY);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTasks] cancelScheduledAlarmNotification failed', error);
  }
};

/**
 * Register background task that polls BLE periodically when possible.
 * Note: actual intervals are OS-dependent; BackgroundTask uses minute-based scheduling.
 */
export const registerBlePollTask = async (): Promise<void> => {
  try {
    // Register with the shortest supported interval (OS may throttle further)
    await BackgroundTask.registerTaskAsync(BLE_POLL_TASK, {
      minimumInterval: 15,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTasks] registerBlePollTask failed', error);
  }
};

/** Unregister BLE poll task. */
export const unregisterBlePollTask = async (): Promise<void> => {
  try {
    if (TaskManager.isTaskDefined(BLE_POLL_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BLE_POLL_TASK);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[backgroundTasks] unregisterBlePollTask failed', error);
  }
};

/** Listen to notification responses and trigger wake sequence if user taps alarm. */
export const addNotificationResponseListener = (listener: (response: Notifications.NotificationResponse) => void) => {
  return Notifications.addNotificationResponseReceivedListener(listener);
};

export default {
  initNotifications,
  scheduleAlarmNotification,
  cancelScheduledAlarmNotification,
  registerBlePollTask,
  unregisterBlePollTask,
  addNotificationResponseListener,
};
