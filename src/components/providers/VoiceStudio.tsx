import { useEffect, useState } from 'react';
import { AudioLines, Download, LoaderCircle, RefreshCw, Volume2 } from 'lucide-react';
import { apiRequest, saveExport, submitJob, waitForJob } from '../../utils/apiClient';

interface Voice { voice_id: string; name: string }
interface VoiceStudioProps { onSaved: (title: string, blob: Blob, format: string) => void | Promise<void> }

export function VoiceStudio({ onSaved }: VoiceStudioProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [download, setDownload] = useState<{ url: string; title: string } | null>(null);

  const loadVoices = () => apiRequest<{ voices: Voice[] }>('/api/providers/elevenlabs/voices')
    .then(({ voices: available }) => { setVoices(available); setVoiceId((current) => current || available[0]?.voice_id || ''); setError(available.length ? '' : 'No voices are available for this API account.'); })
    .catch((reason) => setError(reason instanceof Error ? reason.message : 'ElevenLabs voices are unavailable.'));

  useEffect(() => { void loadVoices(); }, []);

  const generate = async () => {
    setBusy(true); setError(''); setDownload(null);
    try {
      const queued = await submitJob<{ id: string }>('generate_voiceover', '', { text, voiceId });
      const job = await waitForJob<{ id: string; state: string; outputs: string[] }>(queued.id);
      if (job.outputs.length !== 1) throw new Error('The provider did not return a verified voice file.');
      const path = job.outputs[0];
      const response = await fetch(`/api/files/${path.split('/').map(encodeURIComponent).join('/')}`, { credentials: 'include' });
      if (!response.ok) throw new Error('The generated voice file could not be retrieved.');
      const blob = await response.blob();
      const title = `SoniMix_Voiceover_${Date.now()}.mp3`;
      await onSaved(title, blob, 'ElevenLabs MP3');
      const url = URL.createObjectURL(blob); setDownload({ url, title });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Voice generation failed.'); }
    finally { setBusy(false); }
  };

  return <section className="min-h-[70vh] bg-slate-50 px-4 py-12 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <div className="mb-8 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><AudioLines /></span><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">ElevenLabs · server generated</p><h1 className="text-2xl font-bold">Voice Studio</h1></div></div>
      <label className="mb-2 block text-sm font-semibold" htmlFor="voice-select">Voice</label>
      <div className="mb-6 flex gap-2"><select id="voice-select" className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3" value={voiceId} onChange={(event) => setVoiceId(event.target.value)} disabled={!voices.length}><option value="">Select an available voice</option>{voices.map((voice) => <option key={voice.voice_id} value={voice.voice_id}>{voice.name}</option>)}</select><button className="rounded-xl border border-slate-300 px-4 text-slate-600 hover:bg-slate-50" onClick={() => void loadVoices()} aria-label="Refresh available voices"><RefreshCw size={18} /></button></div>
      <label className="mb-2 block text-sm font-semibold" htmlFor="voice-text">Script</label>
      <textarea id="voice-text" className="min-h-40 w-full resize-y rounded-xl border border-slate-300 p-4" maxLength={5000} placeholder="Write the spoken introduction or voiceover…" value={text} onChange={(event) => setText(event.target.value)} />
      <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Up to 5,000 characters</span><span>{text.length}/5000</span></div>
      {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
      <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !voiceId || !text.trim()} onClick={() => void generate()}>{busy ? <><LoaderCircle className="animate-spin" size={18} /> Waiting for verified audio…</> : <><Volume2 size={18} /> Generate voiceover</>}</button>
      {download && <a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 font-semibold text-cyan-900" href={download.url} download={download.title}><Download size={17} /> Download generated voiceover</a>}
    </div>
  </section>;
}
