import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NightLog, SleepPhase } from '../../types';

const NIGHT_LOGS_STORAGE_KEY = 'somnisync:night-logs';
const STORAGE_VERSION_KEY = 'somnisync:storage-version';
const MAX_LOG_COUNT = 7;
const STORAGE_VERSION = 1; // For future schema migrations

/**
 * Summary of a night's sleep without exposing raw sensor data to UI.
 * Useful for history views and statistics.
 */
export interface NightSummary {
	date: string;
	avgTemperature: number; // Average ambient temperature (°C)
	avgLuminosity: number; // Average ambient luminosity (lux)
	dominantPhase: SleepPhase; // Most common sleep phase during the night
	totalSleepMinutes: number; // Total duration of sleep (all phases)
}

/**
 * Read stored logs and filter out any corrupted entries.
 * If JSON parsing fails for the entire log set, returns empty array instead of crashing.
 */
const readStoredLogs = async (): Promise<NightLog[]> => {
	try {
		const rawValue = await AsyncStorage.getItem(NIGHT_LOGS_STORAGE_KEY);
		if (!rawValue) {
			return [];
		}

		const parsed = JSON.parse(rawValue) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		// Filter out corrupted entries while preserving valid ones
		const logs: NightLog[] = [];
		for (const entry of parsed) {
			try {
				// Minimal validation: check that required fields exist
				if (
					entry &&
					typeof entry === 'object' &&
					'date' in entry &&
					'phases' in entry &&
					'sensorSnapshots' in entry &&
					typeof entry.date === 'string' &&
					Array.isArray(entry.phases) &&
					Array.isArray(entry.sensorSnapshots)
				) {
					logs.push(entry as NightLog);
				}
			} catch {
				// Skip this corrupted entry, continue with others
				// eslint-disable-next-line no-console
				console.warn(`[NightLogStorage] Skipped corrupted NightLog entry: ${JSON.stringify(entry)}`);
			}
		}

		return logs;
	} catch (error) {
		// JSON parsing failed completely; return empty array to prevent crash
		// eslint-disable-next-line no-console
		console.warn('[NightLogStorage] Failed to parse stored logs:', error);
		return [];
	}
};

/**
 * Write logs to AsyncStorage, handling quota errors gracefully.
 * If the write fails due to quota exceeded, deletes the oldest log and retries.
 *
 * @throws Error if retry fails or if AsyncStorage is unavailable
 */
const writeStoredLogs = async (logs: NightLog[]): Promise<void> => {
	const logsToStore = logs.slice(0, MAX_LOG_COUNT);

	try {
		await AsyncStorage.setItem(NIGHT_LOGS_STORAGE_KEY, JSON.stringify(logsToStore));
	} catch (error) {
		// Check if this is a quota exceeded error
		const isQuotaError =
			error instanceof Error &&
			(error.message.includes('QuotaExceeded') ||
				error.message.includes('quota') ||
				error.message.includes('ENOMEM'));

		if (isQuotaError && logsToStore.length > 1) {
			// eslint-disable-next-line no-console
			console.warn('[NightLogStorage] AsyncStorage quota exceeded; deleting oldest log and retrying');

			// Remove the oldest log (last in array, since newest-first order) and retry
			const logsWithOldestRemoved = logsToStore.slice(0, -1);
			await writeStoredLogs(logsWithOldestRemoved);
		} else {
			// Not a quota error, or can't retry; rethrow
			throw error;
		}
	}
};

/**
 * Calculate the dominant sleep phase (most time spent) during a night.
 */
const getDominantPhase = (nightLog: NightLog): SleepPhase => {
	const phaseDurations: Record<SleepPhase, number> = {
		LIGHT: 0,
		DEEP: 0,
		TRANSITIONAL: 0,
		AWAKE: 0,
		SIGNAL_LOST: 0,
	};

	for (const entry of nightLog.phases) {
		const duration = (entry.endTime || entry.startTime) - entry.startTime;
		phaseDurations[entry.phase] += duration;
	}

	// Find the phase with the most time (excluding SIGNAL_LOST)
	const validPhases: SleepPhase[] = ['DEEP', 'LIGHT', 'TRANSITIONAL', 'AWAKE'];
	let dominantPhase: SleepPhase = 'AWAKE';
	let maxDuration = 0;

	for (const phase of validPhases) {
		if (phaseDurations[phase] > maxDuration) {
			maxDuration = phaseDurations[phase];
			dominantPhase = phase;
		}
	}

	return dominantPhase;
};

