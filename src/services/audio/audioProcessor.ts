import { Audio, type AVPlaybackStatusSuccess, type Recording } from 'expo-av';

import type { SleepPhase } from '../../types';

export interface RespiratoryAnalysisResult {
	respiratoryFrequencyHz: number;
	confidence: number;
	phase: SleepPhase;
}

const MIN_RESPIRATORY_HZ = 0.1;
const MAX_RESPIRATORY_HZ = 0.5;
const DEFAULT_SAMPLE_RATE = 22000;
const DEFAULT_BUFFER_SIZE = 4096;

const mapFrequencyToPhase = (frequencyHz: number): SleepPhase => {
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

const normaliseSamples = (samples: Float32Array): Float32Array => {
	const result = new Float32Array(samples.length);
	for (let index = 0; index < samples.length; index += 1) {
		result[index] = Math.abs(samples[index]);
	}

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

export class AudioProcessorService {
	private recording: Recording | null = null;

	/** Request microphone permission and configure the audio mode for recording. */
	public async initializeMicrophone(): Promise<boolean> {
		const permission = await Audio.requestPermissionsAsync();
		if (!permission.granted) {
			return false;
		}

		await Audio.setAudioModeAsync({
			allowsRecordingIOS: true,
			playsInSilentModeIOS: true,
			shouldDuckAndroid: true,
			playThroughEarpieceAndroid: false,
		});

		return true;
	}

	/** Start a microphone recording session for downstream analysis. */
	public async startRecording(): Promise<void> {
		const ready = await this.initializeMicrophone();
		if (!ready) {
			throw new Error('Microphone permission was not granted.');
		}

		const recording = new Audio.Recording();
		await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
		await recording.startAsync();
		this.recording = recording;
	}

	/** Stop the active microphone recording session. */
	public async stopRecording(): Promise<void> {
		if (!this.recording) {
			return;
		}

		const recording = this.recording;
		this.recording = null;
		await recording.stopAndUnloadAsync();
	}

	/**
	 * Estimate respiratory frequency from a normalized audio buffer.
	 * The buffer should be an already extracted envelope or amplitude trace.
	 */
	public estimateRespiratoryFrequency(samples: Float32Array, sampleRate = DEFAULT_SAMPLE_RATE): RespiratoryAnalysisResult {
		const boundedSamples = samples.length > DEFAULT_BUFFER_SIZE ? samples.subarray(0, DEFAULT_BUFFER_SIZE) : samples;
		const envelope = downsampleEnvelope(normaliseSamples(boundedSamples), sampleRate);
		const respiratoryFrequencyHz = estimateFrequencyFromEnvelope(envelope, Math.max(1, Math.floor(sampleRate / 8)));
		const phase = mapFrequencyToPhase(respiratoryFrequencyHz);

		return {
			respiratoryFrequencyHz,
			confidence: Math.min(1, envelope.length / DEFAULT_BUFFER_SIZE),
			phase,
		};
	}

	/** Return the most recent recording status if a session is active. */
	public async getRecordingStatus(): Promise<AVPlaybackStatusSuccess | null> {
		if (!this.recording) {
			return null;
		}

		return (await this.recording.getStatusAsync()) as AVPlaybackStatusSuccess;
	}
}

export const audioProcessor = new AudioProcessorService();
