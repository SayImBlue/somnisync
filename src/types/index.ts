// TODO(Al Farouk): keep these shared contracts stable unless the BLE protocol is formally updated.

export interface SensorData {
	temperature: number;
	luminosity: number;
	timestamp: number;
}

export type SleepPhase = 'LIGHT' | 'DEEP' | 'TRANSITIONAL' | 'AWAKE' | 'SIGNAL_LOST';

export interface PhaseDerivationResult {
	phase: SleepPhase;
	confidenceScore: number; // 0–1: how centered the frequency is in the valid band
	isValid: boolean; // false if frequency is out of detectable range
}

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
