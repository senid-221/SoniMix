import { useEffect, useState } from 'react';
import { Download, LoaderCircle, Music2, RefreshCw, Sparkles } from 'lucide-react';
import { ApiError, apiRequest, submitJob, waitForJob } from '../../utils/apiClient';

interface ProviderStatus { available: boolean; reason?: string }
interface MusicJob { id: string; state: string; outputs: string[]; error?: string; message?: string }
interface MusicGenerationStudioProps {
  onSaved: (title: string, blob: Blob, format: string) => void | Promise<void>;
  onAuthRequired: () => void;
}

export function MusicGenerationStudio({ onSaved, onAuthRequired }: MusicGenerationStudioProps) {
  const [provider, setProvider] = useState<'musicgpt' | 'acedata_suno'>('acedata_suno');
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const status = statuses[provider];
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [musicStyle, setMusicStyle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [model, setModel] = useState('chirp-v6');
  const [instrumental, setInstrumental] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Array<{ url: string; title: string }>>([]);

  const refresh = async () => {
    try {
      const [musicgpt, suno] = await Promise.all([apiRequest<ProviderStatus>('/api/providers/musicgpt'), apiRequest<ProviderStatus>('/api/providers/suno')]);
      setStatuses({ musicgpt: { ...musicgpt, reason: musicgpt.reason || 'MusicGPT is ready.' }, acedata_suno: { ...suno, reason: suno.reason || 'Suno via Ace Data Cloud is ready.' } });
      setError('');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setError('Your sign-in session has expired. Sign in again to continue.');
        onAuthRequired();
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Provider status could not be checked.');
    }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => () => tracks.forEach((track) => URL.revokeObjectURL(track.url)), [tracks]);

  const generate = async () => {
    setBusy(true); setError(''); setTracks([]);
    try {
      const queued = await submitJob<{ id: string }>('generate_music', undefined, { provider, prompt, title, musicStyle, lyrics, model, makeInstrumental: instrumental });
      const result = await waitForJob<MusicJob>(queued.id, 5000);
      if (!result.outputs.length) throw new Error('The selected provider returned no verified audio files.');
      const generated: Array<{ url: string; title: string }> = [];
      for (const [index, path] of result.outputs.entries()) {
        const response = await fetch(`/api/files/${path.split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
        if (response.status === 401) throw new ApiError('Your sign-in session has expired. Sign in again to continue.', 401);
        if (!response.ok) throw new Error('A generated track could not be retrieved.');
        const blob = await response.blob();
        const trackTitle = `${title.trim() || 'SoniMix_Generated'}_${index + 1}.mp3`;
        await onSaved(trackTitle, blob, `${provider === 'acedata_suno' ? 'Suno via Ace Data Cloud' : 'MusicGPT'} MP3`);
        generated.push({ url: URL.createObjectURL(blob), title: trackTitle });
      }
      setTracks(generated);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setError('Your sign-in session has expired. Sign in again, then select Generate music again.');
        onAuthRequired();
      } else if (reason instanceof Error && (reason.name === 'TimeoutError' || reason.name === 'AbortError' || /operation was aborted due to timeout/i.test(reason.message))) {
        setError('The music provider timed out before replying. Your request may not have completed. Please wait briefly, refresh provider status, and retry. If this keeps happening, check the provider API key/credits and the Render service logs.');
      } else {
        setError(reason instanceof Error ? reason.message : 'Music generation failed.');
      }
    } finally { setBusy(false); }
  };

  const fieldClass = 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900';
  return <section className="min-h-[70vh] bg-slate-50 px-4 py-12 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <div className="mb-8 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Music2 /></span><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Real provider generation</p><h1 className="text-2xl font-bold">Music Generator</h1></div></div>
      <label className="mb-2 block text-sm font-semibold" htmlFor="music-provider">Music provider</label>
      <select id="music-provider" className={`${fieldClass} mb-5`} value={provider} onChange={(event) => { const nextProvider = event.target.value as 'musicgpt' | 'acedata_suno'; setProvider(nextProvider); setModel(nextProvider === 'acedata_suno' ? 'chirp-v6' : 'v7'); }}><option value="acedata_suno">Suno · Ace Data Cloud</option><option value="musicgpt">MusicGPT</option></select>
      <div className={`mb-6 rounded-xl border p-4 text-sm ${status?.available ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role="status">{status?.available ? `${provider === 'acedata_suno' ? 'Suno via Ace Data Cloud' : 'MusicGPT'} is ready for production. Generated audio is downloaded and validated before delivery.` : status?.reason || 'Checking provider configuration…'} <button onClick={() => void refresh()} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={14} /> Refresh</button></div>
      <label className="mb-2 block text-sm font-semibold" htmlFor="music-prompt">Describe the music</label>
      <textarea id="music-prompt" className="min-h-32 w-full rounded-xl border border-slate-300 p-4" maxLength={2000} placeholder="A cinematic, warm piano piece with gentle strings…" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="music-title">Track title (optional)</label><input id="music-title" className={fieldClass} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="music-style">Genre / style (optional)</label><input id="music-style" className={fieldClass} maxLength={500} placeholder="ambient, indie pop…" value={musicStyle} onChange={(event) => setMusicStyle(event.target.value)} /></div>
      </div>
      <div className="mt-5"><label className="mb-2 block text-sm font-semibold" htmlFor="music-lyrics">Lyrics (optional)</label><textarea id="music-lyrics" className="min-h-28 w-full rounded-xl border border-slate-300 p-4" maxLength={5000} placeholder="Add lyrics, or leave blank for provider-generated lyrics…" value={lyrics} onChange={(event) => setLyrics(event.target.value)} /></div>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <label className="text-sm font-semibold">Model <select className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-2" value={model} onChange={(event) => setModel(event.target.value)}>{provider === 'acedata_suno' ? <><option value="chirp-v6">Chirp V6</option><option value="chirp-v5">Chirp V5</option><option value="chirp-v4-5">Chirp V4.5</option><option value="chirp-v4">Chirp V4</option></> : <><option value="v7">V7</option><option value="v7-pro">V7 Pro</option><option value="v6">V6</option><option value="v6-pro">V6 Pro</option></>}</select></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={instrumental} onChange={(event) => setInstrumental(event.target.checked)} /> Instrumental</label>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <button onClick={() => void generate()} disabled={busy || !status?.available || !prompt.trim()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><LoaderCircle className="animate-spin" size={18} /> Waiting for verified audio…</> : <><Sparkles size={18} /> Generate music</>}</button>
      {tracks.map((track) => <article key={track.url} className="mt-5 rounded-xl border border-slate-200 p-4"><p className="mb-3 font-semibold">{track.title}</p><audio className="w-full" controls src={track.url} /><a className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 font-semibold text-cyan-900" href={track.url} download={track.title}><Download size={16} /> Download</a></article>)}
    </div>
  </section>;
}
