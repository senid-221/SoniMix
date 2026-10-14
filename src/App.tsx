import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/layout/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { MixingStudio } from './components/mixer/MixingStudio';
import { MasteringStudio } from './components/mastering/MasteringStudio';
import { StemSplitterStudio } from './components/stems/StemSplitterStudio';
import { CoverCreatorStudio } from './components/cover-creator/CoverCreatorStudio';
import { ResamplerStudio } from './components/resampler/ResamplerStudio';
import { ProjectsDashboard } from './components/projects/ProjectsDashboard';
import { UserDashboard } from './components/dashboard/UserDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { AdminLoginPage } from './components/auth/AdminLoginPage';
import { AuthModal } from './components/auth/AuthModal';
import { MusicGenerationStudio } from './components/providers/MusicGenerationStudio';
import { AudioTrack, ExportHistoryItem } from './types/audio';
import { AppConfig, UserProfile, DirectoryUser } from './types/dashboard';
import { computeWaveformPeaks } from './utils/audioBufferUtils';
import { apiRequest, saveExport } from './utils/apiClient';
import { DEFAULT_APP_CONFIG, DEFAULT_USER_PROFILE } from './utils/appConfigStore';
import {
  AuthUser,
  authUserToProfile,
} from './utils/authStore';
import { audioEngine } from './audio/audioEngine';

