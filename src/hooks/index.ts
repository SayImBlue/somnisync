import { useShallow } from 'zustand/react/shallow';
import useAlarmStore from '../stores/alarmStore';
import useBleStore from '../stores/bleStore';
import useSleepStore from '../stores/sleepStore';

/** Read the latest sensor payload from the BLE layer. */
export const useSensorData = () => useBleStore((state) => state.lastSensorData);

/** Read the current inferred sleep phase. */
export const useSleepPhase = () => useSleepStore((state) => state.currentPhase);

/** Read the current alarm status and wake-sequence metadata. */
export const useAlarmStatus = () =>
  useAlarmStore(
    useShallow((state) => ({
      config: state.config,
      engineState: state.engineState,
      nextTriggerAt: state.nextTriggerAt,
      isWithinWakeWindow: state.isWithinWakeWindow,
      wakeSequenceStartedAt: state.wakeSequenceStartedAt,
      wakeSequenceProgress: state.wakeSequenceProgress,
    }))
  );

/** Read BLE connection and telemetry state for the UI. */
export const useBleConnection = () =>
  useBleStore(
    useShallow((state) => ({
      connectionState: state.connectionState,
      isScanning: state.isScanning,
      connectedDeviceId: state.connectedDeviceId,
      lastSensorData: state.lastSensorData,
      error: state.error,
    }))
  );

export {};
