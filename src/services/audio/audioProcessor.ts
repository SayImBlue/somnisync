import { AudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

import type { SleepPhase } from '../../types';
import useSleepStore from '@/stores/sleepStore';

export interface RespiratoryAnalysisResult {
    respiratoryFrequencyHz: number;
    confidence: number;
    phase: SleepPhase;
    signalQuality: number; // 0-1
}

const MIN_RESPIRATORY_HZ = 0.08; // 0.08 Hz -> treat as noise below this
const MAX_RESPIRATORY_HZ = 0.5; // >0.5 Hz treat as movement/noise
const DEFAULT_SAMPLE_RATE = 22000;
const DEFAULT_BUFFER_SIZE = 4096;

const NOISE_FLOOR_RMS = 0.001; // below this RMS consider silence
const MOVEMENT_SPIKE_THRESHOLD = 0.5; // sample peak > threshold -> movement
const WARMUP_DISCARD_MS = 10_000; // discard first 10s after resume

const mapFrequencyToPhase = (frequencyHz: number): SleepPhase => {
	// Research-based bands:
	// DEEP: 0.10–0.18 Hz
	// LIGHT: 0.18–0.25 Hz
	// AWAKE: 0.25–0.40 Hz
	if (frequencyHz >= 0.25 && frequencyHz <= 0.4) return 'AWAKE';
	if (frequencyHz >= 0.18 && frequencyHz < 0.25) return 'LIGHT';
	if (frequencyHz >= 0.1 && frequencyHz < 0.18) return 'DEEP';
	return 'TRANSITIONAL';
};

const normaliseSamples = (samples: Float32Array): Float32Array => {
    const result = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) result[i] = samples[i];
    return result;
};

const downsampleEnvelope = (samples: Float32Array, sampleRate: number, targetRate = 8): Float32Array => {
	const windowSize = Math.max(1, Math.floor(sampleRate / targetRate));
	const bucketCount = Math.max(1, Math.floor(samples.length / windowSize));
	const envelope = new Float32Array(bucketCount);

	for (let bucket = 0; bucket < bucketCount; bucket += 1) {
		let sum = 0;
		const start = bucket * windowSize;
		const end = Math.min(samples.length, start + windowSize);

		for (let index = start; index < end; index += 1) {
			sum += samples[index];
		}

		envelope[bucket] = sum / Math.max(1, end - start);
	}

	return envelope;
};

const estimateFrequencyFromEnvelope = (envelope: Float32Array, sampleRate: number): number => {
	const minLag = Math.max(1, Math.floor(sampleRate / MAX_RESPIRATORY_HZ));
	const maxLag = Math.max(minLag + 1, Math.floor(sampleRate / MIN_RESPIRATORY_HZ));
	let bestLag = minLag;
	let bestScore = Number.NEGATIVE_INFINITY;

	for (let lag = minLag; lag <= maxLag && lag < envelope.length; lag += 1) {
		let score = 0;
		for (let index = 0; index < envelope.length - lag; index += 1) {
			score += envelope[index] * envelope[index + lag];
		}

		if (score > bestScore) {
			bestScore = score;
			bestLag = lag;
		}
	}

	return sampleRate / bestLag;
};

const applyHanningWindow = (samples: Float32Array): Float32Array => {
	const out = new Float32Array(samples.length);
	for (let i = 0; i < samples.length; i += 1) {
		const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
		out[i] = samples[i] * w;
	}
	return out;
};

// Simple single-pole low-pass filter
const lowPass = (samples: Float32Array, cutoffHz: number, sampleRate: number): Float32Array => {
	const rc = 1 / (2 * Math.PI * cutoffHz);
	const dt = 1 / sampleRate;
	const alpha = dt / (rc + dt);
	const out = new Float32Array(samples.length);
	let prev = 0;
	for (let i = 0; i < samples.length; i += 1) {
		prev = prev + alpha * (samples[i] - prev);
		out[i] = prev;
	}
	return out;
};

// Simple single-pole high-pass filter by subtracting low-pass
const highPass = (samples: Float32Array, cutoffHz: number, sampleRate: number): Float32Array => {
	const lp = lowPass(samples, cutoffHz, sampleRate);
	const out = new Float32Array(samples.length);
	for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] - lp[i];
	return out;
};

const rms = (samples: Float32Array): number => {
	let sum = 0;
	for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
	return Math.sqrt(sum / Math.max(1, samples.length));
};

export class AudioProcessorService {
	private recording: AudioRecorder | null = null;

	// Warmup discard timestamp to ignore first frames after resume
	private resumeWarmupUntil: number | null = null;

	// recent frequency history for consistency scoring
	private recentFrequencies: number[] = [];

	// consecutive low-quality frames counter
	private lowQualityCount = 0;

