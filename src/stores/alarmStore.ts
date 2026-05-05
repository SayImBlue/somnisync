import { create } from 'zustand';

import type { AlarmConfig, SleepPhase } from '../types';

export type AlarmEngineState = 'idle' | 'armed' | 'triggered' | 'snoozed' | 'wake-sequence';

export interface AlarmStore {
	config: AlarmConfig;
	engineState: AlarmEngineState;
	nextTriggerAt: string | null;
	isWithinWakeWindow: boolean;
	wakeSequenceStartedAt: number | null;
	wakeSequenceProgress: number;
	setConfig: (config: AlarmConfig) => void;
	armAlarm: () => void;
	disarmAlarm: () => void;
	evaluateAlarm: (currentPhase: SleepPhase, now?: number) => boolean;
	triggerWakeSequence: (now?: number) => void;
	stopWakeSequence: () => void;
	clearAlarmState: () => void;
}

const DEFAULT_CONFIG: AlarmConfig = {
	targetTime: '',
	windowMinutes: 30,
	enabled: false,
};

const parseTargetTime = (targetTime: string): number => {
	const parsed = Date.parse(targetTime);
	return Number.isNaN(parsed) ? 0 : parsed;
};

const getWakeSequenceProgress = (startedAt: number | null, now: number): number => {
	if (!startedAt) {
		return 0;
	}

	const elapsedMs = now - startedAt;
	const durationMs = 10 * 60 * 1000;
	return Math.max(0, Math.min(1, elapsedMs / durationMs));
};

const useAlarmStore = create<AlarmStore>((set, get) => ({
	config: DEFAULT_CONFIG,
	engineState: 'idle',
	nextTriggerAt: null,
	isWithinWakeWindow: false,
	wakeSequenceStartedAt: null,
	wakeSequenceProgress: 0,
	/** Replace the active alarm configuration and recompute the next trigger time. */
	setConfig: (config) => {
		const targetTimestamp = parseTargetTime(config.targetTime);
		const nextTriggerAt = targetTimestamp > 0 ? new Date(targetTimestamp).toISOString() : null;
		set({ config, nextTriggerAt, engineState: config.enabled ? 'armed' : 'idle' });
	},
	/** Arm the alarm engine so the current config can trigger inside the wake window. */
	armAlarm: () => {
		set({ engineState: 'armed' });
	},
	/** Disarm the alarm engine and clear transient wake state. */
	disarmAlarm: () => {
		set({ engineState: 'idle', isWithinWakeWindow: false, wakeSequenceStartedAt: null, wakeSequenceProgress: 0 });
	},
	/** Evaluate the alarm against the current phase and clock time. */
	evaluateAlarm: (currentPhase, now = Date.now()) => {
		const { config } = get();
		if (!config.enabled || !config.targetTime) {
			set({ isWithinWakeWindow: false });
			return false;
		}

		const targetTimestamp = parseTargetTime(config.targetTime);
		if (!targetTimestamp) {
			set({ isWithinWakeWindow: false });
			return false;
		}

		const windowMs = config.windowMinutes * 60 * 1000;
		const isWithinWakeWindow = Math.abs(now - targetTimestamp) <= windowMs;
		const shouldTrigger = isWithinWakeWindow && currentPhase === 'LIGHT';

		set({ isWithinWakeWindow });

		if (shouldTrigger) {
			get().triggerWakeSequence(now);
		}

		return shouldTrigger;
	},
	/** Begin the progressive wake sequence used for the SomniSync alarm ramp. */
	triggerWakeSequence: (now = Date.now()) => {
		set({ engineState: 'wake-sequence', wakeSequenceStartedAt: now, wakeSequenceProgress: 0 });
	},
	/** Stop any active wake sequence and return the engine to armed or idle state. */
	stopWakeSequence: () => {
		set((state) => ({
			engineState: state.config.enabled ? 'armed' : 'idle',
			wakeSequenceStartedAt: null,
			wakeSequenceProgress: 0,
		}));
	},
	/** Clear all alarm state back to the default configuration. */
	clearAlarmState: () => {
		set({
			config: DEFAULT_CONFIG,
			engineState: 'idle',
			nextTriggerAt: null,
			isWithinWakeWindow: false,
			wakeSequenceStartedAt: null,
			wakeSequenceProgress: 0,
		});
	},
}));

export { getWakeSequenceProgress };
export default useAlarmStore;
