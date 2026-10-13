import React, { useState, useRef, useEffect } from 'react';
import {
  Gauge,
  Upload,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ResampleSettings } from '../../types/audio';
import { resampleAudioBuffer, ResampleResult } from '../../utils/resampler';
import { audioBufferToWav, computeWaveformPeaks } from '../../utils/audioBufferUtils';
import { WaveformCanvas } from '../waveform/WaveformCanvas';
import { submitJob, uploadAsset, waitForJob } from '../../utils/apiClient';

interface ResamplerStudioProps {
  inputBuffer: AudioBuffer | null;
  onAddExport: (title: string, blob: Blob, format: string) => void | Promise<void>;
}

export const ResamplerStudio: React.FC<ResamplerStudioProps> = ({
  inputBuffer,
  onAddExport,
}) => {
  const [sourceBuffer, setSourceBuffer] = useState<AudioBuffer | null>(inputBuffer);
  const [settings, setSettings] = useState<ResampleSettings>({
    targetSampleRate: 48000,
    bitDepth: 24,
    speed: 1.0,
    pitchSemitones: 0,
    format: 'wav',
    normalize: false,
  });

  const [resampleResult, setResampleResult] = useState<ResampleResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'resampled' | 'original'>('resampled');
  const [currentTime, setCurrentTime] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputBuffer && !sourceBuffer) {
      setSourceBuffer(inputBuffer);
      runResampling(inputBuffer, settings);
    } else if (sourceBuffer && !resampleResult) {
      runResampling(sourceBuffer, settings);
    }
  }, [inputBuffer]);

  const runResampling = async (buf: AudioBuffer, currentSettings: ResampleSettings) => {
    setIsProcessing(true);
    try {
      const res = await resampleAudioBuffer(buf, currentSettings);
      setResampleResult(res);
      stopPlayback();
      setCurrentTime(0);
      pauseOffsetRef.current = 0;
    } catch (err) {
      console.error('Resampling failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arr = await file.arrayBuffer();
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(arr);
      setSourceBuffer(decoded);
      runResampling(decoded, settings);
    } catch (err) {
      console.error(err);
    }
  };

  // Preset Applicator
  const applyPreset = (preset: 'standard' | 'nightcore' | 'chopped' | 'vinyl' | 'broadcast') => {
    let s: ResampleSettings = { ...settings };
    switch (preset) {
      case 'nightcore':
        s = { ...s, speed: 1.25, pitchSemitones: 3.5 };
        break;
      case 'chopped':
        s = { ...s, speed: 0.78, pitchSemitones: -4.0 };
        break;
      case 'vinyl':
        s = { ...s, speed: 0.5, pitchSemitones: -12.0 };
        break;
      case 'broadcast':
        s = { ...s, targetSampleRate: 48000, bitDepth: 24, speed: 1.0, pitchSemitones: 0 };
        break;
      case 'standard':
      default:
        s = { ...s, targetSampleRate: 44100, bitDepth: 16, speed: 1.0, pitchSemitones: 0 };
        break;
    }
    setSettings(s);
    if (sourceBuffer) {
      runResampling(sourceBuffer, s);
    }
  };

  // Playback system
  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  };

  const startPlayback = (offset: number = 0) => {
    stopPlayback();
    const activeBuf = playMode === 'resampled' ? resampleResult?.outputBuffer : sourceBuffer;
    if (!activeBuf) return;

    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const src = audioCtxRef.current.createBufferSource();
    src.buffer = activeBuf;
    src.connect(audioCtxRef.current.destination);

    const safeOffset = Math.min(activeBuf.duration - 0.05, offset);
    src.start(0, safeOffset);

    startTimeRef.current = audioCtxRef.current.currentTime - safeOffset;
    pauseOffsetRef.current = safeOffset;
    sourceNodeRef.current = src;
    setIsPlaying(true);

    const update = () => {
      if (audioCtxRef.current && activeBuf) {
        const cur = audioCtxRef.current.currentTime - startTimeRef.current;
        if (cur >= activeBuf.duration) {
          stopPlayback();
          setCurrentTime(0);
          pauseOffsetRef.current = 0;
          return;
        }
        setCurrentTime(cur);
        animFrameRef.current = requestAnimationFrame(update);
      }
    };
    animFrameRef.current = requestAnimationFrame(update);
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      pauseOffsetRef.current = currentTime;
      stopPlayback();
    } else {
      startPlayback(pauseOffsetRef.current);
    }
  };

  const handleDownload = async () => {
    if (!sourceBuffer || !resampleResult) return;
    setIsProcessing(true);
    try {
      const { file } = await uploadAsset(audioBufferToWav(sourceBuffer, 24), 'resample-source.wav');
      const queued = await submitJob<{ id: string }>('resample_audio', file, { sampleRate: settings.targetSampleRate, bitDepth: settings.bitDepth, speed: settings.speed, pitchSemitones: settings.pitchSemitones, normalize: settings.normalize, format: settings.format });
      const job = await waitForJob<{ id: string; state: string; outputs: string[] }>(queued.id);
      const fileResponse = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!fileResponse.ok) throw new Error('The verified resampled file could not be retrieved.');
      const rendered = await fileResponse.blob();
      const extension = settings.format === 'mp3' ? 'mp3' : 'wav';
      const title = `SoniMix_Resampled_${settings.targetSampleRate}Hz_${settings.bitDepth}bit_${settings.speed}x.${extension}`;
      await onAddExport(title, rendered, `WAV ${settings.bitDepth}-bit (${settings.targetSampleRate}Hz)`);
      const url = URL.createObjectURL(rendered); const anchor = document.createElement('a'); anchor.href = url; anchor.download = title; anchor.click(); URL.revokeObjectURL(url);
      setExportSuccess(true); setTimeout(() => setExportSuccess(false), 4000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Resampling failed.');
    } finally { setIsProcessing(false); }
  };

  const activeDuration = playMode === 'resampled'
    ? resampleResult?.outputDuration || 0
    : sourceBuffer?.duration || 0;

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Gauge className="w-5 h-5 text-teal-400" />
            <h1 className="font-heading font-extrabold text-xl text-white">
              Audio Resampler & Conversion Engine
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 font-mono font-bold">
              TRUE PCM RESAMPLING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Convert sample rates (44.1kHz - 96kHz), bit depths, speed transposition, and creative pitch manipulation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Upload Track</span>
          </button>

          <button
            onClick={() => sourceBuffer && runResampling(sourceBuffer, settings)}
            disabled={!sourceBuffer || isProcessing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-teal-400' : ''}`} />
            <span>Re-Calculate</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!resampleResult}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Resampled Audio</span>
          </button>
        </div>
      </div>

      {!sourceBuffer ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-teal-950/60 border border-teal-800 flex items-center justify-center mb-4">
            <Gauge className="w-8 h-8 text-teal-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No audio loaded for resampling</h2>
          <p className="text-xs text-slate-400 mb-6">
            Upload any track to test sample rate conversion, speed variation, and pitch transposition.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
          >
            Upload Audio File
          </button>
        </div>
      ) : (
        <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          {/* Waveform Player & A/B Comparison */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayToggle}
                  className="w-11 h-11 rounded-xl bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 cursor-pointer transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">
                      {playMode === 'resampled' ? 'Resampled & Pitch-Shifted Audio' : 'Original Unprocessed Audio'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 font-bold uppercase">
                      {playMode === 'resampled' ? 'RESAMPLED PREVIEW' : 'ORIGINAL AUDIO'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {currentTime.toFixed(2)}s / {activeDuration.toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Mode switch */}
              <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => {
                    setPlayMode('original');
                    stopPlayback();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    playMode === 'original' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Original ({sourceBuffer.sampleRate} Hz)
                </button>
                <button
                  onClick={() => {
                    setPlayMode('resampled');
                    stopPlayback();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    playMode === 'resampled' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Resampled ({settings.targetSampleRate} Hz)
                </button>
              </div>
            </div>

            {/* Waveform Canvas */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <WaveformCanvas
                peaks={resampleResult?.peaks || computeWaveformPeaks(sourceBuffer)}
                color={playMode === 'resampled' ? '#14b8a6' : '#64748b'}
                height={70}
                currentTime={currentTime}
                duration={activeDuration}
                onSeek={(t) => {
                  setCurrentTime(t);
                  pauseOffsetRef.current = t;
                  if (isPlaying) startPlayback(t);
                }}
              />
            </div>
          </div>

          {/* Quick Creative Presets */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Quick Resampling Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: 'broadcast', label: 'Broadcast Standard', sub: '48kHz / 24-bit' },
                { id: 'standard', label: 'CD Red Book', sub: '44.1kHz / 16-bit' },
                { id: 'nightcore', label: 'Nightcore Boost', sub: '1.25x Speed / +3.5st' },
                { id: 'chopped', label: 'Chopped & Slowed', sub: '0.78x Speed / -4st' },
                { id: 'vinyl', label: 'Vinyl Half-Speed', sub: '0.50x Speed / -12st' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as any)}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-white block mb-0.5">{p.label}</span>
                  <span className="text-[10px] text-teal-400 font-mono block">{p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Settings Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Format & Sample Rate Technical Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-sm text-white">Sample Rate & Bit Depth</h3>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Target Sample Rate</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[44100, 48000, 88200, 96000].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        const next = { ...settings, targetSampleRate: rate };
                        setSettings(next);
                        if (sourceBuffer) runResampling(sourceBuffer, next);
                      }}
                      className={`py-2 px-1 text-center font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                        settings.targetSampleRate === rate
                          ? 'bg-teal-600 border-teal-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {(rate / 1000).toFixed(1)} kHz
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Quantization Bit Depth</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => {
                      const next = { ...settings, bitDepth: 16 as const };
                      setSettings(next);
                      if (sourceBuffer) runResampling(sourceBuffer, next);
                    }}
                    className={`py-2 text-center font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      settings.bitDepth === 16
                        ? 'bg-teal-600 border-teal-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    16-bit PCM (Standard)
                  </button>
                  <button
                    onClick={() => {
                      const next = { ...settings, bitDepth: 24 as const };
                      setSettings(next);
                      if (sourceBuffer) runResampling(sourceBuffer, next);
                    }}
                    className={`py-2 text-center font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      settings.bitDepth === 24
                        ? 'bg-teal-600 border-teal-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    24-bit PCM (Studio Master)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Input Sample Rate:</span>
                  <span className="font-mono text-white">{sourceBuffer.sampleRate} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Output Sample Rate:</span>
                  <span className="font-mono text-teal-400">{settings.targetSampleRate} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Anti-Aliasing Filter:</span>
                  <span className="font-mono text-emerald-400">Nyquist Linear Phase Enabled</span>
                </div>
              </div>
            </div>

            {/* Creative Speed & Pitch Manipulation */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Speed & Pitch Transposition</h3>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Playback Speed Factor</span>
                  <span className="font-mono text-white">{settings.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.75"
                  step="0.05"
                  value={settings.speed}
                  onChange={(e) => {
                    const next = { ...settings, speed: parseFloat(e.target.value) };
                    setSettings(next);
                    if (sourceBuffer) runResampling(sourceBuffer, next);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pitch Shift Transposition</span>
                  <span className="font-mono text-white">
                    {settings.pitchSemitones > 0 ? `+${settings.pitchSemitones}` : settings.pitchSemitones} Semitones
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={settings.pitchSemitones}
                  onChange={(e) => {
                    const next = { ...settings, pitchSemitones: parseFloat(e.target.value) };
                    setSettings(next);
                    if (sourceBuffer) runResampling(sourceBuffer, next);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Original Duration:</span>
                  <span className="font-mono text-white">{sourceBuffer.duration.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>New Resampled Duration:</span>
                  <span className="font-mono text-amber-400">
                    {resampleResult?.outputDuration.toFixed(2) || (sourceBuffer.duration / settings.speed).toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {exportSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Resampled audio exported with verified technical specifications!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
