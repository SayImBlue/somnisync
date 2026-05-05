import { create } from 'zustand';

import type { AlarmConfig, SleepPhase } from '../types';

export type AlarmEngineState = 'idle' | 'armed' | 'triggered' | 'snoozed' | 'wake-sequence';

/**
 * Snooze configuration: how long to snooze for, and minimum delay between snoozes.
 */
const SNOOZE_DURATION_MINUTES = 10;
const SNOOZE_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Minimum window clamp: if alarm is set less than 30 min from now,
 * reduce the window to the available time to prevent stale triggers.
 */
const DEFAULT_WINDOW_MINUTES = 30;
const MIN_CLAMP_WINDOW_MINUTES = 1; // At least 1 minute of window

export interface AlarmStore {
	config: AlarmConfig;
	engineState: AlarmEngineState;
	nextTriggerAt: string | null;
	isWithinWakeWindow: boolean;
	wakeSequenceStartedAt: number | null;
	wakeSequenceProgress: number;
	lastSnoozeAt: number | null; // Debounce rapid snooze taps
	snoozeDurationMinutes: number; // How long the current snooze lasts
	setConfig: (config: AlarmConfig) => void;
	armAlarm: () => void;
	disarmAlarm: () => void;
	evaluateAlarm: (currentPhase: SleepPhase, now?: number) => boolean;
	triggerWakeSequence: (now?: number) => void;
	updateWakeSequenceProgress: (now?: number) => void;
	stopWakeSequence: () => void;
	snooze: (durationMinutes?: number, now?: number) => boolean; // Debounced snooze
	clearAlarmState: () => void;
	recalculateAfterTimezoneChange: () => void; // Handle timezone changes
}

const DEFAULT_CONFIG: AlarmConfig = {
	targetTime: '',
	windowMinutes: DEFAULT_WINDOW_MINUTES,
	enabled: false,
};

/**
 * Parse ISO 8601 targetTime string to milliseconds since epoch.
 * Returns 0 if parsing fails.
 */
