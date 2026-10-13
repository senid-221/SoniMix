import React, { useState, useRef, useEffect } from 'react';
import {
  GitFork,
  Upload,
  Play,
  Pause,
  Download,
  Archive,
  Sliders,
  Volume2,
  VolumeX,
  Mic,
  Drum,
  Guitar,
  Piano,
  Sparkles,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';
import JSZip from 'jszip';
import { AudioTrack } from '../../types/audio';
import { audioBufferToWav, computeWaveformPeaks } from '../../utils/audioBufferUtils';
import { WaveformCanvas } from '../waveform/WaveformCanvas';
import { SpectrumVisualizer } from '../visualizer/SpectrumVisualizer';

interface StemSplitterStudioProps {
  initialBuffer: AudioBuffer | null;
  onSendToMixer: (stems: AudioTrack[]) => void;
  onAddExport: (title: string, blob: Blob, format: string) => void;
}

export const StemSplitterStudio: React.FC<StemSplitterStudioProps> = ({
  initialBuffer,
  onSendToMixer,
  onAddExport,
}) => {
  const [sourceBuffer, setSourceBuffer] = useState<AudioBuffer | null>(initialBuffer);
  const [sourcePeaks, setSourcePeaks] = useState<number[]>([]);
  const [stems, setStems] = useState<AudioTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isZipping, setIsZipping] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);

  // Playback nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stemSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const stemGainsRef = useRef<Map<string, GainNode>>(new Map());
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio must be sent to the server-side Demucs worker. Browser DSP is not source separation.
  useEffect(() => {
    if (initialBuffer && !sourceBuffer) {
      setSourceBuffer(initialBuffer);
      setSourcePeaks(computeWaveformPeaks(initialBuffer));
    } else if (sourceBuffer && stems.length === 0 && !isProcessing) {
      setSourcePeaks(computeWaveformPeaks(sourceBuffer));
    }
  }, [initialBuffer]);

  const runSeparation = async (_buffer: AudioBuffer) => {
    setProgress(0);
    setProgressStep('Server-side Demucs worker required');
    setProcessingError('Stem separation is disabled until the authenticated SoniMix backend and Demucs worker are configured. No browser-side approximation is used.');
  };

  // Upload user audio
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arr = await file.arrayBuffer();
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(arr);
      setSourceBuffer(decoded);
      setSourcePeaks(computeWaveformPeaks(decoded));
      runSeparation(decoded);
    } catch (err) {
      console.error(err);
    }
  };

  // Playback system
  const stopPlayback = () => {
    for (const [, src] of stemSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    }
    stemSourcesRef.current.clear();
    stemGainsRef.current.clear();

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  };

  const startPlayback = (offset: number = 0) => {
    stopPlayback();
    if (!sourceBuffer || stems.length === 0) return;

    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const hasSolo = stems.some((s) => s.solo);
    const safeOffset = Math.min(sourceBuffer.duration - 0.05, offset);

    stems.forEach((stem) => {
      if (!stem.buffer || !audioCtxRef.current) return;
      const src = audioCtxRef.current.createBufferSource();
      src.buffer = stem.buffer;

      const gain = audioCtxRef.current.createGain();
      const isMuted = stem.mute || (hasSolo && !stem.solo);
      gain.gain.setValueAtTime(isMuted ? 0 : stem.volume, audioCtxRef.current.currentTime);

      src.connect(gain);
      gain.connect(audioCtxRef.current.destination);

      src.start(0, safeOffset);
      stemSourcesRef.current.set(stem.id, src);
      stemGainsRef.current.set(stem.id, gain);
    });

    startTimeRef.current = audioCtxRef.current.currentTime - safeOffset;
    pauseOffsetRef.current = safeOffset;
    setIsPlaying(true);

    const update = () => {
      if (audioCtxRef.current && sourceBuffer) {
        const cur = audioCtxRef.current.currentTime - startTimeRef.current;
        if (cur >= sourceBuffer.duration) {
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

  const handleSeek = (time: number) => {
    pauseOffsetRef.current = time;
    setCurrentTime(time);
    if (isPlaying) {
      startPlayback(time);
    }
  };

  // Mute / Solo toggle
  const toggleMute = (stemId: string) => {
    setStems((prev) => {
      const updated = prev.map((s) => (s.id === stemId ? { ...s, mute: !s.mute } : s));
      const hasSolo = updated.some((s) => s.solo);

      updated.forEach((s) => {
        const gain = stemGainsRef.current.get(s.id);
        if (gain && audioCtxRef.current) {
          const isMuted = s.mute || (hasSolo && !s.solo);
          gain.gain.setValueAtTime(isMuted ? 0 : s.volume, audioCtxRef.current.currentTime);
        }
      });
      return updated;
    });
  };

  const toggleSolo = (stemId: string) => {
    setStems((prev) => {
      const updated = prev.map((s) => (s.id === stemId ? { ...s, solo: !s.solo } : s));
      const hasSolo = updated.some((s) => s.solo);

      updated.forEach((s) => {
        const gain = stemGainsRef.current.get(s.id);
        if (gain && audioCtxRef.current) {
          const isMuted = s.mute || (hasSolo && !s.solo);
          gain.gain.setValueAtTime(isMuted ? 0 : s.volume, audioCtxRef.current.currentTime);
        }
      });
      return updated;
    });
  };

  const handleVolume = (stemId: string, val: number) => {
    setStems((prev) =>
      prev.map((s) => (s.id === stemId ? { ...s, volume: val } : s))
    );
    const gain = stemGainsRef.current.get(stemId);
    if (gain && audioCtxRef.current) {
      const stem = stems.find((s) => s.id === stemId);
      const hasSolo = stems.some((s) => s.solo);
      const isMuted = stem?.mute || (hasSolo && !stem?.solo);
      if (!isMuted) {
        gain.gain.setValueAtTime(val, audioCtxRef.current.currentTime);
      }
    }
  };

  // Download single stem
  const handleDownloadStem = (stem: AudioTrack) => {
    if (!stem.buffer) return;
    const blob = audioBufferToWav(stem.buffer, 16);
    const filename = `SoniMix_Stem_${stem.name.replace(/\s+/g, '_')}.wav`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onAddExport(filename, blob, 'WAV Stem 16-bit');
  };

  // Download all stems as ZIP package
  const handleDownloadAllZip = async () => {
    if (stems.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('SoniMix_Stems_Package');

      for (const stem of stems) {
        if (!stem.buffer) continue;
        const blob = audioBufferToWav(stem.buffer, 16);
        const arrayBuf = await blob.arrayBuffer();
        folder?.file(`${stem.name}.wav`, arrayBuf);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const filename = `SoniMix_Stems_Bundle_${Date.now()}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onAddExport(filename, zipBlob, 'ZIP Stem Package');
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 4000);
    } catch (err) {
      console.error('ZIP creation error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const getStemIcon = (type: string) => {
    switch (type) {
      case 'vocals':
        return <Mic className="w-5 h-5 text-purple-400" />;
      case 'drums':
        return <Drum className="w-5 h-5 text-emerald-400" />;
      case 'bass':
        return <Guitar className="w-5 h-5 text-orange-400" />;
      case 'melody':
      default:
        return <Piano className="w-5 h-5 text-sky-400" />;
    }
  };

  const totalDuration = sourceBuffer?.duration || 0;

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <GitFork className="w-5 h-5 text-blue-400" />
            <h1 className="font-heading font-extrabold text-xl text-white">
              AI Stem Separation Studio
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-bold">
              4-STEM DEMIXING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract independent Vocals, Drums, Bass, and Melody with synchronized multitrack playback.
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
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload New Song</span>
          </button>

          <button
            onClick={() => onSendToMixer(stems)}
            disabled={stems.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            title="Open these 4 separated stems inside the multitrack DAW mixer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open in Multitrack Mixer</span>
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={stems.length === 0 || isZipping}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Packaging ZIP...' : 'Download Stems (ZIP)'}</span>
          </button>
        </div>
      </div>

      {!sourceBuffer ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-800 flex items-center justify-center mb-4">
            <GitFork className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Separate any song into 4 stems</h2>
          <p className="text-xs text-slate-400 mb-6">
            Upload any WAV, MP3, or FLAC track to cleanly separate Vocals, Drums, Bass, and Melody.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              Upload Song File to Separate Stems
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          {/* Processing Progress Banner */}
          {isProcessing && (
            <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-400 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>{progressStep}</span>
                </span>
                <span className="font-mono text-slate-400">{progress}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {processingError && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200">
              {processingError}
            </div>
          )}

          {/* Reference Image 2 Layout: Master Waveform with Glowing Rainbow Spectral Header */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800/80 p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-400">
                  FULL MIX STEREO
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  MASTER SOURCE
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
              </span>
            </div>

            {/* Rainbow Spectrogram Waveform (Matches Reference Image 2) */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 p-3">
              <WaveformCanvas
                peaks={sourcePeaks}
                color="#60a5fa"
                height={72}
                currentTime={currentTime}
                duration={totalDuration}
                onSeek={handleSeek}
              />
            </div>

            {/* Glowing Demixing Flow Node (matches reference image 2) */}
            <div className="flex justify-center -my-1 py-2 relative z-10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 via-emerald-400 to-sky-400 p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>
            </div>

            {/* 4 Separated Stems Tracks Container */}
            <div className="space-y-3 mt-2">
              {stems.map((stem) => (
                <div
                  key={stem.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-all p-3"
                  style={{
                    boxShadow: `0 0 15px -3px ${stem.color}15`,
                  }}
                >
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Stem Info & Badge */}
                    <div className="w-full md:w-56 flex items-center justify-between md:justify-start space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${stem.color}18`,
                          borderColor: `${stem.color}40`,
                        }}
                      >
                        {getStemIcon(stem.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-heading font-bold text-sm text-white uppercase tracking-wide truncate">
                            {stem.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          {stem.type} stem
                        </span>
                      </div>

                      {/* Mute & Solo buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => toggleMute(stem.id)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                            stem.mute
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Mute"
                        >
                          M
                        </button>
                        <button
                          onClick={() => toggleSolo(stem.id)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                            stem.solo
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Solo"
                        >
                          S
                        </button>
                      </div>
                    </div>

                    {/* Stem Waveform */}
                    <div className="flex-1 bg-slate-900/50 rounded-lg p-2 border border-slate-850">
                      <WaveformCanvas
                        peaks={stem.peaks}
                        color={stem.color}
                        height={46}
                        currentTime={currentTime}
                        duration={totalDuration}
                        onSeek={handleSeek}
                      />
                    </div>

                    {/* Volume & Individual Download */}
                    <div className="flex items-center space-x-3 justify-end">
                      <div className="flex items-center space-x-2 w-28">
                        <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.02"
                          value={stem.volume}
                          onChange={(e) => handleVolume(stem.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <button
                        onClick={() => handleDownloadStem(stem)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                        title={`Download ${stem.name} stem in uncompressed WAV`}
                      >
                        <Download className="w-3 h-3 text-blue-400" />
                        <span className="hidden sm:inline">WAV</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Synchronized Transport Control Bar (Matches Reference Image 2 Bottom) */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayToggle}
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 cursor-pointer transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    stopPlayback();
                    setCurrentTime(0);
                    pauseOffsetRef.current = 0;
                  }}
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="text-blue-400 font-bold">{currentTime.toFixed(2)}s</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-slate-400">{totalDuration.toFixed(2)}s</span>
                </div>

                <div className="hidden sm:flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                  <span className="text-slate-400">128.00 BPM</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">4 / 4 TIME</span>
                </div>
              </div>

              {/* Spectrum Visualizer */}
              <div className="flex items-center space-x-3">
                <SpectrumVisualizer height={28} bands={20} barColor="#8b5cf6" className="w-32 hidden sm:flex" />
              </div>
            </div>
          </div>

          {zipSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>All 4 stems packaged into ZIP archive and downloaded successfully!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