	/** Request microphone permission and configure the audio mode for recording. */
	public async initializeMicrophone(): Promise<boolean> {
		const permission = await requestRecordingPermissionsAsync();
		if (!permission.granted) {
			return false;
		}

		await setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
		});

		return true;
	}

	/** Start a microphone recording session for downstream analysis. */
	public async startRecording(): Promise<void> {
		const ready = await this.initializeMicrophone();
		if (!ready) {
			throw new Error('Microphone permission was not granted.');
		}

		const recording = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
		await recording.prepareToRecordAsync();
		recording.record();
		this.recording = recording;

		// Discard first 10s of audio on resume
		this.resumeWarmupUntil = Date.now() + WARMUP_DISCARD_MS;
	}

	/** Stop the active microphone recording session. */
	public async stopRecording(): Promise<void> {
		if (!this.recording) {
			return;
		}

		const recording = this.recording;
		this.recording = null;
		await recording.stop();

		this.resumeWarmupUntil = null;
		this.recentFrequencies = [];
		this.lowQualityCount = 0;
	}

	/**
	 * Estimate respiratory frequency from a normalized audio buffer.
	 * The buffer should be an already extracted envelope or amplitude trace.
	 */
	public estimateRespiratoryFrequency(samples: Float32Array, sampleRate = DEFAULT_SAMPLE_RATE): RespiratoryAnalysisResult {
		const now = Date.now();
		if (this.resumeWarmupUntil && now < this.resumeWarmupUntil) {
			// During warmup, emit SIGNAL_LOST
			return { respiratoryFrequencyHz: 0, confidence: 0, phase: 'SIGNAL_LOST', signalQuality: 0 };
		}

		const boundedSamples = samples.length > DEFAULT_BUFFER_SIZE ? samples.subarray(0, DEFAULT_BUFFER_SIZE) : samples;

		// Apply Hanning window to reduce spectral leakage
		const windowed = applyHanningWindow(normaliseSamples(boundedSamples));

		// Quick amplitude checks
		const peak = Math.max(...Array.from(windowed, (v) => Math.abs(v)));
		const overallRms = rms(windowed);
		if (overallRms < NOISE_FLOOR_RMS) {
			// Silence — signal lost
			useSleepStore.getState().setRespiratoryFrequency(0 as any);
			return { respiratoryFrequencyHz: 0, confidence: 0, phase: 'SIGNAL_LOST', signalQuality: 0 };
		}

		if (peak > MOVEMENT_SPIKE_THRESHOLD) {
			// Movement spike — ignore this frame
			return { respiratoryFrequencyHz: 0, confidence: 0, phase: 'SIGNAL_LOST', signalQuality: 0 };
		}

		// Apply bandpass approx: high-pass then low-pass
		const hp = highPass(windowed, MIN_RESPIRATORY_HZ, sampleRate);
		const bp = lowPass(hp, MAX_RESPIRATORY_HZ, sampleRate);

		// Envelope extraction and frequency estimation
		const targetRate = 8;
		const envelope = downsampleEnvelope(normaliseSamples(bp), sampleRate, targetRate);
		const respiratoryFrequencyHz = estimateFrequencyFromEnvelope(envelope, targetRate);

		// Discard implausible frequencies
		if (respiratoryFrequencyHz <= MIN_RESPIRATORY_HZ || respiratoryFrequencyHz >= MAX_RESPIRATORY_HZ) {
			// treat as noise
			return { respiratoryFrequencyHz: 0, confidence: 0, phase: 'SIGNAL_LOST', signalQuality: 0 };
		}

		// Signal quality estimation: SNR like metric
		const signalRms = rms(bp);
		const noiseRms = Math.max(1e-9, Math.abs(overallRms - signalRms));
		const snr = signalRms / noiseRms;
		const qualityBase = Math.max(0, Math.min(1, snr / (snr + 1))); // normalized

		// Frequency consistency across last 3 frames
		const recent = this.recentFrequencies.slice(-2);
		let consistency = 1;
		if (recent.length > 0) {
			let within = 0;
			for (const f of recent) {
				if (Math.abs(f - respiratoryFrequencyHz) / respiratoryFrequencyHz < 0.15) within += 1;
			}
			consistency = within / recent.length;
		}

		const signalQuality = Math.max(0, Math.min(1, 0.6 * qualityBase + 0.3 * consistency + 0.1 * (1 - (peak / MOVEMENT_SPIKE_THRESHOLD))));

		// Update recent frequencies
		this.recentFrequencies.push(respiratoryFrequencyHz);
		if (this.recentFrequencies.length > 5) this.recentFrequencies.shift();

		// Low quality handling: emit SIGNAL_LOST if sustained
		if (signalQuality < 0.4) {
			this.lowQualityCount += 1;
			if (this.lowQualityCount >= 3) {
				useSleepStore.getState().setRespiratoryFrequency(0 as any);
				this.lowQualityCount = 0;
				return { respiratoryFrequencyHz: 0, confidence: 0, phase: 'SIGNAL_LOST', signalQuality: 0 };
			}
		} else {
			this.lowQualityCount = 0;
		}

		const phase = mapFrequencyToPhase(respiratoryFrequencyHz);

		return {
			respiratoryFrequencyHz,
			confidence: signalQuality,
			phase,
			signalQuality,
		};
	}

	/** Return the most recent recording status if a session is active. */
	public async getRecordingStatus(): Promise<any | null> {
		if (!this.recording) {
			return null;
		}

		return await this.recording.getStatusAsync();
	}
}

export const audioProcessor = new AudioProcessorService();
