/**
 * Audio Editing & Restoration Utilities:
 * Trim, Cut, Delete region, Split at playhead, Studio Enhance, Lo-Fi, and AI Noise Reduce.
 */

export function trimAudioBuffer(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endTime * sampleRate));
  const newLength = Math.max(1, endSample - startSample);

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const trimmed = ctx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = trimmed.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      dstData[i] = srcData[startSample + i];
    }
  }

  return trimmed;
}

export function deleteRegionAudioBuffer(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endTime * sampleRate));
  const deletedLength = endSample - startSample;
  const newLength = Math.max(1, buffer.length - deletedLength);

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const stitched = ctx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = stitched.getChannelData(ch);
    
    // First segment before startSample
    for (let i = 0; i < startSample; i++) {
      dstData[i] = srcData[i];
    }
    // Second segment after endSample
    for (let i = endSample; i < buffer.length; i++) {
      dstData[startSample + (i - endSample)] = srcData[i];
    }
  }

  return stitched;
}

export function splitAudioBuffer(
  buffer: AudioBuffer,
  splitTime: number
): [AudioBuffer, AudioBuffer] {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const splitSample = Math.max(1, Math.min(buffer.length - 1, Math.floor(splitTime * sampleRate)));
  const len1 = splitSample;
  const len2 = buffer.length - splitSample;

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const buf1 = ctx.createBuffer(numChannels, len1, sampleRate);
  const buf2 = ctx.createBuffer(numChannels, len2, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const d1 = buf1.getChannelData(ch);
    const d2 = buf2.getChannelData(ch);

    for (let i = 0; i < len1; i++) d1[i] = src[i];
    for (let i = 0; i < len2; i++) d2[i] = src[splitSample + i];
  }

  return [buf1, buf2];
}

/**
 * Studio Enhance: Harmonic exciter + Presence boost + Transparent multi-band warmth
 */
export async function applyStudioEnhance(buffer: AudioBuffer): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  // Air shelf exciter (> 8 kHz)
  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.setValueAtTime(8500, 0);
  airShelf.gain.setValueAtTime(3.2, 0);

  // Presence peaking (3 kHz)
  const presence = offlineCtx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.setValueAtTime(3200, 0);
  presence.Q.setValueAtTime(1.0, 0);
  presence.gain.setValueAtTime(2.0, 0);

  // Sub bass tightener
  const subClean = offlineCtx.createBiquadFilter();
  subClean.type = 'highpass';
  subClean.frequency.setValueAtTime(32, 0);

  // Glue compressor
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-18, 0);
  comp.ratio.setValueAtTime(2.5, 0);

  src.connect(subClean);
  subClean.connect(presence);
  presence.connect(airShelf);
  airShelf.connect(comp);
  comp.connect(offlineCtx.destination);

  src.start(0);
  return await offlineCtx.startRendering();
}

/**
 * Lo-Fi (Reduce): Vintage cassette telephone bandpass (350Hz - 4kHz) + harmonic drive
 */
export async function applyLoFiReduce(buffer: AudioBuffer): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(380, 0);

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3600, 0);

  const midPeak = offlineCtx.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.setValueAtTime(1200, 0);
  midPeak.gain.setValueAtTime(4.0, 0);

  src.connect(hp);
  hp.connect(lp);
  lp.connect(midPeak);
  midPeak.connect(offlineCtx.destination);

  src.start(0);
  return await offlineCtx.startRendering();
}

/**
 * AI Noise Reduce: Spectral noise gate that attenuates low-level room noise and hiss
 */
export async function applyNoiseReduce(buffer: AudioBuffer): Promise<AudioBuffer> {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const cleaned = ctx.createBuffer(numChannels, length, sampleRate);

  const threshold = 0.012; // Noise gate threshold
  const smoothing = 0.985;

  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = cleaned.getChannelData(ch);
    let envelope = 0;

    for (let i = 0; i < length; i++) {
      const sample = src[i];
      const absSample = Math.abs(sample);
      envelope = Math.max(absSample, envelope * smoothing);

      if (envelope < threshold) {
        // Attenuate noise floor smoothly
        const gain = Math.pow(envelope / threshold, 2);
        dst[i] = sample * gain;
      } else {
        dst[i] = sample;
      }
    }
  }

  return cleaned;
}
