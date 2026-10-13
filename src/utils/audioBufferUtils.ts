import { AudioMetrics } from '../types/audio';

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit or 24-bit PCM).
 */
export function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 24 = 16): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings into DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel samples & write PCM
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Hard clamp between -1.0 and 1.0 to prevent wrap-around clipping
      sample = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 16) {
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      } else {
        // 24-bit PCM
        const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
        const clampedInt = Math.floor(intSample);
        view.setUint8(offset, clampedInt & 0xFF);
        view.setUint8(offset + 1, (clampedInt >> 8) & 0xFF);
        view.setUint8(offset + 2, (clampedInt >> 16) & 0xFF);
        offset += 3;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Computes normalized peak array for waveform visualization.
 */
export function computeWaveformPeaks(buffer: AudioBuffer, numPeaks: number = 200): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1.0, max));
  }

  return peaks;
}

/**
 * Analyzes audio buffer for audio engineering metrics: Peak dBFS, RMS, LUFS estimate, DR.
 */
export function analyzeAudioMetrics(buffer: AudioBuffer): AudioMetrics {
  const numChannels = buffer.numberOfChannels;
  let maxPeak = 0;
  let sumSquares = 0;
  let sampleCount = 0;
  let clipCount = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i]);
      if (val > maxPeak) maxPeak = val;
      if (val >= 0.999) clipCount++;
      sumSquares += val * val;
      sampleCount++;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
  const peakDbfs = maxPeak > 0.00001 ? 20 * Math.log10(maxPeak) : -96;
  const rmsDbfs = rms > 0.00001 ? 20 * Math.log10(rms) : -96;

  // Approximate integrated LUFS (ITU-R BS.1770 K-weighting approximation)
  // Usually LUFS is ~ 3 to 4 dB below full-scale unweighted RMS on modern music
  const estimatedLufs = Math.max(-96, Math.min(0, rmsDbfs - 2.5));
  const crestFactor = Math.max(0, peakDbfs - rmsDbfs);
  const dynamicRange = Math.max(1, Math.min(20, Math.round(crestFactor * 1.2)));

  return {
    peakDbfs: Number(peakDbfs.toFixed(2)),
    rmsDbfs: Number(rmsDbfs.toFixed(2)),
    estimatedLufs: Number(estimatedLufs.toFixed(1)),
    dynamicRange,
    isClipping: clipCount > 5 || maxPeak >= 1.0,
    crestFactor: Number(crestFactor.toFixed(1))
  };
}

/**
 * Procedurally generates a full 16-bar modern demo multitrack (Vocals, Drums, Bass, Melody)
 * using Web Audio API offline rendering.
 */
