import { create } from 'zustand';

import type { SleepPhase, SleepPhaseEntry } from '../types';
const derivePhaseFromFrequency = (frequencyHz: number): SleepPhase => {
	if (frequencyHz < 0.14) {
		return 'AWAKE';
	}

	if (frequencyHz < 0.22) {
		return 'TRANSITIONAL';
	}

	if (frequencyHz < 0.32) {
		return 'LIGHT';
	}

	return 'DEEP';
};

export interface SleepStore {
	currentPhase: SleepPhase;
	respiratoryFrequencyHz: number | null;
	phaseHistory: SleepPhaseEntry[];
	activePhaseStartedAt: number | null;
	setRespiratoryFrequency: (frequencyHz: number) => void;
	setCurrentPhase: (phase: SleepPhase, timestamp?: number) => void;
	resetNight: (date?: number) => void;
}

const useSleepStore = create<SleepStore>((set, get) => ({
	currentPhase: 'AWAKE',
	respiratoryFrequencyHz: null,
	phaseHistory: [],
	activePhaseStartedAt: null,
	/** Update the respiratory frequency and derive the most likely sleep phase. */
	setRespiratoryFrequency: (frequencyHz) => {
		const phase = derivePhaseFromFrequency(frequencyHz);
		set({ respiratoryFrequencyHz: frequencyHz });
		get().setCurrentPhase(phase);
	},
	/** Explicitly set the current sleep phase and keep the phase timeline contiguous. */
	setCurrentPhase: (phase, timestamp = Date.now()) => {
		const state = get();
		const activePhaseStartedAt = state.activePhaseStartedAt ?? timestamp;
		const phaseHistory = [...state.phaseHistory];

		if (phaseHistory.length > 0 && state.currentPhase !== phase) {
			const previousEntry = phaseHistory[phaseHistory.length - 1];
			if (previousEntry.endTime === previousEntry.startTime) {
				phaseHistory[phaseHistory.length - 1] = { ...previousEntry, endTime: timestamp };
			}
		}

		if (state.currentPhase !== phase) {
			phaseHistory.push({ phase, startTime: timestamp, endTime: timestamp });
		}

		set({ currentPhase: phase, activePhaseStartedAt, phaseHistory });
	},
	/** Clear the current sleep session and start a fresh timeline. */
	resetNight: (date = Date.now()) => {
		set({
			currentPhase: 'AWAKE',
			respiratoryFrequencyHz: null,
			phaseHistory: [],
			activePhaseStartedAt: date,
		});
	},
}));

export { derivePhaseFromFrequency };
export default useSleepStore;