const parseTargetTime = (targetTime: string): number => {
	const parsed = Date.parse(targetTime);
	return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Calculate the effective wake window in milliseconds, clamping to available time.
 * If the alarm target is less than `configuredWindowMs` away, use the available time instead.
 * This prevents stale triggers when alarms are set for imminent times.
 *
 * @param targetTimestamp milliseconds since epoch
 * @param configuredWindowMs configured window width
 * @param now current time (ms)
 * @returns effective window width in milliseconds
 */
const getEffectiveWindowMs = (targetTimestamp: number, configuredWindowMs: number, now: number): number => {
	const timeUntilTarget = targetTimestamp - now;
	// If target is in the future and closer than the configured window, clamp to available time
	if (timeUntilTarget > 0 && timeUntilTarget < configuredWindowMs) {
		return timeUntilTarget;
	}
	// If target is in the past, use configured window (allows waking up if already in the window)
	return configuredWindowMs;
};

/**
 * Determine if the given timestamp is within the alarm wake window.
 * Handles day boundaries correctly (e.g., alarms that cross midnight).
 */
const isWithinWakeWindow = (now: number, targetTimestamp: number, windowMs: number): boolean => {
	const delta = Math.abs(now - targetTimestamp);
	return delta <= windowMs;
};

/**
 * Calculate wake sequence progress as a fraction [0, 1] over a 10-minute ramp.
 */
const getWakeSequenceProgress = (startedAt: number | null, now: number): number => {
	if (!startedAt) {
		return 0;
	}

	const elapsedMs = now - startedAt;
	const durationMs = 10 * 60 * 1000; // 10 minutes
	return Math.max(0, Math.min(1, elapsedMs / durationMs));
};

const useAlarmStore = create<AlarmStore>((set, get) => ({
	config: DEFAULT_CONFIG,
	engineState: 'idle',
	nextTriggerAt: null,
	isWithinWakeWindow: false,
	wakeSequenceStartedAt: null,
	wakeSequenceProgress: 0,
	lastSnoozeAt: null,
	snoozeDurationMinutes: SNOOZE_DURATION_MINUTES,

	/**
	 * Replace the active alarm configuration and recompute the next trigger time.
	 * Clamps the window if the alarm target is less than the configured window away.
	 */
	setConfig: (config) => {
		const targetTimestamp = parseTargetTime(config.targetTime);
		if (targetTimestamp <= 0) {
			set({ config, nextTriggerAt: null, engineState: 'idle' });
			return;
		}

		// Clamp window if alarm is imminent (less than configured window away)
		const now = Date.now();
		const configWindowMs = config.windowMinutes * 60 * 1000;
		const effectiveWindowMs = getEffectiveWindowMs(targetTimestamp, configWindowMs, now);
		const clampedWindowMinutes = Math.max(MIN_CLAMP_WINDOW_MINUTES, Math.floor(effectiveWindowMs / 60_000));

		const clampedConfig: AlarmConfig = {
			...config,
			windowMinutes: clampedWindowMinutes,
		};

		const nextTriggerAt = new Date(targetTimestamp).toISOString();
		set({
			config: clampedConfig,
			nextTriggerAt,
			engineState: config.enabled ? 'armed' : 'idle',
		});
	},

	/** Arm the alarm engine so the current config can trigger inside the wake window. */
	armAlarm: () => {
		set({ engineState: 'armed' });
	},

	/** Disarm the alarm engine and clear transient wake state. */
	disarmAlarm: () => {
		set({
			engineState: 'idle',
			isWithinWakeWindow: false,
			wakeSequenceStartedAt: null,
			wakeSequenceProgress: 0,
		});
	},

	/**
	 * Evaluate the alarm against the current phase and clock time.
	 * Only triggers if within the wake window AND in LIGHT phase.
	 */
	evaluateAlarm: (currentPhase, now = Date.now()) => {
		const { config } = get();
		if (!config.enabled || !config.targetTime) {
			set({ isWithinWakeWindow: false });
			return false;
		}

		const targetTimestamp = parseTargetTime(config.targetTime);
		if (targetTimestamp <= 0) {
			set({ isWithinWakeWindow: false });
			return false;
		}

		const windowMs = config.windowMinutes * 60 * 1000;
		const inWindow = isWithinWakeWindow(now, targetTimestamp, windowMs);
		const shouldTrigger = inWindow && currentPhase === 'LIGHT';

		set({ isWithinWakeWindow: inWindow });

		if (shouldTrigger) {
			get().triggerWakeSequence(now);
		}

		return shouldTrigger;
	},

	/**
	 * Begin the progressive wake sequence used for the SomniSync alarm ramp.
	 * The wake sequence continues even if BLE disconnects temporarily;
	 * the BLE manager will reconnect and retry light/temp writes.
	 */
	triggerWakeSequence: (now = Date.now()) => {
		set({
			engineState: 'wake-sequence',
			wakeSequenceStartedAt: now,
			wakeSequenceProgress: 0,
		});
	},

	/**
	 * Update the wake sequence progress based on elapsed time.
	 * This should be called regularly (e.g., on each sensor update or periodic UI tick)
	 * to advance the visual/thermal ramp even if BLE is temporarily disconnected.
	 */
	updateWakeSequenceProgress: (now = Date.now()) => {
		const state = get();
		if (state.engineState !== 'wake-sequence' || !state.wakeSequenceStartedAt) {
			return;
		}

		const newProgress = getWakeSequenceProgress(state.wakeSequenceStartedAt, now);
		set({ wakeSequenceProgress: newProgress });

		// If sequence is complete, return to armed state
		if (newProgress >= 1) {
			get().stopWakeSequence();
		}
	},

	/** Stop any active wake sequence and return the engine to armed or idle state. */
	stopWakeSequence: () => {
		set((state) => ({
			engineState: state.config.enabled ? 'armed' : 'idle',
			wakeSequenceStartedAt: null,
			wakeSequenceProgress: 0,
		}));
	},

	/**
	 * Snooze the alarm for a configured duration.
	 * Debounced: only one snooze allowed per 5 minutes to prevent accidental rapid taps.
	 *
	 * @param durationMinutes override duration (defaults to 10 min)
	 * @param now current time
	 * @returns true if snooze was allowed, false if debounced
	 */
	snooze: (durationMinutes = SNOOZE_DURATION_MINUTES, now = Date.now()): boolean => {
		const state = get();

		// Check debounce: if last snooze was less than 5 min ago, reject
		if (state.lastSnoozeAt !== null && now - state.lastSnoozeAt < SNOOZE_DEBOUNCE_MS) {
			return false; // Snooze rejected due to debounce
		}

		// Stop any active wake sequence and clear the in-window flag
		// Shift the target time forward by the snooze duration
		const targetTimestamp = parseTargetTime(state.config.targetTime);
		if (targetTimestamp <= 0) {
			return false; // No valid alarm to snooze
		}

		const newTargetTimestamp = targetTimestamp + durationMinutes * 60 * 1000;
		const newTargetTime = new Date(newTargetTimestamp).toISOString();

		set({
			engineState: 'snoozed',
			lastSnoozeAt: now,
			snoozeDurationMinutes: durationMinutes,
			wakeSequenceStartedAt: null,
			wakeSequenceProgress: 0,
			isWithinWakeWindow: false,
			config: {
			...state.config,
			targetTime: newTargetTime,
		},
		});

		return true; // Snooze allowed
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
			lastSnoozeAt: null,
			snoozeDurationMinutes: SNOOZE_DURATION_MINUTES,
		});
	},

	/**
	 * Recalculate the alarm trigger time after a timezone change.
	 * Call this when the system detects a timezone change to ensure
	 * the alarm fires at the correct local time.
	 *
	 * Note: In a production app, this would be triggered by a timezone change listener.
	 * For now, it's a manual method available to the app to call if needed.
	 */
	recalculateAfterTimezoneChange: () => {
		const state = get();
		if (!state.config.targetTime) {
			return;
		}

		// Re-parse the target time string, which will be interpreted in the current timezone
		get().setConfig(state.config);
	},
}));

export { getWakeSequenceProgress };
export default useAlarmStore;