export async function generateDemoMultitrack(): Promise<{
  master: AudioBuffer;
  vocals: AudioBuffer;
  drums: AudioBuffer;
  bass: AudioBuffer;
  melody: AudioBuffer;
}> {
  const sampleRate = 44100;
  const bpm = 120;
  const beats = 32; // 8 bars
  const secondsPerBeat = 60 / bpm;
  const totalDuration = beats * secondsPerBeat;
  const totalLength = Math.floor(sampleRate * totalDuration);

  // 1. Generate Drums
  const drumsCtx = new OfflineAudioContext(2, totalLength, sampleRate);
  for (let b = 0; b < beats; b++) {
    const t = b * secondsPerBeat;
    
    // Kick drum on beats 0, 1, 2, 3...
    if (b % 2 === 0) {
      const osc = drumsCtx.createOscillator();
      const gain = drumsCtx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(drumsCtx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }

    // Snare / Clap on beats 1, 3
    if (b % 2 === 1) {
      const noiseBuffer = drumsCtx.createBuffer(1, Math.floor(sampleRate * 0.2), sampleRate);
      const out = noiseBuffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.05));
      }
      const noise = drumsCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = drumsCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, t);
      const snareGain = drumsCtx.createGain();
      snareGain.gain.setValueAtTime(0.7, t);
      snareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      noise.connect(filter);
      filter.connect(snareGain);
      snareGain.connect(drumsCtx.destination);
      noise.start(t);
      noise.stop(t + 0.2);
    }

    // Hi-Hats on every eighth note
    for (let step = 0; step < 2; step++) {
      const hatTime = t + step * (secondsPerBeat / 2);
      const hatLen = Math.floor(sampleRate * 0.05);
      const hatBuf = drumsCtx.createBuffer(1, hatLen, sampleRate);
      const hatData = hatBuf.getChannelData(0);
      for (let i = 0; i < hatLen; i++) {
        hatData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.015));
      }
      const hatSrc = drumsCtx.createBufferSource();
      hatSrc.buffer = hatBuf;
      const hatFilter = drumsCtx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(6500, hatTime);
      const hatGain = drumsCtx.createGain();
      hatGain.gain.setValueAtTime(step === 1 ? 0.35 : 0.2, hatTime);
      hatGain.gain.exponentialRampToValueAtTime(0.001, hatTime + 0.045);
      hatSrc.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(drumsCtx.destination);
      hatSrc.start(hatTime);
      hatSrc.stop(hatTime + 0.05);
    }
  }
  const drumsBuffer = await drumsCtx.startRendering();

  // 2. Generate Bass
  const bassCtx = new OfflineAudioContext(2, totalLength, sampleRate);
  // Bass chord progression in F minor / Ab / Eb / Bb: [F1=43.65, Ab1=51.91, Eb1=38.89, Bb1=58.27]
  const rootNotes = [43.65, 51.91, 38.89, 58.27];
  for (let bar = 0; bar < 8; bar++) {
    const root = rootNotes[bar % 4];
    const barStart = bar * (4 * secondsPerBeat);
    for (let beat = 0; beat < 4; beat++) {
      const noteTime = barStart + beat * secondsPerBeat;
      const osc = bassCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(root, noteTime);

      const subOsc = bassCtx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(root / 2, noteTime);

      const filter = bassCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, noteTime);
      filter.frequency.exponentialRampToValueAtTime(120, noteTime + 0.35);

      const gain = bassCtx.createGain();
      gain.gain.setValueAtTime(0.65, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(bassCtx.destination);

      osc.start(noteTime);
      subOsc.start(noteTime);
      osc.stop(noteTime + 0.48);
      subOsc.stop(noteTime + 0.48);
    }
  }
  const bassBuffer = await bassCtx.startRendering();

  // 3. Generate Melody / Synths
  const melodyCtx = new OfflineAudioContext(2, totalLength, sampleRate);
  // Chords progression arpeggios
  const chordSets = [
    [174.61, 220.00, 261.63, 349.23], // F Minor / Major
    [207.65, 261.63, 311.13, 415.30], // Ab Major
    [155.56, 196.00, 233.08, 311.13], // Eb Major
    [233.08, 293.66, 349.23, 466.16], // Bb Major
  ];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chordSets[bar % 4];
    const barStart = bar * (4 * secondsPerBeat);
    for (let step = 0; step < 8; step++) {
      const t = barStart + step * (secondsPerBeat / 2);
      const noteFreq = chord[step % chord.length];

      const osc = melodyCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(noteFreq, t);

      const filter = melodyCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, t);

      const gain = melodyCtx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(melodyCtx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    }
  }
  const melodyBuffer = await melodyCtx.startRendering();

  // 4. Generate Vocals (Vocal formant synth lead simulation)
  const vocalCtx = new OfflineAudioContext(2, totalLength, sampleRate);
  const vocalMelody = [
    349.23, 392.00, 440.00, 523.25, 440.00, 392.00, 349.23, 329.63,
    349.23, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00, 349.23
  ];
  for (let i = 0; i < vocalMelody.length; i++) {
    const t = i * (secondsPerBeat);
    const freq = vocalMelody[i];

    const osc1 = vocalCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t);

    // Formant filter (Vowel "Ah" / "Oh")
    const formant = vocalCtx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1000 + (i % 2) * 400, t);
    formant.Q.setValueAtTime(4.5, t);

    const gain = vocalCtx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc1.connect(formant);
    formant.connect(gain);
    gain.connect(vocalCtx.destination);

    osc1.start(t);
    osc1.stop(t + 0.9);
  }
  const vocalsBuffer = await vocalCtx.startRendering();

  // 5. Combine into Master Mix Buffer
  const masterCtx = new OfflineAudioContext(2, totalLength, sampleRate);
  const mixDrums = masterCtx.createBufferSource();
  mixDrums.buffer = drumsBuffer;
  mixDrums.connect(masterCtx.destination);
  mixDrums.start(0);

  const mixBass = masterCtx.createBufferSource();
  mixBass.buffer = bassBuffer;
  mixBass.connect(masterCtx.destination);
  mixBass.start(0);

  const mixMelody = masterCtx.createBufferSource();
  mixMelody.buffer = melodyBuffer;
  mixMelody.connect(masterCtx.destination);
  mixMelody.start(0);

  const mixVocals = masterCtx.createBufferSource();
  mixVocals.buffer = vocalsBuffer;
  mixVocals.connect(masterCtx.destination);
  mixVocals.start(0);

  const masterBuffer = await masterCtx.startRendering();

  return {
    master: masterBuffer,
    vocals: vocalsBuffer,
    drums: drumsBuffer,
    bass: bassBuffer,
    melody: melodyBuffer,
  };
}
