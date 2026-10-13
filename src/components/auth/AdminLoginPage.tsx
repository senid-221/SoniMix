import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { SoniMixLogo } from '../common/SoniMixLogo';
import './auth.css';

interface AdminLoginPageProps {
  onLoginSuccess: () => void | Promise<void>;
  onReturnHome: () => void;
  customLogoUrl?: string | null;
  brandName?: string;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess, onReturnHome, customLogoUrl, brandName = 'SoniMix' }) => {
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: adminEmail.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || 'Unable to verify administrator access.');
      await onLoginSuccess();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach the authentication service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-admin-page">
      <button type="button" className="auth-back" onClick={onReturnHome}><ArrowLeft size={17} /> Return to {brandName} Studio</button>
      <section className="auth-panel auth-admin-panel" aria-labelledby="admin-title">
        <div className="auth-brand"><span className="auth-brand-mark auth-brand-logo">{customLogoUrl ? <img src={customLogoUrl} alt={`${brandName} logo`} /> : <SoniMixLogo size={30} />}</span><span>{brandName}</span></div>
        <div className="auth-heading">
          <span className="auth-admin-badge"><ShieldCheck size={15} /> ADMINISTRATOR ACCESS</span>
          <h1 id="admin-title">Studio control, secured.</h1>
          <p>Sign in with your administrator account to manage the SoniMix platform.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field"><span>Administrator email</span><span className="auth-input-wrap"><Mail size={17} /><input type="email" autoComplete="username" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="you@company.com" required /></span></label>
          <label className="auth-field"><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="auth-spinner" size={18} /> Verifying access…</> : <>Continue to dashboard <ArrowRight size={17} /></>}</button>
        </form>
        <div className="auth-secure-note"><ShieldCheck size={16} /><span>Protected administrator sign-in</span></div>
        <p className="auth-legal">Need administrator access? Contact your SoniMix account owner.</p>
      </section>
      <div className="auth-page-signature"><AudioLines size={15} /> SOUND, SHAPED BY YOU</div>
    </main>
  );
};
