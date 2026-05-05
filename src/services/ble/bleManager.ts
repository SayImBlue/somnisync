import { BleManager as BlePlxManager, type Device } from 'react-native-ble-plx';

import { BLE_UUIDS } from './uuids';
import type { SensorData } from '../../types';

export type BleConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';

type BleManagerCallbacks = {
	onConnectionStateChange?: (state: BleConnectionState, connectedDeviceId: string | null) => void;
	onSensorData?: (sensorData: SensorData) => void;
	onError?: (error: Error) => void;
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

	public constructor(callbacks: BleManagerCallbacks = {}) {
		this.bleManager = new BlePlxManager();
		this.callbacks = callbacks;
		this.connectedDevice = null;
	}

	/** Start scanning for the SomniSync BLE service. */
	public async startScan(): Promise<void> {
		this.callbacks.onConnectionStateChange?.('scanning', this.connectedDevice?.id ?? null);

		this.bleManager.startDeviceScan(null, null, (error, device) => {
			if (error) {
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

	/** Stop the active BLE scan. */
	public async stopScan(): Promise<void> {
		this.bleManager.stopDeviceScan();
		this.callbacks.onConnectionStateChange?.(this.connectedDevice ? 'connected' : 'idle', this.connectedDevice?.id ?? null);
	}

	/** Connect to a peripheral by device ID and subscribe to telemetry. */
	public async connectToDevice(deviceId: string): Promise<void> {
		this.callbacks.onConnectionStateChange?.('connecting', deviceId);

		try {
			const device = await this.bleManager.connectToDevice(deviceId);
			await device.discoverAllServicesAndCharacteristics();
			this.connectedDevice = device;
			this.callbacks.onConnectionStateChange?.('connected', device.id);
			await this.subscribeToTelemetry(device);
		} catch (error) {
			const connectionError = error instanceof Error ? error : new Error('Unable to connect to BLE device.');
			this.callbacks.onError?.(connectionError);
			this.callbacks.onConnectionStateChange?.('error', null);
			throw connectionError;
		}
	}

	/** Disconnect the active peripheral, if any. */
	public async disconnect(): Promise<void> {
		this.callbacks.onConnectionStateChange?.('disconnecting', this.connectedDevice?.id ?? null);

		if (!this.connectedDevice) {
			this.callbacks.onConnectionStateChange?.('disconnected', null);
			return;
		}

		await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
		this.connectedDevice = null;
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

	private async subscribeToTelemetry(device: Device): Promise<void> {
		device.monitorCharacteristicForService(BLE_UUIDS.SERVICE, BLE_UUIDS.TEMPERATURE, (error, characteristic) => {
			if (error) {
				this.callbacks.onError?.(error);
				return;
			}

			const json = fromBase64(characteristic?.value);
			if (!json) {
				return;
			}

			const payload = JSON.parse(json) as { temp?: number };
			if (typeof payload.temp === 'number') {
				this.callbacks.onSensorData?.({ temperature: payload.temp, luminosity: 0, timestamp: Date.now() });
			}
		});

		device.monitorCharacteristicForService(BLE_UUIDS.SERVICE, BLE_UUIDS.LUMINOSITY, (error, characteristic) => {
			if (error) {
				this.callbacks.onError?.(error);
				return;
			}

			const json = fromBase64(characteristic?.value);
			if (!json) {
				return;
			}

			const payload = JSON.parse(json) as { lux?: number };
			if (typeof payload.lux === 'number') {
				this.callbacks.onSensorData?.({ temperature: 0, luminosity: payload.lux, timestamp: Date.now() });
			}
		});
	}
}

export const createBleManagerService = (callbacks?: BleManagerCallbacks): BleManagerService => new BleManagerService(callbacks);
