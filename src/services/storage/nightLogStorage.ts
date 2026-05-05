import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NightLog } from '../../types';

const NIGHT_LOGS_STORAGE_KEY = 'somnisync:night-logs';
const MAX_LOG_COUNT = 7;

const readStoredLogs = async (): Promise<NightLog[]> => {
	const rawValue = await AsyncStorage.getItem(NIGHT_LOGS_STORAGE_KEY);
	if (!rawValue) {
		return [];
	}

	try {
		const parsed = JSON.parse(rawValue) as NightLog[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const writeStoredLogs = async (logs: NightLog[]): Promise<void> => {
	await AsyncStorage.setItem(NIGHT_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOG_COUNT)));
};

/** Read the last seven stored sleep logs, newest first. */
export const getLastSevenNights = async (): Promise<NightLog[]> => {
	const logs = await readStoredLogs();
	return logs.slice(0, MAX_LOG_COUNT);
};

/** Persist a night log and keep only the most recent seven entries. */
export const saveNightLog = async (nightLog: NightLog): Promise<void> => {
	const logs = await readStoredLogs();
	const nextLogs = [nightLog, ...logs.filter((log) => log.date !== nightLog.date)];
	await writeStoredLogs(nextLogs);
};

/** Remove all stored night logs from local persistence. */
export const clearNightLogs = async (): Promise<void> => {
	await AsyncStorage.removeItem(NIGHT_LOGS_STORAGE_KEY);
};

export { NIGHT_LOGS_STORAGE_KEY };
