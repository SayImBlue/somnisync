import { create } from 'zustand';

import type { SleepPhase, SleepPhaseEntry, PhaseDerivationResult } from '../types';

/**
 * Research-based respiratory frequency ranges for sleep phases (in Hz).
 * Source: Standard sleep medicine literature.
 * Note: SIGNAL_LOST is for out-of-range frequencies (noise or device error).
 */
const FREQUENCY_BANDS = {
	DEEP: { min: 0.1, max: 0.18, label: '6–11 breaths/min' },
	LIGHT: { min: 0.18, max: 0.25, label: '11–15 breaths/min' },
	TRANSITIONAL: { min: 0.25, max: 0.4, label: '15–24 breaths/min' },
	AWAKE: { min: 0.25, max: 0.4, label: '15–24 breaths/min' },
} as const;

/**
 * Hysteresis configuration: require N consecutive readings of the same phase
 * before confirming a phase transition (prevents flickering).
 */
const HYSTERESIS_THRESHOLD = 3;

/**
 * Frequency validation: noise detection thresholds.
 * - Below 0.08 Hz (~5 breaths/min): likely sensor noise or apnea
 * - Above 0.5 Hz (~30 breaths/min): likely movement or hyperventilation, not sleep data
 */
const MIN_VALID_FREQUENCY = 0.08;
const MAX_VALID_FREQUENCY = 0.5;

/**
 * Derive sleep phase from respiratory frequency with hysteresis, confidence scoring,
 * and edge case handling.
 *
 * Returns { phase, confidenceScore, isValid }:
 * - phase: the detected sleep phase or SIGNAL_LOST if frequency is out of range
 * - confidenceScore: 0–1, how centered the frequency is in the valid band
 * - isValid: false if frequency is outside detectable range or missing
 */
const derivePhaseFromFrequency = (frequencyHz: number | null): PhaseDerivationResult => {
	// Edge case: missing or zero frequency
	if (frequencyHz === null || frequencyHz === 0) {
		return {
			phase: 'SIGNAL_LOST',
			confidenceScore: 0,
			isValid: false,
		};
	}

	// Edge case: out-of-range frequencies (noise or device malfunction)
	if (frequencyHz < MIN_VALID_FREQUENCY || frequencyHz > MAX_VALID_FREQUENCY) {
		return {
			phase: 'SIGNAL_LOST',
			confidenceScore: 0,
			isValid: false,
		};
	}

	// Determine the raw phase (before hysteresis)
	let rawPhase: SleepPhase;
	if (frequencyHz < FREQUENCY_BANDS.DEEP.max) {
		rawPhase = 'DEEP';
	} else if (frequencyHz < FREQUENCY_BANDS.LIGHT.max) {
		rawPhase = 'LIGHT';
	} else {
		// AWAKE and TRANSITIONAL share the 0.25–0.4 band; we'll use TRANSITIONAL
		// as a middle ground, and the store logic will clarify based on history
		rawPhase = 'TRANSITIONAL';
	}

	// Calculate confidence score: how centered is this frequency in its band?
	const band = FREQUENCY_BANDS[rawPhase];
	const bandWidth = band.max - band.min;
	const distanceFromMin = frequencyHz - band.min;
	const centeredness = 1 - Math.abs(distanceFromMin - bandWidth / 2) / (bandWidth / 2);
	const confidenceScore = Math.max(0, Math.min(1, centeredness)); // Clamp to [0, 1]

	return {
		phase: rawPhase,
		confidenceScore,
		isValid: true,
	};
};

export interface SleepStore {
	currentPhase: SleepPhase;
	respiratoryFrequencyHz: number | null;
	phaseHistory: SleepPhaseEntry[];
	activePhaseStartedAt: number | null;
	confidenceScore: number; // 0–1: confidence in the current phase
	candidatePhase: SleepPhase | null; // Phase candidate awaiting hysteresis confirmation
	candidateReadingCount: number; // How many consecutive readings confirm the candidate
	setRespiratoryFrequency: (frequencyHz: number) => void;
	setCurrentPhase: (phase: SleepPhase, timestamp?: number) => void;
	resetNight: (date?: number) => void;
}

const useSleepStore = create<SleepStore>((set, get) => ({
	currentPhase: 'AWAKE',
	respiratoryFrequencyHz: null,
	phaseHistory: [],
	activePhaseStartedAt: null,
	confidenceScore: 0,
	candidatePhase: null,
	candidateReadingCount: 0,

	/** Update the respiratory frequency and apply hysteresis logic before phase change. */
	setRespiratoryFrequency: (frequencyHz) => {
		const derivation = derivePhaseFromFrequency(frequencyHz);

		// Invalid signal: reset hysteresis but don't change phase
		if (!derivation.isValid) {
			set({
				respiratoryFrequencyHz: frequencyHz,
				confidenceScore: 0,
				candidatePhase: null,
				candidateReadingCount: 0,
			});
			return;
		}

		const state = get();
		let newPhase = state.currentPhase;
		let newCandidatePhase = state.candidatePhase;
		let newCandidateReadingCount = state.candidateReadingCount;

		// If the derived phase matches the current phase, no change needed
		if (derivation.phase === state.currentPhase) {
			newCandidatePhase = null;
			newCandidateReadingCount = 0;
		} else if (derivation.phase === state.candidatePhase) {
			// Same candidate: increment counter
			newCandidateReadingCount = state.candidateReadingCount + 1;
			// Confirm if threshold reached
			if (newCandidateReadingCount >= HYSTERESIS_THRESHOLD) {
				newPhase = derivation.phase;
				newCandidatePhase = null;
				newCandidateReadingCount = 0;
				// Only call setCurrentPhase if phase actually changed
				set({
					respiratoryFrequencyHz: frequencyHz,
					currentPhase: newPhase,
					confidenceScore: derivation.confidenceScore,
					candidatePhase: newCandidatePhase,
					candidateReadingCount: newCandidateReadingCount,
				});
				get().setCurrentPhase(newPhase);
				return;
			}
		} else {
			// New candidate: reset counter
			newCandidatePhase = derivation.phase;
			newCandidateReadingCount = 1;
		}

		set({
			respiratoryFrequencyHz: frequencyHz,
			confidenceScore: derivation.confidenceScore,
			candidatePhase: newCandidatePhase,
			candidateReadingCount: newCandidateReadingCount,
		});
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
			confidenceScore: 0,
			candidatePhase: null,
			candidateReadingCount: 0,
		});
	},
}));

export { derivePhaseFromFrequency };
export type { PhaseDerivationResult };
export default useSleepStore;
