import type { SensorData } from '../../types';
import { BLE_UUIDS } from './uuids';
import type { BleConnectionState } from './bleManager';

type BleManagerCallbacks = {
	onConnectionStateChange?: (state: BleConnectionState, connectedDeviceId: string | null) => void;
	onSensorData?: (sensorData: SensorData) => void;
	onError?: (error: Error) => void;
	onPermissionDenied?: () => void;
};

/**
 * Mock BLE manager that simulates ESP32 behavior for UI development and testing.
 * Generates realistic sensor data and connection patterns without requiring a real device.
 */
export class MockBleManagerService {
	private readonly callbacks: BleManagerCallbacks;
	private connectedDeviceId: string | null;
	private isAborted: boolean;
	private connectionState: BleConnectionState;
	private telemetryIntervalId: ReturnType<typeof setInterval> | null;
	private disconnectTimeoutId: ReturnType<typeof setTimeout> | null;
	private phaseTransitionTimeoutId: ReturnType<typeof setTimeout> | null;

	// Sensor simulation state
	private currentTemperature: number;
	private currentLuminosity: number;
	private respiratoryPhase: 'AWAKE' | 'LIGHT' | 'DEEP';

	public constructor(callbacks: BleManagerCallbacks = {}) {
		this.callbacks = callbacks;
		this.connectedDeviceId = null;
		this.isAborted = false;
		this.connectionState = 'idle';
		this.telemetryIntervalId = null;
		this.disconnectTimeoutId = null;
		this.phaseTransitionTimeoutId = null;

		// Initialize sensor state
		this.currentTemperature = 22; // °C
		this.currentLuminosity = 800; // lux
		this.respiratoryPhase = 'LIGHT';
	}

	/** Simulate BLE scan and auto-connect to mock device. */
	public async startScan(): Promise<void> {
		if (this.isAborted) {
			return;
		}

		this.connectionState = 'scanning';
		this.callbacks.onConnectionStateChange?.('scanning', null);

		// Simulate connection delay of 1.5 seconds
		await new Promise((resolve) => setTimeout(resolve, 1500));

		if (this.isAborted) {
			return;
		}

		// Auto-connect to mock device
		this.connectedDeviceId = 'mock-somnisync-device-001';
		await this.connectToDevice(this.connectedDeviceId);
	}

	/** Stop the mock scan. */
	public async stopScan(): Promise<void> {
		if (this.telemetryIntervalId) {
			clearInterval(this.telemetryIntervalId);
			this.telemetryIntervalId = null;
		}

		this.connectionState = this.connectedDeviceId ? 'connected' : 'idle';
		this.callbacks.onConnectionStateChange?.(this.connectionState, this.connectedDeviceId);
	}

	/** Simulate connecting to the device. */
	public async connectToDevice(deviceId: string): Promise<void> {
		if (this.isAborted) {
			return;
		}

		this.connectionState = 'connecting';
		this.callbacks.onConnectionStateChange?.('connecting', deviceId);

		// Simulate connection success
		await new Promise((resolve) => setTimeout(resolve, 500));

		if (this.isAborted) {
			return;
		}

		this.connectedDeviceId = deviceId;
		this.connectionState = 'connected';
		this.callbacks.onConnectionStateChange?.('connected', deviceId);

		// Start telemetry simulation
		this.startTelemetrySimulation();

		// Schedule random disconnection every 8–12 minutes
		this.scheduleRandomDisconnection();
	}

	/** Simulate disconnection from the device. */
	public async disconnect(): Promise<void> {
		this.clearAllTimers();
		this.connectionState = 'disconnecting';
		this.callbacks.onConnectionStateChange?.('disconnecting', this.connectedDeviceId);

		// Simulate disconnection completion
		await new Promise((resolve) => setTimeout(resolve, 200));

		if (!this.isAborted) {
			this.connectedDeviceId = null;
			this.connectionState = 'disconnected';
			this.callbacks.onConnectionStateChange?.('disconnected', null);
		}
	}

	/** Simulate writing JSON to a BLE characteristic. */
	public async writeJson(uuid: string, payload: unknown, withResponse = false): Promise<void> {
		if (!this.connectedDeviceId) {
			throw new Error('No BLE device is currently connected.');
		}

		// Simulate write latency
		await new Promise((resolve) => setTimeout(resolve, 100));

		// In mock mode, we just log the write for now
		// eslint-disable-next-line no-console
		console.debug(`[Mock BLE] Write to ${uuid}:`, payload);
	}

