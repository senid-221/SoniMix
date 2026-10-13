import React, { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, LoaderCircle, LockKeyhole, Mail, UserRound, X } from 'lucide-react';
import { AuthUser } from '../../utils/authStore';
import './auth.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

type AuthMode = 'login' | 'register';

async function readAuthResponse(response: Response): Promise<AuthUser> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || 'We couldn’t complete that request. Please try again.');
  const user = payload.user ?? payload;
  if (!user.id || !user.email || !user.name || !user.role) {
    throw new Error('The server returned an invalid account response. Please contact support.');
  }
  return user as AuthUser;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'ready' | 'missing' | 'unreachable'>('checking');
  const [isGoogleStarting, setIsGoogleStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/auth/google/status', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Google sign-in status could not be checked.');
        return payload;
      })
      .then((payload) => {
        if (active) setGoogleStatus(payload.available === true ? 'ready' : 'missing');
      })
      .catch(() => {
        if (active) setGoogleStatus('unreachable');
      });
    return () => { active = false; };
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleStarting(true);
    try {
      // Do not block sign-in based on a status probe; let the server resolve
      // the configured OAuth redirect and return any actionable setup error.
      const response = await fetch('/api/auth/google', {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
        cache: 'no-store',
      });

      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        window.location.assign('/api/auth/google');
        return;
      }

      if (response.ok) {
        window.location.assign('/api/auth/google');
        return;
      }

      const message = await response.text().catch(() => '');
      setError(message || (response.status === 503
        ? 'Google sign-in needs server credentials and a matching redirect URL.'
        : 'Google sign-in could not start. Check the server configuration and try again.'));
    } catch {
      // A static frontend may not proxy /api routes. Still navigate to the
      // OAuth start route so the configured backend can handle the request.
      window.location.assign('/api/auth/google');
    } finally {
      setIsGoogleStarting(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'login' ? { email: email.trim(), password } : { name: name.trim(), email: email.trim(), password }),
      });
      onLoginSuccess(await readAuthResponse(response));
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach the authentication service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-panel auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close sign in"><X size={19} /></button>
        <div className="auth-brand"><span className="auth-brand-mark"><AudioLines size={21} strokeWidth={2.3} /></span><span>SoniMix</span></div>
        <div className="auth-heading">
          <span className="auth-eyebrow">YOUR STUDIO, IN SYNC</span>
          <h1 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Make room for sound.'}</h1>
          <p>{mode === 'login' ? 'Sign in to pick up where your next great mix begins.' : 'Create an account to start building your sound.'}</p>
        </div>
        <div className="auth-switch" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
        </div>
        <button type="button" className="auth-google" onClick={handleGoogleSignIn} aria-busy={isGoogleStarting}>
          <span aria-hidden="true">G</span>
          {isGoogleStarting ? 'Connecting to Google…' : 'Continue with Google'}
        </button>
        {googleStatus === 'checking' && <p className="auth-google-note">Checking Google sign-in configuration…</p>}
        {googleStatus === 'missing' && <p className="auth-google-note">Trying the server directly. If setup is incomplete, it will report which Google credentials or redirect URL are needed.</p>}
        {googleStatus === 'unreachable' && <p className="auth-google-note">Could not check status. The button will still try to open Google sign-in.</p>}
        <div className="auth-divider"><span /> or use email <span /></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && <label className="auth-field"><span>Your name</span><span className="auth-input-wrap"><UserRound size={17} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" required /></span></label>}
          <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@studio.com" required /></span></label>
          <label className="auth-field"><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 12 characters' : 'Enter your password'} required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><LoaderCircle className="auth-spinner" size={18} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</> : <>{mode === 'login' ? 'Sign in to SoniMix' : 'Create your account'} <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-legal">By continuing, you agree to SoniMix’s Terms of Service and Privacy Policy.</p>
        <div className="auth-footnote"><span /> Secure account access <span /></div>
      </section>
    </div>
  );
};
