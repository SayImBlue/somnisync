// TODO(Al Farouk): keep these shared contracts stable unless the BLE protocol is formally updated.

export interface SensorData {
	temperature: number;
	luminosity: number;
	timestamp: number;
}

export type SleepPhase = 'LIGHT' | 'DEEP' | 'TRANSITIONAL' | 'AWAKE';

export interface AlarmConfig {
	targetTime: string;
	windowMinutes: number;
	enabled: boolean;
}

export interface SleepPhaseEntry {
	phase: SleepPhase;
	startTime: number;
	endTime: number;
}

export interface NightLog {
	date: string;
	phases: SleepPhaseEntry[];
	sensorSnapshots: SensorData[];
}
