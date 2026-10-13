import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Download,
  Upload,
  Layers,
  Wand2,
  Maximize2,
  CheckCircle,
  Eye,
  EyeOff,
  Zap,
  Scissors,
  Crop,
  Trash2,
  Split,
  Sparkles,
  Radio,
  MicOff,
  X,
  Drum,
  Guitar,
  Piano,
  Mic,
  AudioWaveform,
} from 'lucide-react';
import { AudioTrack, MasteringSettings } from '../../types/audio';
import { audioEngine } from '../../audio/audioEngine';
import { WaveformCanvas } from '../waveform/WaveformCanvas';
import { SpectrumVisualizer } from '../visualizer/SpectrumVisualizer';
import { computeWaveformPeaks } from '../../utils/audioBufferUtils';
import {
  trimAudioBuffer,
  deleteRegionAudioBuffer,
  splitAudioBuffer,
  applyStudioEnhance,
  applyLoFiReduce,
  applyNoiseReduce,
} from '../../utils/audioEditorUtils';

interface MixingStudioProps {
  tracks: AudioTrack[];
  setTracks: React.Dispatch<React.SetStateAction<AudioTrack[]>>;
  onMasteringRequest: (mixBuffer: AudioBuffer) => void;
  onAddExport: (title: string, blob: Blob, format: string) => void;
}