/**
 * Compute a night summary from a NightLog without exposing raw sensor data.
 * Useful for UI that needs statistics without full telemetry.
 */
export const getNightSummary = (nightLog: NightLog): NightSummary => {
	// Calculate average temperature
	const tempSnapshots = nightLog.sensorSnapshots.filter((s) => s.temperature > 0);
	const avgTemperature =
		tempSnapshots.length > 0
			? tempSnapshots.reduce((sum, s) => sum + s.temperature, 0) / tempSnapshots.length
			: 0;

	// Calculate average luminosity
	const luxSnapshots = nightLog.sensorSnapshots.filter((s) => s.luminosity >= 0);
	const avgLuminosity =
		luxSnapshots.length > 0
			? luxSnapshots.reduce((sum, s) => sum + s.luminosity, 0) / luxSnapshots.length
			: 0;

	// Calculate total sleep time (all phases except SIGNAL_LOST)
	const totalSleepMs = nightLog.phases.reduce((sum, entry) => {
		if (entry.phase === 'SIGNAL_LOST') {
			return sum;
		}

		const duration = (entry.endTime || entry.startTime) - entry.startTime;
		return sum + duration;
	}, 0);

	const totalSleepMinutes = Math.round(totalSleepMs / 60_000);
	const dominantPhase = getDominantPhase(nightLog);

	return {
		date: nightLog.date,
		avgTemperature: Math.round(avgTemperature * 10) / 10,
		avgLuminosity: Math.round(avgLuminosity),
		dominantPhase,
		totalSleepMinutes,
	};
};

/**
 * Check storage version and perform any necessary migrations.
 * This is a stub for future schema upgrades.
 * Call this on app startup before loading logs.
 */
export const migrateIfNeeded = async (): Promise<void> => {
	try {
		const storedVersion = await AsyncStorage.getItem(STORAGE_VERSION_KEY);
		const parsedVersion = storedVersion ? parseInt(storedVersion, 10) : 0;

		if (parsedVersion < STORAGE_VERSION) {
			// TODO: Add migration logic here if schema changes
			// For now, just update the version
			await AsyncStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
		}
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[NightLogStorage] Migration check failed:', error);
		// Continue anyway; migration errors should not block app startup
	}
};

/**
 * Read the last seven stored sleep logs, newest first.
 * Automatically filters out corrupted entries.
 * Call migrateIfNeeded() at app startup before using this function.
 */
export const getLastSevenNights = async (): Promise<NightLog[]> => {
	const logs = await readStoredLogs();
	return logs.slice(0, MAX_LOG_COUNT);
};

/**
 * Persist a night log and enforce the rolling 7-night window.
 * When the 8th log is added, the oldest log is automatically deleted.
 * Handles storage quota errors by deleting the oldest log and retrying.
 *
 * If the app is killed mid-night, call this with whatever data has been recorded
 * and it will be preserved as a partial night log.
 */
export const saveNightLog = async (nightLog: NightLog): Promise<void> => {
	try {
		const logs = await readStoredLogs();

		// Remove any existing log with the same date (update) or keep all others
		const filteredLogs = logs.filter((log) => log.date !== nightLog.date);

		// Insert new/updated log at the beginning (newest first)
		const nextLogs = [nightLog, ...filteredLogs];

		// Enforce 7-night window: keep only the most recent 7
		const logsToStore = nextLogs.slice(0, MAX_LOG_COUNT);

		await writeStoredLogs(logsToStore);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('[NightLogStorage] Failed to save night log:', error);
		throw error; // Propagate so caller can handle
	}
};

/** Remove all stored night logs from local persistence. */
export const clearNightLogs = async (): Promise<void> => {
	try {
		await AsyncStorage.removeItem(NIGHT_LOGS_STORAGE_KEY);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('[NightLogStorage] Failed to clear night logs:', error);
		throw error;
	}
};

/**
 * Initialize storage on app startup.
 * Checks for schema migrations and validates stored data.
 * Call this once when the app launches.
 */
export const initializeStorage = async (): Promise<void> => {
	await migrateIfNeeded();
};

export { NIGHT_LOGS_STORAGE_KEY, STORAGE_VERSION };
