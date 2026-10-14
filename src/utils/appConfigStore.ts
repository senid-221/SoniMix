import { AppConfig, UserProfile, DirectoryUser } from '../types/dashboard';

export const DEFAULT_APP_CONFIG: AppConfig = {
  customLogoUrl: null,
  customFaviconUrl: null,
  brandName: 'SoniMix',
  pageTitle: 'SoniMix — AI Music Production & Audio Processing Studio',
  heroHeadline: 'Your sound. Your vision. One studio.',
  heroSubtitle: 'A focused workspace for shaping audio, creating artwork, and managing your production projects.',
  sectionTitles: {
    studiosHeadline: 'A connected workspace for your audio projects.',
    studiosSubtitle: 'Use browser-based mixing and artwork tools alongside server processing when configured.',
    pricingHeadline: 'Production tools, in one workspace.',
    pricingSubtitle: 'Provider access and processing availability depend on server configuration.',
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
  announcementText: '',
  audioPlugins: [],
  audioEffects: [
    { id: 'eq', name: 'Equalizer (EQ)', description: 'Tone shaping; requires a compatible processing workflow.', enabled: true, amount: 50 },
    { id: 'compressor', name: 'Compressor', description: 'Dynamic control; requires a compatible processing workflow.', enabled: true, amount: 35 },
    { id: 'limiter', name: 'Limiter', description: 'Peak control; requires a compatible processing workflow.', enabled: true, amount: 25 },
    { id: 'reverb', name: 'Reverb', description: 'Room ambience; requires a compatible processing workflow.', enabled: false, amount: 20 },
    { id: 'delay', name: 'Delay', description: 'Echo effect; requires a compatible processing workflow.', enabled: false, amount: 20 },
    { id: 'noise-reduction', name: 'Noise Reduction', description: 'Noise suppression; requires a compatible processing engine.', enabled: false, amount: 40 },
  ],
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'user',
  plan: 'Account',
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
    return DEFAULT_APP_CONFIG;
  } catch { return DEFAULT_APP_CONFIG; }
}

export function saveAppConfig(config: AppConfig) {
  void config;
}

export function getUserProfile(): UserProfile {
  return DEFAULT_USER_PROFILE;
}

export function saveUserProfile(profile: UserProfile) {
  void profile;
}

export function getDirectoryUsers(): DirectoryUser[] {
  return INITIAL_DIRECTORY_USERS;
}

export function saveDirectoryUsers(users: DirectoryUser[]) {
  void users;
}