export default function App() {
  // Keep the active workspace aligned with the URL so refresh and browser navigation restore it.
  const getTabFromLocation = (): NavTab => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const hash = window.location.hash;
    const route = hash.startsWith('#/') ? hash.slice(1).replace(/\/+$/, '') || '/' : path;
    const routes: Record<string, NavTab> = {
      '/': 'landing',
      '/mixer': 'mixer',
      '/mastering': 'mastering',
      '/stems': 'stems',
      '/cover': 'cover',
      '/resampler': 'resampler',
      '/projects': 'projects',
      '/voice': 'voice',
      '/music': 'music',
      '/dashboard': 'user-dashboard',
      '/admin': 'admin-login',
      '/admin/login': 'admin-login',
    };
    return routes[route] || 'landing';
  };

  const getPathForTab = (tab: NavTab): string => ({
    landing: '/',
    mixer: '/mixer',
    mastering: '/mastering',
    stems: '/stems',
    cover: '/cover',
    resampler: '/resampler',
    projects: '/projects',
    voice: '/voice',
    music: '/music',
    'user-dashboard': '/dashboard',
    'admin-dashboard': '/admin',
    'admin-login': '/admin',
  })[tab];

  const [currentTab, setCurrentTab] = useState<NavTab>(() => getTabFromLocation());

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [masterMixBuffer, setMasterMixBuffer] = useState<AudioBuffer | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);

  // User and Admin Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);

  // App Configuration, User Profile, and User Directory State
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    const getMediaElements = () => document.querySelectorAll<HTMLMediaElement>('audio, video');
    const pauseCompetingPlayers = (event: Event) => {
      const activeMedia = event.target instanceof HTMLMediaElement ? event.target : null;
      getMediaElements().forEach((media) => { if (media !== activeMedia) media.pause(); });
      audioEngine.pause();
    };
    const pauseMediaForMixer = () => getMediaElements().forEach((media) => media.pause());
    document.addEventListener('play', pauseCompetingPlayers, true);
    window.addEventListener('sonimix:audio-engine-play', pauseMediaForMixer);
    return () => {
      document.removeEventListener('play', pauseCompetingPlayers, true);
      window.removeEventListener('sonimix:audio-engine-play', pauseMediaForMixer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/session', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Session lookup failed')))
      .then((payload) => {
        if (!mounted) return;
        const user = payload.user as AuthUser | null;
        setCurrentUser(user);
        if (user) setUserProfile(authUserToProfile(user));
        if (user) apiRequest<{ profile: Record<string, unknown> }>('/api/profile').then(({ profile }) => setUserProfile((previous) => ({ ...previous, totalBounces: Number(profile.exportCount || 0), totalProjects: Number(profile.projectCount || 0), storageUsedMb: Number(profile.storageBytes || 0) / 1048576, preferences: { ...previous.preferences, ...(profile.preferences as UserProfile['preferences'] || {}) } }))).catch(() => undefined);
        if ((window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#/admin')) && user?.role !== 'admin') {
          setCurrentTab('admin-login');
        } else if ((window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#/admin')) && user?.role === 'admin') {
          setCurrentTab('admin-dashboard');
        }
      })
      .catch(() => { if (mounted) setCurrentUser(null); })
      .finally(() => { if (mounted) setIsSessionLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    apiRequest<{ config: AppConfig }>('/api/app-config')
      .then(({ config }) => setAppConfig({
        ...DEFAULT_APP_CONFIG,
        ...config,
        sectionTitles: { ...DEFAULT_APP_CONFIG.sectionTitles, ...(config?.sectionTitles || {}) },
        studioTitles: { ...DEFAULT_APP_CONFIG.studioTitles, ...(config?.studioTitles || {}) },
        customIcons: { ...DEFAULT_APP_CONFIG.customIcons, ...(config?.customIcons || {}) },
        audioPlugins: Array.isArray(config?.audioPlugins) ? config.audioPlugins : DEFAULT_APP_CONFIG.audioPlugins,
        audioEffects: Array.isArray(config?.audioEffects) ? config.audioEffects : DEFAULT_APP_CONFIG.audioEffects,
      }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin') { setDirectoryUsers([]); return; }
    fetch('/api/admin/overview', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Admin data unavailable')))
      .then((payload) => setDirectoryUsers((payload.users || []).map((user: Record<string, unknown>) => ({
        id: String(user.id), name: String(user.name), email: String(user.email), role: String(user.role), plan: 'Account',
        joinedDate: new Date(Number(user.createdAt)).toLocaleDateString(), storageUsedMb: Number(user.storageBytes || 0) / 1048576,
        bouncesCount: Number(user.exports || 0), status: user.status === 'suspended' ? 'suspended' : 'active', lastActive: user.lastSeen ? new Date(Number(user.lastSeen)).toLocaleString() : 'No session',
      })) as DirectoryUser[]))
      .catch(() => setDirectoryUsers([]));
  }, [currentUser]);

  // Restore the matching workspace on direct navigation, refresh, and browser Back/Forward.
  useEffect(() => {
    const handleUrlRouting = () => {
      const tabFromUrl = getTabFromLocation();
      if (tabFromUrl === 'admin-login' || window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#/admin')) {
        setCurrentTab(currentUser?.role === 'admin' ? 'admin-dashboard' : 'admin-login');
        return;
      }
      setCurrentTab(tabFromUrl);
    };

    window.addEventListener('popstate', handleUrlRouting);
    window.addEventListener('hashchange', handleUrlRouting);
    return () => {
      window.removeEventListener('popstate', handleUrlRouting);
      window.removeEventListener('hashchange', handleUrlRouting);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) { setExportHistory([]); return; }
    apiRequest<{ exports: Array<{ id: string; title: string; format: string; fileSize: number; timestamp: number; filePath: string }> }>('/api/exports')
      .then(({ exports }) => setExportHistory(exports.map((item) => ({
        id: item.id, title: item.title,
        type: item.title.toLowerCase().includes('cover') || item.format.toLowerCase().includes('artwork') ? 'cover' : item.title.toLowerCase().includes('stem') ? 'stem' : item.title.toLowerCase().includes('master') ? 'master' : 'mix',
        format: item.format, fileSize: `${(item.fileSize / 1048576).toFixed(1)} MB`, timestamp: item.timestamp, downloadUrl: `/api/files/${item.filePath}`,
      })) as ExportHistoryItem[]))
      .catch((error) => setOperationError(error instanceof Error ? error.message : 'Exports could not be loaded.'));
  }, [currentUser]);

  // Dynamically update document title and favicon when appConfig changes
  useEffect(() => {
    if (appConfig.pageTitle) {
      document.title = appConfig.pageTitle;
    }
    if (appConfig.customFaviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = appConfig.customFaviconUrl;
    }
  }, [appConfig.pageTitle, appConfig.customFaviconUrl]);

  // Sync state changes with persistence
  const handleUpdateAppConfig: React.Dispatch<React.SetStateAction<AppConfig>> = (action) => {
    setAppConfig((prev) => {
      const updated = typeof action === 'function' ? action(prev) : action;
      void apiRequest('/api/admin/app-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        .catch((error) => setOperationError(error instanceof Error ? error.message : 'Settings could not be saved.'));
      return updated;
    });
  };

  const handleUpdateUserProfile: React.Dispatch<React.SetStateAction<UserProfile>> = (action) => {
    setUserProfile((prev) => {
      const updated = typeof action === 'function' ? action(prev) : action;
      void apiRequest('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: updated.preferences }) })
        .catch((error) => setOperationError(error instanceof Error ? error.message : 'Preferences could not be saved.'));
      return updated;
    });
  };

  const handleUpdateDirectoryUsers: React.Dispatch<React.SetStateAction<DirectoryUser[]>> = (action) => {
    setDirectoryUsers((previous) => {
      const updated = typeof action === 'function' ? action(previous) : action;
      const changed = updated.find((user) => {
        const before = previous.find((candidate) => candidate.id === user.id);
        return before && (before.status !== user.status || before.role !== user.role);
      });
      if (changed) {
        void apiRequest('/api/admin/users/' + encodeURIComponent(changed.id), {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: changed.status, role: changed.role }),
        }).catch((error) => setOperationError(error instanceof Error ? error.message : 'Account update failed.'));
      }
      return updated;
    });
  };

  // Tab Selection with Route Synchronization
  const handleSelectTab = (tab: NavTab) => {
    const protectedTabs: NavTab[] = ['mixer', 'mastering', 'stems', 'cover', 'resampler', 'projects', 'user-dashboard', 'voice', 'music'];
    if (protectedTabs.includes(tab) && !currentUser) { setIsAuthModalOpen(true); return; }

    if (tab === 'admin-dashboard' || tab === 'admin-login') {
      const adminTab = currentUser?.role === 'admin' ? 'admin-dashboard' : 'admin-login';
      setCurrentTab(adminTab);
      window.history.pushState(null, '', '/admin');
      return;
    }

    setCurrentTab(tab);
    const nextPath = getPathForTab(tab);
    if (window.location.pathname !== nextPath || window.location.hash) {
      window.history.pushState(null, '', nextPath);
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    const profile = authUserToProfile(user);
    setUserProfile(profile);
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); }
    catch { setOperationError('The session could not be cleared. Please reload and sign in again.'); }
    setCurrentUser(null);
    setUserProfile(DEFAULT_USER_PROFILE);
    if (currentTab !== 'landing') {
      setCurrentTab('landing');
      window.history.pushState(null, '', '/');
    }
  };

  const handleAdminLoginSuccess = async () => {
    const response = await fetch('/api/auth/session', { credentials: 'include' });
    const payload = await response.json();
    if (!response.ok || payload.user?.role !== 'admin') throw new Error('Administrator session was not established.');
    setCurrentUser(payload.user);
    setUserProfile(authUserToProfile(payload.user));
    setCurrentTab('admin-dashboard');
    window.history.pushState(null, '', '/admin');
  };

  const handleExitAdmin = () => {
    setCurrentTab('landing');
    window.history.pushState(null, '', '/');
  };

  // User uploaded audio file from landing dropzone or header
  const handleFileUpload = async (file: File) => {
    try {
      const arr = await file.arrayBuffer();
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const decoded = await ctx.decodeAudioData(arr);

      const peaks = computeWaveformPeaks(decoded);
      const newTrack: AudioTrack = {
        id: `track-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'master',
        color: '#3b82f6',
        buffer: decoded,
        duration: decoded.duration,
        volume: 1.0,
        pan: 0,
        mute: false,
        solo: false,
        peaks,
        effects: {
          eqLow: 0,
          eqMid: 0,
          eqHigh: 0,
          hpf: 20,
          lpf: 20000,
          compThreshold: -24,
          compRatio: 3,
          compAttack: 0.01,
          compRelease: 0.1,
          reverbWet: 0,
          delayWet: 0,
          delayTime: 0.25,
          saturation: 0,
        },
      };

      setTracks([newTrack]);
      setMasterMixBuffer(decoded);
      setCurrentTab('mixer');
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const handleSendStemsToMixer = (separatedStems: AudioTrack[]) => {
    setTracks(separatedStems);
    setCurrentTab('mixer');
  };

  const handleMasteringRequest = (mixBuffer: AudioBuffer) => {
    setMasterMixBuffer(mixBuffer);
    setCurrentTab('mastering');
  };

  const handleAddExport = async (title: string, blob: Blob, format: string) => {
    try {
      const saved = await saveExport(blob, title, format);
      const item: ExportHistoryItem = {
        id: saved.id, title, type: title.toLowerCase().includes('cover') ? 'cover' : title.toLowerCase().includes('stem') ? 'stem' : title.toLowerCase().includes('master') ? 'master' : 'mix',
        format, fileSize: `${(blob.size / 1048576).toFixed(1)} MB`, timestamp: Date.now(), downloadUrl: saved.downloadUrl,
      };
      setExportHistory((previous) => [item, ...previous]);
      setUserProfile((previous) => ({ ...previous, totalBounces: previous.totalBounces + 1 }));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Export could not be saved.');
      throw error;
    }
  };

  // Dedicated Admin Login Page at /admin/login
  if (currentTab === 'admin-login' && !isSessionLoading) {
    return (
      <AdminLoginPage
        onLoginSuccess={handleAdminLoginSuccess}
        onReturnHome={() => handleSelectTab('landing')}
        customLogoUrl={appConfig.customLogoUrl}
        brandName={appConfig.brandName}
      />
    );
  }

  if (isSessionLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600" aria-live="polite">Loading your secure workspace…</div>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        hasTracks={tracks.length > 0}
        customLogoUrl={appConfig.customLogoUrl}
        customIcons={appConfig.customIcons}
        brandName={appConfig.brandName}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col">
        {currentTab === 'landing' && (
          <LandingPage
            onSelectTab={handleSelectTab}
            onFileUpload={handleFileUpload}
            appConfig={appConfig}
          />
        )}

        {currentTab === 'mixer' && (
          <MixingStudio
            tracks={tracks}
            setTracks={setTracks}
            onMasteringRequest={handleMasteringRequest}
            onAddExport={handleAddExport}
          />
        )}

        {currentTab === 'mastering' && (
          <MasteringStudio
            inputBuffer={masterMixBuffer}
            onAddExport={handleAddExport}
          />
        )}

        {currentTab === 'stems' && (
          <StemSplitterStudio
            initialBuffer={masterMixBuffer}
            onSendToMixer={handleSendStemsToMixer}
            onAddExport={handleAddExport}
          />
        )}

        {currentTab === 'cover' && (
          <CoverCreatorStudio
            studioTitle={appConfig.studioTitles.cover}
            onAddExport={handleAddExport}
          />
        )}

        {currentTab === 'voice' && <MusicGenerationStudio onSaved={handleAddExport} />}
        {currentTab === 'music' && <MusicGenerationStudio onSaved={handleAddExport} />}

        {currentTab === 'resampler' && (
          <ResamplerStudio
            inputBuffer={masterMixBuffer}
            onAddExport={handleAddExport}
          />
        )}

        {currentTab === 'projects' && (
          <ProjectsDashboard
            exportHistory={exportHistory}
            onOpenMixer={() => handleSelectTab('mixer')}
            onOpenMastering={() => handleSelectTab('mastering')}
            onOpenStems={() => handleSelectTab('stems')}
            onOpenCover={() => handleSelectTab('cover')}
          />
        )}

        {currentTab === 'user-dashboard' && (
          <UserDashboard
            userProfile={userProfile}
            setUserProfile={handleUpdateUserProfile}
            onNavigateTab={handleSelectTab}
          />
        )}

        {currentTab === 'admin-dashboard' && (
          <AdminDashboard
            appConfig={appConfig}
            setAppConfig={handleUpdateAppConfig}
            directoryUsers={directoryUsers}
            setDirectoryUsers={handleUpdateDirectoryUsers}
            onExitAdmin={handleExitAdmin}
          />
        )}

      </main>

      {operationError && <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-md rounded-xl bg-rose-700 px-4 py-3 text-sm text-white shadow-xl">{operationError}<button className="ml-3 underline" onClick={() => setOperationError(null)}>Dismiss</button></div>}
      {/* Email authentication modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
