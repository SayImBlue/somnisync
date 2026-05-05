import { BleManager as BlePlxManager, type Device } from 'react-native-ble-plx';
import { Platform } from 'react-native';

import { BLE_UUIDS } from './uuids';
import type { SensorData } from '../../types';

export type BleConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'reconnecting' | 'error';

interface ReconnectConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

type BleManagerCallbacks = {
	onConnectionStateChange?: (state: BleConnectionState, connectedDeviceId: string | null) => void;
	onSensorData?: (sensorData: SensorData) => void;
	onError?: (error: Error) => void;
	onPermissionDenied?: () => void;
};

const toBase64 = (value: unknown): string => {
	const json = JSON.stringify(value);
	if (typeof globalThis.btoa === 'function') {
		return globalThis.btoa(json);
	}

	throw new Error('Base64 encoding is unavailable in this runtime.');
};

const fromBase64 = (encodedValue: string | null | undefined): string => {
	if (!encodedValue) {
		return '';
	}

	if (typeof globalThis.atob === 'function') {
		return globalThis.atob(encodedValue);
	}

	throw new Error('Base64 decoding is unavailable in this runtime.');
};

export class BleManagerService {
	private readonly bleManager: BlePlxManager;
	private readonly callbacks: BleManagerCallbacks;
	private connectedDevice: Device | null;
	private reconnectConfig: ReconnectConfig;
	private reconnectAttempt: number;
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null;
	private scanTimeoutId: ReturnType<typeof setTimeout> | null;
	private isAborted: boolean;
	private deviceToReconnect: string | null;

	public constructor(callbacks: BleManagerCallbacks = {}, reconnectConfig: Partial<ReconnectConfig> = {}) {
		this.bleManager = new BlePlxManager();
		this.callbacks = callbacks;
		this.connectedDevice = null;
		this.reconnectConfig = {
			maxAttempts: 5,
			initialDelayMs: 1000,
			maxDelayMs: 32000,
			backoffMultiplier: 2,
			...reconnectConfig,
		};
		this.reconnectAttempt = 0;
		this.reconnectTimeoutId = null;
		this.scanTimeoutId = null;
		this.isAborted = false;
		this.deviceToReconnect = null;
	}

	/** Check whether the platform allows BLE scanning. */
	private async checkPermissionsAsync(): Promise<boolean> {
		try {
			// On Android 12+, BLE permissions must be requested at the app level
			// On iOS, NSBluetoothPeripheralUsageDescription must be in Info.plist
			// This is a simplified check; actual permission handling should be done by the app
			if (Platform.OS === 'android') {
				// Return true here; the app is expected to handle permissions separately
				// via react-native's PermissionsAndroid API
				return true;
			}

			return true;
		} catch (error) {
			return false;
		}
	}

	/** Start scanning for the SomniSync BLE service. */
	public async startScan(): Promise<void> {
		if (this.isAborted) {
			return;
		}

		const hasPermission = await this.checkPermissionsAsync();
		if (!hasPermission) {
			const error = new Error('BLE permissions denied on this device.');
			this.callbacks.onPermissionDenied?.();
			this.callbacks.onError?.(error);
			this.callbacks.onConnectionStateChange?.('error', this.connectedDevice?.id ?? null);
			return;
		}

		this.callbacks.onConnectionStateChange?.('scanning', this.connectedDevice?.id ?? null);

		this.bleManager.startDeviceScan(null, null, (error, device) => {
			if (this.isAborted) {
				return;
			}

			if (error) {
				if (error.message?.includes('permission')) {
					this.callbacks.onPermissionDenied?.();
				}

				this.callbacks.onError?.(error);
				this.callbacks.onConnectionStateChange?.('error', this.connectedDevice?.id ?? null);
				return;
			}

			if (!device?.name && !device?.localName) {
				return;
			}

			const advertisedName = device.name ?? device.localName;
			if (advertisedName?.includes('SomniSync')) {
				void this.connectToDevice(device.id);
			}
		});
	}

	/** Stop the active BLE scan and clear timeouts. */
	public async stopScan(): Promise<void> {
		if (this.scanTimeoutId) {
			clearTimeout(this.scanTimeoutId);
			this.scanTimeoutId = null;
		}

		this.bleManager.stopDeviceScan();
		this.callbacks.onConnectionStateChange?.(this.connectedDevice ? 'connected' : 'idle', this.connectedDevice?.id ?? null);
	}

	/** Connect to a peripheral by device ID and subscribe to telemetry. */
	public async connectToDevice(deviceId: string): Promise<void> {
		if (this.isAborted) {
			return;
		}

		this.resetReconnectState();
		this.callbacks.onConnectionStateChange?.('connecting', deviceId);

		try {
			const device = await this.bleManager.connectToDevice(deviceId);
			await device.discoverAllServicesAndCharacteristics();
			this.connectedDevice = device;
			this.deviceToReconnect = deviceId;
			this.callbacks.onConnectionStateChange?.('connected', device.id);
			await this.subscribeToTelemetry(device);
		} catch (error) {
			const connectionError = error instanceof Error ? error : new Error('Unable to connect to BLE device.');
			if (connectionError.message?.includes('permission')) {
				this.callbacks.onPermissionDenied?.();
			}

			this.callbacks.onError?.(connectionError);
			this.callbacks.onConnectionStateChange?.('error', null);
		}
	}

