import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Upload,
  Users,
  Sliders,
  Type,
  Image as ImageIcon,
  CheckCircle,
  RotateCcw,
  Lock,
  HardDrive,
  SlidersHorizontal,
  Wand2,
  GitFork,
  Gauge,
  Save,
  Globe,
  Settings,
  Layers,
  Sparkles,
  ExternalLink,
  Laptop,
  Home,
  Volume2,
  Music2,
  FolderKanban,
} from 'lucide-react';
import { AppConfig, AudioPluginConfig, DirectoryUser } from '../../types/dashboard';
import { saveAppConfig, saveDirectoryUsers, DEFAULT_APP_CONFIG } from '../../utils/appConfigStore';
import { apiRequest } from '../../utils/apiClient';
import { SoniMixLogo } from '../common/SoniMixLogo';

interface AdminDashboardProps {
  appConfig: AppConfig;
  setAppConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  directoryUsers: DirectoryUser[];
  setDirectoryUsers: React.Dispatch<React.SetStateAction<DirectoryUser[]>>;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  appConfig,
  setAppConfig,
  directoryUsers,
  setDirectoryUsers,
  onExitAdmin,
}) => {
  const [config, setConfig] = useState<AppConfig>(appConfig);
  const [users, setUsers] = useState<DirectoryUser[]>(directoryUsers);
  const [activeTab, setActiveTab] = useState<'config' | 'icons' | 'audio' | 'services' | 'health' | 'users'>('config');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [systemHealth, setSystemHealth] = useState<Record<string, any> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const refreshSystemHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch('/api/health', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Health check failed');
      setSystemHealth(payload);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Health check failed');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { void refreshSystemHealth(); }, []);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [targetIconKey, setTargetIconKey] = useState<string | null>(null);

  const uploadBrandAsset = async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) throw new Error('Brand images must be 5 MB or smaller.');
    const response = await fetch('/api/admin/brand-assets', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': file.name },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Brand image upload failed. Make sure you are signed in as an administrator.');
    return payload.url as string;
  };

  // Persist the complete config on the server before showing the upload as successful.
  const persistBrandConfig = async (updated: AppConfig) => {
    await apiRequest('/api/admin/app-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    setConfig(updated);
    setAppConfig(updated);
  };

  // Brand assets are stored on the backend, not embedded as large data URLs in settings.
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('Please upload a valid image file (SVG, PNG, JPG, or WebP).'); return; }
    try {
      const url = await uploadBrandAsset(file);
      const updated = { ...config, customLogoUrl: url };
      await persistBrandConfig(updated);
      showFeedback('Logo uploaded and saved permanently.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Logo upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetLogo = () => {
    const updated = { ...config, customLogoUrl: null };
    setConfig(updated);
    setAppConfig(updated);
    saveAppConfig(updated);
    showFeedback('Reset logo back to official SoniMix vector brand!');
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.ico')) { alert('Please upload a valid favicon (ICO, SVG, PNG, JPG or WebP).'); return; }
    try {
      const url = await uploadBrandAsset(file);
      const updated = { ...config, customFaviconUrl: url };
      await persistBrandConfig(updated);
      showFeedback('Favicon uploaded and saved permanently.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Favicon upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetFavicon = () => {
    const updated = { ...config, customFaviconUrl: null };
    setConfig(updated);
    setAppConfig(updated);
    saveAppConfig(updated);
    showFeedback('Reset favicon back to default SoniMix icon!');
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetIconKey) return;
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('Please upload a valid icon file (SVG, PNG, JPG or WebP).'); return; }
    try {
      const url = await uploadBrandAsset(file);
      const updated = { ...config, customIcons: { ...config.customIcons, [targetIconKey]: url } };
      await persistBrandConfig(updated);
      showFeedback('Custom icon uploaded and saved permanently.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Icon upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetIcon = (key: string) => {
    const updatedIcons = { ...config.customIcons };
    delete updatedIcons[key];
    const updated = { ...config, customIcons: updatedIcons };
    setConfig(updated);
    setAppConfig(updated);
    saveAppConfig(updated);
    showFeedback(`Reset icon for ${key} to default!`);
  };

  // Save settings to the backend and only confirm publishing after the server accepts them.
  const handleSaveSettings = async () => {
    if (isSavingSettings) return;
    setIsSavingSettings(true);
    setSaveFeedback(null);
    try {
      await apiRequest<{ config: AppConfig }>('/api/admin/app-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setAppConfig(config);
      saveAppConfig(config);
      showFeedback('Application settings saved and published successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Settings could not be saved.';
      setSaveFeedback(`Save failed: ${message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Reset to factory defaults
  const handleResetToDefaults = () => {
    setConfig(DEFAULT_APP_CONFIG);
    setAppConfig(DEFAULT_APP_CONFIG);
    saveAppConfig(DEFAULT_APP_CONFIG);
    showFeedback('All application settings reset to factory defaults!');
  };

  // User directory status toggle
  const toggleUserStatus = (userId: string) => {
    const updated = users.map((u) =>
      u.id === userId
        ? { ...u, status: u.status === 'active' ? ('suspended' as const) : ('active' as const) }
        : u
    );
    setUsers(updated);
    setDirectoryUsers(updated);
    saveDirectoryUsers(updated);
  };

  // Change user plan
  const handleUserPlanChange = (userId: string, plan: 'Free' | 'Pro' | 'Studio') => {
    const updated = users.map((u) => (u.id === userId ? { ...u, plan } : u));
    setUsers(updated);
    setDirectoryUsers(updated);
    saveDirectoryUsers(updated);
  };

  const showFeedback = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  // Covers every primary header link and production module rendered by Navbar.
  // Custom images replace familiar Lucide defaults without changing navigation behavior.
  const toolIconList = [
    { key: 'landing', label: 'Home Navigation Icon', defaultIcon: Home },
    { key: 'mixer', label: 'Mixing Studio Icon', defaultIcon: SlidersHorizontal },
    { key: 'mastering', label: 'AI Mastering Icon', defaultIcon: Wand2 },
    { key: 'voice', label: 'Voice Studio Icon', defaultIcon: Volume2 },
    { key: 'music', label: 'Music Generation Icon', defaultIcon: Music2 },
    { key: 'stems', label: 'Stem Splitter Icon', defaultIcon: GitFork },
    { key: 'cover', label: 'Cover Creator Icon', defaultIcon: ImageIcon },
    { key: 'resampler', label: 'Audio Resampler Icon', defaultIcon: Gauge },
    { key: 'projects', label: 'My Projects Icon', defaultIcon: FolderKanban },
  ];

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Admin Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-heading font-extrabold text-xl text-white">
                Admin Control Console
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                SYSTEM ADMINISTRATOR
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live App Settings, Brand Assets (Logo & Favicon), Headings CMS & User Directory
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onExitAdmin}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Sign Out (Admin)</span>
          </button>
        </div>
      </div>

      {/* Main Admin Workspace */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div aria-label="Admin sections" className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
          {[
            { id: 'config', label: 'Settings', icon: Settings },
            { id: 'icons', label: 'System Icons', icon: Sliders },
            { id: 'audio', label: 'Audio Plugins & Effects', icon: Wand2 },
            { id: 'services', label: 'API Services', icon: Globe },
            { id: 'health', label: 'System Health', icon: Gauge },
            { id: 'users', label: 'User Directory', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback alert */}
        {saveFeedback && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{saveFeedback}</span>
          </div>
        )}

        {/* 1. APPLICATION SETTINGS & BRAND ASSETS (Primary Requested Configuration Section) */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div>
                <h2 className="font-heading font-bold text-base text-white">
                  Application Configuration & Brand Settings
                </h2>
                <p className="text-xs text-slate-400">
                  Update brand assets, page titles, headlines, and section titles that persist across the entire application.
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={handleResetToDefaults}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5"
                  title="Reset all settings to default"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset to Defaults</span>
                </button>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving…' : 'Save All Settings'}</span>
                </button>
              </div>
            </div>

            {/* PART A: BRAND ASSETS UPLOAD (Logo & Favicon) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-amber-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Brand Assets Management (Logo & Favicon)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. BRAND LOGO */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-white uppercase font-mono">
                        Brand Logo
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          config.customLogoUrl
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {config.customLogoUrl ? 'CUSTOM UPLOAD' : 'OFFICIAL VECTOR'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">
                      Displayed in the main navigation bar, hero banner, and footer. Supports SVG, PNG, and JPG.
                    </p>

                    {/* Logo Preview Card */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center min-h-[100px] mb-4">
                      {config.customLogoUrl ? (
                        <img
                          src={config.customLogoUrl}
                          alt="Custom Brand Logo"
                          className="max-h-16 max-w-[200px] object-contain"
                        />
                      ) : (
                        <SoniMixLogo size={60} showWordmark={true} />
                      )}
                    </div>

                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept=".svg,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo File</span>
                    </button>

                    {config.customLogoUrl && (
                      <button
                        onClick={handleResetLogo}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reset Logo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. BROWSER FAVICON */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-white uppercase font-mono">
                        Browser Tab Favicon
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          config.customFaviconUrl
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {config.customFaviconUrl ? 'CUSTOM FAVICON' : 'DEFAULT FAVICON'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">
                      Controls the browser tab icon (<code className="text-amber-400 font-mono">link rel="icon"</code>). Supports ICO, SVG, PNG.
                    </p>

                    {/* Browser Tab Mockup Preview */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 min-h-[100px] flex flex-col justify-center mb-4">
                      <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 max-w-sm">
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200">
                          {config.customFaviconUrl ? (
                            <img
                              src={config.customFaviconUrl}
                              alt="Favicon"
                              className="w-4 h-4 object-contain"
                            />
                          ) : (
                            <SoniMixLogo size={16} />
                          )}
                        </div>
                        <span className="text-xs text-slate-200 truncate font-mono flex-1">
                          {config.pageTitle || 'SoniMix — AI Music Studio'}
                        </span>
                        <span className="text-[10px] text-slate-500">✕</span>
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={faviconInputRef}
                      onChange={handleFaviconUpload}
                      accept=".ico,.svg,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
                    <button
                      onClick={() => faviconInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Favicon File</span>
                    </button>

                    {config.customFaviconUrl && (
                      <button
                        onClick={handleResetFavicon}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reset Favicon</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PART B: BRAND IDENTITY & METADATA */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Brand Identity & Browser Metadata
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Platform Brand Name
                  </label>
                  <input
                    type="text"
                    value={config.brandName || 'SoniMix'}
                    onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                    placeholder="e.g. SoniMix"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Appears in header, footer copyright, and brand badges.
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Browser Window Title (HTML document.title)
                  </label>
                  <input
                    type="text"
                    value={config.pageTitle || ''}
                    onChange={(e) => setConfig({ ...config, pageTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="e.g. SoniMix — AI Music Production & Audio Processing Studio"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Directly updates the browser tab title in real time.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Top Announcement Banner
                </label>
                <input
                  type="text"
                  value={config.announcementText}
                  onChange={(e) => setConfig({ ...config, announcementText: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  placeholder="🚀 SoniMix v2.4 Release: True 24-bit PCM Mastering..."
                />
              </div>
            </div>

            {/* PART C: OPERATIONAL SETTINGS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-heading font-bold text-base text-white">Platform Operations & Access</h3>
                  <p className="text-xs text-slate-400 mt-1">Manage upload limits, free mastering allowance, and maintenance mode. Save changes using the button above or below.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <label htmlFor="max-upload-size" className="block text-xs font-semibold text-slate-300 mb-2">Maximum audio upload size (MB)</label>
                  <input id="max-upload-size" type="number" min="1" max="500" step="1"
                    value={config.maxUploadSizeMb ?? DEFAULT_APP_CONFIG.maxUploadSizeMb}
                    onChange={(e) => setConfig({ ...config, maxUploadSizeMb: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                  <p className="text-[10px] text-slate-500 mt-2">Admin setting is limited to 1–500 MB. The server must enforce the same limit for it to affect uploads.</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <label htmlFor="free-mastering-quota" className="block text-xs font-semibold text-slate-300 mb-2">Free mastering jobs per account</label>
                  <input id="free-mastering-quota" type="number" min="0" max="1000" step="1"
                    value={config.freeMasteringQuota ?? DEFAULT_APP_CONFIG.freeMasteringQuota}
                    onChange={(e) => setConfig({ ...config, freeMasteringQuota: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                  <p className="text-[10px] text-slate-500 mt-2">Set to 0 to disable free mastering allowance. Enforcement must be implemented in the server processing workflow.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-900/60 bg-rose-950/20 p-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Maintenance Mode</h4>
                  <p className="text-xs text-slate-400 mt-1">Toggle the saved maintenance flag. Public access is only blocked if the backend and frontend enforce this flag.</p>
                </div>
                <label className="flex items-center gap-3 text-xs font-semibold text-slate-200">
                  <input type="checkbox" checked={Boolean(config.maintenanceMode)}
                    onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                    className="h-4 w-4 accent-rose-500" />
                  {config.maintenanceMode ? 'Maintenance enabled' : 'Maintenance disabled'}
                </label>
              </div>
            </div>

            {/* PART D: EDITABLE PAGE HEADINGS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Type className="w-5 h-5 text-amber-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Main Page Headings (Hero & Mission)
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Hero Main Headline
                  </label>
                  <input
                    type="text"
                    value={config.heroHeadline}
                    onChange={(e) => setConfig({ ...config, heroHeadline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Hero Supporting Subtitle / Description
                  </label>
                  <textarea
                    rows={3}
                    value={config.heroSubtitle}
                    onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* PART D: KEY SECTION TITLES */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Key Section Titles Across Application
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Studios Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase font-mono block">
                    Core Studios Section
                  </span>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Headline</label>
                    <input
                      type="text"
                      value={config.sectionTitles?.studiosHeadline || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sectionTitles: {
                            ...config.sectionTitles,
                            studiosHeadline: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Subtitle</label>
                    <input
                      type="text"
                      value={config.sectionTitles?.studiosSubtitle || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sectionTitles: {
                            ...config.sectionTitles,
                            studiosSubtitle: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase font-mono block">
                    Pricing & Plans Section
                  </span>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Headline</label>
                    <input
                      type="text"
                      value={config.sectionTitles?.pricingHeadline || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sectionTitles: {
                            ...config.sectionTitles,
                            pricingHeadline: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Subtitle</label>
                    <input
                      type="text"
                      value={config.sectionTitles?.pricingSubtitle || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sectionTitles: {
                            ...config.sectionTitles,
                            pricingSubtitle: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* FAQ Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 md:col-span-2">
                  <span className="text-xs font-bold text-sky-400 uppercase font-mono block">
                    FAQ Section
                  </span>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Headline</label>
                    <input
                      type="text"
                      value={config.sectionTitles?.faqHeadline || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sectionTitles: {
                            ...config.sectionTitles,
                            faqHeadline: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PART E: STUDIO TOOL WORKSPACE TITLES */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Individual Studio Workspace Titles
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">1. Mixing Studio</label>
                  <input
                    type="text"
                    value={config.studioTitles.mixer}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        studioTitles: { ...config.studioTitles, mixer: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">2. AI Mastering Console</label>
                  <input
                    type="text"
                    value={config.studioTitles.mastering}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        studioTitles: { ...config.studioTitles, mastering: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">3. Stem Splitter</label>
                  <input
                    type="text"
                    value={config.studioTitles.stems}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        studioTitles: { ...config.studioTitles, stems: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">4. Cover Creator Studio</label>
                  <input
                    type="text"
                    value={config.studioTitles.cover}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        studioTitles: { ...config.studioTitles, cover: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">5. Audio Resampler Engine</label>
                  <input
                    type="text"
                    value={config.studioTitles.resampler}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        studioTitles: { ...config.studioTitles, resampler: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Save Button */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Publishing…' : 'Save and Publish Application Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. CUSTOM TOOL ICONS */}
        {activeTab === 'icons' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-white mb-1">
                Custom Tool Icons Management
              </h2>
              <p className="text-xs text-slate-400">
                Customize the icons used by Home, every production module, and the main navigation. If no custom image is uploaded, familiar Lucide icons remain active.
              </p>
            </div>

            <input
              type="file"
              ref={iconInputRef}
              onChange={handleIconUpload}
              accept=".svg,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {toolIconList.map((tool) => {
                const DefaultIcon = tool.defaultIcon;
                const customIconUrl = config.customIcons[tool.key];

                return (
                  <div
                    key={tool.key}
                    className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-xs text-white">{tool.label}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                          {customIconUrl ? 'CUSTOM' : 'DEFAULT'}
                        </span>
                      </div>

                      {/* Icon preview box */}
                      <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-2 mb-3">
                        {customIconUrl ? (
                          <img
                            src={customIconUrl}
                            alt={tool.label}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <DefaultIcon className="w-8 h-8 text-blue-400" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => {
                          setTargetIconKey(tool.key);
                          iconInputRef.current?.click();
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Icon</span>
                      </button>

                      {customIconUrl && (
                        <button
                          onClick={() => handleResetIcon(tool.key)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Reset to default icon"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AUDIO PLUGINS AND EFFECTS */}
        {activeTab === 'audio' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold text-white">Audio Plugin Registry</h2>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
                    Register plugin metadata and control visibility. Registering a plugin does not install or execute it;
                    VST3, AU and LV2 require a compatible audio engine before processing audio.
                  </p>
                </div>
                <button onClick={() => {
                  const id = `plugin-${Date.now()}`;
                  const plugin: AudioPluginConfig = { id, name: 'New Audio Plugin', format: 'Other', description: '', enabled: false, status: 'unavailable' };
                  setConfig({ ...config, audioPlugins: [...(config.audioPlugins || []), plugin] });
                }} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">+ Add Plugin</button>
              </div>
              {(config.audioPlugins || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">No custom plugins registered. Built-in studio tools continue to work independently.</div>
              ) : <div className="space-y-3">
                {(config.audioPlugins || []).map((plugin) => <div key={plugin.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-12">
                  <div className="md:col-span-3"><label className="mb-1 block text-[11px] text-slate-400">Plugin name</label><input value={plugin.name} onChange={(e) => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).map((item) => item.id === plugin.id ? { ...item, name: e.target.value } : item) })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" /></div>
                  <div className="md:col-span-2"><label className="mb-1 block text-[11px] text-slate-400">Format</label><select value={plugin.format} onChange={(e) => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).map((item) => item.id === plugin.id ? { ...item, format: e.target.value as AudioPluginConfig['format'] } : item) })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">{['built-in', 'VST3', 'LV2', 'AU', 'Other'].map((format) => <option key={format} value={format}>{format}</option>)}</select></div>
                  <div className="md:col-span-3"><label className="mb-1 block text-[11px] text-slate-400">Description</label><input value={plugin.description} onChange={(e) => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).map((item) => item.id === plugin.id ? { ...item, description: e.target.value } : item) })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Plugin purpose" /></div>
                  <div className="flex items-center gap-2 md:col-span-3"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={plugin.enabled} onChange={(e) => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).map((item) => item.id === plugin.id ? { ...item, enabled: e.target.checked } : item) })} /> Enabled</label><select aria-label="Plugin runtime status" value={plugin.status} onChange={(e) => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).map((item) => item.id === plugin.id ? { ...item, status: e.target.value as AudioPluginConfig['status'] } : item) })} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">{['configured', 'installed', 'unavailable'].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                  <div className="md:col-span-1 md:text-right"><button onClick={() => setConfig({ ...config, audioPlugins: (config.audioPlugins || []).filter((item) => item.id !== plugin.id) })} className="rounded-lg border border-rose-900 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950">Remove</button></div>
                </div>)}
              </div>}
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div><h2 className="font-heading text-lg font-bold text-white">Audio Effects & Defaults</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">Configure and save the desired effect chain and intensity. These settings are not represented as active audio processing unless a processing workflow consumes them.</p></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(config.audioEffects || []).map((effect) => <div key={effect.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-white">{effect.name}</h3><p className="mt-1 text-[11px] leading-relaxed text-slate-400">{effect.description}</p></div><label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-300"><input type="checkbox" checked={effect.enabled} onChange={(e) => setConfig({ ...config, audioEffects: (config.audioEffects || []).map((item) => item.id === effect.id ? { ...item, enabled: e.target.checked } : item) })} /> On</label></div>
                  <div className="flex items-center gap-3"><label htmlFor={`effect-${effect.id}`} className="text-xs text-slate-400">Amount</label><input id={`effect-${effect.id}`} type="range" min="0" max="100" value={effect.amount} onChange={(e) => setConfig({ ...config, audioEffects: (config.audioEffects || []).map((item) => item.id === effect.id ? { ...item, amount: Number(e.target.value) } : item) })} className="min-w-0 flex-1 accent-amber-500" /><span className="w-10 text-right font-mono text-xs text-amber-400">{effect.amount}%</span></div>
                </div>)}
              </div>
              <div className="flex justify-end border-t border-slate-800 pt-4"><button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"><Save className="h-4 w-4" /> Save Plugin & Effect Settings</button></div>
            </section>
          </div>
        )}

        {/* 4. USER DIRECTORY WITH PRIVACY SAFEGUARD */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-white mb-1">
                  User Directory & Account Permissions
                </h2>
                <p className="text-xs text-slate-400">
                  Manage registered platform users, production tiers, and storage quotas.
                </p>
              </div>

              {/* Strict Privacy Shield Badge */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span className="font-semibold">
                  Zero Credential Disclosure: Passwords, Payment Cards & PINs are encrypted & masked
                </span>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Account Type</th>
                    <th className="p-3.5">Bounces</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 text-xs font-mono">
                        No accounts have been registered yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-900/90 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            u.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : u.role === 'producer'
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-400">{u.role === 'admin' ? 'Administrator' : 'Account'}</td>

                      <td className="p-3.5 font-mono text-emerald-400">
                        {u.bouncesCount}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {u.joinedDate}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            u.status === 'active'
                              ? 'bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
