import { ResampleSettings } from '../types/audio';
import { audioBufferToWav, computeWaveformPeaks } from './audioBufferUtils';

export interface ResampleResult {
  outputBuffer: AudioBuffer;
  wavBlob: Blob;
  peaks: number[];
  originalSampleRate: number;
  outputSampleRate: number;
  originalDuration: number;
  outputDuration: number;
  bitDepth: 16 | 24;
}

/**
 * Resamples an AudioBuffer to a new sample rate, speed factor, and pitch shift.
 */
export async function resampleAudioBuffer(
  inputBuffer: AudioBuffer,
  settings: ResampleSettings
): Promise<ResampleResult> {
  const { targetSampleRate, bitDepth, speed, pitchSemitones } = settings;
  const numChannels = inputBuffer.numberOfChannels;
  
  // Speed alters output duration: duration = originalDuration / speed
  const pitchRatio = Math.pow(2, pitchSemitones / 12);
  const effectivePlaybackRate = speed * pitchRatio;
  const outputDuration = inputBuffer.duration / Math.max(0.25, effectivePlaybackRate);
  const totalFrames = Math.floor(outputDuration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(numChannels, Math.max(1, totalFrames), targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;
  source.playbackRate.setValueAtTime(effectivePlaybackRate, 0);

  // Optional anti-aliasing / normalization filter
  if (settings.normalize) {
    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(1.05, 0);
    source.connect(gain);
    gain.connect(offlineCtx.destination);
  } else {
    source.connect(offlineCtx.destination);
  }

  source.start(0);

  const outputBuffer = await offlineCtx.startRendering();
  const wavBlob = audioBufferToWav(outputBuffer, bitDepth);
  const peaks = computeWaveformPeaks(outputBuffer);

  return {
    outputBuffer,
    wavBlob,
    peaks,
    originalSampleRate: inputBuffer.sampleRate,
    outputSampleRate: targetSampleRate,
    originalDuration: inputBuffer.duration,
    outputDuration: outputBuffer.duration,
    bitDepth,
  };
}