	/** Abort all timers and operations. */
	public abort(): void {
		this.isAborted = true;
		this.clearAllTimers();
	}

	/** Check if a device is currently connected. */
	public isConnected(): boolean {
		return this.connectedDeviceId !== null && this.connectionState === 'connected';
	}

	private clearAllTimers(): void {
		if (this.telemetryIntervalId) {
			clearInterval(this.telemetryIntervalId);
			this.telemetryIntervalId = null;
		}

		if (this.disconnectTimeoutId) {
			clearTimeout(this.disconnectTimeoutId);
			this.disconnectTimeoutId = null;
		}

		if (this.phaseTransitionTimeoutId) {
			clearTimeout(this.phaseTransitionTimeoutId);
			this.phaseTransitionTimeoutId = null;
		}
	}

	private startTelemetrySimulation(): void {
		if (this.telemetryIntervalId) {
			return; // Already running
		}

		// Schedule initial phase transition
		this.schedulePhaseTransition();

		// Emit sensor data every 30 seconds
		this.telemetryIntervalId = setInterval(() => {
			if (this.isAborted) {
				return;
			}

			// Update temperature: drift ±0.5°C randomly
			const tempDrift = (Math.random() - 0.5) * 1.0; // Range: -0.5 to +0.5
			this.currentTemperature += tempDrift;
			this.currentTemperature = Math.max(18, Math.min(26, this.currentTemperature)); // Clamp 18–26°C

			// Update luminosity: gradually decrease from 800 to 0 over 20 minutes
			// (600 seconds) = -1.33 lux per 30-second interval
			this.currentLuminosity = Math.max(0, this.currentLuminosity - 1.33);

			this.callbacks.onSensorData?.({
				temperature: Math.round(this.currentTemperature * 10) / 10, // Round to 1 decimal
				luminosity: Math.round(this.currentLuminosity),
				timestamp: Date.now(),
			});
		}, 30_000); // Every 30 seconds
	}

	private schedulePhaseTransition(): void {
		if (this.isAborted) {
			return;
		}

		// Transition every 5–10 minutes randomly
		const delayMs = 5 * 60 * 1000 + Math.random() * 5 * 60 * 1000; // 5–10 minutes

		this.phaseTransitionTimeoutId = setTimeout(() => {
			this.phaseTransitionTimeoutId = null;

			if (this.isAborted) {
				return;
			}

			// Cycle through phases: AWAKE → LIGHT → DEEP → LIGHT → AWAKE → ...
			const phases = ['AWAKE', 'LIGHT', 'DEEP', 'LIGHT'] as const;
			const currentIndex = phases.indexOf(this.respiratoryPhase);
			this.respiratoryPhase = phases[(currentIndex + 1) % phases.length];

			// Simulate phase emission (in real app, this would drive the respiratory frequency estimate)
			// eslint-disable-next-line no-console
			console.debug(`[Mock BLE] Phase transition to ${this.respiratoryPhase}`);

			// Schedule next transition
			this.schedulePhaseTransition();
		}, delayMs);
	}

	private scheduleRandomDisconnection(): void {
		if (this.isAborted) {
			return;
		}

		// Simulate occasional disconnect every 8–12 minutes
		const delayMs = 8 * 60 * 1000 + Math.random() * 4 * 60 * 1000; // 8–12 minutes

		this.disconnectTimeoutId = setTimeout(() => {
			this.disconnectTimeoutId = null;

			if (this.isAborted || !this.connectedDeviceId) {
				return;
			}

			// eslint-disable-next-line no-console
			console.debug('[Mock BLE] Simulating random disconnection to test reconnect logic');

			// Simulate disconnection
			this.clearAllTimers();
			this.connectionState = 'disconnected';
			const disconnectedDeviceId = this.connectedDeviceId;
			this.connectedDeviceId = null;

			this.callbacks.onConnectionStateChange?.('disconnected', disconnectedDeviceId);

			// Trigger reconnect logic in the manager (via bleStore callback)
			// The store will call attemptReconnect() which will retry the connection
		}, delayMs);
	}
}

export const createMockBleManagerService = (callbacks?: BleManagerCallbacks): MockBleManagerService =>
	new MockBleManagerService(callbacks);
