import { useEffect, useState } from 'react';
import { Music2, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../utils/apiClient';

interface ProviderStatus { available: boolean; reason?: string }

export function MusicGenerationStudio() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState('');
  const refresh = () => apiRequest<ProviderStatus>('/api/providers/loudly').then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : 'Provider status could not be checked.'));
  useEffect(() => { void refresh(); }, []);
  return <section className="min-h-[70vh] bg-slate-50 px-4 py-12 text-slate-900 sm:px-8"><div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Music2 /></span><p className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-700">Loudly Music API</p><h1 className="mt-2 text-2xl font-bold">Music Generation</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Generation is available only after this deployment has account-authorized API access and its current endpoint contract configured. SoniMix will not invent provider responses or present preview audio as generated output.</p>{error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{status?.available ? 'Provider reports available, but generation remains disabled until its verified integration is implemented.' : status?.reason || 'Checking provider configuration…'}</div><button onClick={() => void refresh()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><RefreshCw size={16} /> Check configuration</button></div></section>;
}
