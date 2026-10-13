import { computeWaveformPeaks } from './audioBufferUtils';
import { AudioTrack } from '../types/audio';

export interface StemSeparationOutput {
  stems: AudioTrack[];
  originalBuffer: AudioBuffer;
}

/**
 * Performs real multi-band DSP source separation on an AudioBuffer into 4 stems:
 * 1. Vocals (Center-channel vocal formant isolation)
 * 2. Drums (Transient percussive attack & high-frequency drum bus)
 * 3. Bass (Sub-harmonic low-pass filtered rhythm section)
 * 4. Melody/Other (Stereo harmonic residual instruments)
 */
export async function separateAudioStems(
  audioBuffer: AudioBuffer,
  onProgress?: (progress: number, step: string) => void
): Promise<StemSeparationOutput> {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  onProgress?.(10, 'Analyzing stereo field & spectrum...');
  await new Promise((r) => setTimeout(r, 60));

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  // 1. Bass Extraction: steep low-pass filter below 180Hz
  onProgress?.(30, 'Extracting Bass & sub-frequency foundation (<180Hz)...');
  const bassCtx = new OfflineAudioContext(2, length, sampleRate);
  const bassSource = bassCtx.createBufferSource();
  bassSource.buffer = audioBuffer;

  const bassLp1 = bassCtx.createBiquadFilter();
  bassLp1.type = 'lowpass';
  bassLp1.frequency.setValueAtTime(200, 0);
  bassLp1.Q.setValueAtTime(1.0, 0);

  const bassLp2 = bassCtx.createBiquadFilter();
  bassLp2.type = 'lowpass';
  bassLp2.frequency.setValueAtTime(160, 0);

  const bassGain = bassCtx.createGain();
  bassGain.gain.setValueAtTime(1.3, 0); // slight boost for clean bass stem

  bassSource.connect(bassLp1);
  bassLp1.connect(bassLp2);
  bassLp2.connect(bassGain);
  bassGain.connect(bassCtx.destination);
  bassSource.start(0);
  const bassBuffer = await bassCtx.startRendering();

  // 2. Vocals Extraction: Mid-channel center bandpass (250Hz - 4500Hz) with side cancellation
  onProgress?.(55, 'Isolating Vocals via center-channel phantom field...');
  const vocalCtx = new OfflineAudioContext(2, length, sampleRate);
  
  // Create Mid channel buffer
  const midBuffer = vocalCtx.createBuffer(2, length, sampleRate);
  const midL = midBuffer.getChannelData(0);
  const midR = midBuffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    // Center channel extraction with side cancellation
    const mid = (left[i] + right[i]) * 0.5;
    const side = (left[i] - right[i]) * 0.5;
    // Suppress stereo side elements to bring out center vocal
    const centerAttenuated = mid - Math.abs(side) * 0.4;
    midL[i] = centerAttenuated;
    midR[i] = centerAttenuated;
  }

  const vocalSource = vocalCtx.createBufferSource();
  vocalSource.buffer = midBuffer;

  const vocalHp = vocalCtx.createBiquadFilter();
  vocalHp.type = 'highpass';
  vocalHp.frequency.setValueAtTime(280, 0); // Cut out bass/kick

  const vocalLp = vocalCtx.createBiquadFilter();
  vocalLp.type = 'lowpass';
  vocalLp.frequency.setValueAtTime(5200, 0); // Cut high cymbals

  const vocalPresence = vocalCtx.createBiquadFilter();
  vocalPresence.type = 'peaking';
  vocalPresence.frequency.setValueAtTime(1800, 0);
  vocalPresence.Q.setValueAtTime(1.2, 0);
  vocalPresence.gain.setValueAtTime(3.5, 0); // Vocal clarity boost

  vocalSource.connect(vocalHp);
  vocalHp.connect(vocalLp);
  vocalLp.connect(vocalPresence);
  vocalPresence.connect(vocalCtx.destination);
  vocalSource.start(0);
  const vocalBuffer = await vocalCtx.startRendering();

  // 3. Drums Extraction: Transient emphasis & kick+snare envelope isolation
  onProgress?.(75, 'Extracting Drum transients and percussive rhythm...');
  const drumsCtx = new OfflineAudioContext(2, length, sampleRate);
  const drumBuffer = drumsCtx.createBuffer(2, length, sampleRate);
  const drumL = drumBuffer.getChannelData(0);
  const drumR = drumBuffer.getChannelData(1);

  // Transient envelope detection: highlight rapid amplitude changes (attacks)
  let envL = 0;
  let envR = 0;
  const attackAlpha = 0.8;
  const releaseAlpha = 0.9995;

  for (let i = 0; i < length; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    envL = absL > envL ? attackAlpha * absL + (1 - attackAlpha) * envL : releaseAlpha * envL;
    envR = absR > envR ? attackAlpha * absR + (1 - attackAlpha) * envR : releaseAlpha * envR;

    // Transient ratio
    const transL = absL - envL * 0.7;
    const transR = absR - envR * 0.7;
    const drumWeightL = Math.max(0, transL) * 1.8;
    const drumWeightR = Math.max(0, transR) * 1.8;

    drumL[i] = left[i] * (0.3 + Math.min(1.2, drumWeightL));
    drumR[i] = right[i] * (0.3 + Math.min(1.2, drumWeightR));
  }

  const drumSource = drumsCtx.createBufferSource();
  drumSource.buffer = drumBuffer;

  // Drum tone shaping (punchy low-end kick + high-end snap)
  const drumEqLow = drumsCtx.createBiquadFilter();
  drumEqLow.type = 'peaking';
  drumEqLow.frequency.setValueAtTime(90, 0);
  drumEqLow.gain.setValueAtTime(4.0, 0);

  const drumEqHigh = drumsCtx.createBiquadFilter();
  drumEqHigh.type = 'highshelf';
  drumEqHigh.frequency.setValueAtTime(6000, 0);
  drumEqHigh.gain.setValueAtTime(3.0, 0);

  drumSource.connect(drumEqLow);
  drumEqLow.connect(drumEqHigh);
  drumEqHigh.connect(drumsCtx.destination);
  drumSource.start(0);
  const finalDrumBuffer = await drumsCtx.startRendering();

  // 4. Melody / Other: Subtract vocals, bass & transient drum bleed from original mix
  onProgress?.(90, 'Separating stereo harmonic melodies, synths & guitars...');
  const melodyCtx = new OfflineAudioContext(2, length, sampleRate);
  const melodyBuffer = melodyCtx.createBuffer(2, length, sampleRate);
  const melL = melodyBuffer.getChannelData(0);
  const melR = melodyBuffer.getChannelData(1);

  const vL = vocalBuffer.getChannelData(0);
  const bL = bassBuffer.getChannelData(0);
  const dL = finalDrumBuffer.getChannelData(0);
  const vR = vocalBuffer.getChannelData(1);
  const bR = bassBuffer.getChannelData(1);
  const dR = finalDrumBuffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    // Residual subtraction
    const remL = left[i] - (vL[i] * 0.65 + bL[i] * 0.7 + dL[i] * 0.35);
    const remR = right[i] - (vR[i] * 0.65 + bR[i] * 0.7 + dR[i] * 0.35);

    melL[i] = Math.max(-1, Math.min(1, remL * 1.25));
    melR[i] = Math.max(-1, Math.min(1, remR * 1.25));
  }

  onProgress?.(100, 'Stems generated successfully!');

  const defaultEffects = {
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    hpf: 20,
    lpf: 20000,
    compThreshold: -24,
    compRatio: 3,
    compAttack: 0.01,
    compRelease: 0.1,
    reverbWet: 0,
    delayWet: 0,
    delayTime: 0.25,
    saturation: 0,
  };

  const stems: AudioTrack[] = [
    {
      id: 'stem-vocals',
      name: 'Vocals',
      type: 'vocals',
      color: '#c084fc', // purple (matches reference image 2)
      buffer: vocalBuffer,
      duration: vocalBuffer.duration,
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      peaks: computeWaveformPeaks(vocalBuffer),
      effects: { ...defaultEffects, eqHigh: 1.5, reverbWet: 0.1 },
    },
    {
      id: 'stem-drums',
      name: 'Drums',
      type: 'drums',
      color: '#4ade80', // green (matches reference image 2)
      buffer: finalDrumBuffer,
      duration: finalDrumBuffer.duration,
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      peaks: computeWaveformPeaks(finalDrumBuffer),
      effects: { ...defaultEffects, compThreshold: -18, compRatio: 4 },
    },
    {
      id: 'stem-bass',
      name: 'Bass',
      type: 'bass',
      color: '#fb923c', // orange (matches reference image 2)
      buffer: bassBuffer,
      duration: bassBuffer.duration,
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      peaks: computeWaveformPeaks(bassBuffer),
      effects: { ...defaultEffects, eqLow: 2.0 },
    },
    {
      id: 'stem-melody',
      name: 'Melody / Other',
      type: 'melody',
      color: '#38bdf8', // blue (matches reference image 2)
      buffer: melodyBuffer,
      duration: melodyBuffer.duration,
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      peaks: computeWaveformPeaks(melodyBuffer),
      effects: { ...defaultEffects, reverbWet: 0.15 },
    },
  ];

  return {
    stems,
    originalBuffer: audioBuffer,
  };
}
