import { AppConfig, UserProfile, DirectoryUser } from '../types/dashboard';

const STORAGE_KEY_CONFIG = 'sonimix_app_config_v1';
const STORAGE_KEY_USER_PROFILE = 'sonimix_user_profile_v1';
const STORAGE_KEY_DIRECTORY = 'sonimix_user_directory_v1';

export const DEFAULT_APP_CONFIG: AppConfig = {
  customLogoUrl: null,
  customFaviconUrl: null,
  brandName: 'SoniMix',
  pageTitle: 'SoniMix — AI Music Production & Audio Processing Studio',
  heroHeadline: 'Your sound. Your vision. One studio.',
  heroSubtitle:
    'The all-in-one browser production suite for independent artists and producers. Real-time multitrack mixing, industry release mastering, source stem separation, 3000px album cover design, and true PCM audio resampling.',
  sectionTitles: {
    studiosHeadline: 'Engineered for real audio workflows. Not mockups.',
    studiosSubtitle:
      'Every studio module features actual Web Audio API signal processing, offline DSP rendering, and accurate technical exports.',
    pricingHeadline: 'Clear quotas. Zero hidden charges.',
    pricingSubtitle: 'Pick the right tier for your release schedule. No surprise bills.',
    faqHeadline: 'Frequently Asked Questions',
  },
  studioTitles: {
    mixer: 'AI Multitrack Mixing Studio',
    mastering: 'AI Mastering Console',
    stems: 'Stem Separation Splitter',
    cover: 'Cover Creator Studio',
    resampler: 'Audio Resampler Engine',
  },
  customIcons: {},
  maxUploadSizeMb: 200,
  freeMasteringQuota: 3,
  maintenanceMode: false,
  announcementText: '🚀 SoniMix v2.4 Release: True 24-bit PCM Mastering & Real-time DSP is now live!',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr-producer',
  name: 'Artist Producer',
  email: 'artist@sonimix.audio',
  role: 'producer',
  plan: 'Pro',
  storageUsedMb: 0,
  storageLimitMb: 2048,
  totalBounces: 0,
  totalProjects: 0,
  joinedDate: 'Current Session',
  preferences: {
    defaultSampleRate: 48000,
    defaultTargetLufs: -14,
    defaultBitDepth: 24,
    autoSaveEnabled: true,
  },
};

export const INITIAL_DIRECTORY_USERS: DirectoryUser[] = [];

export function getAppConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_APP_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APP_CONFIG,
      ...parsed,
      studioTitles: {
        ...DEFAULT_APP_CONFIG.studioTitles,
        ...(parsed.studioTitles || {}),
      },
      sectionTitles: {
        ...DEFAULT_APP_CONFIG.sectionTitles,
        ...(parsed.sectionTitles || {}),
      },
    };
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export function saveAppConfig(config: AppConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILE);
    if (!raw) return DEFAULT_USER_PROFILE;
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function getDirectoryUsers(): DirectoryUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIRECTORY);
    if (!raw) return INITIAL_DIRECTORY_USERS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_DIRECTORY_USERS;
  }
}

export function saveDirectoryUsers(users: DirectoryUser[]) {
  try {
    localStorage.setItem(STORAGE_KEY_DIRECTORY, JSON.stringify(users));
  } catch {
    // ignore
  }
}
