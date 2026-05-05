import { CONFIG } from '@/config';
import { BleManagerService, createBleManagerService } from './bleManager';
import { MockBleManagerService, createMockBleManagerService } from './mockBleManager';
import type { BleConnectionState } from './bleManager';

type BleManagerCallbacks = {
	onConnectionStateChange?: (state: BleConnectionState, connectedDeviceId: string | null) => void;
	onSensorData?: (sensorData: { temperature: number; luminosity: number; timestamp: number }) => void;
	onError?: (error: Error) => void;
	onPermissionDenied?: () => void;
};

/**
 * Factory function that returns either a real or mock BLE manager based on CONFIG.USE_MOCK_BLE.
 * Both implementations share the same public interface, so callers don't need to know which is being used.
 */
export const createBleManager = (callbacks?: BleManagerCallbacks): BleManagerService | MockBleManagerService => {
	if (CONFIG.USE_MOCK_BLE) {
		return createMockBleManagerService(callbacks);
	}

	return createBleManagerService(callbacks);
};

// Re-export types so consumers can import from this file
export type { BleConnectionState } from './bleManager';
export { BleManagerService } from './bleManager';
export { MockBleManagerService } from './mockBleManager';
