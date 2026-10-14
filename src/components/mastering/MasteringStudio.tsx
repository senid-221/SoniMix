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

function getMasteringProfile(presetName: string): 'warm' | 'bright' | 'balanced' {
  const preset = presetName.toLowerCase();
  if (preset.includes('warm') || preset.includes('tape') || preset.includes('analog')) return 'warm';
  if (preset.includes('bright') || preset.includes('air') || preset.includes('pusher')) return 'bright';
  return 'balanced';
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
  const [serverLoudness, setServerLoudness] = useState<{ integratedLufs: number; truePeakDbtp: number; loudnessRangeLu?: number } | null>(null);
  const [masteredBuffer, setMasteredBuffer] = useState<AudioBuffer | null>(null);
  const [masteredPeaks, setMasteredPeaks] = useState<number[]>([]);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pluginChainBypassed, setPluginChainBypassed] = useState(false);
  const [masteringMode, setMasteringMode] = useState<'limit' | 'clip'>('limit');
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
  const renderMaster = async (buf: AudioBuffer, masterSettings: MasteringSettings, pluginBypass = pluginChainBypassed, peakMode = masteringMode) => {
    setIsProcessing(true);
    setAiReport(null);
    setServerLoudness(null);
    try {
      const { file } = await uploadAsset(audioBufferToWav(buf, 24), 'master-preview.wav');
      const profile = getMasteringProfile(masterSettings.presetName);
      const queued = await submitJob<{ id: string }>('master_audio', file, {
        targetLufs: masterSettings.targetLufs,
        profile,
        bitDepth,
        format: 'wav',
        dsp: { ...masterSettings, pluginBypass, masteringMode: peakMode },
      });
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string; metadata?: { integratedLufs?: number; truePeakDbtp?: number; loudnessRangeLu?: number } }>(queued.id);
      const response = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!response.ok) throw new Error('The server-rendered mastering preview could not be retrieved.');
      const renderedBlob = await response.blob();
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioCtxClass();
      const rendered = await context.decodeAudioData(await renderedBlob.arrayBuffer());
      await context.close();
      setMasteredBuffer(rendered);
      setMasteredPeaks(computeWaveformPeaks(rendered));
      setMasteredMetrics(analyzeAudioMetrics(rendered));
      if (typeof job.metadata?.integratedLufs === 'number' && typeof job.metadata?.truePeakDbtp === 'number') {
        setServerLoudness({ integratedLufs: job.metadata.integratedLufs, truePeakDbtp: job.metadata.truePeakDbtp, loudnessRangeLu: job.metadata.loudnessRangeLu });
      }
      setAiReport({
        style: 'SoniMix server mastering engine',
        lufsAdvice: job.message,
        eqSuggestions: [],
        dynamicsAdvice: 'The server measured integrated loudness, true peak and loudness range with FFmpeg EBU R128 loudnorm analysis after rendering. Browser RMS/crest metrics remain estimates.',
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
    setServerLoudness(null);
    try {
      const { file } = await uploadAsset(audioBufferToWav(inputBuffer, 24), 'master-source.wav');
      const result = await apiRequest<{ explanation: string | null; jobs: Array<{ id: string }> }>('/api/ai/orchestrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction: `Analyze and master this uploaded audio file for a balanced streaming release near ${settings.targetLufs} LUFS. Source file reference: ${file}. Use the supported master_audio tool.` }) });
      if (!result.jobs.length) throw new Error(result.explanation || 'Grok did not request a supported mastering job.');
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string; metadata?: { integratedLufs?: number; truePeakDbtp?: number; loudnessRangeLu?: number } }>(result.jobs[0].id);
      const fileResponse = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!fileResponse.ok) throw new Error('The verified mastered file could not be retrieved.');
      const masteredBlob = await fileResponse.blob();
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtxClass();
      const decoded = await audioContext.decodeAudioData(await masteredBlob.arrayBuffer());
      await audioContext.close();
      setMasteredBuffer(decoded);
      setMasteredPeaks(computeWaveformPeaks(decoded));
      setMasteredMetrics(analyzeAudioMetrics(decoded));
      if (typeof job.metadata?.integratedLufs === 'number' && typeof job.metadata?.truePeakDbtp === 'number') {
        setServerLoudness({ integratedLufs: job.metadata.integratedLufs, truePeakDbtp: job.metadata.truePeakDbtp, loudnessRangeLu: job.metadata.loudnessRangeLu });
      }
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
      const exportProfile = getMasteringProfile(settings.presetName);
      const queued = await submitJob<{ id: string }>('master_audio', file, { targetLufs: settings.targetLufs, profile: exportProfile, bitDepth, format: 'wav', dsp: { ...settings, pluginBypass: pluginChainBypassed, masteringMode } });
      const job = await waitForJob<{ id: string; state: string; outputs: string[]; message: string; metadata?: { integratedLufs?: number; truePeakDbtp?: number; loudnessRangeLu?: number } }>(queued.id);
      const response = await fetch(`/api/files/${job.outputs[0].split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!response.ok) throw new Error('The verified master could not be downloaded.');
      const blob = await response.blob();
      if (typeof job.metadata?.integratedLufs === 'number' && typeof job.metadata?.truePeakDbtp === 'number') {
        setServerLoudness({ integratedLufs: job.metadata.integratedLufs, truePeakDbtp: job.metadata.truePeakDbtp, loudnessRangeLu: job.metadata.loudnessRangeLu });
      }
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

  // Stereo correlation is a real sample-based estimate for the loaded master buffer.
  // Values near +1 indicate a similar in-phase stereo image; values near -1 warn of polarity/mono-compatibility risk.
  const stereoCorrelation = React.useMemo(() => {
    if (!masteredBuffer || masteredBuffer.numberOfChannels < 2) return null;
    const left = masteredBuffer.getChannelData(0);
    const right = masteredBuffer.getChannelData(1);
    const stride = Math.max(1, Math.floor(left.length / 100000));
    let cross = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let i = 0; i < Math.min(left.length, right.length); i += stride) {
      cross += left[i] * right[i];
      leftEnergy += left[i] * left[i];
      rightEnergy += right[i] * right[i];
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    return denominator > 0 ? Math.max(-1, Math.min(1, cross / denominator)) : 0;
  }, [masteredBuffer]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {/* Integrated Loudness */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Integrated Loudness (Server)</span>
                <span className="font-mono text-emerald-400">Target: {settings.targetLufs}</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {serverLoudness ? `${serverLoudness.integratedLufs.toFixed(2)} LUFS` : '--'}
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((serverLoudness?.integratedLufs ?? -30) + 30) * 3.3))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>Source browser estimate: {originalMetrics?.estimatedLufs ?? '--'} LUFS</span>
                <span>Target: {settings.targetLufs} LUFS</span>
              </div>
            </div>

            {/* True Peak dBFS */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>True Peak (Server)</span>
                <span className="font-mono text-blue-400">Ceiling: {settings.ceiling} dBTP</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {serverLoudness ? `${serverLoudness.truePeakDbtp.toFixed(2)} dBTP` : '--'}
              </div>
              <div className="flex items-center space-x-1.5 text-xs">
                {(serverLoudness ? serverLoudness.truePeakDbtp > settings.ceiling + 0.1 : masteredMetrics?.isClipping) ? (
                  <span className="flex items-center space-x-1 text-rose-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>True-Peak Ceiling Exceeded</span>
                  </span>
                ) : serverLoudness ? (
                  <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>True-peak headroom safe</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Waiting for server measurement…</span>
                )}
              </div>
            </div>

            {/* Dynamic Range (DR Score) */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Loudness Range (Server)</span>
                <span className="font-mono text-purple-400">Punch & Transients</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {serverLoudness?.loudnessRangeLu !== undefined ? `${serverLoudness.loudnessRangeLu.toFixed(1)} LU` : '--'}
              </div>
              <p className="text-[11px] text-slate-400">
                Browser crest estimate: {masteredMetrics?.crestFactor ?? '--'} dB
              </p>
            </div>

            {/* Stereo correlation meter */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Stereo Correlation</span>
                <span className="font-mono text-cyan-400">L / R</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {stereoCorrelation === null ? 'Mono / --' : stereoCorrelation.toFixed(2)}
              </div>
              <div className="relative w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="absolute left-1/2 top-0 h-full w-px bg-white/60" />
                {stereoCorrelation !== null && (
                  <div
                    className={`absolute top-0 h-full rounded-full ${stereoCorrelation < 0 ? 'bg-rose-500' : stereoCorrelation < 0.2 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                    style={{
                      left: stereoCorrelation < 0 ? `${(stereoCorrelation + 1) * 50}%` : '50%',
                      width: `${Math.abs(stereoCorrelation) * 50}%`,
                    }}
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {stereoCorrelation === null ? 'Stereo source required' : stereoCorrelation < 0 ? 'Warning: possible phase cancellation' : stereoCorrelation < 0.2 ? 'Very wide / check mono compatibility' : 'Positive phase relationship'}
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

          {/* Real processing plugin rack: each profile updates DSP values used by server rendering. */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 rounded-2xl border border-indigo-500/30 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-300" />
                  <h3 className="font-bold text-sm text-white">Mastering Plugin Rack</h3>
                  <span className="text-[9px] uppercase tracking-wider rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">Server DSP</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Choose a chain, render it, or bypass tone/dynamics effects. Safety limiting and loudness normalization remain active.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                  <span>Peak control</span>
                  <select
                    value={masteringMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as 'limit' | 'clip';
                      setMasteringMode(nextMode);
                      if (inputBuffer) void renderMaster(inputBuffer, settings, pluginChainBypassed, nextMode);
                    }}
                    disabled={isProcessing}
                    className="bg-slate-800 text-white rounded px-2 py-1 outline-none"
                  >
                    <option value="limit">Transparent limiter</option>
                    <option value="clip">Soft clip + limiter</option>
                  </select>
                </label>
                <button
                  onClick={() => {
                    const nextBypass = !pluginChainBypassed;
                    setPluginChainBypassed(nextBypass);
                    if (inputBuffer) void renderMaster(inputBuffer, settings, nextBypass);
                  }}
                  disabled={isProcessing}
                  className={`px-3 py-2 rounded-lg border text-xs font-bold disabled:opacity-50 ${pluginChainBypassed ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'}`}
                >
                  {pluginChainBypassed ? 'Plugin DSP Bypassed' : 'Bypass Plugin DSP'}
                </button>
                <button onClick={triggerReMaster} disabled={isProcessing} className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold">
                  {isProcessing ? 'Rendering chain…' : 'Render Plugin Chain'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'Analog Console', detail: 'Warm tone, gentle glue and moderate stereo', values: { inputGain: 0, eqBass: 0.8, eqLowMid: -0.5, eqPresence: 0.6, eqAir: 0.8, compressionDrive: 0.42, ceiling: -1, stereoWidth: 1.08, warmTape: 0.28 } },
                { name: 'Modern Pusher', detail: 'Forward presence, tighter dynamics and extra punch', values: { inputGain: 1, eqBass: 0.5, eqLowMid: -0.8, eqPresence: 1.2, eqAir: 0.7, compressionDrive: 0.68, ceiling: -0.8, stereoWidth: 1.12, warmTape: 0.12 } },
                { name: 'Clean Streaming', detail: 'Subtle EQ, restrained saturation and safe headroom', values: { inputGain: 0, eqBass: 0, eqLowMid: 0, eqPresence: 0.2, eqAir: 0.3, compressionDrive: 0.25, ceiling: -1.2, stereoWidth: 1, warmTape: 0 } },
              ].map((plugin) => (
                <button key={plugin.name} onClick={() => {
                  const next = { ...settings, ...plugin.values, presetName: plugin.name };
                  setSettings(next);
                  if (inputBuffer) void renderMaster(inputBuffer, next);
                }} disabled={isProcessing} className="text-left rounded-xl border border-slate-700 bg-slate-950/80 hover:border-cyan-400/70 hover:bg-slate-900 p-4 transition-colors disabled:opacity-50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-white">{plugin.name}</span>
                    <span className="text-[9px] text-cyan-300 uppercase tracking-wider">Load</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{plugin.detail}</p>
                  <div className="flex gap-1 mt-3">
                    {[0,1,2,3,4,5].map((bar) => <span key={bar} className="h-1 rounded-full flex-1" style={{ opacity: 0.35 + bar * 0.1, background: plugin.name === 'Modern Pusher' ? '#d946ef' : plugin.name === 'Analog Console' ? '#22d3ee' : '#34d399' }} />)}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">These are original SoniMix processing profiles inspired by analog console, punch and mastering-chain workflows; they are not copies of the pictured commercial plugins.</p>
          </section>

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
                  <span>True-Peak Ceiling</span>
                  <span className="font-mono text-slate-200">{settings.ceiling} dBTP</span>
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
