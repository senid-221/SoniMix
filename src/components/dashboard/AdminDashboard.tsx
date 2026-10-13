import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { AppConfig, DirectoryUser } from '../../types/dashboard';
import { saveAppConfig, saveDirectoryUsers, DEFAULT_APP_CONFIG } from '../../utils/appConfigStore';
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
  const [activeTab, setActiveTab] = useState<'config' | 'icons' | 'users' | 'limits'>('config');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [targetIconKey, setTargetIconKey] = useState<string | null>(null);

  // Logo upload handler (SVG, PNG, JPG, WebP)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (SVG, PNG, JPG, or WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated = { ...config, customLogoUrl: dataUrl };
      setConfig(updated);
      setAppConfig(updated);
      saveAppConfig(updated);
      showFeedback('Brand logo uploaded and applied across header, landing page & footer!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    const updated = { ...config, customLogoUrl: null };
    setConfig(updated);
    setAppConfig(updated);
    saveAppConfig(updated);
    showFeedback('Reset logo back to official SoniMix vector brand!');
  };

  // Favicon upload handler (ICO, SVG, PNG, JPG, WebP)
  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/svg+xml',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.ico')) {
      alert('Please upload a valid icon file (ICO, SVG, PNG, or JPG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated = { ...config, customFaviconUrl: dataUrl };
      setConfig(updated);
      setAppConfig(updated);
      saveAppConfig(updated);
      showFeedback('Custom browser favicon uploaded and applied to document head!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetFavicon = () => {
    const updated = { ...config, customFaviconUrl: null };
    setConfig(updated);
    setAppConfig(updated);
    saveAppConfig(updated);
    showFeedback('Reset favicon back to default SoniMix icon!');
  };

  // Studio tool icon upload handler
  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetIconKey) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updatedIcons = { ...config.customIcons, [targetIconKey]: dataUrl };
      const updated = { ...config, customIcons: updatedIcons };
      setConfig(updated);
      setAppConfig(updated);
      saveAppConfig(updated);
      showFeedback(`Custom icon uploaded for ${targetIconKey}!`);
    };
    reader.readAsDataURL(file);
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

  // Save all Application Settings & Headings
  const handleSaveSettings = () => {
    setAppConfig(config);
    saveAppConfig(config);
    showFeedback('Application settings, brand assets, and headings saved successfully!');
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

  const toolIconList = [
    { key: 'mixer', label: 'Mixing Studio Icon', defaultIcon: SlidersHorizontal },
    { key: 'mastering', label: 'AI Mastering Icon', defaultIcon: Wand2 },
    { key: 'stems', label: 'Stem Splitter Icon', defaultIcon: GitFork },
    { key: 'cover', label: 'Cover Creator Icon', defaultIcon: ImageIcon },
    { key: 'resampler', label: 'Resampler Icon', defaultIcon: Gauge },
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
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {[
            { id: 'config', label: 'Settings & Brand Assets', icon: Settings },
            { id: 'icons', label: 'Studio Tool Icons', icon: Sliders },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'limits', label: 'Studio Quotas & Limits', icon: HardDrive },
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save All Settings</span>
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
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 overflow-hidden bg-slate-900 border border-slate-800">
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

            {/* PART C: EDITABLE PAGE HEADINGS */}
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
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save and Publish Application Settings</span>
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
                Upload custom SVG, PNG, or JPG icons for each studio tool. If no custom image is uploaded, official Lucide icons remain active.
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

        {/* 3. USER DIRECTORY WITH PRIVACY SAFEGUARD */}
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
                    <th className="p-3.5">Plan Tier</th>
                    <th className="p-3.5">Storage Used</th>
                    <th className="p-3.5">Bounces</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 text-xs font-mono">
                        No registered users yet. When users sign in with Google or Email, their accounts appear in this directory.
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

                      <td className="p-3.5">
                        <select
                          value={u.plan}
                          onChange={(e) =>
                            handleUserPlanChange(u.id, e.target.value as 'Free' | 'Pro' | 'Studio')
                          }
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2 py-1 text-slate-200 cursor-pointer focus:outline-none"
                        >
                          <option value="Free">Free Plan</option>
                          <option value="Pro">Pro Plan</option>
                          <option value="Studio">Studio Plan</option>
                        </select>
                      </td>

                      <td className="p-3.5 font-mono">
                        {(u.storageUsedMb / 1024).toFixed(2)} GB
                      </td>

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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. STUDIO QUOTAS & LIMITS */}
        {activeTab === 'limits' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-white mb-1">
                Global Production Quotas & Platform Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure audio file size ceilings, free monthly master quotas, and system maintenance mode.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Maximum Audio Upload Size</span>
                    <span className="font-mono text-blue-400 font-bold">{config.maxUploadSizeMb} MB</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={config.maxUploadSizeMb}
                    onChange={(e) => setConfig({ ...config, maxUploadSizeMb: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Default recommendation: 200MB</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Free Plan Monthly Mastering Quota</span>
                    <span className="font-mono text-emerald-400 font-bold">{config.freeMasteringQuota} Tracks / Mo</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={config.freeMasteringQuota}
                    onChange={(e) => setConfig({ ...config, freeMasteringQuota: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Platform Maintenance Mode</span>
                    <span className="text-[11px] text-slate-400">Pauses high-load DSP rendering for backend maintenance</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.maintenanceMode}
                    onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer mt-4"
                >
                  Save Platform Quota Rules
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
