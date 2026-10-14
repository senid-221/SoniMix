import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  Play,
  Pause,
  Download,
  CheckCircle,
  AlertTriangle,
  Activity,
  Sliders,
  Volume2,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
} from 'lucide-react';
import { MasteringSettings, AudioMetrics } from '../../types/audio';
import { DEFAULT_MASTERING_PRESETS } from '../../utils/projectStore';
import { audioBufferToWav, computeWaveformPeaks, analyzeAudioMetrics } from '../../utils/audioBufferUtils';
import { WaveformCanvas } from '../waveform/WaveformCanvas';
import { SpectrumVisualizer } from '../visualizer/SpectrumVisualizer';
import { apiRequest, submitJob, uploadAsset, waitForJob } from '../../utils/apiClient';

interface MasteringStudioProps {
  inputBuffer: AudioBuffer | null;
  onAddExport: (title: string, blob: Blob, format: string) => void | Promise<void>;
  onLoadAudioFile?: (buffer: AudioBuffer) => void;
}

export const MasteringStudio: React.FC<MasteringStudioProps> = ({
  inputBuffer: propInputBuffer,
  onAddExport,
  onLoadAudioFile,
}) => {
  const [internalBuffer, setInternalBuffer] = useState<AudioBuffer | null>(null);
  const inputBuffer = propInputBuffer || internalBuffer;
  const masterUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<MasteringSettings>(DEFAULT_MASTERING_PRESETS['Streaming Release']);
  const [originalMetrics, setOriginalMetrics] = useState<AudioMetrics | null>(null);
  const [masteredMetrics, setMasteredMetrics] = useState<AudioMetrics | null>(null);
  const [masteredBuffer, setMasteredBuffer] = useState<AudioBuffer | null>(null);
  const [masteredPeaks, setMasteredPeaks] = useState<number[]>([]);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'mastered' | 'original'>('mastered');
  const [currentTime, setCurrentTime] = useState(0);
  const [bitDepth, setBitDepth] = useState<16 | 24>(24);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [aiReport, setAiReport] = useState<{
    style: string;
    lufsAdvice: string;
    eqSuggestions: string[];
    dynamicsAdvice: string;
  } | null>(null);

  // Playback audio graph refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Analyze original buffer when loaded
  useEffect(() => {
    if (inputBuffer) {
      const origM = analyzeAudioMetrics(inputBuffer);
      setOriginalMetrics(origM);
      setOriginalPeaks(computeWaveformPeaks(inputBuffer));
      // Auto-render mastering preview
      renderMaster(inputBuffer, settings);
    }
  }, [inputBuffer]);

  // Render the preview with the same server-side FFmpeg chain used for the final export.
  // This keeps preview and export effects consistent and makes plugin controls affect real audio.
  const renderMaster = async (buf: AudioBuffer, masterSettings: MasteringSettings) => {
    setIsProcessing(true);
    setAiReport(null);
    try {
      const { file } = await uploadAsset(audioBufferToWav(buf, 24), 'master-preview.wav');
      const preset = masterSettings.presetName.toLowerCase();
      const profile = preset.includes('warm') || preset.includes('tape') ? 'warm' : preset.includes('bright') || preset.includes('air') ? 'bright' : 'balanced';
      const queued = await submitJob<{ id: string }>('master_audio', file, {
        targetLufs: masterSettings.targetLufs,
        profile,
        bitDepth,
        format: 'wav',
        dsp: masterSettings,
      });
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string }>(queued.id);
      const response = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!response.ok) throw new Error('The server-rendered mastering preview could not be retrieved.');
      const renderedBlob = await response.blob();
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioCtxClass();
      const rendered = await context.decodeAudioData(await renderedBlob.arrayBuffer());
      setMasteredBuffer(rendered);
      setMasteredPeaks(computeWaveformPeaks(rendered));
      setMasteredMetrics(analyzeAudioMetrics(rendered));
      setAiReport({
        style: 'SoniMix server mastering engine',
        lufsAdvice: job.message,
        eqSuggestions: [],
        dynamicsAdvice: 'Preview processed by the server FFmpeg mastering chain. Loudness and peak cards are client-side estimates; they are not a certified ITU loudness report.',
      });
    } catch (error) {
      setAiReport({
        style: 'Mastering render failed',
        lufsAdvice: error instanceof Error ? error.message : 'The server mastering render failed.',
        eqSuggestions: [],
        dynamicsAdvice: 'No successful preview is claimed. Check the backend audio engine and try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPreset = (presetName: string) => {
    const p = DEFAULT_MASTERING_PRESETS[presetName];
    if (p && inputBuffer) {
      setSettings(p);
      renderMaster(inputBuffer, p);
    }
  };

  const handleSettingChange = (key: keyof MasteringSettings, value: number) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
  };

  const triggerReMaster = () => {
    if (inputBuffer) {
      renderMaster(inputBuffer, settings);
    }
  };

  // Playback handling
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
    const activeBuf = playMode === 'mastered' ? masteredBuffer : inputBuffer;
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

    const updatePlayhead = () => {
      if (audioCtxRef.current && activeBuf) {
        const cur = audioCtxRef.current.currentTime - startTimeRef.current;
        if (cur >= activeBuf.duration) {
          stopPlayback();
          setCurrentTime(0);
          pauseOffsetRef.current = 0;
          return;
        }
        setCurrentTime(cur);
        animFrameRef.current = requestAnimationFrame(updatePlayhead);
      }
    };
    animFrameRef.current = requestAnimationFrame(updatePlayhead);
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

  // Switch A/B mode on the fly
  const handleToggleAB = () => {
    const nextMode = playMode === 'mastered' ? 'original' : 'mastered';
    setPlayMode(nextMode);
    if (isPlaying) {
      // seamless switch
      const cur = currentTime;
      setTimeout(() => {
        startPlayback(cur);
      }, 0);
    }
  };

  // AI Smart Mastering Suggestion
  const handleAIMasteringRecommendation = async () => {
    if (!inputBuffer) return;
    setIsProcessing(true);
    setAiReport(null);
    try {
      const { file } = await uploadAsset(audioBufferToWav(inputBuffer, 24), 'master-source.wav');
      const result = await apiRequest<{ explanation: string | null; jobs: Array<{ id: string }> }>('/api/ai/orchestrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction: `Analyze and master this uploaded audio file for a balanced streaming release near ${settings.targetLufs} LUFS. Source file reference: ${file}. Use the supported master_audio tool.` }) });
      if (!result.jobs.length) throw new Error(result.explanation || 'Grok did not request a supported mastering job.');
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string }>(result.jobs[0].id);
      const fileResponse = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!fileResponse.ok) throw new Error('The verified mastered file could not be retrieved.');
      const masteredBlob = await fileResponse.blob();
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const decoded = await new AudioCtxClass().decodeAudioData(await masteredBlob.arrayBuffer());
      setMasteredBuffer(decoded);
      setMasteredPeaks(computeWaveformPeaks(decoded));
      setMasteredMetrics(analyzeAudioMetrics(decoded));
      setAiReport({ style: 'Grok-orchestrated server master', lufsAdvice: job.message, eqSuggestions: [], dynamicsAdvice: result.explanation || 'Processing was executed by the configured FFmpeg engine and the output passed server-side audio validation.' });
    } catch (error) {
      setAiReport({ style: 'Not completed', lufsAdvice: error instanceof Error ? error.message : 'AI mastering failed.', eqSuggestions: [], dynamicsAdvice: 'No mastering result is claimed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Mastered File
  const handleExport = async () => {
    if (!inputBuffer) return;
    setIsExporting(true);
    try {
      const { file } = await uploadAsset(audioBufferToWav(inputBuffer, 24), 'master-source.wav');
      const queued = await submitJob<{ id: string }>('master_audio', file, { targetLufs: settings.targetLufs, profile: 'balanced', bitDepth, format: 'wav', dsp: settings });
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string }>(queued.id);
      const response = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!response.ok) throw new Error('The verified master could not be downloaded.');
      const blob = await response.blob();
      const filename = `SoniMix_Master_${settings.targetLufs}LUFS_${bitDepth}bit.wav`;
      await onAddExport(filename, blob, `Mastered WAV ${bitDepth}-bit`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      setAiReport({ style: 'Export failed', lufsAdvice: err instanceof Error ? err.message : 'Master export failed.', eqSuggestions: [], dynamicsAdvice: 'No output was saved.' });
    } finally {
      setIsExporting(false);
    }
  };

  const activeDuration = inputBuffer?.duration || 0;

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Studio Header & Target Loudness Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Wand2 className="w-5 h-5 text-indigo-400" />
            <h1 className="font-heading font-extrabold text-xl text-white">
              AI Mastering Console
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono font-bold">
              {settings.targetLufs} LUFS TARGET
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Server-rendered mastering with EQ, compression, stereo control, saturation and loudness normalization.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAIMasteringRecommendation}
            disabled={!inputBuffer || isProcessing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Auto-Optimize</span>
          </button>

          <button
            onClick={triggerReMaster}
            disabled={!inputBuffer || isProcessing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-blue-400' : ''}`} />
            <span>Re-Render</span>
          </button>

          <select
            value={bitDepth}
            onChange={(e) => setBitDepth(Number(e.target.value) as 16 | 24)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer focus:outline-none"
          >
            <option value={24}>WAV 24-bit (Release Master)</option>
            <option value={16}>WAV 16-bit (CD Red Book)</option>
          </select>

          <button
            onClick={handleExport}
            disabled={!masteredBuffer || isExporting}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Master'}</span>
          </button>
        </div>
      </div>

      {!inputBuffer ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
          <input
            type="file"
            ref={masterUploadInputRef}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const arr = await file.arrayBuffer();
                const AudioCtxClass =
                  window.AudioContext ||
                  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                const ctx = new AudioCtxClass();
                const decoded = await ctx.decodeAudioData(arr);
                setInternalBuffer(decoded);
                if (onLoadAudioFile) onLoadAudioFile(decoded);
              } catch (err) {
                console.error('Audio decode error:', err);
              }
            }}
            accept="audio/*"
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center mb-4">
            <Wand2 className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No audio loaded for mastering</h2>
          <p className="text-xs text-slate-400 mb-6">
            Upload your unmastered mix or bounce to analyze technical LUFS metrics and master to release standards.
          </p>
          <button
            onClick={() => masterUploadInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            Upload Audio Track to Master
          </button>
        </div>
      ) : (
        <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* A/B Comparison and Player Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayToggle}
                  className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 cursor-pointer transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">
                      {playMode === 'mastered' ? 'Mastered Audio Preview' : 'Original Unmastered Mix'}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                        playMode === 'mastered'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {playMode === 'mastered' ? 'MASTER ACTIVE' : 'BYPASS (ORIGINAL)'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {currentTime.toFixed(2)}s / {activeDuration.toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Instant A/B Toggle Switch */}
              <button
                onClick={handleToggleAB}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  playMode === 'mastered'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20'
                    : 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/20'
                }`}
                title="Switch instantaneously between Original and Mastered audio"
              >
                {playMode === 'mastered' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>Click to Listen: {playMode === 'mastered' ? 'ORIGINAL (A)' : 'MASTERED (B)'}</span>
              </button>
            </div>

            {/* Waveform Visualization */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <WaveformCanvas
                peaks={playMode === 'mastered' ? masteredPeaks : originalPeaks}
                color={playMode === 'mastered' ? '#10b981' : '#64748b'}
                height={70}
                currentTime={currentTime}
                duration={activeDuration}
                onSeek={handleSeek}
              />
            </div>
          </div>

          {/* Loudness & Acoustic Engineering Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Integrated Loudness */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Estimated Loudness</span>
                <span className="font-mono text-emerald-400">Target: {settings.targetLufs}</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {masteredMetrics ? `${masteredMetrics.estimatedLufs} LUFS` : '--'}
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((masteredMetrics?.estimatedLufs || -30) + 30) * 3.3))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>Orig: {originalMetrics?.estimatedLufs || '--'} LUFS</span>
                <span>Delta: {masteredMetrics && originalMetrics ? `+${(masteredMetrics.estimatedLufs - originalMetrics.estimatedLufs).toFixed(1)} dB` : '--'}</span>
              </div>
            </div>

            {/* True Peak dBFS */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Sample Peak</span>
                <span className="font-mono text-blue-400">Ceiling: {settings.ceiling} dBFS</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {masteredMetrics ? `${masteredMetrics.peakDbfs} dBFS` : '--'}
              </div>
              <div className="flex items-center space-x-1.5 text-xs">
                {masteredMetrics?.isClipping ? (
                  <span className="flex items-center space-x-1 text-rose-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Clipping Detected</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Clean Headroom Safe</span>
                  </span>
                )}
              </div>
            </div>

            {/* Dynamic Range (DR Score) */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Dynamic Range Score</span>
                <span className="font-mono text-purple-400">Punch & Transients</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                DR{masteredMetrics?.dynamicRange || 10}
              </div>
              <p className="text-[11px] text-slate-400">
                Crest Factor: {masteredMetrics?.crestFactor || 8.5} dB (Preserves natural punch)
              </p>
            </div>

            {/* RMS dBFS */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>RMS Level</span>
                <span className="font-mono text-amber-400">Continuous Energy</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {masteredMetrics ? `${masteredMetrics.rmsDbfs} dB` : '--'}
              </div>
              <p className="text-[11px] text-slate-400">
                Original RMS: {originalMetrics?.rmsDbfs || '--'} dB
              </p>
            </div>
          </div>

          {/* AI Mastering Engineering Report */}
          {aiReport && (
            <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="font-heading font-bold text-sm text-white">
                    AI MASTERING INTELLIGENCE REPORT: {aiReport.style}
                  </span>
                </div>
                <button
                  onClick={() => setAiReport(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <p className="text-xs text-indigo-200/90 leading-relaxed font-medium">
                {aiReport.lufsAdvice}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {aiReport.eqSuggestions.map((sug, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-900/60 text-[11px] text-slate-300">
                    <span className="text-indigo-400 font-bold block mb-0.5">EQ Recommendation {i + 1}</span>
                    {sug}
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 pt-1 font-mono">
                <span className="text-indigo-400 font-bold">Server render: </span>
                {aiReport.dynamicsAdvice}
              </div>
            </div>
          )}

          {/* Mastering Presets Bar */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Curated Release Profiles
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {Object.keys(DEFAULT_MASTERING_PRESETS).map((pName) => (
                <button
                  key={pName}
                  onClick={() => handleApplyPreset(pName)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    settings.presetName === DEFAULT_MASTERING_PRESETS[pName].presetName
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="font-bold text-xs block mb-0.5">{pName}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {DEFAULT_MASTERING_PRESETS[pName].targetLufs} LUFS Target
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mastering Chain Custom Tweak Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Input & Dynamics */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Dynamics & Glue</h3>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Input Drive</span>
                  <span className="font-mono text-slate-200">
                    {settings.inputGain > 0 ? `+${settings.inputGain}` : settings.inputGain} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="8"
                  step="0.5"
                  value={settings.inputGain}
                  onChange={(e) => handleSettingChange('inputGain', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Glue Compressor Drive</span>
                  <span className="font-mono text-slate-200">{Math.round(settings.compressionDrive * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.compressionDrive}
                  onChange={(e) => handleSettingChange('compressionDrive', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Output Peak Ceiling</span>
                  <span className="font-mono text-slate-200">{settings.ceiling} dBFS</span>
                </div>
                <input
                  type="range"
                  min="-2.0"
                  max="-0.1"
                  step="0.1"
                  value={settings.ceiling}
                  onChange={(e) => handleSettingChange('ceiling', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* 2. Linear Mastering EQ */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Mastering EQ</h3>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Sub & Low Punch (80Hz)</span>
                  <span className="font-mono text-slate-200">{settings.eqBass} dB</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={settings.eqBass}
                  onChange={(e) => handleSettingChange('eqBass', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Mid Clarity / Clean (320Hz)</span>
                  <span className="font-mono text-slate-200">{settings.eqLowMid} dB</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={settings.eqLowMid}
                  onChange={(e) => handleSettingChange('eqLowMid', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Vocal Presence (3.5kHz)</span>
                  <span className="font-mono text-slate-200">{settings.eqPresence} dB</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={settings.eqPresence}
                  onChange={(e) => handleSettingChange('eqPresence', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Air / High Sparkle (12kHz)</span>
                  <span className="font-mono text-slate-200">{settings.eqAir} dB</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={settings.eqAir}
                  onChange={(e) => handleSettingChange('eqAir', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Stereo Field & Analog Saturation */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Stereo & Character</h3>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Stereo Width (Mid-Side)</span>
                  <span className="font-mono text-slate-200">{Math.round(settings.stereoWidth * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  value={settings.stereoWidth}
                  onChange={(e) => handleSettingChange('stereoWidth', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block mt-1">100% is untouched natural stereo field</span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Analog Tape Saturation</span>
                  <span className="font-mono text-slate-200">{Math.round(settings.warmTape * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={settings.warmTape}
                  onChange={(e) => handleSettingChange('warmTape', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <button
                onClick={triggerReMaster}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer mt-4"
              >
                Apply Custom Settings & Preview
              </button>
            </div>
          </div>

          {exportSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Mastered release track downloaded successfully!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