	/** Disconnect the active peripheral, if any, and cancel any pending reconnects. */
	public async disconnect(): Promise<void> {
		this.clearReconnectTimeout();
		this.callbacks.onConnectionStateChange?.('disconnecting', this.connectedDevice?.id ?? null);

		if (!this.connectedDevice) {
			this.callbacks.onConnectionStateChange?.('disconnected', null);
			return;
		}

		try {
			await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
		} catch (error) {
			// Ignore errors during cancellation
		}

		this.connectedDevice = null;
		this.deviceToReconnect = null;
		this.callbacks.onConnectionStateChange?.('disconnected', null);
	}

	/** Write a JSON payload to a characteristic, optionally with response. */
	public async writeJson(uuid: string, payload: unknown, withResponse = false): Promise<void> {
		if (!this.connectedDevice) {
			throw new Error('No BLE device is currently connected.');
		}

		const data = toBase64(payload);
		if (withResponse) {
			await this.connectedDevice.writeCharacteristicWithResponseForService(BLE_UUIDS.SERVICE, uuid, data);
			return;
		}

		await this.connectedDevice.writeCharacteristicWithoutResponseForService(BLE_UUIDS.SERVICE, uuid, data);
	}

	private resetReconnectState(): void {
		this.reconnectAttempt = 0;
		this.clearReconnectTimeout();
	}

	private clearReconnectTimeout(): void {
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}
	}

	private getReconnectDelayMs(): number {
		const { initialDelayMs, maxDelayMs, backoffMultiplier } = this.reconnectConfig;
		const delay = initialDelayMs * Math.pow(backoffMultiplier, this.reconnectAttempt);
		return Math.min(delay, maxDelayMs);
	}

	private async attemptReconnect(): Promise<void> {
		if (this.isAborted || !this.deviceToReconnect) {
			return;
		}

		if (this.reconnectAttempt >= this.reconnectConfig.maxAttempts) {
			const error = new Error('Max reconnection attempts reached.');
			this.callbacks.onError?.(error);
			this.callbacks.onConnectionStateChange?.('error', null);
			this.deviceToReconnect = null;
			return;
		}

		this.reconnectAttempt += 1;
		const delayMs = this.getReconnectDelayMs();
		this.callbacks.onConnectionStateChange?.('reconnecting', this.deviceToReconnect);

		this.reconnectTimeoutId = setTimeout(() => {
			this.reconnectTimeoutId = null;
			void this.connectToDevice(this.deviceToReconnect!);
		}, delayMs);
	}

	private parseJsonPayload(base64Value: string | null | undefined): Record<string, unknown> | null {
		try {
			if (!base64Value) {
				return null;
			}

			const json = fromBase64(base64Value);
			if (!json) {
				return null;
			}

			return JSON.parse(json) as Record<string, unknown>;
		} catch (error) {
			const parseError = error instanceof Error ? error : new Error('Failed to parse BLE characteristic.');
			this.callbacks.onError?.(parseError);
			return null;
		}
	}

	private async handleDisconnection(): Promise<void> {
		if (this.isAborted) {
			return;
		}

		if (this.deviceToReconnect) {
			this.callbacks.onConnectionStateChange?.('disconnected', this.connectedDevice?.id ?? null);
			await this.attemptReconnect();
		} else {
			this.connectedDevice = null;
			this.callbacks.onConnectionStateChange?.('disconnected', null);
		}
	}

	public abort(): void {
		this.isAborted = true;
		this.clearReconnectTimeout();

		if (this.scanTimeoutId) {
			clearTimeout(this.scanTimeoutId);
			this.scanTimeoutId = null;
		}
	}

	public isConnected(): boolean {
		return this.connectedDevice !== null;
	}

	private async subscribeToTelemetry(device: Device): Promise<void> {
		try {
			device.monitorCharacteristicForService(BLE_UUIDS.SERVICE, BLE_UUIDS.TEMPERATURE, (error, characteristic) => {
				if (error) {
					if (error.message?.includes('disconnected')) {
						void this.handleDisconnection();
						return;
					}

					this.callbacks.onError?.(error);
					return;
				}

				const payload = this.parseJsonPayload(characteristic?.value);
				if (payload && typeof payload.temp === 'number') {
					this.callbacks.onSensorData?.({
						temperature: payload.temp,
						luminosity: 0,
						timestamp: Date.now(),
					});
				}
			});

			device.monitorCharacteristicForService(BLE_UUIDS.SERVICE, BLE_UUIDS.LUMINOSITY, (error, characteristic) => {
				if (error) {
					if (error.message?.includes('disconnected')) {
						void this.handleDisconnection();
						return;
					}

					this.callbacks.onError?.(error);
					return;
				}

				const payload = this.parseJsonPayload(characteristic?.value);
				if (payload && typeof payload.lux === 'number') {
					this.callbacks.onSensorData?.({
						temperature: 0,
						luminosity: payload.lux,
						timestamp: Date.now(),
					});
				}
			});
		} catch (error) {
			const subscribeError = error instanceof Error ? error : new Error('Failed to subscribe to telemetry.');
			this.callbacks.onError?.(subscribeError);
		}
	}
}

export const createBleManagerService = (callbacks?: BleManagerCallbacks, reconnectConfig?: Partial<ReconnectConfig>): BleManagerService => new BleManagerService(callbacks, reconnectConfig);
