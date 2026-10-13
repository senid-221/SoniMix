import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import { verifyAdminCredentials, setAdminAuthenticated } from '../../utils/authStore';
import { SoniMixLogo } from '../common/SoniMixLogo';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onReturnHome: () => void;
  customLogoUrl?: string | null;
  brandName?: string;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onReturnHome,
  customLogoUrl,
  brandName = 'SoniMix',
}) => {
  const [adminEmail, setAdminEmail] = useState('admin@sonimix.audio');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const isValid = verifyAdminCredentials(password, adminEmail);
      if (isValid) {
        setAdminAuthenticated(true);
        onLoginSuccess();
      } else {
        setError('Invalid administrator credentials. Access restricted.');
      }
      setIsSubmitting(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 relative overflow-hidden text-slate-100">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Return to public site button */}
      <button
        onClick={onReturnHome}
        className="absolute top-6 left-6 flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to {brandName} Studio</span>
      </button>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/80 relative z-10">
        {/* Brand & Badge */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-center p-2 shadow-xl shadow-amber-500/10 mb-4 overflow-hidden">
            {customLogoUrl ? (
              <img src={customLogoUrl} alt="Logo" className="w-10 h-10 object-contain" />
            ) : (
              <SoniMixLogo size={44} />
            )}
          </div>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Restricted Administration Access</span>
          </div>

          <h1 className="font-heading font-extrabold text-2xl text-white">
            Admin Management Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access portal at <code className="text-amber-300 font-mono">/admin/login</code> for platform settings & brand control.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-2.5 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Account Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@sonimix.audio"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Master Key / Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password (e.g. admin123)"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Admin Access Protocol</span>
            </div>
            <p>
              Default master passkey: <code className="text-amber-300 font-mono font-bold">admin123</code> or <code className="text-amber-300 font-mono font-bold">admin</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Authenticating Admin...' : 'Unlock Admin Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Unauthorized access attempts are monitored and recorded.
          </p>
        </div>
      </div>
    </div>
  );
};
