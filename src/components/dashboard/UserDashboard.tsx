import React, { useState } from 'react';
import {
  User,
  Shield,
  HardDrive,
  Music,
  SlidersHorizontal,
  Wand2,
  GitFork,
  Image as ImageIcon,
  Gauge,
  CheckCircle,
  Save,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Settings,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../../types/dashboard';
import { saveUserProfile } from '../../utils/appConfigStore';
import { NavTab } from '../layout/Navbar';

interface UserDashboardProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onNavigateTab: (tab: NavTab) => void;
  onOpenAdmin?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  userProfile,
  setUserProfile,
  onNavigateTab,
}) => {
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const [isSaved, setIsSaved] = useState(false);

  const handleSavePreferences = () => {
    setUserProfile(profile);
    saveUserProfile(profile);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const storagePercentage = Math.min(
    100,
    profile.storageLimitMb > 0 ? Math.min(100, Math.round((profile.storageUsedMb / profile.storageLimitMb) * 100)) : 0
  );

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-xl shadow-blue-600/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-heading font-extrabold text-xl text-blue-400">
              {profile.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-heading font-extrabold text-2xl text-white">
                {profile.name}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {profile.plan} PLAN
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {profile.email} • Member since {profile.joinedDate}
            </p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigateTab('mixer')}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Launch Studio</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Storage Quota */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Stored files</span>
              <HardDrive className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {(profile.storageUsedMb / 1024).toFixed(3)} GB
            </div>
            {profile.storageLimitMb > 0 && <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>}
            <span className="text-[10px] text-slate-500 block font-mono">{profile.storageLimitMb > 0 ? `${storagePercentage}% of configured limit` : 'No account storage quota is configured'}</span>
          </div>

          {/* Bounces Completed */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Total Audio Bounces</span>
              <Music className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {profile.totalBounces} Tracks
            </div>
            <span className="text-xs text-slate-400 block">
              100% loss-free PCM 24-bit rendering
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold block">
              Unlimited exports available
            </span>
          </div>

          {/* Active Projects */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Active DAW Sessions</span>
              <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {profile.totalProjects} Sessions
            </div>
            <span className="text-xs text-slate-400 block">
              Synced with local storage cache
            </span>
            <button
              onClick={() => onNavigateTab('projects')}
              className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Manage Projects</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Plan Status */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">Subscription Status</span>
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {profile.plan} Plan
            </div>
            <span className="text-xs text-slate-400 block">
              Renews next billing cycle
            </span>
            <span className="text-[10px] text-slate-500 font-mono block">
              No confidential payment cards exposed
            </span>
          </div>
        </div>

        {/* Quick Studio Launch Pad */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-white">
              Quick Studio Launch Pad
            </h2>
            <span className="text-xs text-slate-500 font-mono">Select a production tool</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <button
              onClick={() => onNavigateTab('mixer')}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <span className="font-bold text-white block">DAW Mixer</span>
              <span className="text-[10px] text-slate-400 block">Multitrack mixing</span>
            </button>

            <button
              onClick={() => onNavigateTab('mastering')}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Wand2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-white block">AI Mastering</span>
              <span className="text-[10px] text-slate-400 block">-14 LUFS release</span>
            </button>

            <button
              onClick={() => onNavigateTab('stems')}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <GitFork className="w-4 h-4" />
              </div>
              <span className="font-bold text-white block">Stem Splitter</span>
              <span className="text-[10px] text-slate-400 block">4-stem isolation</span>
            </button>

            <button
              onClick={() => onNavigateTab('cover')}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-pink-500 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span className="font-bold text-white block">Cover Creator</span>
              <span className="text-[10px] text-slate-400 block">3000px artwork</span>
            </button>

            <button
              onClick={() => onNavigateTab('resampler')}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-500 hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Gauge className="w-4 h-4" />
              </div>
              <span className="font-bold text-white block">Resampler</span>
              <span className="text-[10px] text-slate-400 block">Sample rate & pitch</span>
            </button>
          </div>
        </div>

        {/* Audio Preferences & Profile Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio Engine Defaults */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm text-white">Default Audio Engine Preferences</h3>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Default Sample Rate</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[44100, 48000, 96000].map((rate) => (
                  <button
                    key={rate}
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, defaultSampleRate: rate },
                      }))
                    }
                    className={`py-2 px-1 rounded-lg border text-center font-mono font-bold transition-all cursor-pointer ${
                      profile.preferences.defaultSampleRate === rate
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {(rate / 1000).toFixed(1)} kHz
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Default Mastering Target Loudness</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Streaming (-14)', val: -14 },
                  { label: 'Club / DJ (-9)', val: -9 },
                  { label: 'CD (-11)', val: -11 },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, defaultTargetLufs: item.val },
                      }))
                    }
                    className={`py-2 px-1 rounded-lg border text-center font-mono font-bold transition-all cursor-pointer ${
                      profile.preferences.defaultTargetLufs === item.val
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Export Bit Depth</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[16, 24].map((bit) => (
                  <button
                    key={bit}
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, defaultBitDepth: bit as 16 | 24 },
                      }))
                    }
                    className={`py-2 px-1 rounded-lg border text-center font-mono font-bold transition-all cursor-pointer ${
                      profile.preferences.defaultBitDepth === bit
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    WAV {bit}-bit PCM
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Audio Preferences</span>
            </button>
          </div>

          {/* Profile & Privacy Safeguards */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Account Details & Privacy Safeguard</h3>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Display Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Privacy Compliance Notice */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <span className="font-bold text-emerald-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero-Credential Storage Policy</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                In strict adherence to security and privacy standards, your sensitive credentials (credit card numbers, CVVs, passwords, PIN codes) are never stored or exposed in this interface.
              </p>
            </div>

            {isSaved && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Preferences updated successfully!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