export const MixingStudio: React.FC<MixingStudioProps> = ({
  tracks,
  setTracks,
  onMasteringRequest,
  onAddExport,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || '');
  const [isBypassEffects, setIsBypassEffects] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync with AudioEngine
  useEffect(() => {
    audioEngine.setTracks(tracks);
    audioEngine.setLoop(loopEnabled);
  }, [tracks, loopEnabled]);

  useEffect(() => {
    audioEngine.setOnTimeUpdate((t) => setCurrentTime(t));
    audioEngine.setOnStateChange((p) => setIsPlaying(p));
  }, []);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];
  const maxDuration = audioEngine.getDuration();

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  const handleStop = () => {
    audioEngine.stop();
  };

  const handleSeek = (time: number) => {
    audioEngine.seek(time);
  };

  const handleVolumeChange = (trackId: string, val: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume: val } : t))
    );
    audioEngine.updateTrackVolume(trackId, val);
  };

  const handlePanChange = (trackId: string, val: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, pan: val } : t))
    );
    audioEngine.updateTrackPan(trackId, val);
  };

  const toggleMute = (trackId: string) => {
    setTracks((prev) => {
      const updated = prev.map((t) =>
        t.id === trackId ? { ...t, mute: !t.mute } : t
      );
      return updated;
    });
    setTimeout(() => audioEngine.updateTrackMuteSolo(), 0);
  };

  const toggleSolo = (trackId: string) => {
    setTracks((prev) => {
      const updated = prev.map((t) =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
      );
      return updated;
    });
    setTimeout(() => audioEngine.updateTrackMuteSolo(), 0);
  };

  const handleEffectChange = (
    key: keyof typeof selectedTrack.effects,
    value: number
  ) => {
    if (!selectedTrack) return;
    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrack.id
          ? { ...t, effects: { ...t.effects, [key]: value } }
          : t
      )
    );
    setTimeout(() => audioEngine.updateTrackEffects(selectedTrack.id), 0);
  };

  // Preset Applicator
  const applyPreset = (presetName: string) => {
    if (!selectedTrack) return;
    let newEffects = { ...selectedTrack.effects };

    switch (presetName) {
      case 'Warm Tube':
        newEffects = {
          ...newEffects,
          eqLow: 2.5,
          eqMid: -0.5,
          eqHigh: -1.0,
          saturation: 0.45,
          compThreshold: -20,
          compRatio: 3,
        };
        break;
      case 'Bright Air':
        newEffects = {
          ...newEffects,
          eqLow: -1.0,
          eqMid: 1.0,
          eqHigh: 4.5,
          hpf: 80,
          compThreshold: -22,
          compRatio: 3.5,
        };
        break;
      case 'Clean Punch':
        newEffects = {
          ...newEffects,
          eqLow: 2.0,
          eqMid: -2.0,
          eqHigh: 2.0,
          compThreshold: -16,
          compRatio: 5,
          compAttack: 0.03,
        };
        break;
      case 'Vocal Forward':
        newEffects = {
          ...newEffects,
          eqLow: -2.0,
          eqMid: 3.0,
          eqHigh: 2.5,
          hpf: 110,
          reverbWet: 0.15,
          delayWet: 0.1,
          compThreshold: -24,
          compRatio: 4,
        };
        break;
      case 'Balanced':
      default:
        newEffects = {
          eqLow: 0,
          eqMid: 0,
          eqHigh: 0,
          hpf: 20,
          lpf: 20000,
          compThreshold: -24,
          compRatio: 3,
          compAttack: 0.01,
          compRelease: 0.1,
          reverbWet: 0.05,
          delayWet: 0,
          delayTime: 0.25,
          saturation: 0,
        };
        break;
    }

    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrack.id ? { ...t, effects: newEffects } : t
      )
    );
    setTimeout(() => audioEngine.updateTrackEffects(selectedTrack.id), 0);
  };

  // Upload Custom Track
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuf = await file.arrayBuffer();
      const tempCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decodedBuffer = await tempCtx.decodeAudioData(arrayBuf);
      const peaks = computeWaveformPeaks(decodedBuffer);

      const newTrack: AudioTrack = {
        id: `custom-track-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'custom',
        color: '#60a5fa',
        buffer: decodedBuffer,
        duration: decodedBuffer.duration,
        volume: 1.0,
        pan: 0,
        mute: false,
        solo: false,
        peaks,
        effects: {
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
        },
      };

      setTracks((prev) => [...prev, newTrack]);
      setSelectedTrackId(newTrack.id);
    } catch (err) {
      console.error('Audio decode error:', err);
    }
  };

  // Region Selection Handler
  const handleSelectRegion = (start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const handleClearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // 1. Trim Selection: Keep only highlighted portion
  const handleTrimSelection = () => {
    if (!selectedTrack || !selectedTrack.buffer || selectionStart === null || selectionEnd === null) return;
    const trimmed = trimAudioBuffer(selectedTrack.buffer, selectionStart, selectionEnd);
    const newPeaks = computeWaveformPeaks(trimmed);

    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrack.id
          ? { ...t, buffer: trimmed, duration: trimmed.duration, peaks: newPeaks }
          : t
      )
    );
    handleClearSelection();
  };

  // 2. Delete / Cut Region: Remove highlighted slice
  const handleDeleteSelection = () => {
    if (!selectedTrack || !selectedTrack.buffer || selectionStart === null || selectionEnd === null) return;
    const stitched = deleteRegionAudioBuffer(selectedTrack.buffer, selectionStart, selectionEnd);
    const newPeaks = computeWaveformPeaks(stitched);

    setTracks((prev) =>
      prev.map((t) =>
        t.id === selectedTrack.id
          ? { ...t, buffer: stitched, duration: stitched.duration, peaks: newPeaks }
          : t
      )
    );
    handleClearSelection();
  };

  // 3. Split Track at Playhead
  const handleSplitAtPlayhead = () => {
    if (!selectedTrack || !selectedTrack.buffer || currentTime <= 0.05 || currentTime >= selectedTrack.duration - 0.05) return;
    const [part1, part2] = splitAudioBuffer(selectedTrack.buffer, currentTime);

    const track1: AudioTrack = {
      ...selectedTrack,
      name: `${selectedTrack.name} (A)`,
      buffer: part1,
      duration: part1.duration,
      peaks: computeWaveformPeaks(part1),
    };

    const track2: AudioTrack = {
      ...selectedTrack,
      id: `split-${Date.now()}`,
      name: `${selectedTrack.name} (B)`,
      buffer: part2,
      duration: part2.duration,
      peaks: computeWaveformPeaks(part2),
    };

    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === selectedTrack.id);
      const next = [...prev];
      next.splice(idx, 1, track1, track2);
      return next;
    });
    setSelectedTrackId(track1.id);
  };

  // 4. Quality Restoration: Studio Enhance
  const handleStudioEnhance = async () => {
    if (!selectedTrack || !selectedTrack.buffer) return;
    setIsProcessingAudio(true);
    try {
      const enhanced = await applyStudioEnhance(selectedTrack.buffer);
      const newPeaks = computeWaveformPeaks(enhanced);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrack.id
            ? { ...t, buffer: enhanced, peaks: newPeaks }
            : t
        )
      );
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // 5. Quality Restoration: Lo-Fi Reduce
  const handleLoFiReduce = async () => {
    if (!selectedTrack || !selectedTrack.buffer) return;
    setIsProcessingAudio(true);
    try {
      const lofi = await applyLoFiReduce(selectedTrack.buffer);
      const newPeaks = computeWaveformPeaks(lofi);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrack.id
            ? { ...t, buffer: lofi, peaks: newPeaks }
            : t
        )
      );
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // 6. Quality Restoration: AI Noise Reduce
  const handleNoiseReduce = async () => {
    if (!selectedTrack || !selectedTrack.buffer) return;
    setIsProcessingAudio(true);
    try {
      const cleaned = await applyNoiseReduce(selectedTrack.buffer);
      const newPeaks = computeWaveformPeaks(cleaned);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrack.id
            ? { ...t, buffer: cleaned, peaks: newPeaks }
            : t
        )
      );
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // Export Mix (True Offline Rendering)
  const handleExportMix = async () => {
    if (tracks.length === 0) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const dummyMastering: MasteringSettings = {
        targetLufs: -14,
        ceiling: -0.3,
        inputGain: 0,
        eqBass: 0,
        eqLowMid: 0,
        eqPresence: 0,
        eqAir: 0,
        stereoWidth: 1.0,
        compressionDrive: 0.2,
        warmTape: 0.1,
        presetName: 'Raw Mix Bounce',
      };

      const result = await audioEngine.renderOfflineMix(tracks, dummyMastering, 44100, bitDepth);
      const filename = `SoniMix_Bounce_${new Date().toISOString().slice(0, 10)}_${bitDepth}bit.wav`;

      // Trigger browser download
      const url = URL.createObjectURL(result.wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onAddExport(filename, result.wavBlob, `WAV ${bitDepth}-bit`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Send mix straight to mastering
  const handleSendToMastering = async () => {
    setIsExporting(true);
    try {
      const result = await audioEngine.renderOfflineMix(tracks, undefined, 44100, 16);
      onMasteringRequest(result.buffer);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top DAW Transport Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap select-none">
        {/* Playback Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePlayPause}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleStop}
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Stop & Reset Cursor"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Time & BPM Counter */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-sm">
            <span className="text-blue-400 font-bold">{formatTime(currentTime)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatTime(maxDuration)}</span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">TEMPO:</span>
            <span className="text-emerald-400 font-bold">120.0</span>
            <span className="text-slate-500">BPM</span>
          </div>

          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
              loopEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-slate-800 text-slate-500'
            }`}
          >
            LOOP
          </button>
        </div>

        {/* Master Meter & Spectrum */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Master Spectrum</span>
            <SpectrumVisualizer height={26} bands={24} barColor="#3b82f6" className="w-36" />
          </div>

          {/* A/B Compare Toggle */}
          <button
            onClick={() => setIsBypassEffects(!isBypassEffects)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              isBypassEffects
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle between Processed and Raw Audio"
          >
            {isBypassEffects ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isBypassEffects ? 'A/B: BYPASS (Raw)' : 'A/B: PROCESSED'}</span>
          </button>
        </div>

        {/* Export & Actions */}
        <div className="flex items-center space-x-2.5">
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
            <span className="hidden sm:inline">Add Track</span>
          </button>

          <select
            value={bitDepth}
            onChange={(e) => setBitDepth(Number(e.target.value) as 16 | 24)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-200 cursor-pointer focus:outline-none"
          >
            <option value={16}>WAV 16-bit</option>
            <option value={24}>WAV 24-bit Hi-Res</option>
          </select>

          <button
            onClick={handleExportMix}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Bouncing...' : 'Export Mix'}</span>
          </button>

          <button
            onClick={handleSendToMastering}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            title="Pass entire mix into the AI Mastering Suite"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Master Song</span>
          </button>
        </div>
      </div>

      {/* Main Studio Center: Multitrack Timeline (Left/Top) + Channel Strip / Effects Rack (Right/Bottom) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Multitrack Workspace */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto">
          {/* Toolbar: Timeline ruler, Edit tools, Quality restoration, and Zoom (Inspired by Reference Image 1) */}
          <div className="bg-slate-900/80 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left: Edit & Restoration Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-300 font-mono text-[11px] uppercase tracking-wider mr-1">
                EDIT:
              </span>

              {/* Trim */}
              <button
                onClick={handleTrimSelection}
                disabled={selectionStart === null || selectionEnd === null}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
                title="Trim audio: keep only selected region"
              >
                <Crop className="w-3.5 h-3.5 text-blue-400" />
                <span>Trim</span>
              </button>

              {/* Cut / Delete */}
              <button
                onClick={handleDeleteSelection}
                disabled={selectionStart === null || selectionEnd === null}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
                title="Cut out selected region"
              >
                <Scissors className="w-3.5 h-3.5 text-rose-400" />
                <span>Cut / Delete</span>
              </button>

              {/* Split */}
              <button
                onClick={handleSplitAtPlayhead}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
                title="Split track at current cursor time"
              >
                <Split className="w-3.5 h-3.5 text-amber-400" />
                <span>Split at Playhead</span>
              </button>

              <div className="h-4 w-px bg-slate-750 mx-1 hidden sm:block" />

              <span className="font-bold text-slate-400 font-mono text-[11px] uppercase tracking-wider mr-1 hidden sm:inline">
                RESTORATION:
              </span>

              {/* Studio Enhance */}
              <button
                onClick={handleStudioEnhance}
                disabled={isProcessingAudio}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 transition-colors font-medium cursor-pointer disabled:opacity-50"
                title="Exciter & multiband presence boost"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Studio Enhance</span>
              </button>

              {/* Lo-Fi (Reduce) */}
              <button
                onClick={handleLoFiReduce}
                disabled={isProcessingAudio}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 transition-colors font-medium cursor-pointer disabled:opacity-50"
                title="Vintage cassette telephone bandpass"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Lo-Fi</span>
              </button>

              {/* AI Noise Reduce */}
              <button
                onClick={handleNoiseReduce}
                disabled={isProcessingAudio}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 transition-colors font-medium cursor-pointer disabled:opacity-50"
                title="Spectral noise gate & hiss attenuation"
              >
                <MicOff className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Noise Reduce</span>
              </button>

              {/* Region selection indicator */}
              {selectionStart !== null && selectionEnd !== null && (
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-600/20 border border-blue-500/40 text-[11px] text-blue-300 font-mono ml-2">
                  <span>
                    Selected: {selectionStart.toFixed(2)}s - {selectionEnd.toFixed(2)}s ({(selectionEnd - selectionStart).toFixed(2)}s)
                  </span>
                  <button
                    onClick={handleClearSelection}
                    className="p-0.5 hover:text-white cursor-pointer"
                    title="Clear region selection"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Right: Zoom slider */}
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="text-[11px]">Zoom</span>
              <input
                type="range"
                min="50"
                max="200"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Track Rows */}
          <div className="divide-y divide-slate-850 p-2 space-y-2">
            {tracks.map((track) => {
              const isSelected = track.id === selectedTrackId;
              return (
                <div
                  key={track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                  className={`rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-blue-500/60 shadow-lg shadow-blue-950/40'
                      : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                    {/* Track Control Strip */}
                    <div className="w-full sm:w-64 p-3 border-b sm:border-b-0 sm:border-r border-slate-800 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: `${track.color}18`,
                              borderColor: `${track.color}40`,
                            }}
                          >
                            {track.type === 'vocals' ? (
                              <Mic className="w-3 h-3 text-purple-400" />
                            ) : track.type === 'drums' ? (
                              <Drum className="w-3 h-3 text-emerald-400" />
                            ) : track.type === 'bass' ? (
                              <Guitar className="w-3 h-3 text-orange-400" />
                            ) : track.type === 'melody' ? (
                              <Piano className="w-3 h-3 text-sky-400" />
                            ) : (
                              <AudioWaveform className="w-3 h-3 text-blue-400" />
                            )}
                          </div>
                          <span className="font-bold text-xs text-white truncate max-w-[120px]">
                            {track.name}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {track.type}
                        </span>
                      </div>

                      {/* Mute, Solo & Volume */}
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute(track.id);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                              track.mute
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            M
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSolo(track.id);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${
                              track.solo
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            S
                          </button>
                        </div>

                        {/* Volume fader */}
                        <div className="flex-1 flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <input
                            type="range"
                            min="0"
                            max="1.5"
                            step="0.01"
                            value={track.volume}
                            onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                            {(track.volume * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Pan knob slider */}
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-mono text-slate-500">PAN</span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={track.pan}
                          onChange={(e) => handlePanChange(track.id, parseFloat(e.target.value))}
                          className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-400 w-6 text-right">
                          {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 50))}` : `R${Math.round(track.pan * 50)}`}
                        </span>
                      </div>
                    </div>

                    {/* Track Waveform Canvas */}
                    <div className="flex-1 p-3 bg-slate-950/50 flex flex-col justify-center">
                      <WaveformCanvas
                        peaks={track.peaks}
                        color={track.color}
                        height={52}
                        currentTime={currentTime}
                        duration={maxDuration}
                        selectionStart={isSelected ? selectionStart : null}
                        selectionEnd={isSelected ? selectionEnd : null}
                        onSelectRegion={isSelected ? handleSelectRegion : undefined}
                        onSeek={handleSeek}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Track Effects Rack & Inspector (Right Panel) */}
        <div className="w-full lg:w-96 bg-slate-900 p-4 flex flex-col space-y-4 overflow-y-auto">
          {selectedTrack ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span className="font-heading font-bold text-sm text-white">
                    EFFECTS RACK: {selectedTrack.name}
                  </span>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTrack.color }} />
              </div>

              {/* Sound Presets */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sound Presets
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {['Balanced', 'Warm Tube', 'Bright Air', 'Clean Punch', 'Vocal Forward'].map((name) => (
                    <button
                      key={name}
                      onClick={() => applyPreset(name)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-center font-medium cursor-pointer"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3-Band Parametric Equalizer */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 uppercase font-mono">3-Band EQ</span>
                  <span className="text-[10px] text-slate-500">dB Boost / Cut</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">BASS (100Hz)</label>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={selectedTrack.effects.eqLow}
                      onChange={(e) => handleEffectChange('eqLow', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 block mt-1">
                      {selectedTrack.effects.eqLow > 0 ? `+${selectedTrack.effects.eqLow}` : selectedTrack.effects.eqLow} dB
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">MID (1kHz)</label>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={selectedTrack.effects.eqMid}
                      onChange={(e) => handleEffectChange('eqMid', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 block mt-1">
                      {selectedTrack.effects.eqMid > 0 ? `+${selectedTrack.effects.eqMid}` : selectedTrack.effects.eqMid} dB
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">TREBLE (8kHz)</label>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={selectedTrack.effects.eqHigh}
                      onChange={(e) => handleEffectChange('eqHigh', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 block mt-1">
                      {selectedTrack.effects.eqHigh > 0 ? `+${selectedTrack.effects.eqHigh}` : selectedTrack.effects.eqHigh} dB
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters HPF & LPF */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-cyan-400 uppercase font-mono">Cut Filters</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>High-Pass (HPF)</span>
                      <span className="font-mono">{selectedTrack.effects.hpf} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="500"
                      step="5"
                      value={selectedTrack.effects.hpf}
                      onChange={(e) => handleEffectChange('hpf', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Low-Pass (LPF)</span>
                      <span className="font-mono">{(selectedTrack.effects.lpf / 1000).toFixed(1)} kHz</span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="20000"
                      step="500"
                      value={selectedTrack.effects.lpf}
                      onChange={(e) => handleEffectChange('lpf', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Compressor */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase font-mono">Compressor</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Threshold: {selectedTrack.effects.compThreshold} dB | Ratio: {selectedTrack.effects.compRatio}:1
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Threshold</label>
                    <input
                      type="range"
                      min="-48"
                      max="0"
                      step="1"
                      value={selectedTrack.effects.compThreshold}
                      onChange={(e) => handleEffectChange('compThreshold', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Ratio</label>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="0.5"
                      value={selectedTrack.effects.compRatio}
                      onChange={(e) => handleEffectChange('compRatio', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Time & Space: Reverb, Delay & Saturation */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-purple-400 uppercase font-mono">Atmosphere & Color</span>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Studio Reverb Wet</span>
                      <span className="font-mono">{Math.round(selectedTrack.effects.reverbWet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.02"
                      value={selectedTrack.effects.reverbWet}
                      onChange={(e) => handleEffectChange('reverbWet', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Ping-Pong Delay Send</span>
                      <span className="font-mono">{Math.round(selectedTrack.effects.delayWet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.02"
                      value={selectedTrack.effects.delayWet}
                      onChange={(e) => handleEffectChange('delayWet', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Analog Tape Saturation</span>
                      <span className="font-mono">{Math.round(selectedTrack.effects.saturation * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={selectedTrack.effects.saturation}
                      onChange={(e) => handleEffectChange('saturation', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a track to tweak its effects rack
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Mix bounced and exported successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
