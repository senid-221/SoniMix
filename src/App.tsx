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
import { AudioTrack, ExportHistoryItem } from './types/audio';
import { AppConfig, UserProfile, DirectoryUser } from './types/dashboard';
import { computeWaveformPeaks } from './utils/audioBufferUtils';
import { addExportHistoryItem, getExportHistory } from './utils/projectStore';
import {
  getAppConfig,
  saveAppConfig,
  getUserProfile,
  saveUserProfile,
  getDirectoryUsers,
  saveDirectoryUsers,
  DEFAULT_USER_PROFILE,
} from './utils/appConfigStore';
import {
  AuthUser,
  getStoredAuthUser,
  setStoredAuthUser,
  getIsAdminAuthenticated,
  setAdminAuthenticated,
  authUserToProfile,
} from './utils/authStore';

export default function App() {
  // Determine initial tab from URL (/admin/login or /admin)
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/admin/login' || path === '/admin' || hash === '#/admin/login' || hash === '#/admin') {
      return getIsAdminAuthenticated() ? 'admin-dashboard' : 'admin-login';
    }
    return 'landing';
  });

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [masterMixBuffer, setMasterMixBuffer] = useState<AudioBuffer | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);

  // User and Admin Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // App Configuration, User Profile, and User Directory State
  const [appConfig, setAppConfig] = useState<AppConfig>(() => getAppConfig());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const storedAuth = getStoredAuthUser();
    if (storedAuth) {
      return authUserToProfile(storedAuth);
    }
    return getUserProfile();
  });
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>(() => getDirectoryUsers());

  // Listen for browser URL changes (e.g. user types /admin/login or clicks back)
  useEffect(() => {
    const handleUrlRouting = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin/login' || path === '/admin' || hash === '#/admin/login' || hash === '#/admin') {
        if (getIsAdminAuthenticated()) {
          setCurrentTab('admin-dashboard');
        } else {
          setCurrentTab('admin-login');
        }
      }
    };

    window.addEventListener('popstate', handleUrlRouting);
    window.addEventListener('hashchange', handleUrlRouting);
    return () => {
      window.removeEventListener('popstate', handleUrlRouting);
      window.removeEventListener('hashchange', handleUrlRouting);
    };
  }, []);

  // Load existing export history from localStorage
  useEffect(() => {
    setExportHistory(getExportHistory());
  }, []);

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
      saveAppConfig(updated);
      return updated;
    });
  };

  const handleUpdateUserProfile: React.Dispatch<React.SetStateAction<UserProfile>> = (action) => {
    setUserProfile((prev) => {
      const updated = typeof action === 'function' ? action(prev) : action;
      saveUserProfile(updated);
      return updated;
    });
  };

  const handleUpdateDirectoryUsers: React.Dispatch<React.SetStateAction<DirectoryUser[]>> = (action) => {
    setDirectoryUsers((prev) => {
      const updated = typeof action === 'function' ? action(prev) : action;
      saveDirectoryUsers(updated);
      return updated;
    });
  };

  // Tab Selection with Route Synchronization
  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'admin-dashboard') {
      if (getIsAdminAuthenticated()) {
        setCurrentTab('admin-dashboard');
        window.history.pushState(null, '', '/admin/login');
      } else {
        setCurrentTab('admin-login');
        window.history.pushState(null, '', '/admin/login');
      }
      return;
    }

    setCurrentTab(tab);
    if (window.location.pathname.startsWith('/admin')) {
      window.history.pushState(null, '', '/');
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    const profile = authUserToProfile(user);
    setUserProfile(profile);
    saveUserProfile(profile);
    setDirectoryUsers(getDirectoryUsers());
  };

  const handleLogout = () => {
    setStoredAuthUser(null);
    setCurrentUser(null);
    setUserProfile(DEFAULT_USER_PROFILE);
    saveUserProfile(DEFAULT_USER_PROFILE);
    if (currentTab === 'user-dashboard') {
      setCurrentTab('landing');
    }
  };

  const handleAdminLoginSuccess = () => {
    setAdminAuthenticated(true);
    setCurrentTab('admin-dashboard');
    window.history.pushState(null, '', '/admin/login');
  };

  const handleExitAdmin = () => {
    setAdminAuthenticated(false);
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

  const handleAddExport = (title: string, blob: Blob, format: string) => {
    const item: ExportHistoryItem = {
      id: `export-${Date.now()}`,
      title,
      type: title.includes('Master') ? 'master' : title.includes('Stem') ? 'stem' : 'mix',
      format,
      fileSize: `${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
      timestamp: Date.now(),
      downloadUrl: URL.createObjectURL(blob),
      blob,
    };
    addExportHistoryItem(item);
    setExportHistory((prev) => [item, ...prev]);

    // Update user profile stats
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        totalBounces: prev.totalBounces + 1,
        storageUsedMb: Math.min(
          prev.storageLimitMb,
          prev.storageUsedMb + Math.round(blob.size / (1024 * 1024))
        ),
      };
      saveUserProfile(updated);
      return updated;
    });
  };

  // Dedicated Admin Login Page at /admin/login
  if (currentTab === 'admin-login') {
    return (
      <AdminLoginPage
        onLoginSuccess={handleAdminLoginSuccess}
        onReturnHome={() => handleSelectTab('landing')}
        customLogoUrl={appConfig.customLogoUrl}
        brandName={appConfig.brandName}
      />
    );
  }

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

        {currentTab === 'pricing' && (
          <LandingPage
            onSelectTab={handleSelectTab}
            onFileUpload={handleFileUpload}
            appConfig={appConfig}
          />
        )}
      </main>

      {/* Google and Email Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
