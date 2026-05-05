import { audioProcessor } from '../audioProcessor';

jest.mock('expo-av', () => {
  const RecordingMock = class {
    async prepareToRecordAsync() {}
    async startAsync() {}
    async stopAndUnloadAsync() {}
    async getStatusAsync() { return {}; }
  };

  return {
    Audio: {
      requestPermissionsAsync: async () => ({ granted: true }),
      setAudioModeAsync: async () => {},
      Recording: RecordingMock,
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
    },
  };
});

const generateSine = (freqHz: number, sampleRate: number, durationSec: number, amplitude = 0.5) => {
  const len = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
};

describe('AudioProcessorService', () => {
  it('detects 0.2 Hz breathing and maps to LIGHT', () => {
    const sampleRate = 50; // low sample rate for test envelope
    const samples = generateSine(0.2, sampleRate, 40, 0.3);
    const res = audioProcessor.estimateRespiratoryFrequency(samples, sampleRate);
    expect(res.phase).toBe('LIGHT');
    expect(Math.abs(res.respiratoryFrequencyHz - 0.2)).toBeLessThan(0.05);
    expect(res.signalQuality).toBeGreaterThan(0.3);
  });

  it('detects 0.14 Hz breathing and maps to DEEP', () => {
    const sampleRate = 50;
    const samples = generateSine(0.14, sampleRate, 50, 0.3);
    const res = audioProcessor.estimateRespiratoryFrequency(samples, sampleRate);
    expect(res.phase).toBe('DEEP');
    expect(Math.abs(res.respiratoryFrequencyHz - 0.14)).toBeLessThan(0.04);
  });

  it('returns SIGNAL_LOST for silence', () => {
    const sampleRate = 50;
    const samples = new Float32Array(sampleRate * 10);
    const res = audioProcessor.estimateRespiratoryFrequency(samples, sampleRate);
    expect(res.phase).toBe('SIGNAL_LOST');
  });

  it('returns SIGNAL_LOST for movement spike', () => {
    const sampleRate = 50;
    const samples = generateSine(0.2, sampleRate, 30, 0.3);
    // inject spike
    samples[Math.floor(samples.length / 2)] = 1.0;
    const res = audioProcessor.estimateRespiratoryFrequency(samples, sampleRate);
    expect(res.phase).toBe('SIGNAL_LOST');
  });

  it('detects breathing in noisy environment', () => {
    const sampleRate = 50;
    const base = generateSine(0.2, sampleRate, 40, 0.25);
    const noisy = new Float32Array(base.length);
    for (let i = 0; i < base.length; i++) {
      noisy[i] = base[i] + (Math.random() - 0.5) * 0.15;
    }
    const res = audioProcessor.estimateRespiratoryFrequency(noisy, sampleRate);
    expect(res.phase).toBe('LIGHT');
    expect(res.signalQuality).toBeGreaterThan(0.25);
  });
});
