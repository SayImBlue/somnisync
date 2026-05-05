import { create } from 'zustand';

import { BLE_UUIDS } from '../services/ble/uuids';
import type { SensorData, SleepPhase } from '../types';
import { createBleManager, type BleConnectionState, BleManagerService, MockBleManagerService } from '../services/ble';

type PendingWrite = {
	kind: 'light-control' | 'temp-setpoint' | 'sleep-phase';
	payload: Record<string, unknown>;
	timestamp: number;
};

export interface BleStore {
	connectionState: BleConnectionState;
	isScanning: boolean;
	connectedDeviceId: string | null;
	lastSensorData: SensorData | null;
	error: string | null;
	pendingWrites: PendingWrite[];
	reconnectAttempt: number;
	manager: BleManagerService | MockBleManagerService;
	startScan: () => Promise<void>;
	stopScan: () => Promise<void>;
	connectToDevice: (deviceId: string) => Promise<void>;
	disconnect: () => Promise<void>;
	writeLightControl: (brightness: number) => Promise<void>;
	writeTempSetpoint: (target: number) => Promise<void>;
	writeSleepPhase: (phase: SleepPhase) => Promise<void>;
	clearError: () => void;
}

const useBleStore = create<BleStore>((set, get) => {
	const manager = createBleManager({
		onConnectionStateChange: (connectionState, connectedDeviceId) => {
			set({ connectionState, connectedDeviceId, isScanning: connectionState === 'scanning' });
		},
		onSensorData: (sensorData) => {
			set({ lastSensorData: sensorData });
		},
		onError: (error) => {
			set({ error: error.message, connectionState: 'error' });
		},
		onPermissionDenied: () => {
			set({ error: 'BLE permissions denied. Please grant permissions in device settings.', connectionState: 'error' });
		},
	});

	return {
		connectionState: 'idle',
		isScanning: false,
		connectedDeviceId: null,
		lastSensorData: null,
		error: null,
		pendingWrites: [],
		reconnectAttempt: 0,
		manager,
		startScan: async () => {
			set({ isScanning: true, connectionState: 'scanning', error: null });
			await manager.startScan();
		},
		stopScan: async () => {
			await manager.stopScan();
			set({ isScanning: false, connectionState: 'idle' });
		},
		connectToDevice: async (deviceId) => {
			set({ connectionState: 'connecting', error: null });
			await manager.connectToDevice(deviceId);
		},
		disconnect: async () => {
			set({ connectionState: 'disconnecting' });
			await manager.disconnect();
			set({ connectionState: 'disconnected', connectedDeviceId: null, isScanning: false });
		},
		writeLightControl: async (brightness) => {
			const payload = { brightness };
			set((state) => ({
				pendingWrites: [...state.pendingWrites, { kind: 'light-control', payload, timestamp: Date.now() }],
			}));
			await manager.writeJson(BLE_UUIDS.LIGHT_CONTROL, payload);
		},
		writeTempSetpoint: async (target) => {
			const payload = { target };
			set((state) => ({
				pendingWrites: [...state.pendingWrites, { kind: 'temp-setpoint', payload, timestamp: Date.now() }],
			}));
			await manager.writeJson(BLE_UUIDS.TEMP_SETPOINT, payload, true);
		},
		writeSleepPhase: async (phase) => {
			const payload = { phase };
			set((state) => ({
				pendingWrites: [...state.pendingWrites, { kind: 'sleep-phase', payload, timestamp: Date.now() }],
			}));
			await manager.writeJson(BLE_UUIDS.SLEEP_PHASE, payload);
		},
		clearError: () => set({ error: null }),
	};
});

export default useBleStore;
