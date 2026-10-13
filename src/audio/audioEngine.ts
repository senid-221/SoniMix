import { AudioTrack, MasteringSettings } from '../types/audio';
import { audioBufferToWav } from '../utils/audioBufferUtils';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private duration: number = 0;
  private loop: boolean = false;
  private tracks: AudioTrack[] = [];
  private trackNodes: Map<string, {
    source: AudioBufferSourceNode | null;
    gain: GainNode;
    panner: StereoPannerNode;
    hpf: BiquadFilterNode;
    lpf: BiquadFilterNode;
    eqLow: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqHigh: BiquadFilterNode;
    comp: DynamicsCompressorNode;
    reverbGain: GainNode;
    delayGain: GainNode;
  }> = new Map();

  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onStateChangeCallback: ((isPlaying: boolean) => void) | null = null;
  private animFrameId: number | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 256;
      this.masterAnalyser.smoothingTimeConstant = 0.8;

      // Shared Reverb impulse response
      this.convolverNode = this.ctx.createConvolver();
      this.createReverbImpulse(1.8);

      // Shared Delay bus
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.setValueAtTime(0.28, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      // Reverb & Delay to Master
      this.convolverNode.connect(this.masterGain);
      this.delayNode.connect(this.masterGain);

      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createReverbImpulse(durationSec: number) {
    if (!this.ctx || !this.convolverNode) return;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * 0.45));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.convolverNode.buffer = impulse;
  }

  public setTracks(tracks: AudioTrack[]) {
    this.tracks = tracks;
    let maxDur = 0;
    for (const t of tracks) {
      if (t.duration > maxDur) maxDur = t.duration;
    }
    this.duration = maxDur;
    if (this.isPlaying) {
      const cur = this.getCurrentTime();
      this.stop();
      this.play(cur);
    }
  }

  public setOnTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public setOnStateChange(cb: (isPlaying: boolean) => void) {
    this.onStateChangeCallback = cb;
  }

  public setLoop(loop: boolean) {
    this.loop = loop;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.pauseOffset;
    }
    const elapsed = this.ctx.currentTime - this.startTime + this.pauseOffset;
    if (this.duration > 0 && elapsed >= this.duration) {
      if (this.loop) {
        this.startTime = this.ctx.currentTime;
        this.pauseOffset = 0;
        return 0;
      } else {
        this.stop();
        return 0;
      }
    }
    return Math.max(0, Math.min(this.duration, elapsed));
  }

  public play(fromTime?: number) {
    this.initContext();
    if (!this.ctx) return;

    if (this.isPlaying) {
      this.stopSources();
    }

    const seekTime = fromTime !== undefined ? fromTime : this.pauseOffset;
    this.pauseOffset = Math.max(0, Math.min(this.duration, seekTime));
    this.startTime = this.ctx.currentTime;
    this.isPlaying = true;

    // Check if any track is soloed
    const hasSolo = this.tracks.some((t) => t.solo);

    // Build and start track audio graphs
    this.trackNodes.clear();

    for (const track of this.tracks) {
      if (!track.buffer) continue;

      const source = this.ctx.createBufferSource();
      source.buffer = track.buffer;

      // Track HPF & LPF
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(track.effects.hpf || 20, this.ctx.currentTime);

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(track.effects.lpf || 20000, this.ctx.currentTime);

      // Track 3-band EQ
      const eqLow = this.ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.setValueAtTime(100, this.ctx.currentTime);
      eqLow.gain.setValueAtTime(track.effects.eqLow || 0, this.ctx.currentTime);

      const eqMid = this.ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.setValueAtTime(1000, this.ctx.currentTime);
      eqMid.Q.setValueAtTime(1.0, this.ctx.currentTime);
      eqMid.gain.setValueAtTime(track.effects.eqMid || 0, this.ctx.currentTime);

      const eqHigh = this.ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.setValueAtTime(8000, this.ctx.currentTime);
      eqHigh.gain.setValueAtTime(track.effects.eqHigh || 0, this.ctx.currentTime);

      // Track Compressor
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(track.effects.compThreshold || -24, this.ctx.currentTime);
      comp.ratio.setValueAtTime(track.effects.compRatio || 3, this.ctx.currentTime);
      comp.attack.setValueAtTime(track.effects.compAttack || 0.01, this.ctx.currentTime);
      comp.release.setValueAtTime(track.effects.compRelease || 0.1, this.ctx.currentTime);

      // Track Panner
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(track.pan || 0, this.ctx.currentTime);

      // Track Gain
      const gain = this.ctx.createGain();
      const isMuted = track.mute || (hasSolo && !track.solo);
      gain.gain.setValueAtTime(isMuted ? 0 : track.volume, this.ctx.currentTime);

      // Auxiliary sends for Reverb & Delay
      const reverbGain = this.ctx.createGain();
      reverbGain.gain.setValueAtTime(track.effects.reverbWet || 0, this.ctx.currentTime);

      const delayGain = this.ctx.createGain();
      delayGain.gain.setValueAtTime(track.effects.delayWet || 0, this.ctx.currentTime);

      // Wire track node graph:
      // source -> hpf -> lpf -> eqLow -> eqMid -> eqHigh -> comp -> panner -> gain -> masterGain
      source.connect(hpf);
      hpf.connect(lpf);
      lpf.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(comp);
      comp.connect(panner);
      panner.connect(gain);
      gain.connect(this.masterGain!);

      // Sends
      if (this.convolverNode) {
        gain.connect(reverbGain);
        reverbGain.connect(this.convolverNode);
      }
      if (this.delayNode) {
        gain.connect(delayGain);
        delayGain.connect(this.delayNode);
      }

      // Start source from offset
      const offset = Math.min(track.buffer.duration - 0.01, this.pauseOffset);
      if (offset < track.buffer.duration) {
        source.start(0, offset);
      }

      this.trackNodes.set(track.id, {
        source,
        gain,
        panner,
        hpf,
        lpf,
        eqLow,
        eqMid,
        eqHigh,
        comp,
        reverbGain,
        delayGain,
      });
    }

    this.startAnimationLoop();
    this.onStateChangeCallback?.(true);
  }

  public pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSources();
    this.isPlaying = false;
    this.stopAnimationLoop();
    this.onStateChangeCallback?.(false);
  }

  public stop() {
    this.stopSources();
    this.pauseOffset = 0;
    this.isPlaying = false;
    this.stopAnimationLoop();
    this.onTimeUpdateCallback?.(0);
    this.onStateChangeCallback?.(false);
  }

  public seek(seconds: number) {
    const clamped = Math.max(0, Math.min(this.duration, seconds));
    this.pauseOffset = clamped;
    if (this.isPlaying) {
      this.play(clamped);
    } else {
      this.onTimeUpdateCallback?.(clamped);
    }
  }

  private stopSources() {
    for (const [, nodes] of this.trackNodes) {
      try {
        if (nodes.source) {
          nodes.source.stop();
          nodes.source.disconnect();
        }
      } catch {
        // ignore already stopped
      }
    }
    this.trackNodes.clear();
  }

  public updateTrackVolume(trackId: string, volume: number) {
    const nodes = this.trackNodes.get(trackId);
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;
    track.volume = volume;

    const hasSolo = this.tracks.some((t) => t.solo);
    const isMuted = track.mute || (hasSolo && !track.solo);
    if (nodes && this.ctx) {
      nodes.gain.gain.setValueAtTime(isMuted ? 0 : volume, this.ctx.currentTime);
    }
  }

  public updateTrackPan(trackId: string, pan: number) {
    const nodes = this.trackNodes.get(trackId);
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) return;
    track.pan = pan;
    if (nodes && this.ctx) {
      nodes.panner.pan.setValueAtTime(pan, this.ctx.currentTime);
    }
  }

  public updateTrackMuteSolo() {
    const hasSolo = this.tracks.some((t) => t.solo);
    for (const track of this.tracks) {
      const nodes = this.trackNodes.get(track.id);
      if (nodes && this.ctx) {
        const isMuted = track.mute || (hasSolo && !track.solo);
        nodes.gain.gain.setValueAtTime(isMuted ? 0 : track.volume, this.ctx.currentTime);
      }
    }
  }

  public updateTrackEffects(trackId: string) {
    const nodes = this.trackNodes.get(trackId);
    const track = this.tracks.find((t) => t.id === trackId);
    if (!nodes || !track || !this.ctx) return;

    const fx = track.effects;
    nodes.hpf.frequency.setValueAtTime(fx.hpf || 20, this.ctx.currentTime);
    nodes.lpf.frequency.setValueAtTime(fx.lpf || 20000, this.ctx.currentTime);
    nodes.eqLow.gain.setValueAtTime(fx.eqLow || 0, this.ctx.currentTime);
    nodes.eqMid.gain.setValueAtTime(fx.eqMid || 0, this.ctx.currentTime);
    nodes.eqHigh.gain.setValueAtTime(fx.eqHigh || 0, this.ctx.currentTime);
    nodes.comp.threshold.setValueAtTime(fx.compThreshold || -24, this.ctx.currentTime);
    nodes.comp.ratio.setValueAtTime(fx.compRatio || 3, this.ctx.currentTime);
    nodes.reverbGain.gain.setValueAtTime(fx.reverbWet || 0, this.ctx.currentTime);
    nodes.delayGain.gain.setValueAtTime(fx.delayWet || 0, this.ctx.currentTime);
  }

  public getMasterFrequencyData(array: Uint8Array<ArrayBuffer>) {
    if (this.masterAnalyser) {
      this.masterAnalyser.getByteFrequencyData(array);
    }
  }

  private startAnimationLoop() {
    this.stopAnimationLoop();
    const update = () => {
      if (this.isPlaying) {
        const cur = this.getCurrentTime();
        this.onTimeUpdateCallback?.(cur);
        this.animFrameId = requestAnimationFrame(update);
      }
    };
    this.animFrameId = requestAnimationFrame(update);
  }

  private stopAnimationLoop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Offline Rendering: renders all tracks + effects + mastering bus to a final AudioBuffer and WAV Blob.
   */
  public async renderOfflineMix(
    tracks: AudioTrack[],
    mastering?: MasteringSettings,
    targetSampleRate: number = 44100,
    bitDepth: 16 | 24 = 16
  ): Promise<{ buffer: AudioBuffer; wavBlob: Blob }> {
    let maxDur = 0;
    for (const t of tracks) {
      if (t.duration > maxDur) maxDur = t.duration;
    }
    const renderDuration = Math.max(1, maxDur);
    const totalFrames = Math.floor(renderDuration * targetSampleRate);

    const offlineCtx = new OfflineAudioContext(2, totalFrames, targetSampleRate);

    // Master Bus Nodes in Offline Context
    const masterGain = offlineCtx.createGain();
    const inputGainDb = mastering?.inputGain || 0;
    masterGain.gain.setValueAtTime(Math.pow(10, inputGainDb / 20), 0);

    // Mastering EQ
    const eqBass = offlineCtx.createBiquadFilter();
    eqBass.type = 'lowshelf';
    eqBass.frequency.setValueAtTime(80, 0);
    eqBass.gain.setValueAtTime(mastering?.eqBass || 0, 0);

    const eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.setValueAtTime(1200, 0);
    eqMid.gain.setValueAtTime(mastering?.eqLowMid || 0, 0);

    const eqAir = offlineCtx.createBiquadFilter();
    eqAir.type = 'highshelf';
    eqAir.frequency.setValueAtTime(10000, 0);
    eqAir.gain.setValueAtTime(mastering?.eqAir || 0, 0);

    // Master Glue Compressor
    const masterComp = offlineCtx.createDynamicsCompressor();
    const compDrive = mastering?.compressionDrive || 0.3;
    masterComp.threshold.setValueAtTime(-18 - compDrive * 12, 0);
    masterComp.ratio.setValueAtTime(2 + compDrive * 4, 0);
    masterComp.attack.setValueAtTime(0.02, 0);
    masterComp.release.setValueAtTime(0.2, 0);

    // Master Limiter (Hard ceiling)
    const ceilingDb = mastering?.ceiling || -0.3;
    const limiterGain = offlineCtx.createGain();
    limiterGain.gain.setValueAtTime(Math.pow(10, ceilingDb / 20), 0);

    // Connect master chain
    masterGain.connect(eqBass);
    eqBass.connect(eqMid);
    eqMid.connect(eqAir);
    eqAir.connect(masterComp);
    masterComp.connect(limiterGain);
    limiterGain.connect(offlineCtx.destination);

    // Wire individual tracks
    const hasSolo = tracks.some((t) => t.solo);

    for (const track of tracks) {
      if (!track.buffer) continue;
      const isMuted = track.mute || (hasSolo && !track.solo);
      if (isMuted) continue;

      const src = offlineCtx.createBufferSource();
      src.buffer = track.buffer;

      const hpf = offlineCtx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(track.effects.hpf || 20, 0);

      const lpf = offlineCtx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(track.effects.lpf || 20000, 0);

      const eqL = offlineCtx.createBiquadFilter();
      eqL.type = 'lowshelf';
      eqL.frequency.setValueAtTime(100, 0);
      eqL.gain.setValueAtTime(track.effects.eqLow || 0, 0);

      const eqM = offlineCtx.createBiquadFilter();
      eqM.type = 'peaking';
      eqM.frequency.setValueAtTime(1000, 0);
      eqM.gain.setValueAtTime(track.effects.eqMid || 0, 0);

      const eqH = offlineCtx.createBiquadFilter();
      eqH.type = 'highshelf';
      eqH.frequency.setValueAtTime(8000, 0);
      eqH.gain.setValueAtTime(track.effects.eqHigh || 0, 0);

      const trkGain = offlineCtx.createGain();
      trkGain.gain.setValueAtTime(track.volume, 0);

      const panner = offlineCtx.createStereoPanner();
      panner.pan.setValueAtTime(track.pan || 0, 0);

      src.connect(hpf);
      hpf.connect(lpf);
      lpf.connect(eqL);
      eqL.connect(eqM);
      eqM.connect(eqH);
      eqH.connect(panner);
      panner.connect(trkGain);
      trkGain.connect(masterGain);

      src.start(0);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(renderedBuffer, bitDepth);

    return {
      buffer: renderedBuffer,
      wavBlob,
    };
  }
}

// Global audio engine singleton
export const audioEngine = new AudioEngine();
