export type StemType = 'master' | 'vocals' | 'drums' | 'bass' | 'melody' | 'other' | 'custom';

export interface TrackEffects {
  eqLow: number;      // -12 to +12 dB (100Hz shelf)
  eqMid: number;      // -12 to +12 dB (1kHz peak)
  eqHigh: number;     // -12 to +12 dB (8kHz shelf)
  hpf: number;        // 20 to 500 Hz (highpass)
  lpf: number;        // 2000 to 20000 Hz (lowpass)
  compThreshold: number; // -60 to 0 dB
  compRatio: number;     // 1 to 20
  compAttack: number;    // 0.001 to 0.1 s
  compRelease: number;   // 0.05 to 1.0 s
  reverbWet: number;     // 0 to 1
  delayWet: number;      // 0 to 1
  delayTime: number;     // 0.05 to 1.0 s
  saturation: number;    // 0 to 1
}

export interface AudioTrack {
  id: string;
  name: string;
  type: StemType;
  color: string;
  buffer: AudioBuffer | null;
  duration: number;
  volume: number;       // 0 to 1.5 (1.0 = 0dB)
  pan: number;          // -1.0 (L) to +1.0 (R)
  mute: boolean;
  solo: boolean;
  peaks: number[];      // Normalized amplitude peaks for waveform rendering (100-300 points)
  effects: TrackEffects;
}

export interface MasteringSettings {
  targetLufs: number;        // e.g. -14 (streaming), -9 (club), -11 (CD)
  ceiling: number;           // e.g. -1.0 dBTP true-peak ceiling
  inputGain: number;         // -12 to +12 dB
  eqBass: number;            // -6 to +6 dB (80Hz)
  eqLowMid: number;          // -6 to +6 dB (300Hz)
  eqPresence: number;        // -6 to +6 dB (3.5kHz)
  eqAir: number;             // -6 to +6 dB (12kHz)
  stereoWidth: number;       // 0.5 to 2.0 (1.0 = normal, 1.5 = expanded)
  compressionDrive: number;  // 0 to 1 (single-band glue compression)
  warmTape: number;          // 0 to 1 (analog saturation)
  presetName: string;
}

export interface AudioMetrics {
  peakDbfs: number;
  rmsDbfs: number;
  estimatedLufs: number;
  dynamicRange: number;
  isClipping: boolean;
  crestFactor: number;
}

export interface ResampleSettings {
  targetSampleRate: number; // 44100, 48000, 88200, 96000
  bitDepth: 16 | 24;
  speed: number;            // 0.5 to 2.0
  pitchSemitones: number;   // -12 to +12
  format: 'wav' | 'mp3' | 'flac';
  normalize: boolean;
}

export interface CoverDesign {
  id: string;
  title: string;
  artist: string;
  label: string;
  catalogNo: string;
  releaseYear: string;
  template: 'modern' | 'minimal' | 'bold' | 'neon' | 'vinyl' | 'editorial';
  backgroundType: 'color' | 'gradient' | 'image' | 'dark' | 'abstract';
  backgroundColor: string;
  bgGradient: string;
  bgImageUrl?: string;
  titleFont: string;
  artistFont: string;
  titleColor: string;
  artistColor: string;
  accentColor: string;
  titleSize: number;
  artistSize: number;
  letterSpacing: number;
  showExplicitBadge: boolean;
  showBarcode: boolean;
  showVinylRing: boolean;
  showTextureOverlay: boolean;
  blurBackground: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  bpm: number;
  sampleRate: number;
  createdAt: number;
  updatedAt: number;
  trackCount: number;
  duration: number;
  status: 'draft' | 'mixing' | 'mastered' | 'exported';
}

export interface ExportHistoryItem {
  id: string;
  title: string;
  type: 'master' | 'mix' | 'stem' | 'resampled' | 'cover';
  format: string;
  sampleRate?: number;
  bitDepth?: number;
  fileSize: string;
  timestamp: number;
  downloadUrl?: string;
  blob?: Blob;
}
